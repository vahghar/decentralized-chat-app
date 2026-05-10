import { describe, it, expect } from 'vitest';
import { CryptoService } from './crypto';

// Polyfill window.crypto for Node.js environment via vitest/jsdom
// @ts-ignore
import { webcrypto } from 'crypto';
if (!window.crypto) {
  (window as any).crypto = webcrypto;
}

describe('CryptoService', () => {
  it('should encrypt and decrypt a message using a string secret', async () => {
    const secret = 'my_super_secret_room_key';
    const message = JSON.stringify({ text: 'Hello World', sender: 'Alice' });

    const encrypted = await CryptoService.encrypt(message, secret);
    expect(encrypted).not.toEqual(message);
    expect(encrypted).toBeTruthy();

    const decrypted = await CryptoService.decrypt(encrypted, secret);
    expect(decrypted).toEqual(message);
  });

  it('should fail to decrypt with the wrong string secret', async () => {
    const secret = 'correct_secret';
    const wrongSecret = 'wrong_secret';
    const message = 'Top secret data';

    const encrypted = await CryptoService.encrypt(message, secret);
    
    const decrypted = await CryptoService.decrypt(encrypted, wrongSecret);
    expect(decrypted).toEqual('[Encrypted Message]');
  });

  it('should complete a full ECDH key exchange and derive a shared secret', async () => {
    // 1. Alice generates keys
    const aliceKeys = await CryptoService.generateKeyPair();
    // 2. Bob generates keys
    const bobKeys = await CryptoService.generateKeyPair();

    // 3. Alice exports her public key and sends it to Bob
    const alicePublicRaw = await CryptoService.exportPublicKey(aliceKeys.publicKey);
    // 4. Bob exports his public key and sends it to Alice
    const bobPublicRaw = await CryptoService.exportPublicKey(bobKeys.publicKey);

    // 5. They both import the other's public key
    const importedAlicePublic = await CryptoService.importPublicKey(alicePublicRaw);
    const importedBobPublic = await CryptoService.importPublicKey(bobPublicRaw);

    // 6. They both derive the shared secret
    const aliceSharedSecret = await CryptoService.deriveSharedSecret(aliceKeys.privateKey, importedBobPublic);
    const bobSharedSecret = await CryptoService.deriveSharedSecret(bobKeys.privateKey, importedAlicePublic);

    // 7. Alice encrypts a message with her derived secret
    const message = 'Hello Bob, this is a secure P2P message.';
    const encryptedByAlice = await CryptoService.encrypt(message, aliceSharedSecret);

    // 8. Bob decrypts the message with his derived secret
    const decryptedByBob = await CryptoService.decrypt(encryptedByAlice, bobSharedSecret);

    // If ECDH works, Bob should see the exact message Alice sent
    expect(decryptedByBob).toEqual(message);
  });
});
