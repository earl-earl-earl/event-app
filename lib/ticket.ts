import "server-only";

import { serverEnv } from "@/lib/env/server";

export function buildTicketLink(token: string): string {
  const ticketUrl = new URL("/ticket", serverEnv.APP_BASE_URL);
  ticketUrl.searchParams.set("token", token);
  return ticketUrl.toString();
}
