import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/env/server";
import type { Database } from "@/types/database";

let serviceClient: SupabaseClient<Database> | null = null;

export function getServiceSupabase(): SupabaseClient<Database> {
  if (serviceClient) {
    return serviceClient;
  }

  serviceClient = createClient<Database>(
    serverEnv.SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          "X-Client-Info": "event-checkin-service",
        },
      },
    },
  );

  return serviceClient;
}
