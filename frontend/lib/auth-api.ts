const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
};

export class AuthApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Request failed (${response.status}).`;
    throw new AuthApiError(message, response.status);
  }

  return payload;
}

function parsePublicUser(value: unknown): PublicUser {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    !("name" in value) ||
    typeof value.name !== "string" ||
    !("email" in value) ||
    typeof value.email !== "string" ||
    !("emailVerified" in value) ||
    typeof value.emailVerified !== "boolean" ||
    !("createdAt" in value) ||
    typeof value.createdAt !== "string"
  ) {
    throw new Error("The server returned an invalid profile.");
  }

  return {
    id: value.id,
    name: value.name,
    email: value.email,
    emailVerified: value.emailVerified,
    createdAt: value.createdAt,
  };
}

export async function registerAccount(input: {
  name: string;
  email: string;
  password: string;
}): Promise<void> {
  await request("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function verifyEmailCode(email: string, code: string): Promise<void> {
  await request("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

export async function resendVerificationCode(email: string): Promise<void> {
  await request("/auth/resend-code", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function signIn(email: string, password: string): Promise<void> {
  await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function getProfile(): Promise<PublicUser> {
  return parsePublicUser(await request("/profile"));
}

export async function currentUser(): Promise<PublicUser | null> {
  try {
    return await getProfile();
  } catch (error) {
    if (error instanceof AuthApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export async function updateProfile(name: string): Promise<PublicUser> {
  return parsePublicUser(
    await request("/profile", {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  );
}

export async function signOut(): Promise<void> {
  await request("/auth/logout", { method: "POST" });
}
