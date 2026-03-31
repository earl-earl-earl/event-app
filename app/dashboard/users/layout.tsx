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
    <div className="space-y-6">
      <section className="card p-6">
        <div className="page-header">
          <h1 className="page-title">Admin Account Center</h1>
          <p className="page-subtitle">
            Manage organizer lifecycle and monitor privileged accounts from dedicated admin screens.
          </p>
        </div>

        <nav className="mt-4 flex flex-wrap gap-2">
          {accountLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="btn-secondary text-xs h-8 px-3"
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
