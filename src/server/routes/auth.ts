import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { zValidator } from "@hono/zod-validator";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { compare, hash } from "bcryptjs";
import { loginSchema, registerSchema } from "@/server/validators/auth";
import { randomBytes } from "node:crypto";
import { createSession, destroySession, getSession } from "@/lib/session";

const auth = new Hono();

auth.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  await next();
});

auth.use(
  "*",
  bodyLimit({
    maxSize: 16 * 1024,
    onError: (c) =>
      c.json(
        {
          success: false,
          message: "Request body is too large",
        },
        413,
      ),
  }),
);

auth.post(
  "/register",
  zValidator("json", registerSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          message: "Invalid registration details",
          errors: result.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        400,
      );
    }
  }),
  async (c) => {
    const { email, password } = c.req.valid("json");

    try {
      const passwordHash = await hash(password, 12);

      const user = await db.user.create({
        data: {
          email,
          passwordHash,
        },
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
      });

      return c.json(
        {
          success: true,
          message: "Account created. Please log in.",
          user,
        },
        201,
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return c.json(
          {
            success: false,
            message: "An account with this email already exists",
          },
          409,
        );
      }

      console.error("Registration failed", {
        errorType: error instanceof Error ? error.name : "Unknown",
      });

      return c.json(
        {
          success: false,
          message: "Unable to create account. Please try again.",
        },
        500,
      );
    }
  },
);

// Created lazily and reused within this server process.
let dummyPasswordHash: Promise<string> | undefined;

function getDummyPasswordHash() {
  dummyPasswordHash ??= hash(randomBytes(32).toString("hex"), 12);

  return dummyPasswordHash;
}

auth.post(
  "/login",
  zValidator("json", loginSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          message: "Enter a valid email and password",
        },
        400,
      );
    }
  }),
  async (c) => {
    const { email, password } = c.req.valid("json");

    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
      },
    });

    const passwordHash = user?.passwordHash ?? (await getDummyPasswordHash());

    const passwordMatches = await compare(password, passwordHash);

    if (!user || !passwordMatches) {
      return c.json(
        {
          success: false,
          message: "Invalid email or password",
        },
        401,
      );
    }

    await createSession(c, user.id);

    return c.json({
      success: true,
      message: "Logged in successfully",
      user: {
        id: user.id,
        email: user.email,
      },
    });
  },
);

auth.get("/me", async (c) => {
  const session = await getSession(c);

  if (!session) {
    return c.json(
      {
        success: false,
        message: "You are not logged in",
      },
      401,
    );
  }

  return c.json({
    success: true,
    user: session.user,
  });
});

auth.post("/logout", async (c) => {
  await destroySession(c);

  return c.json({
    success: true,
    message: "Logged out successfully",
  });
});

export default auth;
