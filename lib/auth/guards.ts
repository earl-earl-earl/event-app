import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getAuthenticatedUser, isAdminUser, isStaffUser } from "@/lib/auth/session";

interface GuardSuccess {
  user: User;
}

interface GuardFailure {
  response: NextResponse;
}

export type GuardResult = GuardSuccess | GuardFailure;

export async function requireAdminGuard(): Promise<GuardResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      response: NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 },
      ),
    };
  }

  if (!isAdminUser(user)) {
    return {
      response: NextResponse.json(
        { success: false, error: "Forbidden." },
        { status: 403 },
      ),
    };
  }

  return { user };
}

export async function requireStaffGuard(): Promise<GuardResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      response: NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 },
      ),
    };
  }

  if (!isStaffUser(user)) {
    return {
      response: NextResponse.json(
        { success: false, error: "Forbidden." },
        { status: 403 },
      ),
    };
  }

  return { user };
}
