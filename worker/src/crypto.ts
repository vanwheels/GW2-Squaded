/**
 * Pure crypto/validation helpers for the sync Worker's account system.
 * Split out of index.ts so they're unit-testable without a KV/fetch harness
 * (see crypto.test.ts) - everything here is a pure function over Web
 * Crypto's crypto.subtle, no KV/network access.
 *
 * Ported from ChoiceBuds' worker/src/crypto.ts, unchanged.
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const TOKEN_BYTES = 32;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{2,32}$/;
const MIN_PASSWORD_LENGTH = 8;

function bufToBase64(buf: Uint8Array): string {
  let binary = '';
  for (const byte of buf) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBuf(b64: string): Uint8Array {
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf;
}

function bufToHex(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function deriveBits(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

export interface PasswordHash {
  hash: string; // base64
  salt: string; // base64
}

export async function hashPassword(password: string): Promise<PasswordHash> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveBits(password, salt);
  return { hash: bufToBase64(hash), salt: bufToBase64(salt) };
}

export async function verifyPassword(password: string, stored: PasswordHash): Promise<boolean> {
  const salt = base64ToBuf(stored.salt);
  const candidate = await deriveBits(password, salt);
  return constantTimeEqual(bufToBase64(candidate), stored.hash);
}

/** Returned to the client once; only hashToken()'s digest of it is ever stored. */
export function generateToken(): string {
  return bufToBase64(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return bufToHex(new Uint8Array(digest));
}

/** Web Crypto has no built-in timing-safe string compare. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function isValidUsername(username: string): boolean {
  return typeof username === 'string' && USERNAME_PATTERN.test(username);
}

export function isValidPassword(password: string): boolean {
  return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH;
}
