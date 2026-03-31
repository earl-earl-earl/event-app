"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Tooltip } from "react-tooltip";

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
      <section className="card p-6">
        <div className="page-header">
          <h1 className="page-title">Privileged Account Center</h1>
          <p className="page-subtitle">
            Open Admin and Organizer interfaces to manage accounts with list actions.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/dashboard/admins" className="btn-primary">
            Open Admins
          </Link>
          <Link href="/dashboard/organizers" className="btn-secondary">
            Open Organizers
          </Link>
        </div>
      </section>

      <section className="card p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">All Privileged Accounts</h2>
          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={isLoading}
            className="btn-secondary btn-icon text-slate-600 hover:text-slate-900"
            data-tooltip-id="privileged-actions"
            data-tooltip-content="Refresh accounts"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>

        {errorMessage ? (
          <div className="alert alert-error mt-4">{errorMessage}</div>
        ) : null}

        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
          <table className="data-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="font-medium text-slate-900 capitalize">{user.role}</td>
                  <td>{user.fullName ?? "-"}</td>
                  <td>{user.email ?? "-"}</td>
                  <td>{user.phoneNumber ?? "-"}</td>
                  <td>
                    <span className={`badge ${user.isActive ? "badge-success" : "badge-error"}`}>
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>{formatDate(user.createdAt)}</td>
                </tr>
              ))}
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-slate-400 py-6">
                    No privileged users found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      <Tooltip id="privileged-actions" place="bottom" style={{ zIndex: 50, fontSize: "0.75rem" }} />
    </div>
  );
}