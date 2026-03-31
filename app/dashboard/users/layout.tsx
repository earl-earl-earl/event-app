import Link from "next/link";
import { forbidden } from "next/navigation";

import { getAuthenticatedProfileSession, isAdminRole } from "@/lib/auth/session";

const accountLinks = [
  { href: "/dashboard/users", label: "All Accounts" },
  { href: "/dashboard/admins", label: "Admins" },
  { href: "/dashboard/organizers", label: "Organizers" },
];

export default async function UsersLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getAuthenticatedProfileSession();
  if (!session || !isAdminRole(session.role)) {
    forbidden();
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Admin Account Center</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage organizer lifecycle and monitor privileged accounts from dedicated admin screens.
        </p>

        <nav className="mt-4 flex flex-wrap gap-2">
          {accountLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-3 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </section>

      {children}
    </div>
  );
}
