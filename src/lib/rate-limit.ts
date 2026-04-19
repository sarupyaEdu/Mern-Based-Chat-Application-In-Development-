import "server-only";

import ApiRateLimit from "@/models/ApiRateLimit";

type HeaderSource =
  | Headers
  | Record<string, string | string[] | undefined>
  | undefined;

function readHeader(headers: HeaderSource, name: string) {
  if (!headers) return "";

  if (headers instanceof Headers) {
    return headers.get(name) || "";
  }

  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return value || "";
}

export function getClientIpFromHeaders(headers: HeaderSource) {
  const forwardedFor = readHeader(headers, "x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return (
    readHeader(headers, "x-real-ip") ||
    readHeader(headers, "cf-connecting-ip") ||
    "unknown"
  );
}

export async function enforceRateLimit({
  key,
  maxAttempts,
  windowMs,
  blockDurationMs,
}: {
  key: string;
  maxAttempts: number;
  windowMs: number;
  blockDurationMs: number;
}) {
  const now = new Date();

  let entry = await ApiRateLimit.findOne({ key });

  if (entry?.blockedUntil && entry.blockedUntil.getTime() > now.getTime()) {
    return {
      allowed: false,
      retryAfterMs: entry.blockedUntil.getTime() - now.getTime(),
    };
  }

  if (
    !entry ||
    now.getTime() - entry.windowStart.getTime() > windowMs ||
    (entry.blockedUntil && entry.blockedUntil.getTime() <= now.getTime())
  ) {
    entry = await ApiRateLimit.findOneAndUpdate(
      { key },
      {
        key,
        count: 1,
        windowStart: now,
        blockedUntil: null,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

    return {
      allowed: true,
      remaining: Math.max(maxAttempts - 1, 0),
    };
  }

  entry.count += 1;

  if (entry.count > maxAttempts) {
    entry.blockedUntil = new Date(now.getTime() + blockDurationMs);
    await entry.save();

    return {
      allowed: false,
      retryAfterMs: blockDurationMs,
    };
  }

  await entry.save();

  return {
    allowed: true,
    remaining: Math.max(maxAttempts - entry.count, 0),
  };
}
