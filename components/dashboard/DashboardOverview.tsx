"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { RealtimeStats } from "@/components/dashboard/RealtimeStats";

interface EventRecord {
  id: string;
  name: string;
  date: string;
  location: string;
  created_at: string;
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function DashboardOverview({
  canUseScanner,
}: {
  canUseScanner: boolean;
}) {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

    setErrorMessage(null);
    setEvents(data.events);

    if (data.events.length > 0 && !selectedEventId) {
      setSelectedEventId(data.events[0].id);
    }
  }, [selectedEventId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEvents();
  }, [loadEvents]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Event Operations Dashboard</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          {canUseScanner
            ? "Create events, import attendees via CSV, and monitor check-ins in real time across multiple scanner devices."
            : "View event and guest data, monitor activity, and manage privileged accounts."}
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/dashboard/events"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            {canUseScanner ? "Manage Events" : "View Events"}
          </Link>
          <Link
            href="/dashboard/guests"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {canUseScanner ? "Manage Guests" : "View Guests"}
          </Link>
          {canUseScanner ? (
            <Link
              href="/check-in"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 px-4 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
            >
              Open Scanner
            </Link>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label htmlFor="event-select" className="text-lg font-semibold text-slate-900">Select Active Event</label>
          <select
            id="event-select"
            value={selectedEventId}
            onChange={(event) => setSelectedEventId(event.target.value)}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
          >
            {events.length === 0 ? <option value="">No events</option> : null}
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
        </div>

        {errorMessage ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        {selectedEvent ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p>
              <span className="font-medium text-slate-900">{selectedEvent.name}</span>
            </p>
            <p>{formatDate(selectedEvent.date)}</p>
            <p>{selectedEvent.location}</p>
          </div>
        ) : null}
      </section>

      {selectedEventId ? <RealtimeStats eventId={selectedEventId} /> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Upcoming Events</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="px-3 py-2 font-medium text-slate-900">{event.name}</td>
                  <td className="px-3 py-2">{formatDate(event.date)}</td>
                  <td className="px-3 py-2">{event.location}</td>
                </tr>
              ))}
              {events.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-slate-500">
                    No events yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
