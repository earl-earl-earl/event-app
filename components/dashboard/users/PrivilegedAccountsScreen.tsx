"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { formatDate, type UserRole } from "@/components/dashboard/users/shared";

interface PrivilegedUserRecord {
  id: string;
  role: UserRole;
  email: string | null;
  fullName: string | null;
  phoneNumber: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UsersResponse {
  success: true;
  users: PrivilegedUserRecord[];
}

export function PrivilegedAccountsScreen() {
  const [users, setUsers] = useState<PrivilegedUserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/users", { cache: "no-store" });
      const data = (await response.json()) as UsersResponse | { success: false; error?: string };

      if (!response.ok || !data.success) {
        setErrorMessage(
          "error" in data && typeof data.error === "string"
            ? data.error
            : "Failed to load users.",
        );
        return;
      }

      setUsers(data.users);
      setErrorMessage(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Privileged Account Center</h1>
        <p className="mt-1 text-sm text-slate-600">
          Open Admin and Organizer interfaces to manage accounts with list actions.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/dashboard/admins"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Open Admins
          </Link>
          <Link
            href="/dashboard/organizers"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Open Organizers
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">All Privileged Accounts</h2>
          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={isLoading}
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-3 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {errorMessage ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-3 py-2 font-medium text-slate-900 capitalize">{user.role}</td>
                  <td className="px-3 py-2">{user.fullName ?? "-"}</td>
                  <td className="px-3 py-2">{user.email ?? "-"}</td>
                  <td className="px-3 py-2">{user.phoneNumber ?? "-"}</td>
                  <td className="px-3 py-2">{user.isActive ? "Active" : "Inactive"}</td>
                  <td className="px-3 py-2">{formatDate(user.createdAt)}</td>
                </tr>
              ))}
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-slate-500">
                    No privileged users found.
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