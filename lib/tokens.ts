import "server-only";

import { errors as joseErrors, jwtVerify, SignJWT } from "jose";
import { z } from "zod";

import { serverEnv } from "@/lib/env/server";

const JWT_AUDIENCE = "event-ticket";
const JWT_ISSUER = "event-checkin-system";

const ticketPayloadSchema = z.object({
  guestId: z.string().uuid(),
  eventId: z.string().uuid(),
  issuedAt: z.number().int().positive(),
  iat: z.number().int().optional(),
  exp: z.number().int().positive().optional(),
});

export type TicketTokenPayload = z.infer<typeof ticketPayloadSchema>;

const secret = new TextEncoder().encode(serverEnv.QR_JWT_SECRET);

export async function signGuestToken(input: {
  guestId: string;
  eventId: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);

  const tokenTtlSeconds =
    input.expiresInSeconds ?? serverEnv.TICKET_TOKEN_TTL_SECONDS;

  const jwtBuilder = new SignJWT({
    guestId: input.guestId,
    eventId: input.eventId,
    issuedAt,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt(issuedAt);

  if (tokenTtlSeconds) {
    jwtBuilder.setExpirationTime(issuedAt + tokenTtlSeconds);
  }

  return jwtBuilder.sign(secret);
}

export async function verifyGuestToken(
  token: string,
): Promise<TicketTokenPayload> {
  const { payload } = await jwtVerify(token, secret, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });

  const parsed = ticketPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("Invalid token payload.");
  }

  return parsed.data;
}

export function isJwtExpiredError(error: unknown): boolean {
  return error instanceof joseErrors.JWTExpired;
}
