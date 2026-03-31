"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

interface EventAttendancePoint {
  eventId: string;
  eventName: string;
  eventDate: string;
  location: string;
  totalGuests: number;
  checkedInGuests: number;
  remainingGuests: number;
  checkInRatePercent: number;
}

interface EventVolumeByMonthPoint {
  month: string;
  label: string;
  count: number;
}

interface RecentAccountRecord {
  id: string;
  role: "admin" | "organizer";
  fullName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AdminStatsResponse {
  success: true;
  totals: {
    totalEvents: number;
    totalGuests: number;
    checkedInGuests: number;
    remainingGuests: number;
    checkInRatePercent: number;
  };
  accounts: {
    admins: number;
    organizers: number;
    activeAdmins: number;
    inactiveAdmins: number;
    activeOrganizers: number;
    suspendedOrganizers: number;
  };
  eventAttendance: EventAttendancePoint[];
  eventVolumeByMonth: EventVolumeByMonthPoint[];
  recentAccounts: RecentAccountRecord[];
}

interface MonthlyChartPoint {
  label: string;
  count: number;
  x: number;
  y: number;
}

interface MonthlyChartData {
  width: number;
  height: number;
  baselineY: number;
  maxCount: number;
  linePoints: string;
  areaPoints: string;
  points: MonthlyChartPoint[];
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildMonthlyChartData(points: EventVolumeByMonthPoint[]): MonthlyChartData | null {
  if (points.length === 0) {
    return null;
  }

  const width = 640;
  const height = 220;
  const insetX = 30;
  const insetY = 26;
  const baselineY = height - insetY;
  const maxCount = Math.max(...points.map((point) => point.count), 1);
  const span = width - insetX * 2;
  const step = points.length > 1 ? span / (points.length - 1) : 0;

  const normalizedPoints: MonthlyChartPoint[] = points.map((point, index) => {
    const ratio = point.count / maxCount;

    return {
      label: point.label,
      count: point.count,
      x: insetX + step * index,
      y: baselineY - ratio * (height - insetY * 2),
    };
  });

  const linePoints = normalizedPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const firstPoint = normalizedPoints[0];
  const lastPoint = normalizedPoints[normalizedPoints.length - 1];
  const areaPoints = `${linePoints} ${lastPoint.x},${baselineY} ${firstPoint.x},${baselineY}`;

  return {
    width,
    height,
    baselineY,
    maxCount,
    linePoints,
    areaPoints,
    points: normalizedPoints,
  };
}

export function AdminDashboardOverview() {
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/dashboard/admin-stats", { cache: "no-store" });
      const payload = (await response.json()) as
        | AdminStatsResponse
        | { success: false; error?: string };

      if (!response.ok || !payload.success) {
        setErrorMessage(
          "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Failed to load admin analytics.",
        );
        return;
      }

      setStats(payload);
      setErrorMessage(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const topEventAttendance = useMemo(() => {
    if (!stats) {
      return [];
    }

    return [...stats.eventAttendance]
      .sort((left, right) => right.totalGuests - left.totalGuests)
      .slice(0, 6);
  }, [stats]);

  const monthlyChart = useMemo(
    () => buildMonthlyChartData(stats?.eventVolumeByMonth ?? []),
    [stats],
  );

  const totalAccounts = useMemo(() => {
    if (!stats) {
      return 0;
    }

    return stats.accounts.admins + stats.accounts.organizers;
  }, [stats]);

  const adminSharePercent = useMemo(() => {
    if (!stats || totalAccounts === 0) {
      return 0;
    }

    return clampPercent((stats.accounts.admins / totalAccounts) * 100);
  }, [stats, totalAccounts]);

  const organizerSharePercent = useMemo(() => {
    if (!stats || totalAccounts === 0) {
      return 0;
    }

    return clampPercent((stats.accounts.organizers / totalAccounts) * 100);
  }, [stats, totalAccounts]);

  const roleChart = useMemo(() => {
    const radius = 54;
    const circumference = 2 * Math.PI * radius;

    if (!stats || totalAccounts === 0) {
      return {
        radius,
        circumference,
        adminArc: 0,
        organizerArc: 0,
      };
    }

    return {
      radius,
      circumference,
      adminArc: (stats.accounts.admins / totalAccounts) * circumference,
      organizerArc: (stats.accounts.organizers / totalAccounts) * circumference,
    };
  }, [stats, totalAccounts]);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Admin Analytics Dashboard</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Monitor event performance, check-in progress, and account health from a single
              admin-only overview.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadStats()}
            disabled={isLoading}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Refreshing..." : "Refresh Analytics"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/dashboard/events"
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-3 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            Event Records
          </Link>
          <Link
            href="/dashboard/guests"
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-3 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            Guest Records
          </Link>
          <Link
            href="/dashboard/users"
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-900 bg-slate-900 px-3 text-sm text-white transition hover:bg-slate-700"
          >
            Account Center
          </Link>
        </div>
      </section>

      {errorMessage ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Events</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{stats?.totals.totalEvents ?? "-"}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Guests</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{stats?.totals.totalGuests ?? "-"}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-emerald-700">Checked-In Guests</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-900">
            {stats?.totals.checkedInGuests ?? "-"}
          </p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-amber-700">Check-In Rate</p>
          <p className="mt-1 text-2xl font-semibold text-amber-900">
            {stats ? `${stats.totals.checkInRatePercent}%` : "-"}
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-5">
        <section className="xl:col-span-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Event Check-In Progress</h2>
          <p className="mt-1 text-sm text-slate-600">
            Top events by guest volume with current check-in completion.
          </p>

          {topEventAttendance.length === 0 ? (
            <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              No event attendance data yet.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {topEventAttendance.map((event) => {
                const checkedPercent = clampPercent(event.checkInRatePercent);
                const filledSegments = Math.round((checkedPercent / 100) * 12);

                return (
                  <div key={event.eventId} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900">{event.eventName}</p>
                        <p className="text-xs text-slate-500">{formatDate(event.eventDate)}</p>
                      </div>
                      <p className="text-sm font-medium text-slate-700">
                        {event.checkedInGuests}/{event.totalGuests} checked in
                      </p>
                    </div>

                    <div className="mt-2 grid grid-cols-12 gap-1">
                      {Array.from({ length: 12 }).map((_, index) => (
                        <span
                          key={`${event.eventId}-${index}`}
                          className={`h-2 rounded-sm ${
                            index < filledSegments ? "bg-emerald-500" : "bg-amber-300"
                          }`}
                        />
                      ))}
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <span>{checkedPercent}% complete</span>
                      <span>{event.remainingGuests} remaining</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Account Distribution</h2>
          <p className="mt-1 text-sm text-slate-600">
            Active and suspended account breakdown for admin governance.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="relative h-36 w-36">
              <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" aria-hidden>
                <circle
                  cx="70"
                  cy="70"
                  r={roleChart.radius}
                  fill="none"
                  stroke="#cbd5e1"
                  strokeWidth="20"
                />
                <circle
                  cx="70"
                  cy="70"
                  r={roleChart.radius}
                  fill="none"
                  stroke="#0f172a"
                  strokeWidth="20"
                  strokeDasharray={`${roleChart.adminArc} ${roleChart.circumference - roleChart.adminArc}`}
                />
                <circle
                  cx="70"
                  cy="70"
                  r={roleChart.radius}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="20"
                  strokeDasharray={`${roleChart.organizerArc} ${roleChart.circumference - roleChart.organizerArc}`}
                  strokeDashoffset={-roleChart.adminArc}
                />
              </svg>
              <div className="absolute inset-6 flex items-center justify-center rounded-full bg-white text-center">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Accounts</p>
                  <p className="text-xl font-semibold text-slate-900">{totalAccounts}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <p className="text-slate-700">
                <span className="font-semibold text-slate-900">Admins:</span>{" "}
                {stats?.accounts.admins ?? 0} ({adminSharePercent}%)
              </p>
              <p className="text-slate-700">
                <span className="font-semibold text-slate-900">Organizers:</span>{" "}
                {stats?.accounts.organizers ?? 0} ({organizerSharePercent}%)
              </p>
              <p className="text-slate-700">
                <span className="font-semibold text-slate-900">Active Organizers:</span>{" "}
                {stats?.accounts.activeOrganizers ?? 0}
              </p>
              <p className="text-slate-700">
                <span className="font-semibold text-slate-900">Suspended Organizers:</span>{" "}
                {stats?.accounts.suspendedOrganizers ?? 0}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs uppercase tracking-wide text-emerald-700">Active Admins</p>
              <p className="mt-1 text-xl font-semibold text-emerald-900">
                {stats?.accounts.activeAdmins ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Inactive Admins</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {stats?.accounts.inactiveAdmins ?? 0}
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Event Volume Trend</h2>
        <p className="mt-1 text-sm text-slate-600">
          Month-by-month event creation trend for capacity planning.
        </p>

        {monthlyChart ? (
          <div className="mt-4 overflow-x-auto">
            <svg
              viewBox={`0 0 ${monthlyChart.width} ${monthlyChart.height}`}
              className="h-56 min-w-160 w-full"
              role="img"
              aria-label="Monthly event volume chart"
            >
              <line
                x1={0}
                y1={monthlyChart.baselineY}
                x2={monthlyChart.width}
                y2={monthlyChart.baselineY}
                stroke="#cbd5e1"
                strokeWidth={1}
              />
              <polygon points={monthlyChart.areaPoints} fill="#dbeafe" opacity={0.8} />
              <polyline
                points={monthlyChart.linePoints}
                fill="none"
                stroke="#1d4ed8"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {monthlyChart.points.map((point) => (
                <g key={point.label}>
                  <circle cx={point.x} cy={point.y} r={5} fill="#1d4ed8" />
                  <text
                    x={point.x}
                    y={monthlyChart.baselineY + 16}
                    textAnchor="middle"
                    fontSize={11}
                    fill="#64748b"
                  >
                    {point.label}
                  </text>
                  <text
                    x={point.x}
                    y={point.y - 12}
                    textAnchor="middle"
                    fontSize={11}
                    fill="#1e293b"
                  >
                    {point.count}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            No monthly trend data yet.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Recent Account Activity</h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/admins/create"
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-3 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              Add Admin
            </Link>
            <Link
              href="/dashboard/organizers/create"
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-3 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              Add Organizer
            </Link>
            <Link
              href="/dashboard/organizers"
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-3 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              View Organizers
            </Link>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {(stats?.recentAccounts ?? []).map((account) => (
                <tr key={account.id}>
                  <td className="px-3 py-2 font-medium text-slate-900 capitalize">{account.role}</td>
                  <td className="px-3 py-2">{account.fullName ?? "-"}</td>
                  <td className="px-3 py-2">{account.isActive ? "Active" : "Suspended"}</td>
                  <td className="px-3 py-2">{formatDate(account.createdAt)}</td>
                  <td className="px-3 py-2">{formatDate(account.updatedAt)}</td>
                </tr>
              ))}
              {(stats?.recentAccounts.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-slate-500">
                    No account activity found.
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
