export type UserRole = "admin" | "organizer";

export interface OrganizerAccount {
  id: string;
  role: UserRole;
  email: string | null;
  fullName: string | null;
  phoneNumber: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizersResponse {
  success: true;
  users: OrganizerAccount[];
}

export const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+[]{}";

export function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function isStrongPassword(password: string): boolean {
  return (
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export function generateBrowserPassword(length = 20): string {
  for (let attempts = 0; attempts < 8; attempts += 1) {
    const values = new Uint32Array(length);
    globalThis.crypto.getRandomValues(values);

    let output = "";
    for (let index = 0; index < values.length; index += 1) {
      output += PASSWORD_ALPHABET[values[index] % PASSWORD_ALPHABET.length];
    }

    if (isStrongPassword(output)) {
      return output;
    }
  }

  throw new Error("Failed to generate secure password.");
}
