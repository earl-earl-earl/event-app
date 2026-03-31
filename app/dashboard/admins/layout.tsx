import { forbidden } from "next/navigation";

import { getAuthenticatedProfileSession, isAdminRole } from "@/lib/auth/session";

export default async function AdminsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getAuthenticatedProfileSession();
  if (!session || !isAdminRole(session.role)) {
    forbidden();
  }

  return children;
}
