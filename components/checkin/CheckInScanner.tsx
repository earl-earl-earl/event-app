"use client";

import type { Html5Qrcode } from "html5-qrcode";
import { useCallback, useEffect, useRef, useState } from "react";

import { extractTokenFromQrContent } from "@/lib/qr";

type ScanHistoryItem = {
  id: string;
  status: "success" | "error";
  message: string;
  name?: string;
  timestamp: string;
};

type VerifyResponse =
  | {
      success: true;
      name: string;
      metadata: Record<string, unknown>;
      entryCount: number;
      maxEntries: number;
      checkedInAt: string;
    }
  | {
      success: false;
      error: string;
      code: string;
    };

function createHistoryId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatTimestamp(): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}

export function CheckInScanner() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastTokenRef = useRef<string>("");
  const lastTokenSeenAtRef = useRef<number>(0);

  const [manualInput, setManualInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isScannerReady, setIsScannerReady] = useState(false);
  const [latestResult, setLatestResult] = useState<ScanHistoryItem | null>(null);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);

  const pushHistory = useCallback((entry: ScanHistoryItem) => {
    setLatestResult(entry);
    setHistory((previous) => [entry, ...previous].slice(0, 12));
  }, []);

  const verifyScan = useCallback(
    async (rawToken: string) => {
      const token = extractTokenFromQrContent(rawToken);
      if (!token) {
        pushHistory({
          id: createHistoryId(),
          status: "error",
          message: "Invalid QR payload.",
          timestamp: formatTimestamp(),
        });
        return;
      }

      const now = Date.now();
      if (token === lastTokenRef.current && now - lastTokenSeenAtRef.current < 2000) {
        return;
      }

      lastTokenRef.current = token;
      lastTokenSeenAtRef.current = now;

      setIsVerifying(true);

      try {
        const response = await fetch("/api/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token,
            scannerId: "web-scanner",
          }),
        });

        const data = (await response.json()) as VerifyResponse;

        if (response.ok && data.success) {
          pushHistory({
            id: createHistoryId(),
            status: "success",
            message: `Entry allowed (${data.entryCount}/${data.maxEntries}).`,
            name: data.name,
            timestamp: formatTimestamp(),
          });
          return;
        }

        pushHistory({
          id: createHistoryId(),
          status: "error",
          message:
            "success" in data && data.success === false
              ? data.error
              : "Entry denied.",
          timestamp: formatTimestamp(),
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Verification request failed.";

        pushHistory({
          id: createHistoryId(),
          status: "error",
          message,
          timestamp: formatTimestamp(),
        });
      } finally {
        setIsVerifying(false);
      }
    },
    [pushHistory],
  );

  useEffect(() => {
    let cancelled = false;

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");

        const cameras = await Html5Qrcode.getCameras();
        if (cancelled) {
          return;
        }

        if (!cameras || cameras.length === 0) {
          setScannerError("No camera found on this device.");
          return;
        }

        const scanner = new Html5Qrcode("scanner-region");
        scannerRef.current = scanner;

        await scanner.start(
          cameras[0].id,
          {
            fps: 10,
            qrbox: { width: 280, height: 280 },
            aspectRatio: 1.333,
          },
          (decodedText) => {
            void verifyScan(decodedText);
          },
          () => {
            // Ignore frame-level decode errors.
          },
        );

        if (!cancelled) {
          setScannerError(null);
          setIsScannerReady(true);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to start camera scanner.";
        setScannerError(message);
      }
    }

    void startScanner();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;

      if (scanner) {
        void scanner
          .stop()
          .catch(() => undefined)
          .finally(() => {
            try {
              scanner.clear();
            } catch {
              // Ignore cleanup errors during unmount.
            }
          });
      }
    };
  }, [verifyScan]);

  async function handleManualSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!manualInput.trim()) {
      return;
    }

    await verifyScan(manualInput.trim());
    setManualInput("");
  }

  const latestResultClassName =
    latestResult?.status === "success"
      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
      : latestResult?.status === "error"
        ? "border-rose-300 bg-rose-50 text-rose-900"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Check-In Scanner</h1>
        <p className="mt-1 text-sm text-slate-600">
          Scan attendee ticket QR codes and verify entry in real time.
        </p>

        <div
          id="scanner-region"
          className="mt-4 overflow-hidden rounded-xl border border-slate-300 bg-black"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span
            className={`inline-flex rounded-full px-3 py-1 font-medium ${
              isScannerReady
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {isScannerReady ? "Scanner ready" : "Starting scanner..."}
          </span>
          {isVerifying ? (
            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              Verifying...
            </span>
          ) : null}
        </div>

        {scannerError ? (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {scannerError}
          </p>
        ) : null}

        <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={handleManualSubmit}>
          <input
            value={manualInput}
            onChange={(event) => setManualInput(event.target.value)}
            placeholder="Paste token or ticket URL"
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
          />
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Verify
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <div className={`rounded-xl border p-4 ${latestResultClassName}`}>
          <h2 className="text-sm font-semibold uppercase tracking-wide">Latest Result</h2>
          {latestResult ? (
            <div className="mt-2 space-y-1 text-sm">
              <p className="font-medium">{latestResult.message}</p>
              {latestResult.name ? <p>{latestResult.name}</p> : null}
              <p>{latestResult.timestamp}</p>
            </div>
          ) : (
            <p className="mt-2 text-sm">Waiting for scan...</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            Recent Scans
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {history.map((item) => (
              <li
                key={item.id}
                className={`rounded-lg border px-3 py-2 ${
                  item.status === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-rose-200 bg-rose-50 text-rose-900"
                }`}
              >
                <p className="font-medium">{item.message}</p>
                {item.name ? <p>{item.name}</p> : null}
                <p className="text-xs opacity-80">{item.timestamp}</p>
              </li>
            ))}
            {history.length === 0 ? (
              <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500">
                No scans yet.
              </li>
            ) : null}
          </ul>
        </div>
      </section>
    </div>
  );
}
