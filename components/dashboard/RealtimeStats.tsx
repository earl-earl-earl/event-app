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
    <section className="card p-6">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
        </span>
        <h2 className="text-base font-semibold text-slate-900">Realtime Check-In Stats</h2>
      </div>

      {errorMessage ? (
        <div className="alert alert-error mt-3">{errorMessage}</div>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">Total Guests</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {stats?.totalGuests ?? "-"}
          </p>
        </div>
        <div className="stat-card" style={{ borderColor: "#bbf7d0" }}>
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
      </div>
    </section>
  );
}
