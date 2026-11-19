"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AuthApiError,
  getProfile,
  signOut,
  updateProfile,
  type PublicUser,
} from "@/lib/auth-api";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getProfile()
      .then((profile) => {
        if (!active) return;
        setUser(profile);
        setName(profile.name);
        setReady(true);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        if (caught instanceof AuthApiError && caught.status === 401) {
          router.replace("/");
          return;
        }
        setError(caught instanceof Error ? caught.message : "Could not load your profile.");
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function onSaveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const updated = await updateProfile(name);
      setUser(updated);
      setName(updated.name);
      setEditingName(false);
      setMessage("Your name has been updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update your name.");
    } finally {
      setPending(false);
    }
  }

  async function onSignOut() {
    setError(null);
    setPending(true);
    try {
      await signOut();
      router.replace("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign out.");
      setPending(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#f3efe6] text-sm text-[#6b645b]">
        Loading your profile…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[#f3efe6] px-6 text-center">
        <p className="text-sm text-[#9a3412]" role="alert">
          {error}
        </p>
        <button
          type="button"
          className="rounded-full bg-[#14221f] px-5 py-3 text-sm font-semibold text-[#f3efe6]"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </div>
    );
  }

  const joined = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(user.createdAt));

  return (
    <div className="flex flex-1 flex-col bg-[#f3efe6] text-[#1c1915]">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <p className="text-sm font-semibold tracking-[0.18em] uppercase">Practice Login</p>
        <button
          type="button"
          className="rounded-full border border-[#d6c8b4] bg-white px-4 py-2 text-sm font-medium"
          onClick={onSignOut}
          disabled={pending}
        >
          {pending ? "Please wait…" : "Sign out"}
        </button>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-6 pb-16 sm:px-10">
        <p className="text-sm font-medium text-[#9a3412]">Profile</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[#14221f]">
          Hello, {user.name}.
        </h1>
        <p className="mt-3 text-base leading-7 text-[#4d473f]">
          Your profile is loaded from your signed-in account.
        </p>

        {error ? (
          <p className="mt-5 rounded-2xl bg-[#fde8e4] px-4 py-3 text-sm text-[#9a3412]" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-5 rounded-2xl bg-[#eef6f1] px-4 py-3 text-sm text-[#14532d]" role="status">
            {message}
          </p>
        ) : null}

        <dl className="mt-8 divide-y divide-[#eadfce] rounded-3xl border border-[#e2d8c8] bg-white">
          <div className="grid gap-3 px-6 py-4 sm:grid-cols-[10rem_1fr] sm:items-center">
            <dt className="text-sm text-[#6b645b]">Name</dt>
            <dd>
              {editingName ? (
                <form className="flex flex-col gap-2 sm:flex-row" onSubmit={onSaveName}>
                  <input
                    aria-label="Name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    minLength={2}
                    maxLength={80}
                    required
                    className="min-w-0 flex-1 rounded-xl border border-[#e2d8c8] bg-[#fffcf8] px-3 py-2 outline-none ring-[#9a3412] focus:ring-2"
                  />
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-full bg-[#14221f] px-4 py-2 text-sm font-semibold text-[#f3efe6] disabled:opacity-60"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded-full border border-[#d6c8b4] px-4 py-2 text-sm font-medium disabled:opacity-60"
                    onClick={() => {
                      setName(user.name);
                      setEditingName(false);
                      setError(null);
                    }}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium break-all">{user.name}</span>
                  <button
                    type="button"
                    className="text-sm font-medium underline"
                    onClick={() => {
                      setName(user.name);
                      setEditingName(true);
                      setMessage(null);
                    }}
                  >
                    Edit
                  </button>
                </div>
              )}
            </dd>
          </div>
          <Row label="Email" value={user.email} />
          <Row label="Email status" value={user.emailVerified ? "Verified" : "Not verified"} />
          <Row label="Account created" value={joined} />
        </dl>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 px-6 py-4 sm:grid-cols-[10rem_1fr] sm:items-center">
      <dt className="text-sm text-[#6b645b]">{label}</dt>
      <dd className="font-medium break-all">{value}</dd>
    </div>
  );
}
