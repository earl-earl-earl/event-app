import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminGuard } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { getServiceSupabase } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const createEventSchema = z.object({
  name: z.string().min(2).max(120),
  date: z.string().min(1),
  location: z.string().min(2).max(180),
});

export async function GET() {
  const guard = await requireAdminGuard();
  if ("response" in guard) {
    return guard.response;
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("events")
    .select("id, name, date, location, created_at")
    .order("date", { ascending: true });

  if (error) {
    return jsonError(error.message, 500, "events_fetch_failed");
  }

  return NextResponse.json({
    success: true,
    events: data,
  });
}

export async function POST(request: Request) {
  const guard = await requireAdminGuard();
  if ("response" in guard) {
    return guard.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON payload.", 400, "invalid_payload");
  }

  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.message, 400, "validation_error");
  }

  const eventDate = new Date(parsed.data.date);
  if (Number.isNaN(eventDate.getTime())) {
    return jsonError("Invalid event date.", 400, "invalid_date");
  }

  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from("events")
    .insert({
      name: parsed.data.name.trim(),
      date: eventDate.toISOString(),
      location: parsed.data.location.trim(),
    })
    .select("id, name, date, location, created_at")
    .single();

  if (error) {
    return jsonError(error.message, 500, "event_create_failed");
  }

  return NextResponse.json(
    {
      success: true,
      event: data,
    },
    { status: 201 },
  );
}
