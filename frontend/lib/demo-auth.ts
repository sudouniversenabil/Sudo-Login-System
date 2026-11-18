/**
 * Browser-only practice accounts.
 * A real backend stores users in PostgreSQL and hashes passwords with Argon2.
 * This file lets the two pages work before that server exists.
 */

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
};

type StoredUser = PublicUser & {
  passwordHash: string;
};

type PendingOtp = {
  email: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
  demoCode: string;
};

type Session = {
  userId: string;
};

const USERS_KEY = "practice-login.users";
const OTP_KEY = "practice-login.otp";
const SESSION_KEY = "practice-login.session";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

function readJson<T>(storage: Storage, key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readUsers(): StoredUser[] {
  return readJson<StoredUser[]>(localStorage, USERS_KEY, []);
}

function writeUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function readOtp(): PendingOtp | null {
  const otp = readJson<PendingOtp | null>(localStorage, OTP_KEY, null);
  if (!otp) return null;
  if (otp.expiresAt <= Date.now()) {
    localStorage.removeItem(OTP_KEY);
    return null;
  }
  return otp;
}

function writeOtp(otp: PendingOtp) {
  localStorage.setItem(OTP_KEY, JSON.stringify(otp));
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function assertName(name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 80) {
    throw new AuthError("Name must be between 2 and 80 characters.");
  }
  return trimmed;
}

function assertEmail(email: string) {
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new AuthError("Enter a valid email address.");
  }
  return normalized;
}

function assertPassword(password: string) {
  if (password.length < 10 || password.length > 128) {
    throw new AuthError("Password must be between 10 and 128 characters.");
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new AuthError("Password needs at least one letter and one number.");
  }
}

function makeOtpCode() {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return String(value[0] % 1_000_000).padStart(6, "0");
}

function toPublic(user: StoredUser): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
  };
}

async function issueOtp(email: string): Promise<string> {
  const demoCode = makeOtpCode();
  const pending: PendingOtp = {
    email,
    codeHash: await sha256(`${email}:${demoCode}`),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    demoCode,
  };
  writeOtp(pending);
  return demoCode;
}

export async function registerAccount(input: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<{ email: string; demoCode: string }> {
  const name = assertName(input.name);
  const email = assertEmail(input.email);
  assertPassword(input.password);
  if (input.password !== input.confirmPassword) {
    throw new AuthError("Passwords do not match.");
  }

  const users = readUsers();
  if (users.some((user) => user.email === email)) {
    throw new AuthError("An account with this email already exists.");
  }

  const user: StoredUser = {
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash: await sha256(input.password),
    emailVerified: false,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  writeUsers(users);

  const demoCode = await issueOtp(email);
  return { email, demoCode };
}

export function getPracticeCode(email: string): string | null {
  const otp = readOtp();
  if (!otp || otp.email !== normalizeEmail(email)) return null;
  return otp.demoCode;
}

export async function resendPracticeCode(email: string): Promise<string> {
  const normalized = assertEmail(email);
  const user = readUsers().find((item) => item.email === normalized);
  if (!user) {
    throw new AuthError("Create an account before requesting a code.");
  }
  if (user.emailVerified) {
    throw new AuthError("This email is already verified. You can sign in.");
  }
  return issueOtp(normalized);
}

export async function verifyEmailCode(email: string, code: string) {
  const normalized = assertEmail(email);
  const trimmedCode = code.trim();
  if (!/^\d{6}$/.test(trimmedCode)) {
    throw new AuthError("Enter the 6-digit code.");
  }

  const otp = readOtp();
  if (!otp || otp.email !== normalized) {
    throw new AuthError("Request a new code. This one is missing or expired.");
  }
  if (otp.attempts >= MAX_OTP_ATTEMPTS) {
    localStorage.removeItem(OTP_KEY);
    throw new AuthError("Too many attempts. Request a new code.");
  }

  const codeHash = await sha256(`${normalized}:${trimmedCode}`);
  if (codeHash !== otp.codeHash) {
    otp.attempts += 1;
    writeOtp(otp);
    const left = MAX_OTP_ATTEMPTS - otp.attempts;
    throw new AuthError(
      left > 0
        ? `That code is incorrect. ${left} attempt${left === 1 ? "" : "s"} left.`
        : "Too many attempts. Request a new code.",
    );
  }

  const users = readUsers();
  const user = users.find((item) => item.email === normalized);
  if (!user) {
    throw new AuthError("Account not found. Register again.");
  }
  user.emailVerified = true;
  writeUsers(users);
  localStorage.removeItem(OTP_KEY);
}

export async function signIn(email: string, password: string): Promise<PublicUser> {
  const normalized = assertEmail(email);
  assertPassword(password);
  const users = readUsers();
  const user = users.find((item) => item.email === normalized);
  const passwordHash = await sha256(password);

  if (!user || user.passwordHash !== passwordHash) {
    throw new AuthError("Email or password is incorrect.");
  }
  if (!user.emailVerified) {
    throw new AuthError("Verify your email with the code before you sign in.");
  }

  const session: Session = { userId: user.id };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return toPublic(user);
}

export function signOut() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function currentUser(): PublicUser | null {
  const session = readJson<Session | null>(sessionStorage, SESSION_KEY, null);
  if (!session?.userId) return null;
  const user = readUsers().find((item) => item.id === session.userId);
  if (!user || !user.emailVerified) {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
  return toPublic(user);
}
