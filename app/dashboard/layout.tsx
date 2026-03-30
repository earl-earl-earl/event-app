import Link from "next/link";

import { SignOutButton } from "@/components/auth/SignOutButton";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">QR Check-In</p>
            <h1 className="text-xl font-semibold text-slate-900">Admin Console</h1>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-3 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              Overview
            </Link>
            <Link
              href="/dashboard/events"
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-3 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              Events
            </Link>
            <Link
              href="/dashboard/guests"
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-3 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              Guests
            </Link>
            <Link
              href="/check-in"
              className="inline-flex h-9 items-center justify-center rounded-md border border-emerald-300 bg-emerald-50 px-3 text-sm text-emerald-700 transition hover:bg-emerald-100"
            >
              Scanner
            </Link>
            <SignOutButton />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
