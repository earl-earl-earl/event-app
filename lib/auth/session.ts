import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { publicEnv } from "@/lib/env/public";
import type { Database } from "@/types/database";

const ADMIN_ROLES = new Set(["admin", "organizer"]);
const STAFF_ROLES = new Set(["admin", "organizer", "staff"]);

export async function getSupabaseServerAuthClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
  const supabase = await getSupabaseServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export function getUserRole(user: User | null): string | null {
  if (!user) {
    return null;
  }

  const roleFromAppMetadata = user.app_metadata?.role;
  if (typeof roleFromAppMetadata === "string") {
    return roleFromAppMetadata;
  }

  const roleFromUserMetadata = user.user_metadata?.role;
  if (typeof roleFromUserMetadata === "string") {
    return roleFromUserMetadata;
  }

  return null;
}

export function isAdminUser(user: User | null): boolean {
  if (!user) {
    return false;
  }

  const role = getUserRole(user);

  // Backward-compatible default: if no role is set, treat authenticated users as admins.
  if (!role) {
    return true;
  }

  return ADMIN_ROLES.has(role);
}

export function isStaffUser(user: User | null): boolean {
  if (!user) {
    return false;
  }

  const role = getUserRole(user);

  // Backward-compatible default: if no role is set, treat authenticated users as staff.
  if (!role) {
    return true;
  }

  return STAFF_ROLES.has(role);
}
