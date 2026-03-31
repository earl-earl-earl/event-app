import { forbidden } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  getAuthenticatedProfileSession,
  isAdminRole,
  isManagementRole,
} from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getAuthenticatedProfileSession();
  if (!session || !isManagementRole(session.role)) {
    forbidden();
  }

  const canManageUsers = isAdminRole(session?.role ?? null);

  return (
    <DashboardShell canManageUsers={canManageUsers}>
      {children}
    </DashboardShell>
  );
}
