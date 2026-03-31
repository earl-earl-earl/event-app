import { NextResponse } from "next/server";
import { z } from "zod";

import { requireOrganizerGuard } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { buildTicketLink } from "@/lib/ticket";
import { getServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  eventId: z.string().uuid(),
});

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

export async function POST(request: Request) {
  const guard = await requireOrganizerGuard();
  if ("response" in guard) {
    return guard.response;
  }

  let rawBody: unknown = {};

  try {
    const bodyText = await request.text();
    rawBody = bodyText.length > 0 ? JSON.parse(bodyText) : {};
  } catch {
    return jsonError("Invalid JSON payload.", 400, "invalid_payload");
  }

  const parsedBody = requestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return jsonError(parsedBody.error.message, 400, "validation_error");
  }

  const supabase = getServiceSupabase();
  const pageSize = 1000;
  const insertBatchSize = 500;
  const warnings: string[] = [];
  let queuedCount = 0;
  let offset = 0;

  while (true) {
    const { data: guests, error } = await supabase
      .from("guests")
      .select("id, event_id, email, qr_token, created_at")
      .eq("event_id", parsedBody.data.eventId)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      return jsonError(error.message, 500, "guest_fetch_failed");
    }

    if (!guests || guests.length === 0) {
      break;
    }

    const dispatchJobs = guests
      .filter((guest) => guest.email && guest.qr_token)
      .map((guest) => ({
        guest_id: guest.id,
        event_id: guest.event_id,
        channel: "email" as const,
        destination: guest.email,
        ticket_link: buildTicketLink(guest.qr_token),
      }));

    for (const chunk of chunkArray(dispatchJobs, insertBatchSize)) {
      const { error: insertError } = await supabase
        .from("dispatch_queue")
        .insert(chunk);

      if (insertError) {
        warnings.push(`Dispatch queue insert failed: ${insertError.message}`);
        continue;
      }

      queuedCount += chunk.length;
    }

    offset += pageSize;

    if (guests.length < pageSize) {
      break;
    }
  }

  return NextResponse.json({
    success: true,
    queuedCount,
    warnings: warnings.slice(0, 10),
  });
}
