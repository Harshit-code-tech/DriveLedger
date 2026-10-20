// @ts-nocheck
/**
 * Jest Mock for expo-crypto
 *
 * Implements expo-crypto primitives using Node's standard globalThis.crypto and WebCrypto APIs
 * so tests execute real AES-256-GCM encryption, decryption, authentication, and hashing.
 */

import nodeCrypto from 'crypto';

export const CryptoDigestAlgorithm = {
  SHA1: 'SHA-1',
  SHA256: 'SHA-256',
  SHA384: 'SHA-384',
  SHA512: 'SHA-512',
  MD5: 'MD5',
};

export function getRandomBytes(byteCount: number): Uint8Array {
  return new Uint8Array(nodeCrypto.randomBytes(byteCount));
}

export async function getRandomBytesAsync(byteCount: number): Promise<Uint8Array> {
  return getRandomBytes(byteCount);
}

export function getRandomValues<T extends ArrayBufferView>(typedArray: T): T {
  const bytes = nodeCrypto.randomBytes(typedArray.byteLength);
  new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength).set(bytes);
  return typedArray;
}

export function randomUUID(): string {
  return nodeCrypto.randomUUID();
}

export async function digest(algorithm: string, data: BufferSource): Promise<ArrayBuffer> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer);
  const hash = nodeCrypto.createHash(algorithm.replace('-', '').toLowerCase());
  hash.update(bytes);
  const buf = hash.digest();
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

export async function digestStringAsync(
  algorithm: string,
  data: string,
  options?: { encoding?: 'hex' | 'base64' }
): Promise<string> {
  const hash = nodeCrypto.createHash(algorithm.replace('-', '').toLowerCase());
  hash.update(data);
  return hash.digest((options?.encoding as any) ?? 'hex');
}

export class AESEncryptionKey {
  keyBytes: Uint8Array;
  cryptoKey?: CryptoKey;

  constructor(keyBytes: Uint8Array, cryptoKey?: CryptoKey) {
    this.keyBytes = keyBytes;
    this.cryptoKey = cryptoKey;
  }

  static async import(bytes: Uint8Array): Promise<AESEncryptionKey> {
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      bytes as unknown as BufferSource,
      'AES-GCM',
      true,
      ['encrypt', 'decrypt']
    );
    return new AESEncryptionKey(bytes, key);
  }

  static async generate(size: number = 256): Promise<AESEncryptionKey> {
    const bytes = nodeCrypto.randomBytes(size / 8);
    return AESEncryptionKey.import(new Uint8Array(bytes));
  }

  async bytes(): Promise<Uint8Array> {
    return this.keyBytes;
  }
}

export class AESSealedData {
  combinedBytes: Uint8Array;
  ivLength: number;
  tagLength: number;

  constructor(combinedBytes: Uint8Array, ivLength = 12, tagLength = 16) {
    this.combinedBytes = combinedBytes;
    this.ivLength = ivLength;
    this.tagLength = tagLength;
  }

  static fromCombined(combined: Uint8Array | string, config?: { ivLength?: number; tagLength?: number }): AESSealedData {
    const bytes = typeof combined === 'string'
      ? new Uint8Array(Buffer.from(combined, 'base64'))
      : combined;
    return new AESSealedData(bytes, config?.ivLength ?? 12, config?.tagLength ?? 16);
  }

  static fromParts(iv: Uint8Array | string, ciphertext: Uint8Array | string, tag: Uint8Array | string): AESSealedData {
    const ivBytes = typeof iv === 'string' ? new Uint8Array(Buffer.from(iv, 'base64')) : iv;
    const cipherBytes = typeof ciphertext === 'string' ? new Uint8Array(Buffer.from(ciphertext, 'base64')) : ciphertext;
    const tagBytes = typeof tag === 'string' ? new Uint8Array(Buffer.from(tag, 'base64')) : tag;

    const out = new Uint8Array(ivBytes.length + cipherBytes.length + tagBytes.length);
    out.set(ivBytes, 0);
    out.set(cipherBytes, ivBytes.length);
    out.set(tagBytes, ivBytes.length + cipherBytes.length);
    return new AESSealedData(out, ivBytes.length, tagBytes.length);
  }

  async combined(encoding?: 'bytes' | 'base64'): Promise<Uint8Array | string> {
    return encoding === 'base64'
      ? Buffer.from(this.combinedBytes).toString('base64')
      : this.combinedBytes;
  }

  async iv(encoding?: 'bytes' | 'base64'): Promise<Uint8Array | string> {
    const bytes = this.combinedBytes.subarray(0, this.ivLength);
    return encoding === 'base64' ? Buffer.from(bytes).toString('base64') : bytes;
  }

  async tag(encoding?: 'bytes' | 'base64'): Promise<Uint8Array | string> {
    const bytes = this.combinedBytes.subarray(this.combinedBytes.length - this.tagLength);
    return encoding === 'base64' ? Buffer.from(bytes).toString('base64') : bytes;
  }

  async ciphertext(options?: { includeTag?: boolean; encoding?: 'bytes' | 'base64' }): Promise<Uint8Array | string> {
    const end = options?.includeTag
      ? this.combinedBytes.length
      : this.combinedBytes.length - this.tagLength;
    const bytes = this.combinedBytes.subarray(this.ivLength, end);
    return options?.encoding === 'base64' ? Buffer.from(bytes).toString('base64') : bytes;
  }
}

export async function aesEncryptAsync(
  plaintext: Uint8Array | string,
  key: AESEncryptionKey,
  options?: { nonce?: { bytes?: Uint8Array; length?: number }; tagLength?: number; additionalData?: Uint8Array }
): Promise<AESSealedData> {
  const plainBytes = typeof plaintext === 'string'
    ? new Uint8Array(Buffer.from(plaintext, 'base64'))
    : plaintext;
  const iv = (options as any)?.iv ?? options?.nonce?.bytes ?? new Uint8Array(nodeCrypto.randomBytes(options?.nonce?.length ?? 12));
  const tagLength = options?.tagLength ?? 16;

  const cryptoKey = key.cryptoKey ?? (await globalThis.crypto.subtle.importKey(
    'raw',
    key.keyBytes as unknown as BufferSource,
    'AES-GCM',
    false,
    ['encrypt']
  ));

  const gcmParams: AesGcmParams = {
    name: 'AES-GCM',
    iv: iv as unknown as BufferSource,
    tagLength: tagLength * 8,
  };
  if (options?.additionalData) {
    gcmParams.additionalData = options.additionalData as unknown as BufferSource;
  }

  // WebCrypto AES-GCM encrypt returns ciphertext || tag
  const cipherAndTagBuffer = await globalThis.crypto.subtle.encrypt(gcmParams, cryptoKey, plainBytes as unknown as BufferSource);
  const cipherAndTag = new Uint8Array(cipherAndTagBuffer);

  const combined = new Uint8Array(iv.length + cipherAndTag.length);
  combined.set(iv, 0);
  combined.set(cipherAndTag, iv.length);

  return new AESSealedData(combined, iv.length, tagLength);
}

export async function aesDecryptAsync(
  sealedData: AESSealedData,
  key: AESEncryptionKey,
  options?: { additionalData?: Uint8Array; output?: 'bytes' | 'base64' }
): Promise<Uint8Array | string> {
  const iv = sealedData.combinedBytes.subarray(0, sealedData.ivLength);
  const cipherAndTag = sealedData.combinedBytes.subarray(sealedData.ivLength);

  const cryptoKey = key.cryptoKey ?? (await globalThis.crypto.subtle.importKey(
    'raw',
    key.keyBytes as unknown as BufferSource,
    'AES-GCM',
    false,
    ['decrypt']
  ));

  const gcmParams: AesGcmParams = {
    name: 'AES-GCM',
    iv: iv as unknown as BufferSource,
    tagLength: sealedData.tagLength * 8,
  };
  if (options?.additionalData) {
    gcmParams.additionalData = options.additionalData as unknown as BufferSource;
  }

  const plainBuffer = await globalThis.crypto.subtle.decrypt(gcmParams, cryptoKey, cipherAndTag as unknown as BufferSource);
  const plainBytes = new Uint8Array(plainBuffer);

  return options?.output === 'base64'
    ? Buffer.from(plainBytes).toString('base64')
    : plainBytes;
}
