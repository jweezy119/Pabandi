import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function rotateIssuerKey() {
  console.log('Initiating Pabandi Issuer Key Rotation...');

  // 1. Mark existing keys as inactive
  await prisma.issuerKey.updateMany({
    where: { isActive: true },
    data: { 
      isActive: false, 
      rotatedAt: new Date() 
    }
  });
  console.log('Previous active keys marked as inactive.');

  // 2. Generate new ES256 key pair
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256'
  });

  const kid = `key-${Date.now()}`;

  const privateKeyPem = privateKey.export({ type: 'sec1', format: 'pem' }).toString();
  
  // Create JWK
  const jwk = publicKey.export({ format: 'jwk' });
  const publicKeyJwk = {
    ...jwk,
    kid,
    alg: 'ES256',
    use: 'sig'
  };

  // 3. Save to database
  const newKey = await prisma.issuerKey.create({
    data: {
      kid,
      privateKeyPem,
      publicKeyJwk: publicKeyJwk as any,
      isActive: true,
      rotatedAt: new Date()
    }
  });

  console.log(`Successfully generated and activated new Issuer Key: ${newKey.kid}`);
  console.log('The DID Document will now reflect this key as the primary assertion method.');
}

rotateIssuerKey()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
