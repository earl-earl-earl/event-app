import { AdminDashboardOverview } from "@/components/dashboard/AdminDashboardOverview";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import {
  getAuthenticatedProfileSession,
  isAdminRole,
  isOrganizerRole,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getAuthenticatedProfileSession();

  if (isAdminRole(session?.role ?? null)) {
    return <AdminDashboardOverview />;
  }

  return <DashboardOverview canUseScanner={isOrganizerRole(session?.role ?? null)} />;
}
