import { createHash, randomBytes } from "node:crypto";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import { db } from "@/lib/db";

const SESSION_COOKIE = "noteshare_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "Lax" as const,
  path: "/",
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function readSessionToken(c: Context) {
  const token = getCookie(c, SESSION_COOKIE);

  // 32 random bytes encoded as hexadecimal produce 64 characters.
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return null;
  }

  return token;
}

export async function createSession(c: Context, userId: string) {
  const token = randomBytes(32).toString("hex");

  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);

  const previousToken = readSessionToken(c);

  await db.$transaction(async (tx) => {
    if (previousToken) {
      await tx.session.deleteMany({
        where: { tokenHash: hashToken(previousToken) },
      });
    }

    await tx.session.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt,
      },
    });
  });

  setCookie(c, SESSION_COOKIE, token, {
    ...cookieOptions,
    maxAge: SESSION_DURATION_SECONDS,
    expires: expiresAt,
  });
}

export async function getSession(c: Context) {
  const token = readSessionToken(c);

  if (!token) {
    return null;
  }

  const session = await db.session.findUnique({
    where: {
      tokenHash: hashToken(token),
    },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  if (!session || session.expiresAt <= new Date()) {
    return null;
  }

  return session;
}

export async function destroySession(c: Context) {
  const token = readSessionToken(c);

  if (token) {
    await db.session.deleteMany({
      where: {
        tokenHash: hashToken(token),
      },
    });
  }

  deleteCookie(c, SESSION_COOKIE, cookieOptions);
}
