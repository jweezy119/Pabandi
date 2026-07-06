// Using standard Web Crypto API to match BusinessDashboard's RSA-OAEP decryption
export const generateRsaKeyPair = async (): Promise<{ publicKey: string, privateKey: string }> => {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  const exportedPublicKey = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
  const exportedPrivateKey = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

  const exportBufferToPem = (buffer: ArrayBuffer, type: string) => {
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const pem = base64.match(/.{1,64}/g)?.join('\n');
    return `-----BEGIN ${type}-----\n${pem}\n-----END ${type}-----`;
  };

  return {
    publicKey: exportBufferToPem(exportedPublicKey, "PUBLIC KEY"),
    privateKey: exportBufferToPem(exportedPrivateKey, "PRIVATE KEY")
  };
};

export const encryptRsa = async (text: string, pemPublicKey: string): Promise<string> => {
  const base64 = pemPublicKey.replace(/(-----(BEGIN|END) PUBLIC KEY-----|\n|\r)/g, '');
  const binaryDerString = atob(base64);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  const pubKey = await window.crypto.subtle.importKey(
    "spki",
    binaryDer.buffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );

  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    pubKey,
    data
  );

  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
};

