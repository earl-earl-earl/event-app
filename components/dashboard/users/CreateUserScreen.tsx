"use client";

import { useState } from "react";

import {
  generateBrowserPassword,
  type UserRole,
} from "@/components/dashboard/users/shared";

interface CreateUserResponse {
  success: true;
  user: {
    id: string;
    role: UserRole;
    email: string | null;
    fullName: string | null;
    phoneNumber: string | null;
    createdAt: string;
  };
  generatedPassword: string | null;
}

export function CreateUserScreen({ role }: { role: UserRole }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [generateOnServer, setGenerateOnServer] = useState(true);

  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  const roleLabel = role === "admin" ? "Admin" : "Organizer";

  async function handleCreateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage(null);
    setSuccessMessage(null);
    setGeneratedPassword(null);
    setIsCreating(true);

    try {
      const normalizedPassword = password.trim();
      const shouldGenerateOnServer = generateOnServer && normalizedPassword.length === 0;

      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          fullName: fullName.trim(),
          phoneNumber: phoneNumber.trim() || undefined,
          role,
          password: normalizedPassword || undefined,
          generatePassword: shouldGenerateOnServer,
        }),
      });

      const data = (await response.json()) as
        | CreateUserResponse
        | { success: false; error?: string };

      if (!response.ok || !data.success) {
        setErrorMessage(
          "error" in data && typeof data.error === "string"
            ? data.error
            : `Failed to create ${roleLabel.toLowerCase()} account.`,
        );
        return;
      }

      setEmail("");
      setFullName("");
      setPhoneNumber("");
      setPassword("");
      setGenerateOnServer(true);

      setGeneratedPassword(data.generatedPassword);
      setSuccessMessage(
        `Created ${roleLabel.toLowerCase()} account for ${data.user.email ?? "(no email)"}.`,
      );
    } finally {
      setIsCreating(false);
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
      <h1 className="text-2xl font-semibold text-slate-900">Create {roleLabel}</h1>
      <p className="mt-1 text-sm text-slate-600">
        Create a new {roleLabel.toLowerCase()} account from this dedicated admin screen.
      </p>

      <form className="mt-5 grid gap-3 md:grid-cols-2" onSubmit={handleCreateUser}>
        <label className="text-sm text-slate-700">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={`${roleLabel.toLowerCase()}@company.com`}
            className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
          />
        </label>

        <label className="text-sm text-slate-700">
          Full name
          <input
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder={`${roleLabel} Name`}
            className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
          />
        </label>

        <label className="text-sm text-slate-700">
          Phone number
          <input
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="+639171234567"
            className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
          />
        </label>

        <label className="text-sm text-slate-700">
          Password
          <input
            type="text"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Leave blank for server generation"
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
          disabled={isCreating}
          className="md:col-span-2 inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isCreating ? "Creating..." : `Create ${roleLabel}`}
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