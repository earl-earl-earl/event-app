"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";

interface TicketCardProps {
  qrValue: string;
  guestName: string;
  guestEmail: string;
  eventName: string;
  eventDate: string;
  eventLocation: string;
  metadata: Record<string, unknown>;
  checkedIn: boolean;
  entryCount: number;
  maxEntries: number;
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(parsed);
}

export default function TicketCard({
  qrValue,
  guestName,
  guestEmail,
  eventName,
  eventDate,
  eventLocation,
  metadata,
  checkedIn,
  entryCount,
  maxEntries,
}: TicketCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [qrError, setQrError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function renderQrCode() {
      try {
        const url = await QRCode.toDataURL(qrValue, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 320,
        });

        if (active) {
          setQrDataUrl(url);
          setQrError(null);
        }
      } catch (error) {
        if (!active) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "Failed to render QR code.";
        setQrError(message);
      }
    }

    void renderQrCode();

    return () => {
      active = false;
    };
  }, [qrValue]);

  const metadataEntries = useMemo(() => Object.entries(metadata), [metadata]);

  return (
    <div className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Event Ticket</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{eventName}</h1>
          <p className="mt-1 text-sm text-slate-600">{formatDate(eventDate)}</p>
          <p className="text-sm text-slate-600">{eventLocation}</p>
        </div>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
            checkedIn
              ? "bg-amber-100 text-amber-800"
              : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {checkedIn ? "Already checked in" : "Ready for entry"}
        </span>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-sm text-slate-500">Guest</p>
          <p className="text-lg font-semibold text-slate-900">{guestName}</p>
          <p className="text-sm text-slate-600">{guestEmail}</p>
          <p className="mt-2 text-sm text-slate-600">
            Entries used: {entryCount}/{maxEntries}
          </p>

          {metadataEntries.length > 0 ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Additional Details
              </p>
              <dl className="mt-2 space-y-1 text-sm text-slate-700">
                {metadataEntries.map(([key, value]) => (
                  <div key={key} className="grid grid-cols-[auto_1fr] gap-2">
                    <dt className="font-medium text-slate-800">{key}</dt>
                    <dd className="truncate">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </div>

        <div className="flex min-h-64 min-w-64 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-3">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="Ticket QR code" className="h-64 w-64" />
          ) : qrError ? (
            <p className="text-center text-sm text-rose-700">{qrError}</p>
          ) : (
            <p className="text-sm text-slate-500">Rendering QR code...</p>
          )}
        </div>
      </div>

      <p className="mt-5 text-xs text-slate-500">
        Keep this ticket link private. Entry validation is always performed server-side.
      </p>
    </div>
  );
}
