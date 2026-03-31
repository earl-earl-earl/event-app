import { EventManagement } from "@/components/dashboard/EventManagement";
import { getAuthenticatedProfileSession, isOrganizerRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const session = await getAuthenticatedProfileSession();

  return <EventManagement canManageEvents={isOrganizerRole(session?.role ?? null)} />;
}
