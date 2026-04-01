import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthenticatedProfileSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function SuspendedAccountPage() {
  const session = await getAuthenticatedProfileSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-50 via-rose-50/30 to-slate-100 px-4 py-8">
      <section className="card w-full max-w-lg p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-700">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M15 9l-6 6" />
            <path d="M9 9l6 6" />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold text-slate-900">Account Suspended</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Your account is currently suspended, so dashboard access is disabled.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Please contact an administrator to reactivate your account.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <Link href="/login" className="btn-secondary h-9 px-4 text-sm">
            Back to Login
          </Link>
          <Link href="/" className="btn-primary h-9 px-4 text-sm">
            Go to Home
          </Link>
        </div>
      </section>
    </main>
  );
}
