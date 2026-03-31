import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 px-4 py-8">
      <section className="w-full max-w-xl text-center">
        {/* Logo */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg shadow-blue-500/20">
          <svg width="28" height="28" viewBox="0 0 18 18" fill="white">
            <rect x="1" y="1" width="6" height="6" rx="1" />
            <rect x="11" y="1" width="6" height="6" rx="1" />
            <rect x="1" y="11" width="6" height="6" rx="1" />
            <rect x="11" y="11" width="6" height="6" rx="1" opacity="0.5" />
          </svg>
        </div>

        <h1 className="mt-5 text-3xl font-bold text-slate-900 tracking-tight">
          QR Event Check-In Platform
        </h1>
        <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
          Secure, concurrent check-ins with signed JWT tickets, real-time
          attendance dashboards, bulk CSV import, and camera scanner support.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/login"
            className="btn-primary w-full sm:w-auto px-6"
          >
            <svg className="mr-2" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 2h3a1 1 0 011 1v10a1 1 0 01-1 1h-3" />
              <polyline points="7 11 10 8 7 5" />
              <line x1="10" y1="8" x2="2" y2="8" />
            </svg>
            Sign In
          </Link>
          <Link
            href="/dashboard"
            className="btn-secondary w-full sm:w-auto px-6"
          >
            Open Dashboard
          </Link>
        </div>

        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-slate-400">
          <Link
            href="/check-in"
            className="hover:text-blue-600 transition-colors"
          >
            Open Scanner
          </Link>
          <span>·</span>
          <Link
            href="/ticket"
            className="hover:text-blue-600 transition-colors"
          >
            Ticket Endpoint
          </Link>
        </div>
      </section>
    </main>
  );
}
