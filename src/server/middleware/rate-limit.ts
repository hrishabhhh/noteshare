import { isIP } from "node:net";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";

import { db } from "@/lib/db";
import { hashSecret } from "@/lib/secrets";

type RateLimitOptions = {
  scope: string;
  limit: number;
  windowSeconds: number;
};

function getClientIdentifier(c: Context) {
  if (process.env.VERCEL === "1") {
    const ip = c.req.header("x-vercel-forwarded-for")?.trim();

    if (ip && isIP(ip)) {
      return ip;
    }
  }

  // Without a trusted hosting proxy, use a shared bucket.
  // Do not trust arbitrary IP headers supplied by the caller.
  return "local-or-unidentified-client";
}

export function rateLimit({ scope, limit, windowSeconds }: RateLimitOptions) {
  return createMiddleware(async (c, next) => {
    if (c.req.method !== "POST") {
      return next();
    }

    c.header("Cache-Control", "no-store");

    const client = getClientIdentifier(c);
    const key = hashSecret(`${scope}:${client}`);

    let allowed: boolean;

    try {
      const rows = await db.$queryRaw<{ hits: number }[]>`
        INSERT INTO "RateLimit" ("key", "hits", "resetAt")
        VALUES (
          ${key},
          1,
          clock_timestamp()
            + (${windowSeconds}::double precision * interval '1 second')
        )
        ON CONFLICT ("key")
        DO UPDATE SET
          "hits" = CASE
            WHEN "RateLimit"."resetAt" <= clock_timestamp()
              THEN 1
            ELSE "RateLimit"."hits" + 1
          END,
          "resetAt" = CASE
            WHEN "RateLimit"."resetAt" <= clock_timestamp()
              THEN clock_timestamp()
                + (${windowSeconds}::double precision * interval '1 second')
            ELSE "RateLimit"."resetAt"
          END
        WHERE
          "RateLimit"."resetAt" <= clock_timestamp()
          OR "RateLimit"."hits" < ${limit}
        RETURNING "hits"
      `;

      allowed = rows.length > 0;
    } catch {
      // Do not allow unlimited attempts when the limiter is unavailable.
      console.error("Rate limit database check failed");

      return c.json(
        {
          success: false,
          message: "Service temporarily unavailable. Please try again.",
        },
        503,
      );
    }

    if (!allowed) {
      c.header("Retry-After", String(windowSeconds));

      return c.json(
        {
          success: false,
          code: "RATE_LIMITED",
          message: `Too many attempts. Try again in ${windowSeconds} seconds.`,
        },
        429,
      );
    }

    await next();
  });
}
