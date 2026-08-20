import crypto from "crypto";

// Every auth token in this app (password reset, invite, email verification)
// follows the same shape: a cryptographically random raw value that goes
// into the email link and is never persisted, and a SHA-256 hash of it that
// is what actually gets stored and looked up. A database read (backup leak,
// misconfigured access, SQL injection) exposes only hashes, which are
// useless without the original — same model as how API keys/session tokens
// are conventionally stored, distinct from bcrypt (which is for passwords,
// deliberately slow to resist offline guessing of *low-entropy* secrets;
// these tokens already have 256 bits of entropy, so a fast, deterministic
// hash is both correct and necessary for an equality-lookup index).
export function generateSecureToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
