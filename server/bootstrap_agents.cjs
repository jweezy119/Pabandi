const { Keypair, Connection, Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getAccount, createAssociatedTokenAccountInstruction, createTransferInstruction } = require('@solana/spl-token');
const bs58 = require('bs58');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const nt = JSON.parse(fs.readFileSync('/home/peesee/.new_treasury.json', 'utf8'));
const kp = Keypair.fromSecretKey(bs58.default.decode(nt.secret_b58));
const TREAS = kp.publicKey;
const MINT = new PublicKey(process.env.SOLANA_PAB_MINT_ADDRESS || '4MLskKmcnz8bVaPfEuVbhZGsbeUMZqKjQYQQDEX6WQcQ');
const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
const TOKEN_DECIMALS = 9;
const PAB_PER_AGENT = 100;
const SOL_PER_AGENT = 0.001;

async function main() {
  const prisma = new PrismaClient();
  const agents = await prisma.web3Agent.findMany({ where: { isActive: true } });
  console.log('agents found:', agents.length);
  let ataCreated = 0, pabSent = 0, solSent = 0, skipped = 0;

  for (const a of agents) {
    try {
      const agentPub = new PublicKey(a.walletAddress);
      const ata = await getAssociatedTokenAddress(MINT, agentPub);
      // 1) ATA
      try { await getAccount(connection, ata); }
      catch {
        const tx = new Transaction().add(createAssociatedTokenAccountInstruction(TREAS, ata, agentPub, MINT, TOKEN_PROGRAM_ID));
        await sendAndConfirm(connection, tx, [kp]);
        ataCreated++;
      }
      // 2) PAB
      const treasAta = await getAssociatedTokenAddress(MINT, TREAS);
      const tx2 = new Transaction().add(createTransferInstruction(treasAta, ata, TREAS, BigInt(PAB_PER_AGENT) * 10n ** BigInt(TOKEN_DECIMALS)));
      await sendAndConfirm(connection, tx2, [kp]);
      pabSent++;
      // 3) small SOL for gas
      const ab = await connection.getBalance(agentPub);
      if (ab < SOL_PER_AGENT * LAMPORTS_PER_SOL) {
        const need = Math.floor(SOL_PER_AGENT * LAMPORTS_PER_SOL) - ab;
        const tx3 = new Transaction().add(SystemProgram.transfer({ fromPubkey: TREAS, toPubkey: agentPub, lamports: need }));
        await sendAndConfirm(connection, tx3, [kp]);
        solSent++;
      }
    } catch (e) { console.log('skip', a.profileId, e.message.slice(0, 60)); skipped++; }
  }
  await prisma.$disconnect();
  console.log(JSON.stringify({ ataCreated, pabSent, solSent, skipped, agents: agents.length }));
}
async function sendAndConfirm(conn, tx, signers) {
  const { blockhash } = await conn.getLatestBlockhash();
  tx.recentBlockhash = blockhash; tx.feePayer = kp.publicKey;
  tx.sign(...signers);
  const sig = await conn.sendRawTransaction(tx.serialize());
  await conn.confirmTransaction(sig, 'confirmed');
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
