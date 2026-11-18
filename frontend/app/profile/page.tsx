"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentUser, signOut, type PublicUser } from "@/lib/demo-auth";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sessionUser = currentUser();
    if (!sessionUser) {
      router.replace("/");
      return;
    }
    setUser(sessionUser);
    setReady(true);
  }, [router]);

  if (!ready || !user) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#f3efe6] text-sm text-[#6b645b]">
        Checking your session…
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
          onClick={() => {
            signOut();
            router.replace("/");
          }}
        >
          Sign out
        </button>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-6 pb-16 sm:px-10">
        <p className="text-sm font-medium text-[#9a3412]">Profile</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[#14221f]">
          Hello, {user.name}.
        </h1>
        <p className="mt-3 text-base leading-7 text-[#4d473f]">
          You reached this page after a verified sign-in. Closing the tab ends the practice
          session.
        </p>

        <dl className="mt-8 divide-y divide-[#eadfce] rounded-3xl border border-[#e2d8c8] bg-white">
          <Row label="Name" value={user.name} />
          <Row label="Email" value={user.email} />
          <Row label="Email status" value="Verified" />
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
