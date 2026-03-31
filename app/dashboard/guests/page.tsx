import { GuestManagement } from "@/components/dashboard/GuestManagement";
import { getAuthenticatedProfileSession, isOrganizerRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function GuestsPage() {
  const session = await getAuthenticatedProfileSession();

  return <GuestManagement canManageGuests={isOrganizerRole(session?.role ?? null)} />;
}
