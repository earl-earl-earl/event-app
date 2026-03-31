"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Tooltip } from "react-tooltip";

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

interface MetadataDraftField {
  id: string;
  key: string;
  value: string;
}

interface GuestMutationNotice {
  tone: "success" | "info";
  message: string;
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
    if (!raw) {
      return "-";
    }

    if (raw.length <= 120) {
      return raw;
    }

    return `${raw.slice(0, 117)}...`;
  } catch {
    return "{}";
  }
}

function normalizeToJson(value: unknown): Json {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeToJson(item));
  }

  if (typeof value === "object") {
    const output: Record<string, Json> = {};

    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      if (item === undefined) {
        return;
      }

      output[key] = normalizeToJson(item);
    });

    return output;
  }

  return String(value);
}

function getMetadataRecord(metadata: Json): Record<string, Json> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  const output: Record<string, Json> = {};

  Object.entries(metadata as Record<string, Json | undefined>).forEach(([key, value]) => {
    if (value !== undefined) {
      output[key] = value;
    }
  });

  return output;
}

function formatMetadataHeaderLabel(key: string): string {
  return key
    .split(/[_\s-]+/g)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMetadataValue(value: Json | undefined): string {
  if (value === null || value === undefined) {
    return "-";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  try {
    const raw = JSON.stringify(value);
    if (!raw) {
      return "-";
    }

    if (raw.length <= 80) {
      return raw;
    }

    return `${raw.slice(0, 77)}...`;
  } catch {
    return "-";
  }
}

function serializeMetadataValue(value: Json): string {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  if (value === null) {
    return "null";
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function parseMetadataInputValue(rawValue: string): Json {
  const value = rawValue.trim();

  if (/^(true|false)$/i.test(value)) {
    return value.toLowerCase() === "true";
  }

  if (/^-?\d+(\.\d+)?$/.test(value)) {
    const parsedNumber = Number(value);

    if (Number.isFinite(parsedNumber)) {
      return parsedNumber;
    }
  }

  if (
    (value.startsWith("{") && value.endsWith("}")) ||
    (value.startsWith("[") && value.endsWith("]"))
  ) {
    try {
      return normalizeToJson(JSON.parse(value));
    } catch {
      return value;
    }
  }

  return value;
}

function createMetadataDraftField(
  key = "",
  value = "",
): MetadataDraftField {
  const fallbackId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : fallbackId;

  return {
    id,
    key,
    value,
  };
}

function buildMetadataPayload(
  fields: MetadataDraftField[],
): Record<string, Json> {
  const metadata: Record<string, Json> = {};

  fields.forEach((field) => {
    const normalizedKey = field.key.trim().toLowerCase().replace(/[\s-]+/g, "_");
    const rawValue = field.value.trim();

    if (!normalizedKey || rawValue.length === 0) {
      return;
    }

    metadata[normalizedKey] = parseMetadataInputValue(rawValue);
  });

  return metadata;
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
  const [isRequeueingDispatch, setIsRequeueingDispatch] = useState(false);
  const [isSavingGuest, setIsSavingGuest] = useState(false);
  const [deletingGuestId, setDeletingGuestId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [dispatchMessage, setDispatchMessage] = useState<string | null>(null);
  const [guestNotice, setGuestNotice] = useState<GuestMutationNotice | null>(null);

  const [editingGuestId, setEditingGuestId] = useState<string | null>(null);
  const [guestForm, setGuestForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    maxEntries: "1",
  });
  const [metadataFields, setMetadataFields] = useState<MetadataDraftField[]>([
    createMetadataDraftField(),
  ]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const metadataColumns = useMemo(() => {
    const keys = new Set<string>();

    guests.forEach((guest) => {
      Object.keys(getMetadataRecord(guest.metadata)).forEach((key) => {
        keys.add(key);
      });
    });

    return [...keys].sort((left, right) => left.localeCompare(right));
  }, [guests]);

  const tableColumnCount =
    4 +
    (metadataColumns.length > 0 ? metadataColumns.length : 1) +
    (canManageGuests ? 1 : 0);

  const resetGuestForm = useCallback(() => {
    setEditingGuestId(null);
    setGuestForm({
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      maxEntries: "1",
    });
    setMetadataFields([createMetadataDraftField()]);
  }, []);

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
    setGuestNotice(null);
    resetGuestForm();
  }, [selectedEventId, resetGuestForm]);

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
    setGuestNotice(null);
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
            failures?: Array<{ id: number; reason: string }>;
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

      const failureSummary =
        data.failures && data.failures.length > 0
          ? ` Failures: ${data.failures
              .slice(0, 3)
              .map((failure) => `#${failure.id} ${failure.reason}`)
              .join(" | ")}`
          : "";

      setDispatchMessage(
        `Processed ${data.processed} jobs. Sent ${data.sent}, retries ${data.retryQueued}, failed ${data.permanentlyFailed}.${failureSummary}`,
      );
    } finally {
      setIsRunningDispatch(false);
    }
  }

  async function handleRequeueEmails() {
    if (!selectedEventId) {
      setErrorMessage("Please select an event before requeueing emails.");
      return;
    }

    setIsRequeueingDispatch(true);
    setDispatchMessage(null);

    try {
      const response = await fetch("/api/dispatch/requeue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId: selectedEventId,
        }),
      });

      const data = (await response.json()) as
        | { success: true; queuedCount: number; warnings?: string[] }
        | { success: false; error?: string };

      if (!response.ok || !data.success) {
        setDispatchMessage(
          "error" in data && typeof data.error === "string"
            ? data.error
            : "Email requeue failed.",
        );
        return;
      }

      const warningMessage =
        data.warnings && data.warnings.length > 0
          ? ` Warnings: ${data.warnings.slice(0, 2).join(" ")}`
          : "";

      setDispatchMessage(
        `Queued ${data.queuedCount} email job(s).${warningMessage}`,
      );
    } finally {
      setIsRequeueingDispatch(false);
    }
  }

  function populateFormForGuest(guest: GuestRecord) {
    const metadata = getMetadataRecord(guest.metadata);
    const nextFields = Object.entries(metadata).map(([key, value]) =>
      createMetadataDraftField(key, serializeMetadataValue(value)),
    );

    setEditingGuestId(guest.id);
    setGuestForm({
      firstName: guest.first_name,
      lastName: guest.last_name,
      email: guest.email,
      phoneNumber: guest.phone_number,
      maxEntries: String(guest.max_entries),
    });
    setMetadataFields(
      nextFields.length > 0 ? nextFields : [createMetadataDraftField()],
    );
    setErrorMessage(null);
    setGuestNotice(null);
  }

  function upsertMetadataField(
    fieldId: string,
    key: "key" | "value",
    value: string,
  ) {
    setMetadataFields((current) =>
      current.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              [key]: value,
            }
          : field,
      ),
    );
  }

  function removeMetadataField(fieldId: string) {
    setMetadataFields((current) => {
      if (current.length <= 1) {
        return current;
      }

      return current.filter((field) => field.id !== fieldId);
    });
  }

  async function handleSaveGuest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedEventId) {
      setErrorMessage("Please select an event before saving a guest.");
      return;
    }

    const maxEntries = Number(guestForm.maxEntries.trim());
    if (!Number.isInteger(maxEntries) || maxEntries <= 0) {
      setErrorMessage("Max entries must be a positive whole number.");
      return;
    }

    const payload = {
      eventId: selectedEventId,
      firstName: guestForm.firstName.trim(),
      lastName: guestForm.lastName.trim(),
      email: guestForm.email.trim().toLowerCase(),
      phoneNumber: guestForm.phoneNumber.trim(),
      maxEntries,
      metadata: buildMetadataPayload(metadataFields),
    };

    if (
      !payload.firstName ||
      !payload.lastName ||
      !payload.email ||
      !payload.phoneNumber
    ) {
      setErrorMessage("First name, last name, email, and phone number are required.");
      return;
    }

    setErrorMessage(null);
    setGuestNotice(null);
    setIsSavingGuest(true);

    try {
      const isUpdate = Boolean(editingGuestId);
      const endpoint = isUpdate ? `/api/guests/${editingGuestId}` : "/api/guests";
      const method = isUpdate ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as
        | {
            success: true;
            queuedDispatchJobs?: number;
            queueWarnings?: string[];
          }
        | { success: false; error?: string };

      if (!response.ok || !data.success) {
        setErrorMessage(
          "error" in data && typeof data.error === "string"
            ? data.error
            : "Failed to save guest.",
        );
        return;
      }

      if (isUpdate) {
        setGuestNotice({
          tone: "success",
          message: "Guest updated successfully.",
        });
      } else if ((data.queueWarnings?.length ?? 0) > 0) {
        setGuestNotice({
          tone: "info",
          message: `Guest created, but ticket dispatch was not fully queued: ${data.queueWarnings?.join(" ")}`,
        });
      } else {
        setGuestNotice({
          tone: "success",
          message: `Guest created successfully. ${data.queuedDispatchJobs ?? 0} dispatch jobs queued.`,
        });
      }

      resetGuestForm();
      await Promise.all([loadGuests(), loadStats()]);
    } finally {
      setIsSavingGuest(false);
    }
  }

  async function handleDeleteGuest(guest: GuestRecord) {
    if (!selectedEventId) {
      setErrorMessage("Please select an event before deleting a guest.");
      return;
    }

    const confirmed = window.confirm(
      `Delete ${guest.first_name} ${guest.last_name}? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage(null);
    setGuestNotice(null);
    setDeletingGuestId(guest.id);

    try {
      const response = await fetch(
        `/api/guests/${guest.id}?eventId=${selectedEventId}`,
        {
          method: "DELETE",
        },
      );

      const data = (await response.json()) as
        | { success: true; deletedGuestId: string }
        | { success: false; error?: string };

      if (!response.ok || !data.success) {
        setErrorMessage(
          "error" in data && typeof data.error === "string"
            ? data.error
            : "Failed to delete guest.",
        );
        return;
      }

      if (editingGuestId === guest.id) {
        resetGuestForm();
      }

      setGuestNotice({
        tone: "success",
        message: "Guest deleted successfully.",
      });

      await Promise.all([loadGuests(), loadStats()]);
    } finally {
      setDeletingGuestId(null);
    }
  }

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + limit, total);

  return (
    <div className="space-y-6">
      {/* Header + Filters */}
      <section className="card p-6">
        <div className="page-header">
          <h1 className="page-title">Guest Management</h1>
          <p className="page-subtitle">
            {canManageGuests
              ? "Upload or manually add attendees, edit or delete guest records, track check-ins, and monitor dispatch queue."
              : "Admin accounts can view guest records. Organizer accounts can import, add, edit, delete, and dispatch guests."}
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <label className="form-label" htmlFor="guest-event-filter">Event</label>
            <select
              id="guest-event-filter"
              title="Event"
              value={selectedEventId}
              onChange={(event) => setSelectedEventId(event.target.value)}
              className="form-input"
            >
              {events.length === 0 ? <option value="">No events</option> : null}
              {events.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" htmlFor="guest-search-filter">Search guests</label>
            <input
              id="guest-search-filter"
              title="Search guests"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Name or email"
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label" htmlFor="guest-status-filter">Status</label>
            <select
              id="guest-status-filter"
              title="Status"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "all" | "checked_in" | "not_checked_in")
              }
              className="form-input"
            >
              <option value="all">All</option>
              <option value="checked_in">Checked in</option>
              <option value="not_checked_in">Not checked in</option>
            </select>
          </div>
        </div>

        {selectedEvent ? (
          <p className="mt-3 text-sm text-slate-500">
            Active event: <span className="font-medium text-slate-900">{selectedEvent.name}</span>
          </p>
        ) : null}
      </section>

      {/* CSV Upload */}
      {canManageGuests ? (
        <>
          <section className="card p-6">
            <h2 className="text-base font-semibold text-slate-900">CSV Upload</h2>
            <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleUploadCsv}>
              <input
                ref={fileInputRef}
                type="file"
                title="CSV file"
                aria-label="CSV file"
                accept=".csv,text/csv"
                placeholder="Select CSV file"
                onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)}
                className="form-input flex-1 py-1.5"
              />
              <button
                type="submit"
                disabled={isUploadingCsv}
                className="btn-primary"
              >
                {isUploadingCsv ? "Uploading..." : "Upload CSV"}
              </button>
              <button
                type="button"
                disabled={isRunningDispatch || isRequeueingDispatch}
                onClick={handleRunDispatch}
                className="btn-secondary"
              >
                {isRunningDispatch ? "Running..." : "Run Dispatch"}
              </button>
              <button
                type="button"
                disabled={isRequeueingDispatch || isRunningDispatch}
                onClick={handleRequeueEmails}
                className="btn-secondary"
              >
                {isRequeueingDispatch ? "Requeueing..." : "Requeue Email"}
              </button>
            </form>

            {uploadResult ? (
              <div className="alert alert-success mt-4">
                Inserted: {uploadResult.insertedCount}, Failed: {uploadResult.failedCount},
                Dispatch jobs queued: {uploadResult.queuedDispatchJobs}
                {uploadResult.queueWarnings.length > 0 ? (
                  <span className="block mt-1 text-amber-700">
                    Warning: {uploadResult.queueWarnings.join(" ")}
                  </span>
                ) : null}
              </div>
            ) : null}

            {dispatchMessage ? (
              <div className="alert alert-info mt-3">{dispatchMessage}</div>
            ) : null}

            {uploadResult && uploadResult.failures.length > 0 ? (
              <div className="alert alert-error mt-4">
                <div>
                  <p className="font-medium">Top CSV failures:</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {uploadResult.failures.slice(0, 8).map((failure, index) => (
                      <li key={`${failure.rowNumber}-${index}`}>
                        Row {failure.rowNumber}: {failure.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </section>

          <section className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">
                {editingGuestId ? "Edit Guest" : "Manual Guest Addition"}
              </h2>
              {editingGuestId ? (
                <button
                  type="button"
                  onClick={resetGuestForm}
                  className="btn-secondary h-8 px-3 text-xs"
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>

            <form className="mt-4 space-y-4" onSubmit={handleSaveGuest}>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <label className="form-label" htmlFor="manual-guest-first-name">First name</label>
                  <input
                    id="manual-guest-first-name"
                    title="First name"
                    value={guestForm.firstName}
                    onChange={(event) =>
                      setGuestForm((current) => ({
                        ...current,
                        firstName: event.target.value,
                      }))
                    }
                    className="form-input"
                    placeholder="Jane"
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="manual-guest-last-name">Last name</label>
                  <input
                    id="manual-guest-last-name"
                    title="Last name"
                    value={guestForm.lastName}
                    onChange={(event) =>
                      setGuestForm((current) => ({
                        ...current,
                        lastName: event.target.value,
                      }))
                    }
                    className="form-input"
                    placeholder="Doe"
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="manual-guest-email">Email</label>
                  <input
                    id="manual-guest-email"
                    title="Email"
                    value={guestForm.email}
                    onChange={(event) =>
                      setGuestForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    className="form-input"
                    type="email"
                    placeholder="guest@example.com"
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="manual-guest-phone-number">Phone number</label>
                  <input
                    id="manual-guest-phone-number"
                    title="Phone number"
                    value={guestForm.phoneNumber}
                    onChange={(event) =>
                      setGuestForm((current) => ({
                        ...current,
                        phoneNumber: event.target.value,
                      }))
                    }
                    className="form-input"
                    placeholder="+63 900 000 0000"
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="manual-guest-max-entries">Max entries</label>
                  <input
                    id="manual-guest-max-entries"
                    title="Max entries"
                    value={guestForm.maxEntries}
                    onChange={(event) =>
                      setGuestForm((current) => ({
                        ...current,
                        maxEntries: event.target.value,
                      }))
                    }
                    className="form-input"
                    type="number"
                    placeholder="1"
                    min={1}
                    step={1}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Metadata fields</label>
                <div className="space-y-2">
                  {metadataFields.map((field) => (
                    <div
                      key={field.id}
                      className="grid gap-2 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_auto]"
                    >
                      <input
                        title="Metadata key"
                        aria-label="Metadata key"
                        value={field.key}
                        onChange={(event) =>
                          upsertMetadataField(field.id, "key", event.target.value)
                        }
                        className="form-input"
                        placeholder="e.g. company"
                      />
                      <input
                        title="Metadata value"
                        aria-label="Metadata value"
                        value={field.value}
                        onChange={(event) =>
                          upsertMetadataField(field.id, "value", event.target.value)
                        }
                        className="form-input"
                        placeholder="e.g. Acme Inc"
                      />
                      <button
                        type="button"
                        onClick={() => removeMetadataField(field.id)}
                        disabled={metadataFields.length <= 1}
                        className="btn-danger h-10 px-3"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setMetadataFields((current) => [
                        ...current,
                        createMetadataDraftField(),
                      ])
                    }
                    className="btn-secondary h-8 px-3 text-xs"
                  >
                    + Add metadata field
                  </button>
                  <p className="text-xs text-slate-400">
                    Values support text, numbers, booleans, and JSON.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button type="submit" disabled={isSavingGuest} className="btn-primary">
                  {isSavingGuest
                    ? "Saving..."
                    : editingGuestId
                      ? "Save Guest Changes"
                      : "Add Guest"}
                </button>
                {editingGuestId ? (
                  <span className="text-xs text-slate-400">
                    Editing existing guest record.
                  </span>
                ) : null}
              </div>
            </form>

            {guestNotice ? (
              <div
                className={`mt-4 alert ${
                  guestNotice.tone === "success" ? "alert-success" : "alert-info"
                }`}
              >
                {guestNotice.message}
              </div>
            ) : null}
          </section>
        </>
      ) : (
        <section className="card p-6">
          <h2 className="text-base font-semibold text-slate-900">Import Permissions</h2>
          <div className="alert alert-info mt-3">
            You have read-only access to guests. CSV upload and dispatch actions are organizer-only.
          </div>
        </section>
      )}

      {/* Stats Cards */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">Total Guests</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {stats?.totalGuests ?? "-"}
          </p>
        </div>
        <div className="stat-card border-emerald-200">
          <p className="text-xs uppercase tracking-wider font-semibold text-emerald-600">Checked In</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700">
            {stats?.checkedInCount ?? "-"}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wider font-semibold text-blue-600">Remaining</p>
          <p className="mt-2 text-3xl font-bold text-blue-700">
            {stats?.remainingGuests ?? "-"}
          </p>
        </div>
      </section>

      {errorMessage ? (
        <div className="alert alert-error">{errorMessage}</div>
      ) : null}

      {/* Guest List Table */}
      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">Guest List</h2>
          <p className="text-sm text-slate-400">
            Showing {pageStart}–{pageEnd} of {total}
          </p>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Entries</th>
                {metadataColumns.length > 0 ? (
                  metadataColumns.map((column) => <th key={column}>{formatMetadataHeaderLabel(column)}</th>)
                ) : (
                  <th>Metadata</th>
                )}
                {canManageGuests ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {guests.map((guest) => (
                <tr key={guest.id}>
                  <td className="font-medium text-slate-900">
                    {guest.first_name} {guest.last_name}
                  </td>
                  <td>
                    <p>{guest.email}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{guest.phone_number}</p>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        guest.checked_in ? "badge-success" : "badge-warning"
                      }`}
                    >
                      {guest.checked_in ? "Checked in" : "Pending"}
                    </span>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatDate(guest.checked_in_at)}
                    </p>
                  </td>
                  <td>
                    <span className="font-medium text-slate-900">{guest.entry_count}</span>
                    <span className="text-slate-400"> / {guest.max_entries}</span>
                  </td>
                  {metadataColumns.length > 0 ? (
                    metadataColumns.map((column) => (
                      <td
                        key={`${guest.id}-${column}`}
                        className="text-xs text-slate-500 font-mono"
                      >
                        {formatMetadataValue(getMetadataRecord(guest.metadata)[column])}
                      </td>
                    ))
                  ) : (
                    <td className="text-xs text-slate-400 font-mono">
                      {stringifyMetadata(guest.metadata)}
                    </td>
                  )}
                  {canManageGuests ? (
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => populateFormForGuest(guest)}
                          disabled={isSavingGuest || deletingGuestId === guest.id}
                          className="btn-secondary btn-icon flex items-center justify-center text-slate-600 hover:text-indigo-600 focus:text-indigo-600 disabled:opacity-50"
                          data-tooltip-id="guest-actions"
                          data-tooltip-content="Edit Guest"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGuest(guest)}
                          disabled={isSavingGuest || deletingGuestId === guest.id}
                          className="btn-danger btn-icon flex items-center justify-center disabled:opacity-50"
                          data-tooltip-id="guest-actions"
                          data-tooltip-content={deletingGuestId === guest.id ? "Deleting..." : "Delete Guest"}
                        >
                          {deletingGuestId === guest.id ? (
                            <span className="animate-spin text-sm">⏳</span>
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
              {!isLoadingGuests && guests.length === 0 ? (
                <tr>
                  <td colSpan={tableColumnCount} className="text-center text-slate-400 py-6">
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
            className="btn-secondary text-xs h-8 px-3"
          >
            ← Previous
          </button>
          <button
            type="button"
            disabled={offset + limit >= total}
            onClick={() => setOffset((value) => value + limit)}
            className="btn-secondary text-xs h-8 px-3"
          >
            Next →
          </button>
        </div>
      </section>
      <Tooltip id="guest-actions" place="top" style={{ zIndex: 50, fontSize: "0.75rem" }} />
    </div>
  );
}
