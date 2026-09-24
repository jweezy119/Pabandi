"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const crypto = __importStar(require("crypto"));
const prisma = new client_1.PrismaClient();
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
            publicKeyJwk: publicKeyJwk,
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
//# sourceMappingURL=rotate-keys.js.map