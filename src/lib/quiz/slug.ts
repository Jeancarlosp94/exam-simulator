/**
 * URL-safe random slug for public quiz share links.
 *
 * 8 chars from a 32-char alphabet = 32^8 ≈ 1.1 × 10¹² possibilities — more
 * than enough that collisions only matter once we cross ~10⁶ shares, and
 * even then the route handler retries on insert conflict.
 *
 * Crockford's Base32 (no 0/O/I/L/1) keeps slugs hand-typable when someone
 * reads the URL aloud, which is the actual delivery mode in WhatsApp/voice.
 */

import { randomBytes } from "node:crypto";

const ALPHABET = "23456789abcdefghjkmnpqrstvwxyz"; // Crockford-ish, no 0/o/i/l/1
const SLUG_LENGTH = 8;

export function generateShareSlug(): string {
  const bytes = randomBytes(SLUG_LENGTH);
  let out = "";
  for (let i = 0; i < SLUG_LENGTH; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}
