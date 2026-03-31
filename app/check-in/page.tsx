import { forbidden } from "next/navigation";

import { CheckInScanner } from "@/components/checkin/CheckInScanner";
import { getAuthenticatedProfileSession, isOrganizerRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function CheckInPage() {
  const session = await getAuthenticatedProfileSession();

  if (!session || !isOrganizerRole(session.role)) {
    forbidden();
  }

  return <CheckInScanner />;
}
