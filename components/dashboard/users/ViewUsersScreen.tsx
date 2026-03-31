"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { formatDate, type UserRole } from "@/components/dashboard/users/shared";

interface ManagedUserRecord {
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
  currentUserId: string;
  users: ManagedUserRecord[];
}

interface PatchResponse {
  success: true;
  user?: ManagedUserRecord;
  organizer?: ManagedUserRecord;
}

interface DeleteResponse {
  success: true;
  deletedUserId: string;
}

export function ViewUsersScreen({ role }: { role: UserRole }) {
  const [users, setUsers] = useState<ManagedUserRecord[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const roleLabel = role === "admin" ? "Admin" : "Organizer";
  const roleLabelPlural = role === "admin" ? "Admins" : "Organizers";
  const createRoute =
    role === "admin" ? "/dashboard/admins/create" : "/dashboard/organizers/create";
  const editRouteBase = role === "admin" ? "/dashboard/admins/edit" : "/dashboard/organizers/edit";

  const loadUsers = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/users?role=${role}`, { cache: "no-store" });
      const data = (await response.json()) as UsersResponse | { success: false; error?: string };

      if (!response.ok || !data.success) {
        setErrorMessage(
          "error" in data && typeof data.error === "string"
            ? data.error
            : `Failed to load ${roleLabel.toLowerCase()} accounts.`,
        );
        return;
      }

      setUsers(data.users);
      setCurrentUserId(data.currentUserId);
      setErrorMessage(null);
    } finally {
      setIsLoading(false);
    }
  }, [role, roleLabel]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function handleToggleSuspend(user: ManagedUserRecord) {
    setBusyUserId(user.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isActive: !user.isActive,
        }),
      });

      const data = (await response.json()) as PatchResponse | { success: false; error?: string };

      if (!response.ok || !data.success) {
        setErrorMessage(
          "error" in data && typeof data.error === "string"
            ? data.error
            : `Failed to update ${roleLabel.toLowerCase()} status.`,
        );
        return;
      }

      const updatedUser = data.user ?? data.organizer;
      if (!updatedUser) {
        setErrorMessage("Failed to parse updated user response.");
        return;
      }

      setUsers((previous) =>
        previous.map((item) => (item.id === updatedUser.id ? updatedUser : item)),
      );
      setSuccessMessage(
        updatedUser.isActive
          ? `Reactivated ${updatedUser.email ?? updatedUser.id}.`
          : `Suspended ${updatedUser.email ?? updatedUser.id}.`,
      );
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleDelete(user: ManagedUserRecord) {
    const confirmed = globalThis.confirm(
      `Delete ${roleLabel.toLowerCase()} account ${user.email ?? user.id}? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setBusyUserId(user.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as DeleteResponse | { success: false; error?: string };

      if (!response.ok || !data.success) {
        setErrorMessage(
          "error" in data && typeof data.error === "string"
            ? data.error
            : `Failed to delete ${roleLabel.toLowerCase()} account.`,
        );
        return;
      }

      setUsers((previous) => previous.filter((item) => item.id !== data.deletedUserId));
      setSuccessMessage(`Deleted ${roleLabel.toLowerCase()} account ${user.email ?? user.id}.`);
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">View {roleLabelPlural}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage {roleLabel.toLowerCase()} accounts with row-level actions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={isLoading}
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-3 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
          <Link
            href={createRoute}
            className="inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-3 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Add {roleLabel}
          </Link>
        </div>
      </div>

      {errorMessage ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {successMessage}
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {users.map((user) => {
              const isBusy = busyUserId === user.id;
              const isSelf = currentUserId === user.id;

              return (
                <tr key={user.id}>
                  <td className="px-3 py-2 font-medium text-slate-900">{user.fullName ?? "-"}</td>
                  <td className="px-3 py-2">{user.email ?? "-"}</td>
                  <td className="px-3 py-2">{user.phoneNumber ?? "-"}</td>
                  <td className="px-3 py-2">{user.isActive ? "Active" : "Suspended"}</td>
                  <td className="px-3 py-2">{formatDate(user.createdAt)}</td>
                  <td className="px-3 py-2">{formatDate(user.updatedAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`${editRouteBase}?userId=${user.id}`}
                        className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleToggleSuspend(user)}
                        className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isBusy
                          ? "Processing..."
                          : user.isActive
                            ? "Suspend"
                            : "Reactivate"}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy || isSelf}
                        onClick={() => void handleDelete(user)}
                        title={isSelf ? "You cannot delete your own account." : undefined}
                        className="inline-flex h-8 items-center justify-center rounded-md border border-rose-300 px-3 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSelf ? "Delete (Self)" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-slate-500">
                  No {roleLabel.toLowerCase()} accounts found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}