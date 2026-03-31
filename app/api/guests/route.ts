import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireManagementGuard, requireOrganizerGuard } from "@/lib/auth/guards";
import { serverEnv } from "@/lib/env/server";
import { buildTicketLink } from "@/lib/ticket";
import { jsonError } from "@/lib/http";
import { getServiceSupabase } from "@/lib/supabase/service";
import { signGuestToken } from "@/lib/tokens";
import type { Database, Json } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GuestInsert = Database["public"]["Tables"]["guests"]["Insert"];
type DispatchInsert = Database["public"]["Tables"]["dispatch_queue"]["Insert"];

const querySchema = z.object({
  eventId: z.string().uuid(),
  search: z.string().optional(),
  status: z.enum(["all", "checked_in", "not_checked_in"]).default("all"),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

const createGuestSchema = z.object({
  eventId: z.string().uuid(),
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  phoneNumber: z.string().trim().min(3).max(64),
  maxEntries: z.coerce.number().int().positive().max(100).default(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function normalizeSearchTerm(value: string): string {
  return value.replace(/[%*,]/g, "").trim();
}

function normalizeToJson(value: unknown): Json {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeToJson(item));
  }

  if (typeof value === "object") {
    const output: Record<string, Json> = {};

    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      if (item === undefined) {
        return;
      }

      output[key] = normalizeToJson(item);
    });

    return output;
  }

  return String(value);
}

function normalizeMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, Json> {
  if (!metadata) {
    return {};
  }

  const output: Record<string, Json> = {};

  Object.entries(metadata).forEach(([rawKey, rawValue]) => {
    const key = rawKey.trim().toLowerCase().replace(/[\s-]+/g, "_");

    if (!key || rawValue === undefined) {
      return;
    }

    output[key] = normalizeToJson(rawValue);
  });

  return output;
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

export async function POST(request: Request) {
  const guard = await requireOrganizerGuard();
  if ("response" in guard) {
    return guard.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON payload.", 400, "invalid_payload");
  }

  const parsedBody = createGuestSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError(parsedBody.error.message, 400, "validation_error");
  }

  const supabase = getServiceSupabase();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id")
    .eq("id", parsedBody.data.eventId)
    .maybeSingle();

  if (eventError) {
    return jsonError(eventError.message, 500, "event_fetch_failed");
  }

  if (!event) {
    return jsonError("Event not found.", 404, "event_not_found");
  }

  const guestId = randomUUID();

  let guestToken: string;

  try {
    guestToken = await signGuestToken({
      guestId,
      eventId: parsedBody.data.eventId,
    });
  } catch {
    return jsonError("Failed to generate guest token.", 500, "token_generation_failed");
  }

  const guestInsert: GuestInsert = {
    id: guestId,
    event_id: parsedBody.data.eventId,
    first_name: parsedBody.data.firstName.trim(),
    last_name: parsedBody.data.lastName.trim(),
    email: parsedBody.data.email.trim().toLowerCase(),
    phone_number: parsedBody.data.phoneNumber.trim(),
    qr_token: guestToken,
    max_entries: parsedBody.data.maxEntries,
    metadata: normalizeMetadata(parsedBody.data.metadata),
  };

  const { data: guest, error: guestError } = await supabase
    .from("guests")
    .insert(guestInsert)
    .select(
      "id, event_id, first_name, last_name, email, phone_number, checked_in, checked_in_at, entry_count, max_entries, metadata, created_at",
    )
    .single();

  if (guestError) {
    return jsonError(guestError.message, 500, "guest_create_failed");
  }

  const ticketLink = buildTicketLink(guestToken);
  const smsEnabled = Boolean(
    serverEnv.TWILIO_ACCOUNT_SID &&
      serverEnv.TWILIO_AUTH_TOKEN &&
      serverEnv.TWILIO_FROM_NUMBER,
  );
  const dispatchJobs: DispatchInsert[] = [
    {
      guest_id: guest.id,
      event_id: parsedBody.data.eventId,
      channel: "email",
      destination: guest.email,
      ticket_link: ticketLink,
    },
  ];

  if (smsEnabled) {
    dispatchJobs.push({
      guest_id: guest.id,
      event_id: parsedBody.data.eventId,
      channel: "sms",
      destination: guest.phone_number,
      ticket_link: ticketLink,
    });
  }

  let queuedDispatchJobs = 0;
  const queueWarnings: string[] = [];

  const { error: dispatchQueueError } = await supabase
    .from("dispatch_queue")
    .insert(dispatchJobs);

  if (dispatchQueueError) {
    queueWarnings.push(`Dispatch queue insert failed: ${dispatchQueueError.message}`);
  } else {
    queuedDispatchJobs = dispatchJobs.length;
  }

  return NextResponse.json(
    {
      success: true,
      guest,
      queuedDispatchJobs,
      queueWarnings,
    },
    { status: 201 },
  );
}
