"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { Json } from "@/types/database";

interface EventRecord {
  id: string;
  name: string;
  date: string;
  location: string;
}

interface GuestRecord {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  checked_in: boolean;
  checked_in_at: string | null;
  entry_count: number;
  max_entries: number;
  metadata: Json;
}

interface GuestListResponse {
  success: boolean;
  guests: GuestRecord[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

interface StatsResponse {
  success: boolean;
  totalGuests: number;
  checkedInCount: number;
  remainingGuests: number;
}

interface UploadResponse {
  success: boolean;
  insertedCount: number;
  failedCount: number;
  queuedDispatchJobs: number;
  queueWarnings: string[];
  failures: Array<{ rowNumber: number; reason: string }>;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function stringifyMetadata(metadata: Json): string {
  try {
    const raw = JSON.stringify(metadata);
    if (raw.length <= 120) {
      return raw;
    }

    return `${raw.slice(0, 117)}...`;
  } catch {
    return "{}";
  }
}

export function GuestManagement({
  canManageGuests,
}: {
  canManageGuests: boolean;
}) {
  const urlSearchParams = useSearchParams();

  const [events, setEvents] = useState<EventRecord[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>(
    urlSearchParams.get("eventId") ?? "",
  );

  const [guests, setGuests] = useState<GuestRecord[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "checked_in" | "not_checked_in">(
    "all",
  );

  const [offset, setOffset] = useState(0);
  const limit = 50;
  const [total, setTotal] = useState(0);

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isLoadingGuests, setIsLoadingGuests] = useState(false);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [isRunningDispatch, setIsRunningDispatch] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [dispatchMessage, setDispatchMessage] = useState<string | null>(null);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const loadEvents = useCallback(async () => {
    const response = await fetch("/api/events", { cache: "no-store" });
    const data = (await response.json()) as
      | { success: true; events: EventRecord[] }
      | { success: false; error?: string };

    if (!response.ok || !data.success) {
      setErrorMessage(
        "error" in data && typeof data.error === "string"
          ? data.error
          : "Failed to load events.",
      );
      return;
    }

    setEvents(data.events);

    if (!selectedEventId && data.events.length > 0) {
      setSelectedEventId(data.events[0].id);
    }
  }, [selectedEventId]);

  const loadGuests = useCallback(async () => {
    if (!selectedEventId) {
      return;
    }

    setIsLoadingGuests(true);

    try {
      const params = new URLSearchParams({
        eventId: selectedEventId,
        limit: String(limit),
        offset: String(offset),
        status: statusFilter,
      });

      if (searchTerm.trim()) {
        params.set("search", searchTerm.trim());
      }

      const response = await fetch(`/api/guests?${params.toString()}`, {
        cache: "no-store",
      });

      const data = (await response.json()) as
        | GuestListResponse
        | { success: false; error?: string };

      if (!response.ok || !data.success) {
        setErrorMessage(
          "error" in data && typeof data.error === "string"
            ? data.error
            : "Failed to load guests.",
        );
        return;
      }

      setErrorMessage(null);
      setGuests(data.guests);
      setTotal(data.pagination.total);
    } finally {
      setIsLoadingGuests(false);
    }
  }, [limit, offset, searchTerm, selectedEventId, statusFilter]);

  const loadStats = useCallback(async () => {
    if (!selectedEventId) {
      return;
    }

    const response = await fetch(`/api/guests/stats?eventId=${selectedEventId}`, {
      cache: "no-store",
    });

    const data = (await response.json()) as
      | StatsResponse
      | { success: false; error?: string };

    if (!response.ok || !data.success) {
      return;
    }

    setStats(data);
  }, [selectedEventId]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (!selectedEventId) {
      return;
    }

    void loadGuests();
    void loadStats();
  }, [selectedEventId, loadGuests, loadStats]);

  useEffect(() => {
    if (!selectedEventId) {
      return;
    }

    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel(`guest-management-${selectedEventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "guests",
          filter: `event_id=eq.${selectedEventId}`,
        },
        () => {
          void loadGuests();
          void loadStats();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadGuests, loadStats, selectedEventId]);

  useEffect(() => {
    setOffset(0);
  }, [searchTerm, selectedEventId, statusFilter]);

  async function handleUploadCsv(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedEventId) {
      setErrorMessage("Please select an event before uploading.");
      return;
    }

    if (!csvFile) {
      setErrorMessage("Please select a CSV file.");
      return;
    }

    setErrorMessage(null);
    setUploadResult(null);
    setIsUploadingCsv(true);

    try {
      const formData = new FormData();
      formData.set("eventId", selectedEventId);
      formData.set("file", csvFile);

      const response = await fetch("/api/upload-csv", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as UploadResponse | { error?: string };

      if (!response.ok || !("success" in data) || !data.success) {
        setErrorMessage(
          "error" in data && typeof data.error === "string"
            ? data.error
            : "CSV upload failed.",
        );
        return;
      }

      setUploadResult(data);
      setCsvFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await Promise.all([loadGuests(), loadStats()]);
    } finally {
      setIsUploadingCsv(false);
    }
  }

  async function handleRunDispatch() {
    setIsRunningDispatch(true);
    setDispatchMessage(null);

    try {
      const response = await fetch("/api/dispatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          batchSize: 200,
        }),
      });

      const data = (await response.json()) as
        | {
            success: true;
            processed: number;
            sent: number;
            retryQueued: number;
            permanentlyFailed: number;
          }
        | { success: false; error?: string };

      if (!response.ok || !data.success) {
        setDispatchMessage(
          "error" in data && typeof data.error === "string"
            ? data.error
            : "Dispatch worker failed.",
        );
        return;
      }

      setDispatchMessage(
        `Processed ${data.processed} jobs. Sent ${data.sent}, retries ${data.retryQueued}, failed ${data.permanentlyFailed}.`,
      );
    } finally {
      setIsRunningDispatch(false);
    }
  }

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + limit, total);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Guest Management</h1>
        <p className="mt-1 text-sm text-slate-600">
          {canManageGuests
            ? "Upload attendee CSV files, track check-in status, and monitor dispatch queue."
            : "Admin accounts can view guest records. Organizer accounts can import and dispatch guests."}
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-sm text-slate-700">
            Event
            <select
              value={selectedEventId}
              onChange={(event) => setSelectedEventId(event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
            >
              {events.length === 0 ? <option value="">No events</option> : null}
              {events.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-700">
            Search guests
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Name or email"
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
            />
          </label>

          <label className="text-sm text-slate-700">
            Status
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "all" | "checked_in" | "not_checked_in")
              }
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
            >
              <option value="all">All</option>
              <option value="checked_in">Checked in</option>
              <option value="not_checked_in">Not checked in</option>
            </select>
          </label>
        </div>

        {selectedEvent ? (
          <p className="mt-3 text-sm text-slate-600">
            Active event: <span className="font-medium text-slate-900">{selectedEvent.name}</span>
          </p>
        ) : null}
      </section>

      {canManageGuests ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">CSV Upload</h2>
          <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleUploadCsv}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              placeholder="Select CSV file"
              onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
            />
            <button
              type="submit"
              disabled={isUploadingCsv}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploadingCsv ? "Uploading..." : "Upload CSV"}
            </button>
            <button
              type="button"
              disabled={isRunningDispatch}
              onClick={handleRunDispatch}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRunningDispatch ? "Running..." : "Run Dispatch Worker"}
            </button>
          </form>

          {uploadResult ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <p>
                Inserted: {uploadResult.insertedCount}, Failed: {uploadResult.failedCount},
                Dispatch jobs queued: {uploadResult.queuedDispatchJobs}
              </p>
              {uploadResult.queueWarnings.length > 0 ? (
                <p className="mt-2 text-amber-800">
                  Warning: {uploadResult.queueWarnings.join(" ")}
                </p>
              ) : null}
            </div>
          ) : null}

          {dispatchMessage ? (
            <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {dispatchMessage}
            </p>
          ) : null}

          {uploadResult && uploadResult.failures.length > 0 ? (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <p className="font-medium">Top CSV failures:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {uploadResult.failures.slice(0, 8).map((failure, index) => (
                  <li key={`${failure.rowNumber}-${index}`}>
                    Row {failure.rowNumber}: {failure.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Import Permissions</h2>
          <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            You have read-only access to guests. CSV upload and dispatch actions are organizer-only.
          </p>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Guests</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {stats?.totalGuests ?? "-"}
          </p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-emerald-700">Checked In</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-900">
            {stats?.checkedInCount ?? "-"}
          </p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-amber-700">Remaining</p>
          <p className="mt-1 text-2xl font-semibold text-amber-900">
            {stats?.remainingGuests ?? "-"}
          </p>
        </div>
      </section>

      {errorMessage ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Guest List</h2>
          <p className="text-sm text-slate-500">
            Showing {pageStart}-{pageEnd} of {total}
          </p>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Entries</th>
                <th className="px-3 py-2">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {guests.map((guest) => (
                <tr key={guest.id}>
                  <td className="px-3 py-2 font-medium text-slate-900">
                    {guest.first_name} {guest.last_name}
                  </td>
                  <td className="px-3 py-2">
                    <p>{guest.email}</p>
                    <p className="text-xs text-slate-500">{guest.phone_number}</p>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        guest.checked_in
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {guest.checked_in ? "Checked in" : "Pending"}
                    </span>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(guest.checked_in_at)}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    {guest.entry_count} / {guest.max_entries}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {stringifyMetadata(guest.metadata)}
                  </td>
                </tr>
              ))}
              {!isLoadingGuests && guests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-slate-500">
                    No guests found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset((value) => Math.max(value - limit, 0))}
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-3 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={offset + limit >= total}
            onClick={() => setOffset((value) => value + limit)}
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-3 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
