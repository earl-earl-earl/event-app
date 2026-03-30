import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminGuard } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { getServiceSupabase } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  eventId: z.string().uuid(),
});

export async function GET(request: Request) {
  const guard = await requireAdminGuard();
  if ("response" in guard) {
    return guard.response;
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    eventId: url.searchParams.get("eventId"),
  });

  if (!parsed.success) {
    return jsonError(parsed.error.message, 400, "validation_error");
  }

  const supabase = getServiceSupabase();

  const [totalResponse, checkedInResponse] = await Promise.all([
    supabase
      .from("guests")
      .select("id", { count: "exact", head: true })
      .eq("event_id", parsed.data.eventId),
    supabase
      .from("guests")
      .select("id", { count: "exact", head: true })
      .eq("event_id", parsed.data.eventId)
      .eq("checked_in", true),
  ]);

  if (totalResponse.error) {
    return jsonError(totalResponse.error.message, 500, "stats_total_failed");
  }

  if (checkedInResponse.error) {
    return jsonError(checkedInResponse.error.message, 500, "stats_checked_failed");
  }

  const totalGuests = totalResponse.count ?? 0;
  const checkedInCount = checkedInResponse.count ?? 0;

  return NextResponse.json({
    success: true,
    totalGuests,
    checkedInCount,
    remainingGuests: Math.max(totalGuests - checkedInCount, 0),
  });
}
