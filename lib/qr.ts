export function extractTokenFromQrContent(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    const token = url.searchParams.get("token");

    if (token && token.trim().length > 0) {
      return token.trim();
    }

    return null;
  } catch {
    return trimmed;
  }
}
