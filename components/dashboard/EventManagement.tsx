"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Event Management</h1>
        <p className="mt-1 text-sm text-slate-600">
          {canManageEvents
            ? "Create and manage events before importing attendee CSV lists."
            : "Admin accounts can view events. Organizer accounts can create and manage events."}
        </p>

        {canManageEvents ? (
          <form className="mt-5 grid gap-3 md:grid-cols-4" onSubmit={handleCreateEvent}>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              placeholder="Event name"
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
            />
            <input
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
              type="datetime-local"
              placeholder="Event date and time"
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
            />
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              required
              placeholder="Venue"
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
            />
            <button
              type="submit"
              disabled={isCreating}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreating ? "Creating..." : "Create Event"}
            </button>
          </form>
        ) : (
          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            You have read-only access to events.
          </p>
        )}

        {errorMessage ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errorMessage}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">All Events</h2>
          <button
            type="button"
            onClick={() => void loadEvents()}
            disabled={isLoading}
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-3 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {events.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 font-medium text-slate-900">{item.name}</td>
                  <td className="px-3 py-2">{formatDate(item.date)}</td>
                  <td className="px-3 py-2">{item.location}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/dashboard/guests?eventId=${item.id}`}
                      className="text-sm font-medium text-slate-900 underline-offset-2 hover:underline"
                    >
                      View Guests
                    </Link>
                  </td>
                </tr>
              ))}
              {events.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                    No events found.
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
