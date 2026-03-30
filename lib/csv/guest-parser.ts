import Papa from "papaparse";

import type { Json } from "@/types/database";

const FIRST_NAME_KEYS = ["first_name", "firstname", "first", "given_name"];
const LAST_NAME_KEYS = ["last_name", "lastname", "last", "surname", "family_name"];
const FULL_NAME_KEYS = ["name", "full_name", "fullname", "guest_name"];
const EMAIL_KEYS = ["email", "email_address", "mail"];
const PHONE_KEYS = ["phone", "phone_number", "phonenumber", "mobile", "contact_number"];
const MAX_ENTRIES_KEYS = ["max_entries", "entry_limit", "allowed_entries"];

const KNOWN_COLUMNS = new Set([
  ...FIRST_NAME_KEYS,
  ...LAST_NAME_KEYS,
  ...FULL_NAME_KEYS,
  ...EMAIL_KEYS,
  ...PHONE_KEYS,
  ...MAX_ENTRIES_KEYS,
]);

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ParsedGuestInput {
  rowNumber: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  maxEntries: number;
  metadata: Record<string, Json>;
}

export interface CsvGuestFailure {
  rowNumber: number;
  reason: string;
}

export interface ParsedGuestCsv {
  guests: ParsedGuestInput[];
  failures: CsvGuestFailure[];
}

type RawCsvRow = Record<string, unknown>;

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function isJson(value: unknown): value is Json {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((item) => isJson(item));
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every((item) =>
      isJson(item),
    );
  }

  return false;
}

function coerceMetadataValue(value: unknown): Json | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  const rawText = String(value).trim();
  if (rawText.length === 0) {
    return undefined;
  }

  if (/^(true|false)$/i.test(rawText)) {
    return rawText.toLowerCase() === "true";
  }

  if (/^-?\d+(\.\d+)?$/.test(rawText)) {
    const numberValue = Number(rawText);
    if (Number.isFinite(numberValue)) {
      return numberValue;
    }
  }

  if (
    (rawText.startsWith("{") && rawText.endsWith("}")) ||
    (rawText.startsWith("[") && rawText.endsWith("]"))
  ) {
    try {
      const parsed = JSON.parse(rawText);
      if (isJson(parsed)) {
        return parsed;
      }
    } catch {
      return rawText;
    }
  }

  return rawText;
}

function pullFirstValue(row: RawCsvRow, keys: string[]): string {
  for (const key of keys) {
    const raw = row[key];
    if (raw === null || raw === undefined) {
      continue;
    }

    const stringValue = String(raw).trim();
    if (stringValue.length > 0) {
      return stringValue;
    }
  }

  return "";
}

function parseNameFromCombinedField(value: string): {
  firstName: string;
  lastName: string;
} {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length < 2) {
    return {
      firstName: parts[0] ?? "",
      lastName: "",
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function parsePositiveInt(value: string, fallback: number): number {
  if (value.trim().length === 0) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

export function parseGuestCsv(csvText: string): ParsedGuestCsv {
  const parsed = Papa.parse<RawCsvRow>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
  });

  const failures: CsvGuestFailure[] = parsed.errors.map((error) => ({
    rowNumber: (error.row ?? 0) + 2,
    reason: error.message,
  }));

  const guests: ParsedGuestInput[] = [];

  parsed.data.forEach((row, index) => {
    const rowNumber = index + 2;

    let firstName = pullFirstValue(row, FIRST_NAME_KEYS);
    let lastName = pullFirstValue(row, LAST_NAME_KEYS);

    if (!firstName || !lastName) {
      const combinedName = pullFirstValue(row, FULL_NAME_KEYS);
      if (combinedName) {
        const parsedName = parseNameFromCombinedField(combinedName);
        if (!firstName) {
          firstName = parsedName.firstName;
        }

        if (!lastName) {
          lastName = parsedName.lastName;
        }
      }
    }

    const email = pullFirstValue(row, EMAIL_KEYS).toLowerCase();
    const phoneNumber = pullFirstValue(row, PHONE_KEYS);
    const maxEntriesRaw = pullFirstValue(row, MAX_ENTRIES_KEYS);
    const maxEntries = parsePositiveInt(maxEntriesRaw, 1);

    if (!firstName) {
      failures.push({ rowNumber, reason: "Missing first_name (or name)." });
      return;
    }

    if (!lastName) {
      failures.push({ rowNumber, reason: "Missing last_name (or name)." });
      return;
    }

    if (!email || !emailRegex.test(email)) {
      failures.push({ rowNumber, reason: "Missing or invalid email." });
      return;
    }

    if (!phoneNumber) {
      failures.push({ rowNumber, reason: "Missing phone number." });
      return;
    }

    const metadata: Record<string, Json> = {};

    Object.entries(row).forEach(([key, value]) => {
      if (KNOWN_COLUMNS.has(key)) {
        return;
      }

      const parsedMetadataValue = coerceMetadataValue(value);
      if (parsedMetadataValue !== undefined) {
        metadata[key] = parsedMetadataValue;
      }
    });

    guests.push({
      rowNumber,
      firstName,
      lastName,
      email,
      phoneNumber,
      maxEntries,
      metadata,
    });
  });

  return { guests, failures };
}
