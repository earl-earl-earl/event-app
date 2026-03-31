import { NextResponse } from "next/server";
import { z } from "zod";

import { requireOrganizerGuard } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { getServiceSupabase } from "@/lib/supabase/service";
import type { Database, Json } from "@/types/database";

export const dynamic = "force-dynamic";

type GuestUpdate = Database["public"]["Tables"]["guests"]["Update"];

const guestIdSchema = z.string().uuid();

const updateGuestSchema = z
  .object({
    eventId: z.string().uuid(),
    firstName: z.string().trim().min(1).max(120).optional(),
    lastName: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().max(320).optional(),
    phoneNumber: z.string().trim().min(3).max(64).optional(),
    maxEntries: z.coerce.number().int().positive().max(100).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (value) =>
      value.firstName !== undefined ||
      value.lastName !== undefined ||
      value.email !== undefined ||
      value.phoneNumber !== undefined ||
      value.maxEntries !== undefined ||
      value.metadata !== undefined,
    {
      message: "At least one update field is required.",
    },
  );

const deleteQuerySchema = z.object({
  eventId: z.string().uuid().optional(),
});

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

async function fetchGuestById(guestId: string) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("guests")
    .select("id, event_id")
    .eq("id", guestId)
    .maybeSingle();

  if (error) {
    return {
      error: jsonError(error.message, 500, "guest_fetch_failed"),
      guest: null,
    };
  }

  if (!data) {
    return {
      error: jsonError("Guest not found.", 404, "guest_not_found"),
      guest: null,
    };
  }

  return {
    error: null,
    guest: data,
  };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ guestId: string }> },
) {
  const guard = await requireOrganizerGuard();
  if ("response" in guard) {
    return guard.response;
  }

  const { guestId } = await context.params;
  const parsedGuestId = guestIdSchema.safeParse(guestId);
  if (!parsedGuestId.success) {
    return jsonError("Invalid guest id.", 400, "invalid_guest_id");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON payload.", 400, "invalid_payload");
  }

  const parsedBody = updateGuestSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError(parsedBody.error.message, 400, "validation_error");
  }

  const targetGuest = await fetchGuestById(parsedGuestId.data);
  if (targetGuest.error) {
    return targetGuest.error;
  }

  if (targetGuest.guest.event_id !== parsedBody.data.eventId) {
    return jsonError(
      "Guest does not belong to the selected event.",
      409,
      "event_mismatch",
    );
  }

  const updatePayload: GuestUpdate = {};

  if (parsedBody.data.firstName !== undefined) {
    updatePayload.first_name = parsedBody.data.firstName.trim();
  }

  if (parsedBody.data.lastName !== undefined) {
    updatePayload.last_name = parsedBody.data.lastName.trim();
  }

  if (parsedBody.data.email !== undefined) {
    updatePayload.email = parsedBody.data.email.trim().toLowerCase();
  }

  if (parsedBody.data.phoneNumber !== undefined) {
    updatePayload.phone_number = parsedBody.data.phoneNumber.trim();
  }

  if (parsedBody.data.maxEntries !== undefined) {
    updatePayload.max_entries = parsedBody.data.maxEntries;
  }

  if (parsedBody.data.metadata !== undefined) {
    updatePayload.metadata = normalizeMetadata(parsedBody.data.metadata);
  }

  const supabase = getServiceSupabase();
  const { data: updatedGuest, error: updateError } = await supabase
    .from("guests")
    .update(updatePayload)
    .eq("id", parsedGuestId.data)
    .eq("event_id", parsedBody.data.eventId)
    .select(
      "id, event_id, first_name, last_name, email, phone_number, checked_in, checked_in_at, entry_count, max_entries, metadata, created_at",
    )
    .single();

  if (updateError) {
    return jsonError(updateError.message, 500, "guest_update_failed");
  }

  return NextResponse.json({
    success: true,
    guest: updatedGuest,
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ guestId: string }> },
) {
  const guard = await requireOrganizerGuard();
  if ("response" in guard) {
    return guard.response;
  }

  const { guestId } = await context.params;
  const parsedGuestId = guestIdSchema.safeParse(guestId);
  if (!parsedGuestId.success) {
    return jsonError("Invalid guest id.", 400, "invalid_guest_id");
  }

  const url = new URL(request.url);
  const parsedQuery = deleteQuerySchema.safeParse({
    eventId: url.searchParams.get("eventId") ?? undefined,
  });

  if (!parsedQuery.success) {
    return jsonError(parsedQuery.error.message, 400, "validation_error");
  }

  const targetGuest = await fetchGuestById(parsedGuestId.data);
  if (targetGuest.error) {
    return targetGuest.error;
  }

  if (
    parsedQuery.data.eventId &&
    targetGuest.guest.event_id !== parsedQuery.data.eventId
  ) {
    return jsonError(
      "Guest does not belong to the selected event.",
      409,
      "event_mismatch",
    );
  }

  const supabase = getServiceSupabase();

  let deleteQuery = supabase.from("guests").delete().eq("id", parsedGuestId.data);

  if (parsedQuery.data.eventId) {
    deleteQuery = deleteQuery.eq("event_id", parsedQuery.data.eventId);
  }

  const { error: deleteError } = await deleteQuery;

  if (deleteError) {
    return jsonError(deleteError.message, 500, "guest_delete_failed");
  }

  return NextResponse.json({
    success: true,
    deletedGuestId: parsedGuestId.data,
  });
}
