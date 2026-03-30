import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <section className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Production System</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">
          QR Event Check-In Platform
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-600">
          Secure, concurrent check-ins with signed JWT tickets, Supabase-backed
          verification, bulk CSV import, realtime attendance dashboards, and camera
          scanner support.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Organizer Login
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Open Dashboard
          </Link>
          <Link
            href="/check-in"
            className="inline-flex h-12 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 px-4 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
          >
            Open Scanner
          </Link>
          <Link
            href="/ticket"
            className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Ticket Link Endpoint
          </Link>
        </div>
      </section>
    </main>
  );
}
