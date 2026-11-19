"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AuthApiError,
  currentUser,
  registerAccount,
  resendVerificationCode,
  signIn,
  verifyEmailCode,
} from "@/lib/auth-api";

type Mode = "login" | "register" | "verify";

const steps = [
  { title: "Create an account", detail: "Name, email, and password." },
  { title: "Verify the code", detail: "Sign-in stays locked until the code matches." },
  { title: "Sign in", detail: "Only a verified email can open a session." },
  { title: "Open your profile", detail: "The next page shows the signed-in account." },
];

export function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [alreadyIn, setAlreadyIn] = useState(false);

  useEffect(() => {
    let active = true;
    currentUser()
      .then((user) => {
        if (active) setAlreadyIn(Boolean(user));
      })
      .catch((caught: unknown) => {
        if (active) showError(caught);
      });
    return () => {
      active = false;
    };
  }, []);

  function resetNotices() {
    setError(null);
    setMessage(null);
  }

  function showError(caught: unknown) {
    setError(caught instanceof Error ? caught.message : "Something went wrong. Try again.");
  }

  async function onRegister(event: FormEvent) {
    event.preventDefault();
    resetNotices();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    try {
      await registerAccount({ name, email, password });
      setPassword("");
      setConfirmPassword("");
      setCode("");
      setMode("verify");
      setMessage("Account created. Check your email for the 6-digit verification code.");
    } catch (caught) {
      showError(caught);
    } finally {
      setPending(false);
    }
  }

  async function onVerify(event: FormEvent) {
    event.preventDefault();
    resetNotices();
    setPending(true);
    try {
      await verifyEmailCode(email, code);
      setCode("");
      setMode("login");
      setMessage("Email verified. You can sign in now.");
    } catch (caught) {
      showError(caught);
    } finally {
      setPending(false);
    }
  }

  async function onResend() {
    resetNotices();
    setPending(true);
    try {
      await resendVerificationCode(email);
      setCode("");
      setMessage("If that account is waiting for verification, a new code was sent.");
    } catch (caught) {
      showError(caught);
    } finally {
      setPending(false);
    }
  }

  async function onLogin(event: FormEvent) {
    event.preventDefault();
    resetNotices();
    setPending(true);
    try {
      await signIn(email, password);
      router.push("/profile");
    } catch (caught) {
      showError(caught);
      if (caught instanceof AuthApiError && caught.status === 403) {
        setMode("verify");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-[#f3efe6] text-[#1c1915]">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <p className="text-sm font-semibold tracking-[0.18em] uppercase">Practice Login</p>
        <p className="text-sm text-[#6b645b]">Email-verified sign-in</p>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-start gap-10 px-6 pb-16 sm:px-10 lg:grid-cols-[1fr_28rem]">
        <section className="pt-4 lg:pt-10">
          <p className="text-sm font-medium text-[#9a3412]">Two pages. One practice flow.</p>
          <h1 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight text-[#14221f] sm:text-5xl">
            Register, confirm the code, then open your profile.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-[#4d473f]">
            Create an account, verify the code sent to your email, and sign in. Your session is
            managed by the server with a secure, HTTP-only cookie.
          </p>
          <ol className="mt-8 space-y-4">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#14221f] text-sm font-semibold text-[#f3efe6]">
                  {index + 1}
                </span>
                <span>
                  <span className="block font-medium">{step.title}</span>
                  <span className="block text-sm text-[#6b645b]">{step.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-3xl border border-[#e2d8c8] bg-white p-6 shadow-[0_20px_50px_rgba(28,25,21,0.06)] sm:p-8">
          {alreadyIn && mode === "login" ? (
            <p className="mb-5 rounded-2xl bg-[#eef6f1] px-4 py-3 text-sm text-[#14532d]">
              You already have a session in this tab.{" "}
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => router.push("/profile")}
              >
                Go to your profile
              </button>
            </p>
          ) : null}

          <div className="mb-6 flex gap-2 rounded-full bg-[#f6f1e8] p-1 text-sm">
            <button
              type="button"
              className={`flex-1 rounded-full px-3 py-2 font-medium ${mode !== "register" ? "bg-white shadow-sm" : "text-[#6b645b]"}`}
              onClick={() => {
                resetNotices();
                setMode("login");
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`flex-1 rounded-full px-3 py-2 font-medium ${mode === "register" ? "bg-white shadow-sm" : "text-[#6b645b]"}`}
              onClick={() => {
                resetNotices();
                setMode("register");
              }}
            >
              Create account
            </button>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">
            {mode === "register" && "Create your account"}
            {mode === "verify" && "Verify your email"}
            {mode === "login" && "Sign in"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#6b645b]">
            {mode === "register" && "The account stays unverified until the code is accepted."}
            {mode === "verify" && "Sign-in is blocked until this code is accepted."}
            {mode === "login" && "Use the email you already verified."}
          </p>

          {message ? (
            <p className="mt-4 rounded-2xl bg-[#eef6f1] px-4 py-3 text-sm text-[#14532d]" role="status">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 rounded-2xl bg-[#fde8e4] px-4 py-3 text-sm text-[#9a3412]" role="alert">
              {error}
            </p>
          ) : null}

          {mode === "register" ? (
            <form className="mt-6 space-y-4" onSubmit={onRegister}>
              <Field
                label="Name"
                value={name}
                onChange={setName}
                autoComplete="name"
                minLength={2}
                maxLength={80}
              />
              <Field
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
              />
              <Field
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                hint="Use between 10 and 128 characters."
                minLength={10}
                maxLength={128}
              />
              <Field
                label="Confirm password"
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
                maxLength={128}
              />
              <Submit pending={pending} label="Create account" />
            </form>
          ) : null}

          {mode === "verify" ? (
            <form className="mt-6 space-y-4" onSubmit={onVerify}>
              <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
              <Field
                label="6-digit code"
                value={code}
                onChange={setCode}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
              />
              <Submit pending={pending} label="Verify email" />
              <button
                type="button"
                className="w-full text-sm font-medium text-[#14221f] underline disabled:opacity-50"
                onClick={onResend}
                disabled={pending}
              >
                Send a new code
              </button>
            </form>
          ) : null}

          {mode === "login" ? (
            <form className="mt-6 space-y-4" onSubmit={onLogin}>
              <Field
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
              />
              <Field
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
                maxLength={128}
              />
              <Submit pending={pending} label="Sign in" />
              <button
                type="button"
                className="w-full text-sm font-medium text-[#14221f] underline"
                onClick={() => {
                  resetNotices();
                  setMode("verify");
                }}
              >
                I still need to verify my email
              </button>
            </form>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  hint,
  inputMode,
  maxLength,
  minLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  hint?: string;
  inputMode?: "numeric" | "text";
  maxLength?: number;
  minLength?: number;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <label className="block text-sm font-medium" htmlFor={id}>
      {label}
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        minLength={minLength}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-[#e2d8c8] bg-[#fffcf8] px-3 py-2.5 text-base outline-none ring-[#9a3412] focus:ring-2"
        required
      />
      {hint ? <span className="mt-1 block text-xs font-normal text-[#6b645b]">{hint}</span> : null}
    </label>
  );
}

function Submit({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-[#14221f] px-4 py-3 text-sm font-semibold text-[#f3efe6] disabled:opacity-60"
    >
      {pending ? "Please wait…" : label}
    </button>
  );
}
