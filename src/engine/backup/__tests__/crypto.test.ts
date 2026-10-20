/**
 * Backup Cryptography Tests
 *
 * Tests:
 * 1. Standards-compliant Base64 conversions
 * 2. Fresh random salt & IV generation
 * 3. Version 3 password-based key derivation (PBKDF2-HMAC-SHA256) + AES-256-GCM authenticated encryption
 * 4. AAD metadata integrity & tamper resistance
 * 5. Wrong password authentication rejection
 * 6. Ciphertext & tag tampering rejection
 * 7. Envelope structure & parameter bounds validation
 */

import {
  uint8ArrayToBase64,
  base64ToUint8Array,
  generateRandomSalt,
  generateRandomIV,
  deriveKeyFromPassword,
  encryptBackupV3,
  decryptBackupV3,
  validateEnvelopeV3,
  safeEqual,
} from '../crypto';
import { APP_ID, type PasswordEncryptedBackupEnvelope } from '../types';

describe('Backup Cryptography Engine (P0.1)', () => {
  jest.setTimeout(25000);
  const TEST_PASSWORD = 'CorrectHorseBatteryStaple#2026';
  const WRONG_PASSWORD = 'IncorrectPassword123!';
  const SAMPLE_METADATA = {
    app_id: APP_ID,
    app_version: '1.0.0',
    created_at: '2026-10-19T12:00:00.000Z',
  };
  const SAMPLE_PLAINTEXT = JSON.stringify({
    app_id: APP_ID,
    version: 3,
    data: {
      vehicles: [
        {
          id: 'v-test-1',
          nickname: 'Speedster',
          registration_number: 'DL01AB1234',
          fuel_type: 'petrol',
          vehicle_type: 'car',
          created_at: '2026-10-19T12:00:00.000Z',
          updated_at: '2026-10-19T12:00:00.000Z',
        },
      ],
      fuel_entries: [],
      service_records: [],
      expenses: [],
      documents: [],
    },
  });

  describe('Base64 & byte utilities', () => {
    it('round-trips Uint8Array through Base64 without data loss', () => {
      const original = new Uint8Array([0, 1, 2, 127, 128, 254, 255, 42, 99]);
      const base64 = uint8ArrayToBase64(original);
      const restored = base64ToUint8Array(base64);
      expect(restored).toEqual(original);
    });

    it('performs constant-time string comparison (safeEqual)', () => {
      expect(safeEqual('abc', 'abc')).toBe(true);
      expect(safeEqual('abc', 'abd')).toBe(false);
      expect(safeEqual('abc', 'ab')).toBe(false);
    });
  });

  describe('Randomness & Nonce/Salt Freshness', () => {
    it('generates 16-byte random salt and 12-byte random IV', () => {
      const salt = generateRandomSalt(16);
      const iv = generateRandomIV(12);
      expect(salt.length).toBe(16);
      expect(iv.length).toBe(12);
    });

    it('generates distinct salt and IV on successive calls', () => {
      const salt1 = generateRandomSalt(16);
      const salt2 = generateRandomSalt(16);
      expect(salt1).not.toEqual(salt2);

      const iv1 = generateRandomIV(12);
      const iv2 = generateRandomIV(12);
      expect(iv1).not.toEqual(iv2);
    });
  });

  describe('Key Derivation (PBKDF2-HMAC-SHA256)', () => {
    it('derives a valid AESEncryptionKey from password and salt', async () => {
      const salt = generateRandomSalt(16);
      const key = await deriveKeyFromPassword(TEST_PASSWORD, salt, 1000);
      expect(key).toBeDefined();
    });

    it('rejects passwords that are not strings or empty', async () => {
      const salt = generateRandomSalt(16);
      await expect(deriveKeyFromPassword('', salt, 1000)).rejects.toThrow();
    });

    it('rejects iterations below minimum bound', async () => {
      const salt = generateRandomSalt(16);
      await expect(deriveKeyFromPassword(TEST_PASSWORD, salt, 50)).rejects.toThrow(
        /iterations out of bounds/
      );
    });

    it('rejects iterations above maximum bound', async () => {
      const salt = generateRandomSalt(16);
      await expect(deriveKeyFromPassword(TEST_PASSWORD, salt, 2000000)).rejects.toThrow(
        /iterations out of bounds/
      );
    });
  });

  describe('Version 3 Encrypt / Decrypt Round-Trip', () => {
    it('encrypts plaintext and decrypts successfully with correct password', async () => {
      const encryptedString = await encryptBackupV3(SAMPLE_PLAINTEXT, TEST_PASSWORD, SAMPLE_METADATA);
      expect(typeof encryptedString).toBe('string');

      const envelope = JSON.parse(encryptedString) as PasswordEncryptedBackupEnvelope;
      expect(envelope.format).toBe('driveledger.encrypted-backup');
      expect(envelope.version).toBe(3);
      expect(envelope.kdf.algorithm).toBe('PBKDF2-HMAC-SHA256');
      expect(envelope.encryption.algorithm).toBe('AES-256-GCM');
      expect(envelope.ciphertext).toBeDefined();
      expect(envelope.tag).toBeDefined();

      const decrypted = await decryptBackupV3(envelope, TEST_PASSWORD);
      expect(decrypted).toBe(SAMPLE_PLAINTEXT);
    });

    it('produces different ciphertexts for identical plaintext and password (random salt/nonce)', async () => {
      const enc1 = await encryptBackupV3(SAMPLE_PLAINTEXT, TEST_PASSWORD, SAMPLE_METADATA);
      const enc2 = await encryptBackupV3(SAMPLE_PLAINTEXT, TEST_PASSWORD, SAMPLE_METADATA);

      const env1 = JSON.parse(enc1) as PasswordEncryptedBackupEnvelope;
      const env2 = JSON.parse(enc2) as PasswordEncryptedBackupEnvelope;

      expect(env1.kdf.salt).not.toBe(env2.kdf.salt);
      expect(env1.encryption.iv).not.toBe(env2.encryption.iv);
      expect(env1.ciphertext).not.toBe(env2.ciphertext);

      // Both must decrypt to the exact same plaintext
      expect(await decryptBackupV3(env1, TEST_PASSWORD)).toBe(SAMPLE_PLAINTEXT);
      expect(await decryptBackupV3(env2, TEST_PASSWORD)).toBe(SAMPLE_PLAINTEXT);
    });

    it('fails authentication and throws when wrong password is supplied', async () => {
      const encryptedString = await encryptBackupV3(SAMPLE_PLAINTEXT, TEST_PASSWORD, SAMPLE_METADATA);
      const envelope = JSON.parse(encryptedString) as PasswordEncryptedBackupEnvelope;

      await expect(decryptBackupV3(envelope, WRONG_PASSWORD)).rejects.toThrow(
        /Incorrect password or corrupted backup/
      );
    });

    it('fails authentication when ciphertext is tampered', async () => {
      const encryptedString = await encryptBackupV3(SAMPLE_PLAINTEXT, TEST_PASSWORD, SAMPLE_METADATA);
      const envelope = JSON.parse(encryptedString) as PasswordEncryptedBackupEnvelope;

      // Tamper ciphertext by flipping bytes
      const cipherBytes = base64ToUint8Array(envelope.ciphertext);
      cipherBytes[0] ^= 0xff;
      envelope.ciphertext = uint8ArrayToBase64(cipherBytes);

      await expect(decryptBackupV3(envelope, TEST_PASSWORD)).rejects.toThrow(
        /Incorrect password or corrupted backup/
      );
    });

    it('fails authentication when authentication tag is tampered', async () => {
      const encryptedString = await encryptBackupV3(SAMPLE_PLAINTEXT, TEST_PASSWORD, SAMPLE_METADATA);
      const envelope = JSON.parse(encryptedString) as PasswordEncryptedBackupEnvelope;

      const tagBytes = base64ToUint8Array(envelope.tag);
      tagBytes[0] ^= 0x01;
      envelope.tag = uint8ArrayToBase64(tagBytes);

      await expect(decryptBackupV3(envelope, TEST_PASSWORD)).rejects.toThrow(
        /Incorrect password or corrupted backup/
      );
    });

    it('fails authentication when AAD metadata is tampered', async () => {
      const encryptedString = await encryptBackupV3(SAMPLE_PLAINTEXT, TEST_PASSWORD, SAMPLE_METADATA);
      const envelope = JSON.parse(encryptedString) as PasswordEncryptedBackupEnvelope;

      // Tamper metadata covered by AAD
      envelope.metadata.app_version = '9.9.9';

      await expect(decryptBackupV3(envelope, TEST_PASSWORD)).rejects.toThrow(
        /Incorrect password or corrupted backup/
      );
    });

    it('fails authentication when salt is tampered', async () => {
      const encryptedString = await encryptBackupV3(SAMPLE_PLAINTEXT, TEST_PASSWORD, SAMPLE_METADATA);
      const envelope = JSON.parse(encryptedString) as PasswordEncryptedBackupEnvelope;

      const saltBytes = base64ToUint8Array(envelope.kdf.salt);
      saltBytes[0] ^= 0x55;
      envelope.kdf.salt = uint8ArrayToBase64(saltBytes);

      await expect(decryptBackupV3(envelope, TEST_PASSWORD)).rejects.toThrow(
        /Incorrect password or corrupted backup/
      );
    });
  });

  describe('Envelope Validation & Parameter Bounds (validateEnvelopeV3)', () => {
    it('rejects non-object or null input', () => {
      expect(validateEnvelopeV3(null).valid).toBe(false);
      expect(validateEnvelopeV3('string').valid).toBe(false);
      expect(validateEnvelopeV3([]).valid).toBe(false);
    });

    it('rejects wrong format identifier', () => {
      const invalid = { format: 'wrong.format', version: 3 };
      expect(validateEnvelopeV3(invalid).valid).toBe(false);
    });

    it('rejects unsupported version numbers', () => {
      const invalid = { format: 'driveledger.encrypted-backup', version: 4 };
      expect(validateEnvelopeV3(invalid).valid).toBe(false);
    });

    it('rejects out-of-bound KDF iterations', () => {
      const invalid = {
        format: 'driveledger.encrypted-backup',
        version: 3,
        kdf: { algorithm: 'PBKDF2-HMAC-SHA256', iterations: 50, salt: 'abc' },
        encryption: { algorithm: 'AES-256-GCM', iv: 'abc' },
        ciphertext: 'cipher',
        tag: 'tag',
      };
      expect(validateEnvelopeV3(invalid).valid).toBe(false);
    });
  });
});
