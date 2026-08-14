const { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction, SystemProgram } = require('@solana/web3.js');
const bs58 = (require('bs58').default || require('bs58'));
const ta = require('@solana/spl-token');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const MINT = 'Cc2nwBNc8Zo5e6QwmtV3JQfEi2gTfEYNrDGgxPmGaZLZ';
const TREASURY = '68AQPHecjT3Fjy1i6R7W2xpxajj2ZfDbHZvRmX2MwPKs';
const { decryptPrivateKey } = require('./dist/utils/crypto'); // may not exist; fallback below
const p = new PrismaClient();
const c = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
(async () => {
  // pick a prepared agent with 100 PAB
  const agent = await p.web3Agent.findFirst({ where: { isActive: true, prepared: true }, select: { profileId: true, walletAddress: true, encryptedPrivateKey: true } });
  console.log('agent:', agent.profileId.slice(0,8), agent.walletAddress.slice(0,12));
  // decrypt like the service does
  let priv;
  try { priv = decryptPrivateKey(agent.encryptedPrivateKey); console.log('decrypted via service fn'); }
  catch(e){ console.log('decrypt fn err:', e.message); }
  if (!priv) {
    // fallback: the agent was created from sha256 seed(profileId+firstName); we don't know firstName. Try env approach:
    console.log('no priv, cannot proceed locally');
    await p.$disconnect(); return;
  }
  const kp = Keypair.fromSecretKey(bs58.decode(priv));
  console.log('derived pubkey:', kp.publicKey.toBase58(), '| matches:', kp.publicKey.toBase58() === agent.walletAddress);
  const mintPk = new PublicKey(MINT);
  const senderAta = await ta.getAssociatedTokenAddress(mintPk, kp.publicKey);
  const treasuryPubkey = new PublicKey(TREASURY);
  const treasuryAta = await ta.getAssociatedTokenAddress(mintPk, treasuryPubkey);
  const feeLamports = 1 * 1e9; // 1 PAB fee
  const tx = new Transaction();
  tx.add(ta.createTransferInstruction(senderAta, treasuryAta, kp.publicKey, feeLamports));
  tx.feePayer = treasuryPubkey;
  try { const sig = await sendAndConfirmTransaction(c, tx, [kp, /* treasury */]); console.log('TX OK:', sig.slice(0,16)); }
  catch(e){ console.log('TX FAILED:', e.message.slice(0,300)); }
  await p.$disconnect();
})().catch(e => { console.log('ERR', e.message); p.$disconnect(); });
