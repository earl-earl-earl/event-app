"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { getBrowserSupabase } from "@/lib/supabase/browser";

function readAppMetadataIsActive(appMetadata: unknown): boolean | null {
  if (!appMetadata || typeof appMetadata !== "object") {
    return null;
  }

  const rawIsActive = (appMetadata as Record<string, unknown>).is_active;
  return typeof rawIsActive === "boolean" ? rawIsActive : null;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = useMemo(() => searchParams.get("next") ?? "/dashboard", [
    searchParams,
  ]);
  const suspendedMessage =
    searchParams.get("error") === "suspended"
      ? "Your account is suspended. Please contact an administrator."
      : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const displayedErrorMessage = errorMessage ?? suspendedMessage;

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

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (readAppMetadataIsActive(user?.app_metadata) === false) {
        await supabase.auth.signOut();
        router.replace("/suspended");
        router.refresh();
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
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-blue-600 to-blue-700 shadow-lg shadow-blue-500/20">
          <svg width="22" height="22" viewBox="0 0 18 18" fill="white">
            <rect x="1" y="1" width="6" height="6" rx="1" />
            <rect x="11" y="1" width="6" height="6" rx="1" />
            <rect x="1" y="11" width="6" height="6" rx="1" />
            <rect x="11" y="11" width="6" height="6" rx="1" opacity="0.5" />
          </svg>
        </div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900 tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sign in to manage events and run scanners
        </p>
      </div>

      <div className="card p-6">
        <form className="space-y-4" onSubmit={handlePasswordLogin}>
          <div>
            <label className="form-label" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="form-input"
              placeholder="staff@event.com"
            />
          </div>

          <div>
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="form-input"
              placeholder="Enter password"
            />
          </div>

          {displayedErrorMessage ? (
            <div className="alert alert-error">
              <svg className="shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0V5zm.75 6.5a.75.75 0 100-1.5.75.75 0 000 1.5z" />
              </svg>
              <span>{displayedErrorMessage}</span>
            </div>
          ) : null}

          {infoMessage ? (
            <div className="alert alert-success">
              <svg className="shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.03 5.53l-3.5 3.5a.75.75 0 01-1.06 0l-1.5-1.5a.75.75 0 011.06-1.06l.97.97 2.97-2.97a.75.75 0 011.06 1.06z" />
              </svg>
              <span>{infoMessage}</span>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={handleMagicLink}
              className="btn-secondary w-full"
            >
              Send Magic Link
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
