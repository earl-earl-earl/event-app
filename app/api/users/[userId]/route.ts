import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminGuard } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { getServiceSupabase } from "@/lib/supabase/service";
import type { Database } from "@/types/database";

const userIdSchema = z.string().uuid();

const updateUserSchema = z
  .object({
    email: z.string().email().max(320).optional(),
    fullName: z.string().trim().min(2).max(160).optional(),
    phoneNumber: z.union([z.string().trim().min(7).max(30), z.null()]).optional(),
    password: z.string().min(12).max(128).optional(),
    isActive: z.boolean().optional(),
    generatePassword: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.email !== undefined ||
      value.fullName !== undefined ||
      value.phoneNumber !== undefined ||
      value.password !== undefined ||
      value.isActive !== undefined ||
      value.generatePassword === true,
    {
      message: "At least one update field is required.",
    },
  );

const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+[]{}";

function normalizePhoneNumber(value: string | null | undefined): string | null {
  if (value === null) {
    return null;
  }

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

async function getTargetProfile(userId: string) {
  const supabase = getServiceSupabase();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, phone_number, is_active, created_by, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return {
      error: jsonError(error.message, 500, "profile_fetch_failed"),
      profile: null,
    };
  }

  if (!profile) {
    return {
      error: jsonError("User account not found.", 404, "user_not_found"),
      profile: null,
    };
  }

  return {
    error: null,
    profile,
  };
}

function buildManagedUser(
  profile: Database["public"]["Tables"]["profiles"]["Row"],
  email: string | null,
) {
  return {
    id: profile.id,
    role: profile.role,
    email,
    fullName: profile.full_name,
    phoneNumber: profile.phone_number,
    isActive: profile.is_active,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const guard = await requireAdminGuard();
  if ("response" in guard) {
    return guard.response;
  }

  const { userId } = await context.params;
  const parsedUserId = userIdSchema.safeParse(userId);
  if (!parsedUserId.success) {
    return jsonError("Invalid user id.", 400, "invalid_user_id");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON payload.", 400, "invalid_payload");
  }

  const parsedBody = updateUserSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError(parsedBody.error.message, 400, "validation_error");
  }

  const target = await getTargetProfile(parsedUserId.data);
  if (target.error) {
    return target.error;
  }

  if (parsedBody.data.isActive === false && parsedUserId.data === guard.user.id) {
    return jsonError("You cannot suspend your own account.", 400, "self_suspend_not_allowed");
  }

  let password = parsedBody.data.password;
  const generatedPassword = parsedBody.data.generatePassword
    ? generateSecurePassword()
    : null;

  if (generatedPassword) {
    password = generatedPassword;
  }

  if (password && !isStrongPassword(password)) {
    return jsonError(
      "Password must include uppercase, lowercase, number, and symbol characters.",
      400,
      "weak_password",
    );
  }

  const supabase = getServiceSupabase();

  const normalizedFullName = parsedBody.data.fullName?.trim();
  const normalizedPhoneNumber = normalizePhoneNumber(parsedBody.data.phoneNumber);

  const shouldUpdateAuthUser =
    parsedBody.data.email !== undefined ||
    normalizedFullName !== undefined ||
    parsedBody.data.phoneNumber !== undefined ||
    password !== undefined ||
    parsedBody.data.isActive !== undefined;

  let didUpdateAuthUser = false;

  if (shouldUpdateAuthUser) {
    const metadataUpdate: Record<string, string | null> = {};

    if (normalizedFullName !== undefined) {
      metadataUpdate.full_name = normalizedFullName;
    }

    if (parsedBody.data.phoneNumber !== undefined) {
      metadataUpdate.phone_number = normalizedPhoneNumber;
    }

    const appMetadataUpdate: Record<string, string | boolean> = {
      role: target.profile.role,
      is_active: parsedBody.data.isActive ?? target.profile.is_active,
    };

    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
      parsedUserId.data,
      {
        ...(parsedBody.data.email !== undefined
          ? { email: parsedBody.data.email.trim().toLowerCase() }
          : {}),
        ...(password !== undefined ? { password } : {}),
        ...(Object.keys(metadataUpdate).length > 0 ? { user_metadata: metadataUpdate } : {}),
        app_metadata: appMetadataUpdate,
      },
    );

    if (authUpdateError) {
      return jsonError(authUpdateError.message, 400, "auth_user_update_failed");
    }

    didUpdateAuthUser = true;
  }

  const profileUpdatePayload: Record<string, unknown> = {};

  if (normalizedFullName !== undefined) {
    profileUpdatePayload.full_name = normalizedFullName;
  }

  if (parsedBody.data.phoneNumber !== undefined) {
    profileUpdatePayload.phone_number = normalizedPhoneNumber;
  }

  if (parsedBody.data.isActive !== undefined) {
    profileUpdatePayload.is_active = parsedBody.data.isActive;
  } else if (didUpdateAuthUser && target.profile.is_active === false) {
    // Keep suspended state when metadata sync triggers profile updates.
    profileUpdatePayload.is_active = false;
  }

  if (Object.keys(profileUpdatePayload).length > 0) {
    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update(profileUpdatePayload)
      .eq("id", parsedUserId.data);

    if (profileUpdateError) {
      return jsonError(profileUpdateError.message, 500, "profile_update_failed");
    }
  }

  const { data: updatedProfile, error: updatedProfileError } = await supabase
    .from("profiles")
    .select("id, role, full_name, phone_number, is_active, created_by, created_at, updated_at")
    .eq("id", parsedUserId.data)
    .maybeSingle();

  if (updatedProfileError || !updatedProfile) {
    return jsonError(
      updatedProfileError?.message ?? "Failed to fetch updated user profile.",
      500,
      "profile_fetch_after_update_failed",
    );
  }

  const { data: updatedAuth, error: updatedAuthError } = await supabase.auth.admin.getUserById(
    parsedUserId.data,
  );

  if (updatedAuthError) {
    return jsonError(updatedAuthError.message, 500, "auth_fetch_after_update_failed");
  }

  return NextResponse.json({
    success: true,
    user: buildManagedUser(updatedProfile, updatedAuth.user.email ?? null),
    generatedPassword,
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const guard = await requireAdminGuard();
  if ("response" in guard) {
    return guard.response;
  }

  const { userId } = await context.params;
  const parsedUserId = userIdSchema.safeParse(userId);
  if (!parsedUserId.success) {
    return jsonError("Invalid user id.", 400, "invalid_user_id");
  }

  if (parsedUserId.data === guard.user.id) {
    return jsonError("You cannot delete your own account.", 400, "self_delete_not_allowed");
  }

  const target = await getTargetProfile(parsedUserId.data);
  if (target.error) {
    return target.error;
  }

  const supabase = getServiceSupabase();
  const { error: deleteError } = await supabase.auth.admin.deleteUser(parsedUserId.data);

  if (deleteError) {
    return jsonError(deleteError.message, 500, "user_delete_failed");
  }

  return NextResponse.json({
    success: true,
    deletedUserId: parsedUserId.data,
  });
}
