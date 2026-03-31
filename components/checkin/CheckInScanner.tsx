"use client";

import Link from "next/link";
import type { CameraDevice, Html5Qrcode } from "html5-qrcode";
import { useCallback, useEffect, useRef, useState } from "react";

import { extractTokenFromQrContent } from "@/lib/qr";

/* ─── Types ─── */

type ScanStatus = "idle" | "success" | "error";

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

/* ─── Helpers ─── */

function createHistoryId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatTimestamp(): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date());
}

const MIN_QR_BOX_SIZE = 160;
const MAX_QR_BOX_SIZE = 280;

function clampQrBoxSize(size: number): number {
  return Math.max(MIN_QR_BOX_SIZE, Math.min(size, MAX_QR_BOX_SIZE));
}

function getQrBoxSize(viewfinderWidth: number, viewfinderHeight: number): number {
  const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
  return clampQrBoxSize(Math.floor(minEdge * 0.6));
}

function pickPreferredCamera(cameras: CameraDevice[]): CameraDevice | undefined {
  return cameras.find((camera) => /back|rear|environment/i.test(camera.label));
}

/* ─── Sub-components ─── */

function ScanViewfinder({ status }: { status: ScanStatus }) {
  const color =
    status === "success"
      ? "#10b981"
      : status === "error"
        ? "#ef4444"
        : "#3b82f6";

  return (
    <div className="relative" aria-hidden>
      {/* Corner brackets */}
      {[
        "top-0 left-0",
        "top-0 right-0 rotate-90",
        "bottom-0 right-0 rotate-180",
        "bottom-0 left-0 -rotate-90",
      ].map((pos, i) => (
        <span
          key={i}
          className={`absolute ${pos} w-8 h-8 transition-colors duration-300`}
          style={{
            borderTop: `3px solid ${color}`,
            borderLeft: `3px solid ${color}`,
            borderRadius: "3px 0 0 0",
          }}
        />
      ))}
    </div>
  );
}

function ResultBanner({
  status,
  message,
  name,
  entryCount,
  maxEntries,
}: {
  status: ScanStatus;
  message: string;
  name?: string;
  entryCount?: number;
  maxEntries?: number;
}) {
  if (status === "idle") {
    return null;
  }

  const isSuccess = status === "success";

  return (
    <div
      className={`mx-4 mb-4 rounded-2xl p-4 transition-all ${
        isSuccess
          ? "bg-emerald-500/10 border border-emerald-500/30"
          : "bg-red-500/10 border border-red-500/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            isSuccess ? "bg-emerald-500/20" : "bg-red-500/20"
          }`}
        >
          {isSuccess ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" fill="#10b981" />
              <path
                d="M5 8l2.5 2.5L11 5.5"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" fill="#ef4444" />
              <path
                d="M5.5 5.5l5 5M10.5 5.5l-5 5"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {name ? (
            <p className={`font-semibold text-base ${isSuccess ? "text-emerald-300" : "text-red-300"}`}>
              {name}
            </p>
          ) : null}
          <p className={`text-sm ${isSuccess ? "text-emerald-400" : "text-red-400"}`}>
            {message}
          </p>
          {isSuccess && entryCount !== undefined && maxEntries !== undefined ? (
            <div className="mt-2">
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${Math.min((entryCount / maxEntries) * 100, 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-emerald-500/70">
                Entry {entryCount} of {maxEntries}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */

export function CheckInScanner() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastTokenRef = useRef<string>("");
  const lastTokenSeenAtRef = useRef<number>(0);
  const viewfinderWrapperRef = useRef<HTMLDivElement | null>(null);

  const [manualInput, setManualInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isScannerReady, setIsScannerReady] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);

  const [qrBoxSize, setQrBoxSize] = useState<number>(220);

  const [latestStatus, setLatestStatus] = useState<ScanStatus>("idle");
  const [latestMessage, setLatestMessage] = useState("");
  const [latestName, setLatestName] = useState<string | undefined>(undefined);
  const [latestEntryCount, setLatestEntryCount] = useState<number | undefined>(undefined);
  const [latestMaxEntries, setLatestMaxEntries] = useState<number | undefined>(undefined);

  const maskRadius = Math.max(Math.floor(qrBoxSize / 2), 80);
  const maskInnerRadius = Math.max(maskRadius - 2, 60);
  const scanLineWidth = Math.max(Math.round(qrBoxSize * 0.8), 140);

  // Auto-clear the result banner after 4 seconds
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showResult(
    status: "success" | "error",
    message: string,
    name?: string,
    entryCount?: number,
    maxEntries?: number,
  ) {
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
    }
    setLatestStatus(status);
    setLatestMessage(message);
    setLatestName(name);
    setLatestEntryCount(entryCount);
    setLatestMaxEntries(maxEntries);

    bannerTimerRef.current = setTimeout(() => {
      setLatestStatus("idle");
    }, 4000);
  }

  const pushHistory = useCallback((entry: ScanHistoryItem) => {
    setHistory((previous) => [entry, ...previous].slice(0, 20));
  }, []);

  const verifyScan = useCallback(
    async (rawToken: string) => {
      const token = extractTokenFromQrContent(rawToken);
      if (!token) {
        showResult("error", "Invalid QR code — no token found.");
        pushHistory({
          id: createHistoryId(),
          status: "error",
          message: "Invalid QR payload.",
          timestamp: formatTimestamp(),
        });
        return;
      }

      const now = Date.now();
      if (token === lastTokenRef.current && now - lastTokenSeenAtRef.current < 2500) {
        return;
      }

      lastTokenRef.current = token;
      lastTokenSeenAtRef.current = now;

      setIsVerifying(true);

      try {
        const response = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, scannerId: "web-scanner" }),
        });

        const data = (await response.json()) as VerifyResponse;

        if (response.ok && data.success) {
          const msg = `Entry allowed (${data.entryCount}/${data.maxEntries})`;
          showResult("success", msg, data.name, data.entryCount, data.maxEntries);
          pushHistory({
            id: createHistoryId(),
            status: "success",
            message: msg,
            name: data.name,
            timestamp: formatTimestamp(),
          });
          return;
        }

        const errMsg = "success" in data && !data.success ? data.error : "Entry denied.";
        showResult("error", errMsg);
        pushHistory({
          id: createHistoryId(),
          status: "error",
          message: errMsg,
          timestamp: formatTimestamp(),
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Verification request failed.";
        showResult("error", msg);
        pushHistory({
          id: createHistoryId(),
          status: "error",
          message: msg,
          timestamp: formatTimestamp(),
        });
      } finally {
        setIsVerifying(false);
      }
    },
    [pushHistory],
  );

  useEffect(() => {
    const element = viewfinderWrapperRef.current;
    if (!element) return;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      setQrBoxSize(getQrBoxSize(rect.width, rect.height));
    };

    updateSize();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const cameras = await Html5Qrcode.getCameras();
        if (cancelled) return;

        if (!cameras || cameras.length === 0) {
          setScannerError("No camera found. Use the manual entry below.");
          return;
        }

        const scanner = new Html5Qrcode("scanner-viewfinder");
        scannerRef.current = scanner;

        const preferredCamera = pickPreferredCamera(cameras);
        const onScanSuccess = (decodedText: string) => { void verifyScan(decodedText); };
        const onScanFailure = () => { /* ignore frame errors */ };
        const scanConfig = {
          fps: 10,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const size = getQrBoxSize(viewfinderWidth, viewfinderHeight);
            return { width: size, height: size };
          },
          aspectRatio: 4 / 3,
          videoConstraints: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };

        // Try a known rear camera first, then explicit environment constraints, then final fallback.
        const cameraStartAttempts: Array<string | MediaTrackConstraints> = [];
        if (preferredCamera?.id) {
          cameraStartAttempts.push(preferredCamera.id);
        }
        cameraStartAttempts.push({ facingMode: { exact: "environment" } });
        cameraStartAttempts.push({ facingMode: { ideal: "environment" } });
        if (!preferredCamera?.id && cameras[0]?.id) {
          cameraStartAttempts.push(cameras[0].id);
        }

        let startError: unknown;
        for (const cameraTarget of cameraStartAttempts) {
          try {
            await scanner.start(cameraTarget, scanConfig, onScanSuccess, onScanFailure);
            startError = undefined;
            break;
          } catch (error) {
            startError = error;
          }
        }

        if (startError) {
          throw startError;
        }

        if (!cancelled) {
          setScannerError(null);
          setIsScannerReady(true);
        }
      } catch (error) {
        if (!cancelled) {
          setScannerError(
            error instanceof Error ? error.message : "Unable to start camera.",
          );
        }
      }
    }

    void startScanner();

    return () => {
      cancelled = true;
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        void scanner.stop().catch(() => undefined).finally(() => {
          try { scanner.clear(); } catch { /* ignore */ }
        });
      }
    };
  }, [verifyScan]);

  async function handleManualSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!manualInput.trim()) return;
    await verifyScan(manualInput.trim());
    setManualInput("");
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            aria-label="Back to dashboard"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="10 12 6 8 10 4" />
            </svg>
          </Link>
          <div>
            <p className="text-sm font-semibold text-white leading-none">QR Scanner</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Check-In Mode</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Live indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5">
            {isScannerReady ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-[11px] font-medium text-emerald-400">Live</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-[11px] font-medium text-amber-400">Starting</span>
              </>
            )}
          </div>

          {/* History toggle */}
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            aria-label="Toggle scan history"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1z" />
              <path d="M8 4v4l2.5 2.5" />
            </svg>
            {history.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                {history.length > 9 ? "9+" : history.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Camera viewfinder */}
      <div className="relative flex-1 flex flex-col">
        {/* Scanner container */}
        <div
          ref={viewfinderWrapperRef}
          className="relative w-full max-w-[640px] mx-auto bg-black overflow-hidden rounded-3xl border border-white/10"
          style={{ aspectRatio: "4 / 3" }}
        >
          <div id="scanner-viewfinder" className="w-full h-full" />

          {/* Viewfinder overlay */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Dark overlay with transparent center cutout */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="absolute inset-0 bg-black/50"
                style={{
                  maskImage: `radial-gradient(circle ${maskRadius}px at 50% 50%, transparent ${maskInnerRadius}px, black ${maskRadius}px)`,
                  WebkitMaskImage: `radial-gradient(circle ${maskRadius}px at 50% 50%, transparent ${maskInnerRadius}px, black ${maskRadius}px)`,
                }}
              />
              {/* Corner brackets */}
              <div className="relative" style={{ width: qrBoxSize, height: qrBoxSize }}>
                <ScanViewfinder status={latestStatus} />
              </div>
            </div>

            {/* Scanning line */}
            {isScannerReady && latestStatus === "idle" && (
              <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                <div
                  className="h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-80"
                  style={{ width: scanLineWidth, animation: "scanline 2s ease-in-out infinite" }}
                />
              </div>
            )}
          </div>

          {/* Scanner error */}
          {scannerError && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-center max-w-xs">
                <svg className="mx-auto mb-2" width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="16" r="14" stroke="#ef4444" strokeWidth="1.5" />
                  <path d="M16 10v7M16 21v1" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <p className="text-sm text-red-300">{scannerError}</p>
              </div>
            </div>
          )}

          {/* Verifying spinner overlay */}
          {isVerifying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 backdrop-blur-sm">
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="#60a5fa" strokeWidth="2" opacity="0.3" />
                  <path d="M14 8a6 6 0 01-6 6" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span className="text-xs font-medium text-blue-300">Verifying...</span>
              </div>
            </div>
          )}
        </div>

        {/* Result banner */}
        <div className="pt-4">
          <ResultBanner
            status={latestStatus}
            message={latestMessage}
            name={latestName}
            entryCount={latestEntryCount}
            maxEntries={latestMaxEntries}
          />
        </div>

        {/* Manual entry */}
        <div className="px-4 pb-4">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Paste token or ticket URL"
              className="flex-1 h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
            <button
              type="submit"
              className="h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-sm font-medium text-white transition-all"
            >
              Verify
            </button>
          </form>
          <p className="mt-2 text-center text-[11px] text-slate-600">
            Point camera at a QR code or paste a token above
          </p>
        </div>
      </div>

      {/* History slide-up panel */}
      {showHistory && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowHistory(false)}
          />
          {/* Panel */}
          <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-gray-900 border-t border-white/10 max-h-[70vh] flex flex-col">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <div className="flex items-center justify-between px-4 pb-3">
              <h2 className="text-sm font-semibold text-white">Scan History</h2>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 pb-6 space-y-2">
              {history.length === 0 ? (
                <p className="text-center text-sm text-slate-600 py-8">No scans yet.</p>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-xl px-4 py-3 ${
                      item.status === "success"
                        ? "bg-emerald-500/10 border border-emerald-500/20"
                        : "bg-red-500/10 border border-red-500/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {item.name && (
                          <p className={`text-sm font-medium ${item.status === "success" ? "text-emerald-300" : "text-red-300"}`}>
                            {item.name}
                          </p>
                        )}
                        <p className={`text-xs ${item.status === "success" ? "text-emerald-500" : "text-red-500"}`}>
                          {item.message}
                        </p>
                      </div>
                      <span className="shrink-0 text-[10px] text-slate-600">{item.timestamp}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Scanline animation */}
      <style>{`
        #scanner-viewfinder {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        #scanner-viewfinder video,
        #scanner-viewfinder canvas {
          width: 100% !important;
          height: 100% !important;
          object-fit: contain;
        }

        @keyframes scanline {
          0%, 100% { transform: translateY(-60px); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          50% { transform: translateY(60px); }
        }
      `}</style>
    </div>
  );
}
