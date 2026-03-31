import { redirect } from "next/navigation";

import { PrivilegedAccountsScreen } from "@/components/dashboard/users/PrivilegedAccountsScreen";
import { getAuthenticatedProfileSession, isAdminRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await getAuthenticatedProfileSession();

  if (!session || !isAdminRole(session.role)) {
    redirect("/dashboard");
  }

  return <PrivilegedAccountsScreen />;
}
