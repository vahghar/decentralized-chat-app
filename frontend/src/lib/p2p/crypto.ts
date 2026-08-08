import bs58 from 'bs58';

export interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeyBase58: string; // The user's ID
}

// Generate a new ECDSA keypair
export async function generateKeyPair(): Promise<KeyPair> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true, // extractable
    ["sign", "verify"]
  );

  const exportedPublicKey = await window.crypto.subtle.exportKey("raw", keyPair.publicKey);
  const publicKeyBase58 = bs58.encode(new Uint8Array(exportedPublicKey));

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    publicKeyBase58,
  };
}

// Sign data with private key
export async function signData(data: string, privateKey: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const signature = await window.crypto.subtle.sign(
    {
      name: "ECDSA",
      hash: { name: "SHA-256" },
    },
    privateKey,
    encoder.encode(data)
  );
  return bs58.encode(new Uint8Array(signature));
}

// Verify a signature
export async function verifySignature(
  data: string,
  signatureBase58: string,
  publicKeyBase58: string
): Promise<boolean> {
  try {
    const signature = bs58.decode(signatureBase58);
    const publicKeyRaw = bs58.decode(publicKeyBase58);

    const publicKey = await window.crypto.subtle.importKey(
      "raw",
      publicKeyRaw as any,
      {
        name: "ECDSA",
        namedCurve: "P-256",
      },
      true,
      ["verify"]
    );

    const encoder = new TextEncoder();
    return await window.crypto.subtle.verify(
      {
        name: "ECDSA",
        hash: { name: "SHA-256" },
      },
      publicKey,
      signature as any,
      encoder.encode(data)
    );
  } catch (error) {
    console.error("Signature verification failed:", error);
    return false;
  }
}

// Simple hash function for IDs
export async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(data));
  return bs58.encode(new Uint8Array(hashBuffer));
}
