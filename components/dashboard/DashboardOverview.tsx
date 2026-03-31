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

interface DashboardOverviewProps {
  canUseScanner?: boolean;
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

export function DashboardOverview({ canUseScanner = false }: DashboardOverviewProps) {
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
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Create events, import attendees via CSV, and monitor check-ins in real time.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/events" className="btn-primary">
            Manage Events
          </Link>
          <Link href="/dashboard/guests" className="btn-secondary">
            Manage Guests
          </Link>
          {canUseScanner ? (
            <Link href="/check-in" className="btn-secondary">
              <svg
                className="mr-2"
                width="14"
                height="14"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 5V3a1 1 0 011-1h4" />
                <path d="M13 2h4a1 1 0 011 1v4" />
                <path d="M18 13v4a1 1 0 01-1 1h-4" />
                <path d="M7 18H3a1 1 0 01-1-1v-4" />
                <line x1="2" y1="10" x2="18" y2="10" />
              </svg>
            </Link>
          ) : null}
        </div>
      </div>

      {/* Event Selector */}
      <section className="card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label htmlFor="event-select" className="text-base font-semibold text-slate-900">
            Select Active Event
          </label>
          <select
            id="event-select"
            value={selectedEventId}
            onChange={(event) => setSelectedEventId(event.target.value)}
            className="form-input max-w-xs"
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
          <div className="alert alert-error mt-4">{errorMessage}</div>
        ) : null}

        {selectedEvent ? (
          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/50 p-4 text-sm">
            <p className="font-semibold text-slate-900">{selectedEvent.name}</p>
            <p className="text-slate-500 mt-0.5">{formatDate(selectedEvent.date)}</p>
            <p className="text-slate-500">{selectedEvent.location}</p>
          </div>
        ) : null}
      </section>

      {selectedEventId ? <RealtimeStats eventId={selectedEventId} /> : null}

      {/* Upcoming Events Table */}
      <section className="card p-6">
        <h2 className="text-base font-semibold text-slate-900">Upcoming Events</h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Date</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="font-medium text-slate-900">{event.name}</td>
                  <td>{formatDate(event.date)}</td>
                  <td>{event.location}</td>
                </tr>
              ))}
              {events.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center text-slate-400 py-6">
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
