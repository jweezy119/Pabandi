// One-shot: rotate every active agent's keypair to a PROPER Ed25519 secret key (round-trips via fromSecretKey).
// Also change createAgent to use Keypair.generate() (fix below). Old agents encrypted with random-per-boot ENC_KEY are unrecoverable.
const { PrismaClient } = require('@prisma/client');
const { Keypair } = require('@solana/web3.js');
const bs58 = (require('bs58').default || require('bs58'));
const crypto = require('crypto');
const ALGORITHM = 'aes-256-gcm';
const ENC_KEY = process.env.WALLET_ENC_KEY;
function encryptPrivateKey(privateKey) {
  const iv = crypto.randomBytes(12);
  const key = Buffer.from(ENC_KEY, 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
}
const p = new PrismaClient();
(async () => {
  if (!ENC_KEY || Buffer.from(ENC_KEY, 'hex').length !== 32) { console.log('FATAL: WALLET_ENC_KEY not set/invalid'); await p.$disconnect(); process.exit(1); }
  const agents = await p.web3Agent.findMany({ where: { isActive: true }, select: { id: true, profileId: true } });
  console.log('rotating', agents.length, 'agents');
  for (const a of agents) {
    const keypair = Keypair.generate();            // proper Ed25519: secretKey round-trips via fromSecretKey
    const privateKey = bs58.encode(keypair.secretKey);
    const encryptedPrivateKey = encryptPrivateKey(privateKey);
    const walletAddress = keypair.publicKey.toBase58();
    await p.web3Agent.update({ where: { id: a.id }, data: { walletAddress, encryptedPrivateKey, prepared: false, balancePab: 0 } });
    console.log('  rotated', a.profileId.slice(0, 8), '->', walletAddress.slice(0, 8) + '...');
  }
  console.log('DONE.');
  await p.$disconnect();
})().catch(e => { console.log('ERR', e.message); p.$disconnect(); });
