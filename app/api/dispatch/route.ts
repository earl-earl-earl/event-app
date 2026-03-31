import { NextResponse } from "next/server";
import { z } from "zod";

import { requireOrganizerGuard } from "@/lib/auth/guards";
import { dispatchTicket } from "@/lib/dispatch";
import { serverEnv } from "@/lib/env/server";
import { jsonError } from "@/lib/http";
import { getServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  batchSize: z.coerce.number().int().positive().max(500).optional(),
});

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
  const batchSize = parsedBody.data.batchSize ?? serverEnv.DISPATCH_BATCH_SIZE;

  const { data: claimedJobs, error: claimError } = await supabase.rpc(
    "claim_dispatch_jobs",
    {
      p_limit: batchSize,
    },
  );

  if (claimError) {
    return jsonError(claimError.message, 500, "dispatch_claim_failed");
  }

  if (!claimedJobs || claimedJobs.length === 0) {
    return NextResponse.json({
      success: true,
      processed: 0,
      sent: 0,
      retryQueued: 0,
      permanentlyFailed: 0,
      failures: [],
    });
  }

  let sent = 0;
  let retryQueued = 0;
  let permanentlyFailed = 0;

  const failures: Array<{ id: number; reason: string }> = [];

  for (const job of claimedJobs) {
    const result = await dispatchTicket(job);

    if (result.ok) {
      sent += 1;
      await supabase
        .from("dispatch_queue")
        .update({
          status: "sent",
          last_error: null,
        })
        .eq("id", job.id);
      continue;
    }

    failures.push({
      id: job.id,
      reason: result.error ?? "Unknown dispatch error.",
    });

    if (job.attempts >= 3) {
      permanentlyFailed += 1;
      await supabase
        .from("dispatch_queue")
        .update({
          status: "failed",
          last_error: result.error ?? "Unknown dispatch error.",
        })
        .eq("id", job.id);
      continue;
    }

    retryQueued += 1;
    await supabase
      .from("dispatch_queue")
      .update({
        status: "pending",
        last_error: result.error ?? "Unknown dispatch error.",
      })
      .eq("id", job.id);
  }

  return NextResponse.json({
    success: true,
    processed: claimedJobs.length,
    sent,
    retryQueued,
    permanentlyFailed,
    failures: failures.slice(0, 50),
  });
}
