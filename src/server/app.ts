import { Hono } from "hono";
import { db } from "@/lib/db";
import auth from "@/server/routes/auth";
import { HTTPException } from "hono/http-exception";
import notes from "@/server/routes/notes";
import share from "@/server/routes/share";
import { rateLimit } from "@/server/middleware/rate-limit";

const app = new Hono().basePath("/api");

app.use("*", async (c, next) => {
  const safeMethods = ["GET", "HEAD", "OPTIONS"];

  if (safeMethods.includes(c.req.method)) {
    return next();
  }

  const appUrl = process.env.APP_URL;

  if (!appUrl) {
    return c.json(
      {
        success: false,
        message: "Application URL is not configured",
      },
      500,
    );
  }

  const trustedOrigin = new URL(appUrl).origin;
  const requestOrigin = c.req.header("Origin");

  if (requestOrigin !== trustedOrigin) {
    return c.json(
      {
        success: false,
        message: "Request origin is not allowed",
      },
      403,
    );
  }

  await next();
});

app.get("/health", (c) => {
  return c.json({
    success: true,
    message: "NoteShare API is running",
  });
});

app.get("/health/db", async (c) => {
  c.header("Cache-Control", "no-store");

  try {
    await db.$queryRaw`SELECT 1`;

    return c.json({
      success: true,
      message: "Database connection successful",
    });
  } catch (error) {
    console.error("Database readiness check failed:", error);

    return c.json(
      {
        success: false,
        message: "Database temporarily unavailable",
      },
      503,
    );
  }
});
app.use(
  "/auth/login",
  rateLimit({
    scope: "login",
    limit: 10,
    windowSeconds: 60,
  }),
);

app.use(
  "/auth/register",
  rateLimit({
    scope: "register",
    limit: 5,
    windowSeconds: 600,
  }),
);

app.use(
  "/share/:token/open",
  rateLimit({
    scope: "share-open",
    limit: 30,
    windowSeconds: 60,
  }),
);
app.route("/auth", auth);

app.onError((error, c) => {
  if (error instanceof HTTPException && error.status < 500) {
    return c.json(
      {
        success: false,
        message: "Invalid request",
      },
      error.status,
    );
  }

  console.error("API request failed:", error);
  return c.json(
    {
      success: false,
      message: "Something went wrong. Please try again.",
    },
    500,
  );
});
app.route("/notes", notes);
app.route("/share", share);
export default app;
