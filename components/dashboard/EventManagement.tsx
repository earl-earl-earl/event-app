"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Trash2, Pencil, RefreshCw } from "lucide-react";
import { Tooltip } from "react-tooltip";

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

export function EventManagement({
  canManageEvents,
}: {
  canManageEvents: boolean;
}) {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);

    try {
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
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  async function handleCreateEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage(null);

    const eventDate = new Date(date);
    if (Number.isNaN(eventDate.getTime())) {
      setErrorMessage("Please provide a valid event date and time.");
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          date: eventDate.toISOString(),
          location,
        }),
      });

      const data = (await response.json()) as
        | { success: true; event: EventRecord }
        | { success: false; error?: string };

      if (!response.ok || !data.success) {
        setErrorMessage(
          "error" in data && typeof data.error === "string"
            ? data.error
            : "Failed to create event.",
        );
        return;
      }

      setName("");
      setDate("");
      setLocation("");
      setEvents((previous) => [data.event, ...previous]);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header + Create Form */}
      <section className="card p-6">
        <div className="page-header">
          <h1 className="page-title">Event Management</h1>
          <p className="page-subtitle">
            {canManageEvents
              ? "Create and manage events before importing attendee CSV lists."
              : "Admin accounts can view events. Organizer accounts can create and manage events."}
          </p>
        </div>

        {canManageEvents ? (
          <form className="mt-5 grid gap-3 md:grid-cols-4" onSubmit={handleCreateEvent}>
            <div>
              <label className="form-label">Event Name</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                placeholder="Annual Conference"
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Date & Time</label>
              <input
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
                type="datetime-local"
                placeholder="Select date and time"
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Venue</label>
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                required
                placeholder="Convention Center"
                className="form-input"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isCreating}
                className="btn-primary w-full"
              >
                {isCreating ? "Creating..." : "Create Event"}
              </button>
            </div>
          </form>
        ) : (
          <div className="alert alert-info mt-4">
            You have read-only access to events.
          </div>
        )}

        {errorMessage ? (
          <div className="alert alert-error mt-4">{errorMessage}</div>
        ) : null}
      </section>

      {/* Events Table */}
      <section className="card p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">All Events</h2>
          <button
            type="button"
            onClick={() => void loadEvents()}
            disabled={isLoading}
            className="btn-secondary btn-icon text-slate-600 hover:text-slate-900"
            data-tooltip-id="events-actions"
            data-tooltip-content="Refresh events"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Date</th>
                <th>Location</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((item) => (
                <tr key={item.id}>
                  <td className="font-medium text-slate-900">{item.name}</td>
                  <td>{formatDate(item.date)}</td>
                  <td>{item.location}</td>
                  <td>
                    <Link
                      href={`/dashboard/guests?eventId=${item.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      View Guests →
                    </Link>
                  </td>
                </tr>
              ))}
              {events.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-slate-400 py-6">
                    No events found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      <Tooltip id="events-actions" place="bottom" style={{ zIndex: 50, fontSize: "0.75rem" }} />
    </div>
  );
}
