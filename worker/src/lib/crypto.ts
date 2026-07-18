import { SignJWT, jwtVerify } from "jose";
import type { JwtPayload, Role } from "../types";

const PBKDF2_ITERATIONS = 100_000;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt.buffer)}$${toBase64(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterStr, saltB64, hashB64] = stored.split("$");
  if (scheme !== "pbkdf2" || !iterStr || !saltB64 || !hashB64) return false;
  const iterations = Number(iterStr);
  const salt = fromBase64(saltB64);
  const expected = fromBase64(hashB64);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256,
  );
  const actual = new Uint8Array(bits);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!;
  return diff === 0;
}

function secretKey(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(
  payload: JwtPayload,
  secret: string,
  expiresIn = "15m",
) {
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .setJti(crypto.randomUUID())
    .sign(secretKey(secret));
}

export async function signRefreshToken(
  payload: JwtPayload,
  secret: string,
  expiresIn = "7d",
) {
  return new SignJWT({ email: payload.email, role: payload.role, typ: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .setJti(crypto.randomUUID())
    .sign(secretKey(secret));
}

export async function verifyAccessToken(token: string, secret: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, secretKey(secret));
  return {
    sub: String(payload.sub),
    email: String(payload.email),
    role: payload.role as Role,
  };
}

export async function verifyRefreshToken(token: string, secret: string) {
  const { payload } = await jwtVerify(token, secretKey(secret));
  if (payload.typ !== "refresh") throw new Error("Invalid refresh token");
  return {
    sub: String(payload.sub),
    email: String(payload.email),
    role: payload.role as Role,
    jti: String(payload.jti ?? ""),
  };
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
