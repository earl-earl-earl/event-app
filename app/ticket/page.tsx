import TicketCard from "@/app/ticket/TicketCard";
import { extractTokenFromQrContent } from "@/lib/qr";
import { getServiceSupabase } from "@/lib/supabase/service";
import { buildTicketLink } from "@/lib/ticket";
import { isJwtExpiredError, verifyGuestToken } from "@/lib/tokens";
import type { Json } from "@/types/database";

export const dynamic = "force-dynamic";

type TicketSearchParams = Promise<{
  token?: string | string[];
}>;

function normalizeTokenParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function normalizeMetadata(metadata: Json): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return metadata as Record<string, unknown>;
}

function InvalidTicket({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-xl rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Invalid Ticket</h1>
        <p className="mt-2 text-sm text-slate-700">{message}</p>
      </div>
    </main>
  );
}

export default async function TicketPage({
  searchParams,
}: {
  searchParams: TicketSearchParams;
}) {
  const query = await searchParams;
  const tokenParam = normalizeTokenParam(query.token);

  if (!tokenParam) {
    return <InvalidTicket message="Missing ticket token." />;
  }

  const token = extractTokenFromQrContent(tokenParam);
  if (!token) {
    return <InvalidTicket message="Malformed ticket token." />;
  }

  let payload;

  try {
    payload = await verifyGuestToken(token);
  } catch (error) {
    if (isJwtExpiredError(error)) {
      return <InvalidTicket message="Ticket token has expired." />;
    }

    return <InvalidTicket message="Ticket signature verification failed." />;
  }

  const supabase = getServiceSupabase();

  const { data: guest, error: guestError } = await supabase
    .from("guests")
    .select(
      "id, event_id, first_name, last_name, email, checked_in, entry_count, max_entries, metadata, qr_token",
    )
    .eq("id", payload.guestId)
    .maybeSingle();

  if (guestError || !guest) {
    return <InvalidTicket message="Guest record was not found." />;
  }

  if (guest.event_id !== payload.eventId || guest.qr_token !== token) {
    return <InvalidTicket message="Ticket no longer matches guest record." />;
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, name, date, location")
    .eq("id", guest.event_id)
    .maybeSingle();

  if (eventError || !event) {
    return <InvalidTicket message="Event record was not found." />;
  }

  const qrValue = buildTicketLink(token);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <TicketCard
        qrValue={qrValue}
        guestName={`${guest.first_name} ${guest.last_name}`}
        guestEmail={guest.email}
        eventName={event.name}
        eventDate={event.date}
        eventLocation={event.location}
        metadata={normalizeMetadata(guest.metadata)}
        checkedIn={guest.checked_in}
        entryCount={guest.entry_count}
        maxEntries={guest.max_entries}
      />
    </main>
  );
}
