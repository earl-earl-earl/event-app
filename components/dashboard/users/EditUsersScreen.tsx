"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  generateBrowserPassword,
  type UserRole,
} from "@/components/dashboard/users/shared";

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
  users: ManagedUserRecord[];
}

interface UpdateUserResponse {
  success: true;
  user?: ManagedUserRecord;
  organizer?: ManagedUserRecord;
  generatedPassword: string | null;
}

export function EditUsersScreen({ role }: { role: UserRole }) {
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<ManagedUserRecord[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [generateOnServer, setGenerateOnServer] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  const roleLabel = role === "admin" ? "Admin" : "Organizer";
  const roleLabelPlural = role === "admin" ? "Admins" : "Organizers";
  const selectedUserIdFromQuery = searchParams.get("userId");

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [users, selectedUserId],
  );

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
      setErrorMessage(null);

      if (
        selectedUserIdFromQuery &&
        data.users.some((user) => user.id === selectedUserIdFromQuery)
      ) {
        setSelectedUserId(selectedUserIdFromQuery);
      } else if (!selectedUserId && data.users.length > 0) {
        setSelectedUserId(data.users[0].id);
      }
    } finally {
      setIsLoading(false);
    }
  }, [role, roleLabel, selectedUserId, selectedUserIdFromQuery]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!selectedUser) {
      return;
    }

    setEmail(selectedUser.email ?? "");
    setFullName(selectedUser.fullName ?? "");
    setPhoneNumber(selectedUser.phoneNumber ?? "");
    setPassword("");
    setGenerateOnServer(false);
    setGeneratedPassword(null);
  }, [selectedUser]);

  async function handleSaveChanges(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedUserId) {
      setErrorMessage(`Please select a ${roleLabel.toLowerCase()} first.`);
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setGeneratedPassword(null);
    setIsSaving(true);

    try {
      const payload: Record<string, unknown> = {};

      if (email.trim() !== (selectedUser?.email ?? "")) {
        payload.email = email.trim();
      }

      if (fullName.trim() !== (selectedUser?.fullName ?? "")) {
        payload.fullName = fullName.trim();
      }

      if (phoneNumber.trim() !== (selectedUser?.phoneNumber ?? "")) {
        payload.phoneNumber = phoneNumber.trim() || null;
      }

      if (password.trim().length > 0) {
        payload.password = password.trim();
      }

      if (generateOnServer && password.trim().length === 0) {
        payload.generatePassword = true;
      }

      if (Object.keys(payload).length === 0) {
        setErrorMessage("No changes detected.");
        return;
      }

      const response = await fetch(`/api/users/${selectedUserId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as
        | UpdateUserResponse
        | { success: false; error?: string };

      if (!response.ok || !data.success) {
        setErrorMessage(
          "error" in data && typeof data.error === "string"
            ? data.error
            : `Failed to update ${roleLabel.toLowerCase()} account.`,
        );
        return;
      }

      const updatedUser = data.user ?? data.organizer;
      if (!updatedUser) {
        setErrorMessage("Failed to parse updated user response.");
        return;
      }

      setGeneratedPassword(data.generatedPassword);
      setSuccessMessage(`Updated ${roleLabel.toLowerCase()} account for ${updatedUser.email ?? "(no email)"}.`);

      setUsers((previous) =>
        previous.map((user) => (user.id === updatedUser.id ? updatedUser : user)),
      );

      setPassword("");
      setGenerateOnServer(false);
    } finally {
      setIsSaving(false);
    }
  }

  function handleGeneratePasswordLocally() {
    try {
      setPassword(generateBrowserPassword());
      setGenerateOnServer(false);
      setErrorMessage(null);
    } catch {
      setErrorMessage("Failed to generate password in browser. Try server generation.");
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Edit {roleLabelPlural}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Update {roleLabel.toLowerCase()} profile details, email, and password.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadUsers()}
          disabled={isLoading}
          className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-3 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="mt-4">
        <label className="text-sm text-slate-700">
          {roleLabel} account
          <select
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
          >
            {users.length === 0 ? <option value="">No {roleLabel.toLowerCase()}s</option> : null}
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.fullName ?? user.email ?? user.id}
              </option>
            ))}
          </select>
        </label>
      </div>

      <form className="mt-5 grid gap-3 md:grid-cols-2" onSubmit={handleSaveChanges}>
        <label className="text-sm text-slate-700">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
          />
        </label>

        <label className="text-sm text-slate-700">
          Full name
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
          />
        </label>

        <label className="text-sm text-slate-700">
          Phone number
          <input
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
          />
        </label>

        <label className="text-sm text-slate-700">
          Password
          <input
            type="text"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Leave blank if unchanged"
            className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
          />
        </label>

        <div className="md:col-span-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleGeneratePasswordLocally}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Generate Password
          </button>

          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={generateOnServer}
              onChange={(event) => setGenerateOnServer(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Auto-generate on server if password is blank
          </label>
        </div>

        <button
          type="submit"
          disabled={isSaving || !selectedUser}
          className="md:col-span-2 inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving..." : `Save ${roleLabel} Changes`}
        </button>
      </form>

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

      {generatedPassword ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Generated password: <span className="font-mono">{generatedPassword}</span>
        </div>
      ) : null}
    </section>
  );
}