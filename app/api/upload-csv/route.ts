import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminGuard } from "@/lib/auth/guards";
import { importGuestsForEvent } from "@/lib/csv/import-guests";
import { parseGuestCsv } from "@/lib/csv/guest-parser";
import { jsonError } from "@/lib/http";
import { getServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  eventId: z.string().uuid(),
});

export async function POST(request: Request) {
  const guard = await requireAdminGuard();
  if ("response" in guard) {
    return guard.response;
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return jsonError("Invalid multipart request.", 400, "invalid_form_data");
  }

  const payload = payloadSchema.safeParse({
    eventId: formData.get("eventId"),
  });

  if (!payload.success) {
    return jsonError(payload.error.message, 400, "validation_error");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonError("CSV file is required.", 400, "missing_file");
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    return jsonError("Only .csv files are supported.", 400, "invalid_file_type");
  }

  const csvText = await file.text();
  if (!csvText.trim()) {
    return jsonError("CSV file is empty.", 400, "empty_csv");
  }

  const supabase = getServiceSupabase();
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, name")
    .eq("id", payload.data.eventId)
    .maybeSingle();

  if (eventError) {
    return jsonError(eventError.message, 500, "event_fetch_failed");
  }

  if (!event) {
    return jsonError("Event not found.", 404, "event_not_found");
  }

  const parsedCsv = parseGuestCsv(csvText);

  if (parsedCsv.guests.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: "No valid rows found in CSV.",
        code: "no_valid_rows",
        failures: parsedCsv.failures,
      },
      { status: 422 },
    );
  }

  const result = await importGuestsForEvent({
    eventId: payload.data.eventId,
    rows: parsedCsv.guests,
    preValidationFailures: parsedCsv.failures,
  });

  return NextResponse.json({
    success: true,
    event,
    insertedCount: result.insertedCount,
    failedCount: result.failedCount,
    queuedDispatchJobs: result.queuedDispatchJobs,
    queueWarnings: result.queueWarnings,
    failures: result.failures.slice(0, 200),
    failureOverflow: Math.max(result.failures.length - 200, 0),
    ticketLinksPreview: result.ticketLinks.slice(0, 50),
  });
}
