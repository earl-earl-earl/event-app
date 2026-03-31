"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useRef, useState } from "react";

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

type DownloadKind = "pdf" | "png";

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

function formatFileNamePart(value: string): string {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "-");
}

function buildTicketFileName(
  eventName: string,
  guestName: string,
  extension: DownloadKind,
): string {
  const parts = [eventName, guestName, "ticket"]
    .map(formatFileNamePart)
    .filter(Boolean);
  const baseName = parts.join("-");
  return `${baseName || "ticket"}.${extension}`;
}

function triggerDownload(dataUrl: string, fileName: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  link.click();
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
  const [downloadStatus, setDownloadStatus] = useState<DownloadKind | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const ticketRef = useRef<HTMLDivElement | null>(null);

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
  const isDownloading = downloadStatus !== null;
  const canDownload = Boolean(qrDataUrl) && !qrError;

  const getTicketNode = () => {
    const node = ticketRef.current;
    if (!node) {
      throw new Error("Ticket is not ready yet.");
    }

    return node;
  };

  const getTicketPng = async () => {
    const { toPng } = await import("html-to-image");
    return toPng(getTicketNode(), {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#ffffff",
    });
  };

  const handleDownloadPng = async () => {
    setDownloadStatus("png");
    setDownloadError(null);

    try {
      const dataUrl = await getTicketPng();
      triggerDownload(dataUrl, buildTicketFileName(eventName, guestName, "png"));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to download PNG.";
      setDownloadError(message);
    } finally {
      setDownloadStatus(null);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadStatus("pdf");
    setDownloadError(null);

    try {
      const node = getTicketNode();
      const dataUrl = await getTicketPng();
      const rect = node.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({
        orientation: width > height ? "landscape" : "portrait",
        unit: "px",
        format: [width, height],
      });

      pdf.addImage(dataUrl, "PNG", 0, 0, width, height);
      pdf.save(buildTicketFileName(eventName, guestName, "pdf"));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to download PDF.";
      setDownloadError(message);
    } finally {
      setDownloadStatus(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div
        ref={ticketRef}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Event Ticket
            </p>
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

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canDownload || isDownloading}
          onClick={() => void handleDownloadPng()}
        >
          {downloadStatus === "png" ? "Preparing PNG..." : "Download PNG"}
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canDownload || isDownloading}
          onClick={() => void handleDownloadPdf()}
        >
          {downloadStatus === "pdf" ? "Preparing PDF..." : "Download PDF"}
        </button>
      </div>

      {downloadError ? (
        <p className="mt-2 text-sm text-rose-700">{downloadError}</p>
      ) : null}
    </div>
  );
}
