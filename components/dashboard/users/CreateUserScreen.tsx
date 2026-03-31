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
    <section className="card p-6">
      <div className="page-header">
        <h1 className="page-title">Create {roleLabel}</h1>
        <p className="page-subtitle">
          Create a new {roleLabel.toLowerCase()} account from this dedicated admin screen.
        </p>
      </div>

      <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={handleCreateUser}>
        <div>
          <label className="form-label">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={`${roleLabel.toLowerCase()}@company.com`}
            className="form-input"
          />
        </div>

        <div>
          <label className="form-label">Full name</label>
          <input
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder={`${roleLabel} Name`}
            className="form-input"
          />
        </div>

        <div>
          <label className="form-label">Phone number</label>
          <input
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="+639171234567"
            className="form-input"
          />
        </div>

        <div>
          <label className="form-label">Password</label>
          <input
            type="text"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Leave blank for server generation"
            className="form-input"
          />
        </div>

        <div className="md:col-span-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleGeneratePasswordLocally}
            className="btn-secondary"
          >
            Generate Password
          </button>

          <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={generateOnServer}
              onChange={(event) => setGenerateOnServer(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Auto-generate on server if password is blank
          </label>
        </div>

        <button
          type="submit"
          disabled={isCreating}
          className="md:col-span-2 btn-primary"
        >
          {isCreating ? "Creating..." : `Create ${roleLabel}`}
        </button>
      </form>

      {errorMessage ? (
        <div className="alert alert-error mt-4">{errorMessage}</div>
      ) : null}

      {successMessage ? (
        <div className="alert alert-success mt-4">{successMessage}</div>
      ) : null}

      {generatedPassword ? (
        <div className="alert alert-warning mt-4">
          Generated password: <span className="font-mono font-semibold">{generatedPassword}</span>
        </div>
      ) : null}
    </section>
  );
}