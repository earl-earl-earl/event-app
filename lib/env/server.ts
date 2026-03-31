import "server-only";

import { z } from "zod";

const optionalTrimmedString = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  },
  z.string().optional(),
);

const optionalEmail = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  },
  z.string().email().optional(),
);

const serverEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  QR_JWT_SECRET: z.string().min(32),
  APP_BASE_URL: z.string().url(),
  TICKET_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().optional(),
  VERIFY_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  VERIFY_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(120),
  DISPATCH_BATCH_SIZE: z.coerce.number().int().positive().default(200),
  BREVO_API_KEY: optionalTrimmedString,
  BREVO_FROM_EMAIL: optionalEmail,
  BREVO_FROM_NAME: optionalTrimmedString,
  TWILIO_ACCOUNT_SID: optionalTrimmedString,
  TWILIO_AUTH_TOKEN: optionalTrimmedString,
  TWILIO_FROM_NUMBER: optionalTrimmedString,
});

const parsedServerEnv = serverEnvSchema.safeParse({
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  QR_JWT_SECRET: process.env.QR_JWT_SECRET,
  APP_BASE_URL: process.env.APP_BASE_URL,
  TICKET_TOKEN_TTL_SECONDS: process.env.TICKET_TOKEN_TTL_SECONDS,
  VERIFY_RATE_LIMIT_WINDOW_SECONDS: process.env.VERIFY_RATE_LIMIT_WINDOW_SECONDS,
  VERIFY_RATE_LIMIT_MAX_REQUESTS: process.env.VERIFY_RATE_LIMIT_MAX_REQUESTS,
  DISPATCH_BATCH_SIZE: process.env.DISPATCH_BATCH_SIZE,
  BREVO_API_KEY: process.env.BREVO_API_KEY,
  BREVO_FROM_EMAIL: process.env.BREVO_FROM_EMAIL,
  BREVO_FROM_NAME: process.env.BREVO_FROM_NAME,
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER,
});

const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

export const serverEnv = parsedServerEnv.success
  ? parsedServerEnv.data
  : isBuildPhase
    ? {
        SUPABASE_URL: "https://placeholder.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "placeholder-service-role-key",
        NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "placeholder-publishable-key",
        QR_JWT_SECRET: "placeholder-secret-placeholder-secret-32chars",
        APP_BASE_URL: "http://localhost:3000",
        TICKET_TOKEN_TTL_SECONDS: 604800,
        VERIFY_RATE_LIMIT_WINDOW_SECONDS: 60,
        VERIFY_RATE_LIMIT_MAX_REQUESTS: 120,
        DISPATCH_BATCH_SIZE: 200,
        BREVO_API_KEY: undefined,
        BREVO_FROM_EMAIL: undefined,
        BREVO_FROM_NAME: undefined,
        TWILIO_ACCOUNT_SID: undefined,
        TWILIO_AUTH_TOKEN: undefined,
        TWILIO_FROM_NUMBER: undefined,
      }
    : (() => {
        throw new Error(
          `Invalid server environment configuration: ${parsedServerEnv.error.message}`,
        );
      })();
