import "server-only";

import { randomUUID } from "node:crypto";

import type { PostgrestError } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/env/server";
import { buildTicketLink } from "@/lib/ticket";
import { getServiceSupabase } from "@/lib/supabase/service";
import { signGuestToken } from "@/lib/tokens";
import type { Database } from "@/types/database";

import type { CsvGuestFailure, ParsedGuestInput } from "./guest-parser";

const INSERT_BATCH_SIZE = 500;
const TOKEN_GENERATION_CONCURRENCY = 50;

type GuestInsert = Database["public"]["Tables"]["guests"]["Insert"];
type DispatchInsert = Database["public"]["Tables"]["dispatch_queue"]["Insert"];

interface PreparedGuestRecord {
  id: string;
  event_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  qr_token: string;
  max_entries: number;
  metadata: GuestInsert["metadata"];
}

interface PreparedGuestRow {
  rowNumber: number;
  guest: PreparedGuestRecord;
}

export interface GuestImportResult {
  insertedCount: number;
  failedCount: number;
  queuedDispatchJobs: number;
  failures: CsvGuestFailure[];
  queueWarnings: string[];
  ticketLinks: Array<{
    rowNumber: number;
    email: string;
    phoneNumber: string;
    ticketLink: string;
  }>;
}

function formatPostgrestError(error: PostgrestError): string {
  return [error.message, error.details, error.hint].filter(Boolean).join(" ");
}

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
  const output: U[] = new Array(items.length);
  let currentIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = currentIndex;
      currentIndex += 1;

      if (index >= items.length) {
        return;
      }

      output[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );

  return output;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

async function prepareGuestRows(
  eventId: string,
  rows: ParsedGuestInput[],
): Promise<PreparedGuestRow[]> {
  return mapWithConcurrency(
    rows,
    TOKEN_GENERATION_CONCURRENCY,
    async (row): Promise<PreparedGuestRow> => {
      const guestId = randomUUID();
      const token = await signGuestToken({
        guestId,
        eventId,
      });

      return {
        rowNumber: row.rowNumber,
        guest: {
          id: guestId,
          event_id: eventId,
          first_name: row.firstName,
          last_name: row.lastName,
          email: row.email,
          phone_number: row.phoneNumber,
          qr_token: token,
          max_entries: row.maxEntries,
          metadata: row.metadata,
        },
      };
    },
  );
}

async function queueDispatchJobs(
  insertedRows: PreparedGuestRow[],
): Promise<{ queuedCount: number; warnings: string[] }> {
  if (insertedRows.length === 0) {
    return { queuedCount: 0, warnings: [] };
  }

  const supabase = getServiceSupabase();

  const dispatchJobs: DispatchInsert[] = [];
  const smsEnabled = Boolean(
    serverEnv.TWILIO_ACCOUNT_SID &&
      serverEnv.TWILIO_AUTH_TOKEN &&
      serverEnv.TWILIO_FROM_NUMBER,
  );

  for (const insertedRow of insertedRows) {
    const ticketLink = buildTicketLink(insertedRow.guest.qr_token);

    dispatchJobs.push({
      guest_id: insertedRow.guest.id,
      event_id: insertedRow.guest.event_id,
      channel: "email",
      destination: insertedRow.guest.email,
      ticket_link: ticketLink,
    });

    if (smsEnabled) {
      dispatchJobs.push({
        guest_id: insertedRow.guest.id,
        event_id: insertedRow.guest.event_id,
        channel: "sms",
        destination: insertedRow.guest.phone_number,
        ticket_link: ticketLink,
      });
    }
  }

  let queuedCount = 0;
  const warnings: string[] = [];

  for (const chunk of chunkArray(dispatchJobs, INSERT_BATCH_SIZE)) {
    const { error } = await supabase.from("dispatch_queue").insert(chunk);

    if (error) {
      warnings.push(`Dispatch queue insert failed: ${formatPostgrestError(error)}`);
      continue;
    }

    queuedCount += chunk.length;
  }

  return { queuedCount, warnings };
}

export async function importGuestsForEvent(params: {
  eventId: string;
  rows: ParsedGuestInput[];
  preValidationFailures?: CsvGuestFailure[];
}): Promise<GuestImportResult> {
  const supabase = getServiceSupabase();

  const preparedRows = await prepareGuestRows(params.eventId, params.rows);

  const failures: CsvGuestFailure[] = [...(params.preValidationFailures ?? [])];
  const insertedRows: PreparedGuestRow[] = [];

  for (const chunk of chunkArray(preparedRows, INSERT_BATCH_SIZE)) {
    const { error } = await supabase
      .from("guests")
      .insert(chunk.map((item) => item.guest));

    if (!error) {
      insertedRows.push(...chunk);
      continue;
    }

    for (const row of chunk) {
      const { error: rowError } = await supabase.from("guests").insert(row.guest);

      if (rowError) {
        failures.push({
          rowNumber: row.rowNumber,
          reason: formatPostgrestError(rowError),
        });
        continue;
      }

      insertedRows.push(row);
    }
  }

  const queueResult = await queueDispatchJobs(insertedRows);

  const ticketLinks = insertedRows.map((insertedRow) => ({
    rowNumber: insertedRow.rowNumber,
    email: insertedRow.guest.email,
    phoneNumber: insertedRow.guest.phone_number,
    ticketLink: buildTicketLink(insertedRow.guest.qr_token),
  }));

  return {
    insertedCount: insertedRows.length,
    failedCount: failures.length,
    queuedDispatchJobs: queueResult.queuedCount,
    failures,
    queueWarnings: queueResult.warnings,
    ticketLinks,
  };
}
