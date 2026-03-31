import { NextResponse } from "next/server";
import { z } from "zod";

import { requireOrganizerGuard } from "@/lib/auth/guards";
import { serverEnv } from "@/lib/env/server";
import { getRequestIpAddress, jsonError } from "@/lib/http";
import { extractTokenFromQrContent } from "@/lib/qr";
import { getServiceSupabase } from "@/lib/supabase/service";
import { isJwtExpiredError, verifyGuestToken } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const verifyRequestSchema = z.object({
  token: z.string().min(1),
  scannerId: z.string().trim().min(1).max(120).optional(),
  eventId: z.string().uuid().optional(),
});

const failureStatusMap: Record<string, number> = {
  invalid_token: 401,
  token_expired: 401,
  guest_not_found: 404,
  event_mismatch: 409,
  already_checked_in: 409,
  entry_limit_reached: 409,
};

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

  const parsedBody = verifyRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError(parsedBody.error.message, 400, "validation_error");
  }

  const token = extractTokenFromQrContent(parsedBody.data.token);
  if (!token) {
    return jsonError("Invalid token.", 400, "invalid_token");
  }

  const sourceIp = getRequestIpAddress(request);
  const scannerId = parsedBody.data.scannerId ?? null;

  const supabase = getServiceSupabase();

  const rateLimitIdentifier = sourceIp
    ? `verify:${sourceIp}`
    : `verify-user:${guard.user.id}`;

  const { data: isAllowed, error: rateLimitError } = await supabase.rpc(
    "enforce_verify_rate_limit",
    {
      p_identifier: rateLimitIdentifier,
      p_window_seconds: serverEnv.VERIFY_RATE_LIMIT_WINDOW_SECONDS,
      p_max_requests: serverEnv.VERIFY_RATE_LIMIT_MAX_REQUESTS,
    },
  );

  if (rateLimitError) {
    return jsonError(rateLimitError.message, 500, "rate_limit_failed");
  }

  if (!isAllowed) {
    return jsonError("Too many scan attempts. Please slow down.", 429, "rate_limited");
  }

  let payload;

  try {
    payload = await verifyGuestToken(token);
  } catch (error) {
    const code = isJwtExpiredError(error) ? "token_expired" : "invalid_token";

    await supabase.rpc("log_scan_attempt", {
      p_success: false,
      p_reason: code,
      p_event_id: parsedBody.data.eventId ?? null,
      p_guest_id: null,
      p_token: token,
      p_scanner_id: scannerId,
      p_scanned_by: guard.user.id,
      p_source_ip: sourceIp,
      p_payload: {},
    });

    const message =
      code === "token_expired" ? "Token expired." : "Invalid token signature.";

    return jsonError(message, 401, code);
  }

  if (parsedBody.data.eventId && parsedBody.data.eventId !== payload.eventId) {
    await supabase.rpc("log_scan_attempt", {
      p_success: false,
      p_reason: "event_mismatch",
      p_event_id: payload.eventId,
      p_guest_id: payload.guestId,
      p_token: token,
      p_scanner_id: scannerId,
      p_scanned_by: guard.user.id,
      p_source_ip: sourceIp,
      p_payload: {
        requestedEventId: parsedBody.data.eventId,
      },
    });

    return jsonError("Event mismatch.", 409, "event_mismatch");
  }

  const { data: verifyRows, error: verifyError } = await supabase.rpc(
    "verify_guest_check_in",
    {
      p_guest_id: payload.guestId,
      p_event_id: payload.eventId,
      p_token: token,
      p_scanner_id: scannerId,
      p_scanned_by: guard.user.id,
      p_source_ip: sourceIp,
    },
  );

  if (verifyError) {
    return jsonError(verifyError.message, 500, "verify_failed");
  }

  const verifyResult = verifyRows?.[0];
  if (!verifyResult) {
    return jsonError("Verification failed.", 500, "verify_empty_result");
  }

  if (verifyResult.success) {
    return NextResponse.json({
      success: true,
      name: verifyResult.guest_name,
      metadata: verifyResult.metadata,
      entryCount: verifyResult.entry_count,
      maxEntries: verifyResult.max_entries,
      checkedInAt: verifyResult.checked_in_at,
    });
  }

  const statusCode = failureStatusMap[verifyResult.code] ?? 400;

  return NextResponse.json(
    {
      success: false,
      error: verifyResult.message,
      code: verifyResult.code,
    },
    { status: statusCode },
  );
}
