import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { publicEnv } from "@/lib/env/public";
import type { Database } from "@/types/database";

const ADMIN_ROLES = new Set<Database["public"]["Enums"]["profile_role"]>([
  "admin",
]);
const MANAGEMENT_ROLES = new Set<Database["public"]["Enums"]["profile_role"]>([
  "admin",
  "organizer",
]);
const ORGANIZER_ROLES = new Set<Database["public"]["Enums"]["profile_role"]>([
  "organizer",
]);

export type ProfileRole = Database["public"]["Enums"]["profile_role"];
export type ProfileRecord = Database["public"]["Tables"]["profiles"]["Row"];

export interface AuthenticatedProfileSession {
  user: User;
  role: ProfileRole;
  profile: ProfileRecord;
}

export async function getSupabaseServerAuthClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const cookie of cookiesToSet) {
            try {
              cookieStore.set(cookie.name, cookie.value, cookie.options);
            } catch {
              // Server Components can read cookies but cannot always mutate them.
            }
          }
        },
      },
    },
  );
}

export async function getAuthenticatedUser(): Promise<User | null> {
  const session = await getAuthenticatedProfileSession();
  return session?.user ?? null;
}

export async function getAuthenticatedProfileSession(): Promise<AuthenticatedProfileSession | null> {
  const supabase = await getSupabaseServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, full_name, phone_number, is_active, created_by, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || !profile.is_active) {
    return null;
  }

  return {
    user,
    role: profile.role,
    profile,
  };
}

export function isAdminRole(role: ProfileRole | null): boolean {
  if (!role) {
    return false;
  }

  return ADMIN_ROLES.has(role);
}

export function isManagementRole(role: ProfileRole | null): boolean {
  if (!role) {
    return false;
  }

  return MANAGEMENT_ROLES.has(role);
}

export function isOrganizerRole(role: ProfileRole | null): boolean {
  if (!role) {
    return false;
  }

  return ORGANIZER_ROLES.has(role);
}
