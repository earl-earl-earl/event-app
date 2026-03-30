"use client";

import { useCallback, useEffect, useState } from "react";

import { getBrowserSupabase } from "@/lib/supabase/browser";

interface RealtimeStatsProps {
  eventId: string;
}

interface StatsResponse {
  success: boolean;
  totalGuests: number;
  checkedInCount: number;
  remainingGuests: number;
}

export function RealtimeStats({ eventId }: RealtimeStatsProps) {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    const response = await fetch(`/api/guests/stats?eventId=${eventId}`, {
      cache: "no-store",
    });

    const data = (await response.json()) as StatsResponse | { error?: string };

    if (!response.ok || !("success" in data) || !data.success) {
      setErrorMessage(
        "error" in data && typeof data.error === "string"
          ? data.error
          : "Failed to load stats.",
      );
      return;
    }

    setErrorMessage(null);
    setStats(data);
  }, [eventId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStats();

    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel(`stats-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "guests",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          void loadStats();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, loadStats]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Realtime Check-In Stats</h2>

      {errorMessage ? (
        <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Guests</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {stats?.totalGuests ?? "-"}
          </p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs uppercase tracking-wide text-emerald-700">Checked In</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-900">
            {stats?.checkedInCount ?? "-"}
          </p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs uppercase tracking-wide text-amber-700">Remaining</p>
          <p className="mt-1 text-2xl font-semibold text-amber-900">
            {stats?.remainingGuests ?? "-"}
          </p>
        </div>
      </div>
    </section>
  );
}
