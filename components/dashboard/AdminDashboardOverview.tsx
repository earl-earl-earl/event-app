"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Tooltip } from "react-tooltip";

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
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="page-header">
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">
            Monitor event performance, check-in progress, and account health.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadStats()}
            disabled={isLoading}
            className="btn-secondary btn-icon"
            data-tooltip-id="dashboard-actions"
            data-tooltip-content="Refresh dashboard"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </button>
          <Link href="/dashboard/users" className="btn-primary">
            Account Center
          </Link>
        </div>
      </div>

      {errorMessage ? (
        <div className="alert alert-error">{errorMessage}</div>
      ) : null}

      {/* KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">Total Events</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{stats?.totals.totalEvents ?? "-"}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">Total Guests</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{stats?.totals.totalGuests ?? "-"}</p>
        </div>
        <div className="stat-card" style={{ borderColor: "#bbf7d0" }}>
          <p className="text-xs uppercase tracking-wider font-semibold text-emerald-600">Checked In</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700">
            {stats?.totals.checkedInGuests ?? "-"}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wider font-semibold text-blue-600">Check-In Rate</p>
          <p className="mt-2 text-3xl font-bold text-blue-700">
            {stats ? `${stats.totals.checkInRatePercent}%` : "-"}
          </p>
        </div>
      </section>

      {/* Main Grid */}
      <div className="grid gap-6 xl:grid-cols-5">
        {/* Event Check-In Progress */}
        <section className="xl:col-span-3 card p-6">
          <h2 className="text-base font-semibold text-slate-900">Event Check-In Progress</h2>
          <p className="mt-1 text-sm text-slate-500">
            Top events by guest volume with current check-in completion.
          </p>

          {topEventAttendance.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400 text-center py-6">
              No event attendance data yet.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {topEventAttendance.map((event) => {
                const checkedPercent = clampPercent(event.checkInRatePercent);

                return (
                  <div key={event.eventId} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900 text-sm">{event.eventName}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{formatDate(event.eventDate)}</p>
                      </div>
                      <p className="text-sm font-semibold text-slate-700">
                        {event.checkedInGuests}/{event.totalGuests}
                      </p>
                    </div>

                    <div className="mt-2.5 h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${checkedPercent}%`,
                          background: checkedPercent >= 75 ? "linear-gradient(90deg, #10b981, #059669)" :
                            checkedPercent >= 50 ? "linear-gradient(90deg, #3b82f6, #2563eb)" :
                            "linear-gradient(90deg, #f59e0b, #d97706)"
                        }}
                      />
                    </div>

                    <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400">
                      <span>{checkedPercent}% complete</span>
                      <span>{event.remainingGuests} remaining</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Account Distribution */}
        <section className="xl:col-span-2 card p-6">
          <h2 className="text-base font-semibold text-slate-900">Account Distribution</h2>
          <p className="mt-1 text-sm text-slate-500">
            Active and suspended account breakdown.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="relative h-36 w-36">
              <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" aria-hidden>
                <circle
                  cx="70"
                  cy="70"
                  r={roleChart.radius}
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="20"
                />
                <circle
                  cx="70"
                  cy="70"
                  r={roleChart.radius}
                  fill="none"
                  stroke="#1e3a8a"
                  strokeWidth="20"
                  strokeDasharray={`${roleChart.adminArc} ${roleChart.circumference - roleChart.adminArc}`}
                />
                <circle
                  cx="70"
                  cy="70"
                  r={roleChart.radius}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="20"
                  strokeDasharray={`${roleChart.organizerArc} ${roleChart.circumference - roleChart.organizerArc}`}
                  strokeDashoffset={-roleChart.adminArc}
                />
              </svg>
              <div className="absolute inset-6 flex items-center justify-center rounded-full bg-white text-center">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Accounts</p>
                  <p className="text-xl font-bold text-slate-900">{totalAccounts}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-900 shrink-0" />
                <span className="text-slate-600">
                  Admins: <span className="font-semibold text-slate-900">{stats?.accounts.admins ?? 0}</span>
                  <span className="text-slate-400 ml-1">({adminSharePercent}%)</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
                <span className="text-slate-600">
                  Organizers: <span className="font-semibold text-slate-900">{stats?.accounts.organizers ?? 0}</span>
                  <span className="text-slate-400 ml-1">({organizerSharePercent}%)</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-slate-600">
                  Active: <span className="font-semibold text-slate-900">{stats?.accounts.activeOrganizers ?? 0}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-400 shrink-0" />
                <span className="text-slate-600">
                  Suspended: <span className="font-semibold text-slate-900">{stats?.accounts.suspendedOrganizers ?? 0}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600">Active Admins</p>
              <p className="mt-1 text-xl font-bold text-emerald-700">
                {stats?.accounts.activeAdmins ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Inactive Admins</p>
              <p className="mt-1 text-xl font-bold text-slate-700">
                {stats?.accounts.inactiveAdmins ?? 0}
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Event Volume Trend */}
      <section className="card p-6">
        <h2 className="text-base font-semibold text-slate-900">Event Volume Trend</h2>
        <p className="mt-1 text-sm text-slate-500">
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
                stroke="#e2e8f0"
                strokeWidth={1}
              />
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <polygon points={monthlyChart.areaPoints} fill="url(#chartGradient)" />
              <polyline
                points={monthlyChart.linePoints}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {monthlyChart.points.map((point) => (
                <g key={point.label}>
                  <circle cx={point.x} cy={point.y} r={4} fill="white" stroke="#3b82f6" strokeWidth="2" />
                  <text
                    x={point.x}
                    y={monthlyChart.baselineY + 16}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#94a3b8"
                    fontFamily="inherit"
                  >
                    {point.label}
                  </text>
                  <text
                    x={point.x}
                    y={point.y - 12}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight="600"
                    fill="#1e293b"
                    fontFamily="inherit"
                  >
                    {point.count}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400 text-center py-6">
            No monthly trend data yet.
          </p>
        )}
      </section>

      {/* Recent Account Activity */}
      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">Recent Account Activity</h2>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/admins/create" className="btn-secondary text-xs h-8 px-3">
              Add Admin
            </Link>
            <Link href="/dashboard/organizers/create" className="btn-secondary text-xs h-8 px-3">
              Add Organizer
            </Link>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
          <table className="data-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Name</th>
                <th>Status</th>
                <th>Created</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.recentAccounts ?? []).map((account) => (
                <tr key={account.id}>
                  <td className="font-medium text-slate-900 capitalize">{account.role}</td>
                  <td>{account.fullName ?? "-"}</td>
                  <td>
                    <span className={`badge ${account.isActive ? "badge-success" : "badge-error"}`}>
                      {account.isActive ? "Active" : "Suspended"}
                    </span>
                  </td>
                  <td>{formatDate(account.createdAt)}</td>
                  <td>{formatDate(account.updatedAt)}</td>
                </tr>
              ))}
              {(stats?.recentAccounts.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-slate-400 py-6">
                    No account activity found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      <Tooltip id="dashboard-actions" place="bottom" style={{ zIndex: 50, fontSize: "0.75rem" }} />
    </div>
  );
}
