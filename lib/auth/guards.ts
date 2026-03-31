import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import {
  getAuthenticatedProfileSession,
  isAdminRole,
  isManagementRole,
  isOrganizerRole,
  type ProfileRecord,
  type ProfileRole,
} from "@/lib/auth/session";

interface GuardSuccess {
  user: User;
  role: ProfileRole;
  profile: ProfileRecord;
}

interface GuardFailure {
  response: NextResponse;
}

export type GuardResult = GuardSuccess | GuardFailure;

export async function requireAdminGuard(): Promise<GuardResult> {
  const session = await getAuthenticatedProfileSession();

  if (!session) {
    return {
      response: NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 },
      ),
    };
  }

  if (!isAdminRole(session.role)) {
    return {
      response: NextResponse.json(
        { success: false, error: "Forbidden." },
        { status: 403 },
      ),
    };
  }

  return session;
}

export async function requireStaffGuard(): Promise<GuardResult> {
  return requireOrganizerGuard();
}

export async function requireManagementGuard(): Promise<GuardResult> {
  const session = await getAuthenticatedProfileSession();

  if (!session) {
    return {
      response: NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 },
      ),
    };
  }

  if (!isManagementRole(session.role)) {
    return {
      response: NextResponse.json(
        { success: false, error: "Forbidden." },
        { status: 403 },
      ),
    };
  }

  return session;
}

export async function requireOrganizerGuard(): Promise<GuardResult> {
  const session = await getAuthenticatedProfileSession();

  if (!session) {
    return {
      response: NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 },
      ),
    };
  }

  if (!isOrganizerRole(session.role)) {
    return {
      response: NextResponse.json(
        { success: false, error: "Forbidden." },
        { status: 403 },
      ),
    };
  }

  return session;
}
