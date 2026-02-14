import CryptoJS from 'crypto-js';

const SALT = 'teacher_app_secure_salt_v1';
const ITERATIONS = 10000;
const KEY_SIZE = 256 / 32;

export function deriveKey(pin: string): string {
  return CryptoJS.PBKDF2(pin, SALT, {
    keySize: KEY_SIZE,
    iterations: ITERATIONS,
  }).toString();
}

export function encrypt(data: string, pin: string): string {
  const key = deriveKey(pin);
  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(data, CryptoJS.enc.Hex.parse(key), {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  const combined = iv.toString() + ':' + encrypted.toString();
  return combined;
}

export function decrypt(encryptedData: string, pin: string): string | null {
  try {
    const key = deriveKey(pin);
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      console.log('Invalid encrypted data format');
      return null;
    }
    const iv = CryptoJS.enc.Hex.parse(parts[0]);
    const encrypted = parts[1];
    const decrypted = CryptoJS.AES.decrypt(encrypted, CryptoJS.enc.Hex.parse(key), {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    const result = decrypted.toString(CryptoJS.enc.Utf8);
    if (!result) {
      console.log('Decryption resulted in empty string - wrong PIN');
      return null;
    }
    return result;
  } catch (error) {
    console.log('Decryption failed:', error);
    return null;
  }
}

export function hashPin(pin: string): string {
  return CryptoJS.SHA256(pin + SALT).toString();
}

export function verifyPin(pin: string, hash: string): boolean {
  return hashPin(pin) === hash;
}
