import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Generating initial IssuerKey for Verifiable Credentials...');
  
  // Generate ES256 (P-256) key pair, widely supported for JWT VCs
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: {
      type: 'spki',
      format: 'jwk',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  const kid = 'key-1';

  // Format public key to strictly follow JsonWebKey structure
  const publicKeyJwk = {
    kty: publicKey.kty,
    crv: publicKey.crv,
    x: publicKey.x,
    y: publicKey.y,
    kid: kid,
  };

  const keyRecord = await prisma.issuerKey.upsert({
    where: { kid },
    update: {},
    create: {
      kid,
      publicKeyJwk,
      privateKeyPem: privateKey,
      algorithm: 'ES256',
    },
  });

  console.log('IssuerKey generated and stored successfully!');
  console.log(`Key ID: ${keyRecord.kid}`);
  console.log(`Public Key JWK: ${JSON.stringify(keyRecord.publicKeyJwk)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
