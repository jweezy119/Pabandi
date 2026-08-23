const { Keypair, Connection, Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getAccount, createAssociatedTokenAccountInstruction, createTransferInstruction } = require('@solana/spl-token');
const bs58 = require('bs58');
const { PrismaClient } = require('@prisma/client');
const nt = JSON.parse(require('fs').readFileSync('/home/peesee/.new_treasury.json', 'utf8'));
const kp = Keypair.fromSecretKey(bs58.default.decode(nt.secret_b58));
const TREAS = kp.publicKey;
const MINT = new PublicKey(process.env.SOLANA_PAB_MINT_ADDRESS || '4MLskKmcnz8bVaPfEuVbhZGsbeUMZqKjQYQQDEX6WQcQ');
const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
const TOKEN_DECIMALS = 9, PAB = 100;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function rpc(fn, tries = 6) {
  for (let i = 0; i < tries; i++) { try { return await fn(); } catch (e) { if (/429|Too many|rate/i.test(e.message) && i < tries - 1) { await sleep(700 * (i + 1)); continue; } throw e; } }
}
async function send(tx, signers) {
  const { blockhash } = await rpc(() => connection.getLatestBlockhash()); tx.recentBlockhash = blockhash; tx.feePayer = kp.publicKey; tx.sign(...signers);
  const sig = await rpc(() => connection.sendRawTransaction(tx.serialize())); await rpc(() => connection.confirmTransaction(sig, 'confirmed')); return sig;
}
async function main() {
  const prisma = new PrismaClient();
  const agents = await prisma.web3Agent.findMany({ where: { isActive: true } });
  let funded = 0, ok = 0, errs = 0;
  for (const a of agents) {
    try {
      const pub = new PublicKey(a.walletAddress);
      const ata = await rpc(() => getAssociatedTokenAddress(MINT, pub));
      let have = 0; try { have = Number((await rpc(() => getAccount(connection, ata))).amount) / 1e9; } catch { have = 0; }
      if (have >= 100) { ok++; continue; }
      // create ATA if missing
      try { await rpc(() => getAccount(connection, ata)); } catch { await send(new Transaction().add(createAssociatedTokenAccountInstruction(TREAS, ata, pub, MINT, TOKEN_PROGRAM_ID)), [kp]); }
      const treasAta = await rpc(() => getAssociatedTokenAddress(MINT, TREAS));
      await send(new Transaction().add(createTransferInstruction(treasAta, ata, TREAS, BigInt(PAB) * 10n ** BigInt(TOKEN_DECIMALS))), [kp]);
      const ab = await rpc(() => connection.getBalance(pub));
      if (ab < 0.001 * LAMPORTS_PER_SOL) await send(new Transaction().add(SystemProgram.transfer({ fromPubkey: TREAS, toPubkey: pub, lamports: Math.floor(0.001 * LAMPORTS_PER_SOL) })), [kp]);
      funded++;
    } catch (e) { console.log('ERR', a.profileId, e.message.slice(0, 40)); errs++; }
    await sleep(1200); // space out RPC to avoid 429
  }
  await prisma.$disconnect();
  console.log(JSON.stringify({ newlyFunded: funded, alreadyOk: ok, errors: errs }));
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
