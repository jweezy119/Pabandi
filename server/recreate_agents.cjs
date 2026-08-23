const { Keypair, Connection, Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getAccount, createAssociatedTokenAccountInstruction, createTransferInstruction } = require('@solana/spl-token');
const bs58 = require('bs58');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const nt = JSON.parse(fs.readFileSync('/home/peesee/.new_treasury.json', 'utf8'));
const kp = Keypair.fromSecretKey(bs58.default.decode(nt.secret_b58));
const TREAS = kp.publicKey;
const WALLET_ENC_KEY = fs.readFileSync('/home/peesee/.new_wallet_enc.txt', 'utf8').trim();
const MINT = new PublicKey(process.env.SOLANA_PAB_MINT_ADDRESS || '4MLskKmcnz8bVaPfEuVbhZGsbeUMZqKjQYQQDEX6WQcQ');
const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
const TOKEN_DECIMALS = 9;
const PAB = 100;

function encrypt(privateKey) {
  const iv = crypto.randomBytes(12);
  const key = Buffer.from(WALLET_ENC_KEY, 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let enc = cipher.update(privateKey, 'utf8', 'hex'); enc += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + enc;
}
async function send(conn, tx, signers) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const { blockhash } = await conn.getLatestBlockhash(); tx.recentBlockhash = blockhash; tx.feePayer = kp.publicKey; tx.sign(...signers);
      const sig = await conn.sendRawTransaction(tx.serialize()); await conn.confirmTransaction(sig, 'confirmed'); return sig;
    } catch (e) {
      if (/429|rate|Too many/i.test(e.message) && attempt < 3) { await new Promise(r => setTimeout(r, 800 * (attempt + 1))); continue; }
      throw e;
    }
  }
}

function decrypt(encrypted) {
  try { const [ivHex, tagHex, encHex] = encrypted.split(':'); const iv = Buffer.from(ivHex, 'hex'); const tag = Buffer.from(tagHex, 'hex'); const key = Buffer.from(WALLET_ENC_KEY, 'hex'); const d = crypto.createDecipheriv('aes-256-gcm', key, iv); d.setAuthTag(tag); let o = d.update(encHex, 'hex', 'utf8'); o += d.final('utf8'); return o; } catch { return null; }
}
async function main() {
  const prisma = new PrismaClient();
  const agents = await prisma.web3Agent.findMany({ where: { isActive: true } });
  let done = 0, skip = 0, errs = 0;
  for (const a of agents) {
    // Skip agents already recreated (decryptable with current WALLET_ENC_KEY)
    if (decrypt(a.encryptedPrivateKey)) { skip++; continue; }
    try {
      const agentKp = Keypair.generate();
      const secret = bs58.default.encode(agentKp.secretKey);
      const enc = encrypt(secret);
      await prisma.web3Agent.update({ where: { id: a.id }, data: { walletAddress: agentKp.publicKey.toBase58(), encryptedPrivateKey: enc, balancePab: PAB, prepared: true } });
      // Fund new on-chain wallet: ATA + 100 PAB + 0.001 SOL
      const ata = await getAssociatedTokenAddress(MINT, agentKp.publicKey);
      try { await getAccount(connection, ata); } catch {
        await send(connection, new Transaction().add(createAssociatedTokenAccountInstruction(TREAS, ata, agentKp.publicKey, MINT, TOKEN_PROGRAM_ID)), [kp]);
      }
      const treasAta = await getAssociatedTokenAddress(MINT, TREAS);
      await send(connection, new Transaction().add(createTransferInstruction(treasAta, ata, TREAS, BigInt(PAB) * 10n ** BigInt(TOKEN_DECIMALS))), [kp]);
      const ab = await connection.getBalance(agentKp.publicKey);
      if (ab < 0.001 * LAMPORTS_PER_SOL) {
        await send(connection, new Transaction().add(SystemProgram.transfer({ fromPubkey: TREAS, toPubkey: agentKp.publicKey, lamports: Math.floor(0.001 * LAMPORTS_PER_SOL) })), [kp]);
      }
      done++;
    } catch (e) { console.log('ERR', a.profileId, e.message.slice(0, 50)); errs++; }
  }
  await prisma.$disconnect();
  console.log(JSON.stringify({ recreated: done, skipped: skip, errors: errs, total: agents.length }));
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
