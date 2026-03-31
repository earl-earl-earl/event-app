import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminGuard } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { getServiceSupabase } from "@/lib/supabase/service";
import type { Database } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createPrivilegedUserSchema = z
  .object({
    email: z.string().email().max(320),
    fullName: z.string().trim().min(2).max(160),
    phoneNumber: z.string().trim().min(7).max(30).optional(),
    role: z.enum(["admin", "organizer"]),
    password: z.string().min(12).max(128).optional(),
    generatePassword: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    const hasPassword = typeof value.password === "string" && value.password.length > 0;

    if (!value.generatePassword && !hasPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: "Password is required unless generatePassword is true.",
      });
    }
  });

const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+[]{}";

function normalizePhoneNumber(value: string | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  return normalized;
}

function isStrongPassword(password: string): boolean {
  return (
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function generateSecurePassword(length = 20): string {
  for (let attempts = 0; attempts < 8; attempts += 1) {
    const bytes = randomBytes(length);
    let output = "";

    for (let index = 0; index < bytes.length; index += 1) {
      output += PASSWORD_ALPHABET[bytes[index] % PASSWORD_ALPHABET.length];
    }

    if (isStrongPassword(output)) {
      return output;
    }
  }

  throw new Error("Failed to generate a strong password.");
}

async function buildUserEmailMap() {
  const supabase = getServiceSupabase();
  const emailByUserId = new Map<string, string | null>();

  let page = 1;
  const perPage = 1000;

  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(error.message);
    }

    for (const user of data.users) {
      emailByUserId.set(user.id, user.email ?? null);
    }

    if (data.users.length < perPage) {
      break;
    }

    page += 1;
  }

  return emailByUserId;
}

export async function GET(request: Request) {
  const guard = await requireAdminGuard();
  if ("response" in guard) {
    return guard.response;
  }

  const url = new URL(request.url);
  const roleFilterParam = url.searchParams.get("role");
  const roleFilter =
    roleFilterParam === null
      ? null
      : roleFilterParam === "admin" || roleFilterParam === "organizer"
        ? (roleFilterParam as Database["public"]["Enums"]["profile_role"])
        : null;

  if (roleFilterParam !== null && roleFilter === null) {
    return jsonError("Invalid role filter.", 400, "invalid_role_filter");
  }

  const supabase = getServiceSupabase();

  let profilesQuery = supabase
    .from("profiles")
    .select("id, role, full_name, phone_number, is_active, created_by, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (roleFilter) {
    profilesQuery = profilesQuery.eq("role", roleFilter);
  }

  const { data: profiles, error: profilesError } = await profilesQuery;

  if (profilesError) {
    return jsonError(profilesError.message, 500, "profiles_fetch_failed");
  }

  let emailByUserId: Map<string, string | null>;

  try {
    emailByUserId = await buildUserEmailMap();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list auth users.";
    return jsonError(message, 500, "auth_users_fetch_failed");
  }

  return NextResponse.json({
    success: true,
    currentUserId: guard.user.id,
    users: profiles.map((profile) => ({
      id: profile.id,
      role: profile.role,
      email: emailByUserId.get(profile.id) ?? null,
      fullName: profile.full_name,
      phoneNumber: profile.phone_number,
      isActive: profile.is_active,
      createdBy: profile.created_by,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    })),
  });
}

export async function POST(request: Request) {
  const guard = await requireAdminGuard();
  if ("response" in guard) {
    return guard.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON payload.", 400, "invalid_payload");
  }

  const parsedBody = createPrivilegedUserSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError(parsedBody.error.message, 400, "validation_error");
  }

  const role = parsedBody.data.role as Database["public"]["Enums"]["profile_role"];
  const fullName = parsedBody.data.fullName.trim();
  const phoneNumber = normalizePhoneNumber(parsedBody.data.phoneNumber);

  let password = parsedBody.data.password;
  const generatedPassword = parsedBody.data.generatePassword
    ? generateSecurePassword()
    : null;

  if (generatedPassword) {
    password = generatedPassword;
  }

  if (!password) {
    return jsonError("Password is required.", 400, "password_required");
  }

  if (!isStrongPassword(password)) {
    return jsonError(
      "Password must include uppercase, lowercase, number, and symbol characters.",
      400,
      "weak_password",
    );
  }

  const supabase = getServiceSupabase();

  const { data: createdAuthUser, error: createAuthError } =
    await supabase.auth.admin.createUser({
      email: parsedBody.data.email.trim().toLowerCase(),
      password,
      email_confirm: true,
      app_metadata: {
        role,
      },
      user_metadata: {
        full_name: fullName,
        phone_number: phoneNumber,
      },
    });

  if (createAuthError || !createdAuthUser.user) {
    return jsonError(
      createAuthError?.message ?? "Failed to create auth user.",
      400,
      "auth_user_create_failed",
    );
  }

  const { error: profileInsertError } = await supabase.from("profiles").upsert(
    {
      id: createdAuthUser.user.id,
      role,
      full_name: fullName,
      phone_number: phoneNumber,
      is_active: true,
      created_by: guard.user.id,
    },
    { onConflict: "id" },
  );

  if (profileInsertError) {
    await supabase.auth.admin.deleteUser(createdAuthUser.user.id);

    return jsonError(profileInsertError.message, 500, "profile_create_failed");
  }

  return NextResponse.json(
    {
      success: true,
      user: {
        id: createdAuthUser.user.id,
        email: createdAuthUser.user.email,
        role,
        fullName,
        phoneNumber,
        createdAt: createdAuthUser.user.created_at,
      },
      generatedPassword,
    },
    { status: 201 },
  );
}
