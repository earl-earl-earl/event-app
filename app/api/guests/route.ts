import { NextResponse } from "next/server";
import { z } from "zod";

import { requireManagementGuard } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { getServiceSupabase } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  eventId: z.string().uuid(),
  search: z.string().optional(),
  status: z.enum(["all", "checked_in", "not_checked_in"]).default("all"),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

function normalizeSearchTerm(value: string): string {
  return value.replace(/[%*,]/g, "").trim();
}

export async function GET(request: Request) {
  const guard = await requireManagementGuard();
  if ("response" in guard) {
    return guard.response;
  }

  const url = new URL(request.url);
  const parsedQuery = querySchema.safeParse({
    eventId: url.searchParams.get("eventId"),
    search: url.searchParams.get("search") ?? undefined,
    status: url.searchParams.get("status") ?? "all",
    limit: url.searchParams.get("limit") ?? 50,
    offset: url.searchParams.get("offset") ?? 0,
  });

  if (!parsedQuery.success) {
    return jsonError(parsedQuery.error.message, 400, "validation_error");
  }

  const { eventId, search, status, limit, offset } = parsedQuery.data;

  const supabase = getServiceSupabase();

  let query = supabase
    .from("guests")
    .select(
      "id, event_id, first_name, last_name, email, phone_number, checked_in, checked_in_at, entry_count, max_entries, metadata, created_at",
      { count: "exact" },
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status === "checked_in") {
    query = query.eq("checked_in", true);
  } else if (status === "not_checked_in") {
    query = query.eq("checked_in", false);
  }

  if (search && search.trim().length > 0) {
    const safeSearch = normalizeSearchTerm(search);
    if (safeSearch.length > 0) {
      query = query.or(
        `first_name.ilike.%${safeSearch}%,last_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`,
      );
    }
  }

  const { data, error, count } = await query;

  if (error) {
    return jsonError(error.message, 500, "guests_fetch_failed");
  }

  return NextResponse.json({
    success: true,
    guests: data,
    pagination: {
      limit,
      offset,
      total: count ?? 0,
    },
  });
}
