export class CryptoService {
  // --- AES-GCM (Message Encryption) ---
  
  private static async getRawKey(secret: string | CryptoKey): Promise<CryptoKey> {
    if (typeof secret !== 'string') return secret;
    const enc = new TextEncoder();
    return await window.crypto.subtle.importKey(
      "raw",
      enc.encode(secret.padEnd(32, '0').slice(0, 32)),
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );
  }

  static async encrypt(text: string, secret: string | CryptoKey = 'default_secret'): Promise<string> {
    const key = await this.getRawKey(secret);
    const enc = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      enc.encode(text)
    );
    const buffer = new Uint8Array(encrypted);
    const combined = new Uint8Array(iv.length + buffer.length);
    combined.set(iv);
    combined.set(buffer, iv.length);
    return btoa(String.fromCharCode.apply(null, Array.from(combined)));
  }

  static async decrypt(ciphertext: string, secret: string | CryptoKey = 'default_secret'): Promise<string> {
    try {
      const key = await this.getRawKey(secret);
      const combined = new Uint8Array(atob(ciphertext).split('').map(c => c.charCodeAt(0)));
      const iv = combined.slice(0, 12);
      const data = combined.slice(12);
      const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
      return new TextDecoder().decode(decrypted);
    } catch (e) {
      console.warn("Decryption failed", e);
      return "[Encrypted Message]";
    }
  }

  // --- ECDH (Key Exchange) ---

  static async generateKeyPair(): Promise<CryptoKeyPair> {
    return await window.crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveKey"]
    );
  }

  static async exportPublicKey(key: CryptoKey): Promise<string> {
    const exported = await window.crypto.subtle.exportKey("spki", key);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
  }

  static async importPublicKey(base64: string): Promise<CryptoKey> {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return await window.crypto.subtle.importKey(
      "spki",
      bytes,
      { name: "ECDH", namedCurve: "P-256" },
      true,
      []
    );
  }

  static async deriveSharedSecret(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
    return await window.crypto.subtle.deriveKey(
      { name: "ECDH", public: publicKey },
      privateKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  // --- Persistent Identity (IndexedDB) ---
  
  static async saveIdentity(keyPair: CryptoKeyPair): Promise<void> {
    const db = await this.openDB();
    const tx = db.transaction("identity", "readwrite");
    tx.objectStore("identity").put(keyPair.privateKey, "privateKey");
    tx.objectStore("identity").put(keyPair.publicKey, "publicKey");
  }

  static async getIdentity(): Promise<CryptoKeyPair | null> {
    try {
      const db = await this.openDB();
      const tx = db.transaction("identity", "readonly");
      const store = tx.objectStore("identity");
      const priv = await this.getRequest(store.get("privateKey"));
      const pub = await this.getRequest(store.get("publicKey"));
      if (!priv || !pub) return null;
      return { privateKey: priv, publicKey: pub };
    } catch { return null; }
  }

  private static openDB(): Promise<IDBDatabase> {
    return new Promise((res, rej) => {
      const req = indexedDB.open("crypto-store", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("identity");
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }

  private static getRequest(req: IDBRequest): Promise<any> {
    return new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }
}
