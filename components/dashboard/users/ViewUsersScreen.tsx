"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2, Ban, CheckCircle, RefreshCw } from "lucide-react";
import { Tooltip } from "react-tooltip";

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
    <section className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="page-header">
          <h1 className="page-title">View {roleLabelPlural}</h1>
          <p className="page-subtitle">
            Manage {roleLabel.toLowerCase()} accounts with row-level actions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={isLoading}
            className="btn-secondary btn-icon text-slate-600 hover:text-slate-900"
            data-tooltip-id="user-actions"
            data-tooltip-content={`Refresh ${roleLabelPlural.toLowerCase()}`}
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </button>
          <Link href={createRoute} className="btn-primary text-xs h-8 px-3">
            Add {roleLabel}
          </Link>
        </div>
      </div>

      {errorMessage ? (
        <div className="alert alert-error mt-4">{errorMessage}</div>
      ) : null}

      {successMessage ? (
        <div className="alert alert-success mt-4">{successMessage}</div>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Created</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isBusy = busyUserId === user.id;
              const isSelf = currentUserId === user.id;

              return (
                <tr key={user.id}>
                  <td className="font-medium text-slate-900">{user.fullName ?? "-"}</td>
                  <td>{user.email ?? "-"}</td>
                  <td>{user.phoneNumber ?? "-"}</td>
                  <td>
                    <span className={`badge ${user.isActive ? "badge-success" : "badge-error"}`}>
                      {user.isActive ? "Active" : "Suspended"}
                    </span>
                  </td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>{formatDate(user.updatedAt)}</td>
                  <td>
                    <div className="flex flex-wrap gap-2 items-center">
                      <Link
                        href={`${editRouteBase}?userId=${user.id}`}
                        className="btn-secondary btn-icon flex items-center justify-center text-slate-600 hover:text-indigo-600 focus:text-indigo-600"
                        title="Edit User"
                        data-tooltip-id="user-actions"
                        data-tooltip-content="Edit User"
                      >
                        <Pencil size={16} />
                      </Link>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleToggleSuspend(user)}
                        className="btn-secondary btn-icon flex items-center justify-center text-slate-600 hover:text-orange-600 focus:text-orange-600"
                        title={user.isActive ? "Suspend User" : "Reactivate User"}
                        data-tooltip-id="user-actions"
                        data-tooltip-content={user.isActive ? "Suspend" : "Reactivate"}
                      >
                        {isBusy ? (
                          <span className="animate-spin text-lg">⏳</span>
                        ) : user.isActive ? (
                          <Ban size={16} />
                        ) : (
                          <CheckCircle size={16} />
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy || isSelf}
                        onClick={() => void handleDelete(user)}
                        title={isSelf ? "You cannot delete your own account." : "Delete User"}
                        className="btn-danger btn-icon flex items-center justify-center disabled:opacity-50"
                        data-tooltip-id="user-actions"
                        data-tooltip-content={isSelf ? "Self - Cannot Delete" : "Delete"}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-slate-400 py-6">
                  No {roleLabel.toLowerCase()} accounts found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Tooltip id="user-actions" place="bottom" style={{ zIndex: 50, fontSize: "0.75rem" }} />
    </section>
  );
}