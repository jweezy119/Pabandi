/**
 * FUND ONLY WHAT'S MISSING — idempotent, never overspends.
 * For each active agent whose on-chain ATA does NOT exist, create it (cost ~0.00203928 SOL).
 * Stops hard when treasury SOL would drop below SAFETY_FLOOR (0.002). Uses retry/backoff for
 * public-RPC 429s. PAB is already in treasury, so no PAB cost. Designed to run on exactly 0.08 SOL.
 */
const { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getAccount, createAssociatedTokenAccountInstruction } = require('@solana/spl-token');
const bs58 = require('bs58');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const decode = (k) => (bs58.default ? bs58.default.decode(k) : bs58.decode(k));
const nt = JSON.parse(fs.readFileSync('/home/peesee/.new_treasury.json', 'utf8'));
const treasury = Keypair.fromSecretKey(decode(nt.secret_b58));
const MINT = new PublicKey('4MLskKmcnz8bVaPfEuVbhZGsbeUMZqKjQYQQDEX6WQcQ');
const conn = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed');
const SAFETY_FLOOR = 0.002 * LAMPORTS_PER_SOL;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function send(tx, signers, tries = 6) {
  for (let i = 0; i < tries; i++) {
    try { const { blockhash } = await conn.getLatestBlockhash(); tx.recentBlockhash = blockhash; tx.feePayer = signers[0].publicKey; tx.sign(...signers); const sig = await conn.sendRawTransaction(tx.serialize()); await conn.confirmTransaction(sig, 'confirmed'); return sig; }
    catch (e) { if (/429|Too many|simulation|blockhash/i.test(e.message) && i < tries - 1) { await sleep(1200 * (i + 1)); continue; } throw e; }
  }
}

async function main() {
  const prisma = new PrismaClient();
  const agents = await prisma.web3Agent.findMany({ where: { isActive: true } });
  let created = 0, skipped = 0, spent = 0;
  for (const a of agents) {
    const bal = await conn.getBalance(treasury.publicKey);
    if (bal - 0.0021 * LAMPORTS_PER_SOL < SAFETY_FLOOR) { console.log(`STOP: treasury SOL ${(bal/LAMPORTS_PER_SOL).toFixed(5)} would drop below floor after next ATA`); break; }
    const ata = await getAssociatedTokenAddress(MINT, new PublicKey(a.walletAddress));
    let exists = true;
    try { await getAccount(conn, ata); } catch { exists = false; }
    if (exists) { skipped++; continue; }
    await send(new Transaction().add(createAssociatedTokenAccountInstruction(treasury.publicKey, ata, new PublicKey(a.walletAddress), MINT, TOKEN_PROGRAM_ID)), [treasury]);
    spent += 0.00203928; created++;
    if (created % 5 === 0) console.log(`  created ${created} ATAs, spent ~${spent.toFixed(4)} SOL`);
    await sleep(700); // ease RPC
  }
  const finalBal = await conn.getBalance(treasury.publicKey);
  console.log(JSON.stringify({ ataCreated: created, skipped, approxSolSpent: +spent.toFixed(5), treasurySolRemaining: +(finalBal/LAMPORTS_PER_SOL).toFixed(6) }));
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
