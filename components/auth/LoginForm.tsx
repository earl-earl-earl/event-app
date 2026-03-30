"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { getBrowserSupabase } from "@/lib/supabase/browser";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = useMemo(() => searchParams.get("next") ?? "/dashboard", [
    searchParams,
  ]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  async function handlePasswordLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    setIsLoading(true);

    try {
      const supabase = getBrowserSupabase();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMagicLink(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();

    if (!email.trim()) {
      setErrorMessage("Email is required for magic link sign-in.");
      return;
    }

    setErrorMessage(null);
    setInfoMessage(null);
    setIsLoading(true);

    try {
      const supabase = getBrowserSupabase();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}${nextPath}`,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setInfoMessage("Magic link sent. Check your email inbox.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Organizer Login</h1>
      <p className="mt-1 text-sm text-slate-600">
        Sign in to manage events, upload guests, and run scanner devices.
      </p>

      <form className="mt-6 space-y-4" onSubmit={handlePasswordLogin}>
        <label className="block text-sm text-slate-700" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-slate-500"
          placeholder="staff@event.com"
        />

        <label className="block text-sm text-slate-700" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-slate-500"
          placeholder="Enter password"
        />

        {errorMessage ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        {infoMessage ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {infoMessage}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 pt-2 sm:flex-row">
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={handleMagicLink}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Send Magic Link
          </button>
        </div>
      </form>
    </div>
  );
}
