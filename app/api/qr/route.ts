import { NextResponse } from "next/server";
import QRCode from "qrcode";

import { jsonError } from "@/lib/http";
import { extractTokenFromQrContent } from "@/lib/qr";
import { buildTicketLink } from "@/lib/ticket";
import { verifyGuestToken } from "@/lib/tokens";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const tokenParam = new URL(request.url).searchParams.get("token");
  if (!tokenParam) {
    return jsonError("Token is required.", 400, "missing_token");
  }

  const token = extractTokenFromQrContent(tokenParam);
  if (!token) {
    return jsonError("Invalid token.", 400, "invalid_token");
  }

  try {
    await verifyGuestToken(token);
  } catch {
    return jsonError("Invalid token.", 400, "invalid_token");
  }

  const qrData = buildTicketLink(token);
  const pngBuffer = await QRCode.toBuffer(qrData, {
    type: "png",
    width: 512,
    margin: 1,
    errorCorrectionLevel: "M",
  });

  return new NextResponse(new Uint8Array(pngBuffer), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=120",
    },
  });
}
