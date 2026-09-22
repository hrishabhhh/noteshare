import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { hashSecret } from "@/lib/secrets";
import { getShareState, openSharedNote } from "@/server/services/share";

const share = new Hono();

const tokenSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});

const unlockSchema = z.object({
  accessKey: z.string().max(128).optional(),
});

share.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  c.header("Referrer-Policy", "no-referrer");
  await next();
});

share.use(
  "*",
  bodyLimit({
    maxSize: 4096,
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

share.post(
  "/:token/open",
  zValidator("param", tokenSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          code: "INVALID_LINK",
          message: "Invalid share link",
        },
        404,
      );
    }
  }),
  zValidator("json", unlockSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          message: "Invalid unlock request",
        },
        400,
      );
    }
  }),
  async (c) => {
    const { token } = c.req.valid("param");
    const { accessKey } = c.req.valid("json");

    const tokenHash = hashSecret(token);
    const accessKeyHash = accessKey ? hashSecret(accessKey) : null;

    const note = await openSharedNote(tokenHash, accessKeyHash);

    if (note) {
      return c.json({
        success: true,
        note,
      });
    }

    // This lookup only explains a denial.
    // It never grants access or returns note content.
    const state = await getShareState(tokenHash);

    if (!state) {
      return c.json(
        {
          success: false,
          code: "INVALID_LINK",
          message: "Invalid share link",
        },
        404,
      );
    }

    if (state.revoked) {
      return c.json(
        {
          success: false,
          code: "REVOKED",
          message: "This share link has been revoked",
        },
        410,
      );
    }

    if (state.expired) {
      return c.json(
        {
          success: false,
          code: "EXPIRED",
          message: "This share link has expired",
        },
        410,
      );
    }

    if (state.consumed) {
      return c.json(
        {
          success: false,
          code: "ALREADY_USED",
          message: "This one-time link has already been used",
        },
        410,
      );
    }

    if (state.protected) {
      return c.json(
        {
          success: false,
          code: "INVALID_KEY",
          message: "A correct access key is required",
        },
        401,
      );
    }

    return c.json(
      {
        success: false,
        code: "UNAVAILABLE",
        message: "This link is unavailable",
      },
      410,
    );
  },
);

share.get(
  "/:token",
  zValidator("param", tokenSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          message: "Invalid share link",
        },
        404,
      );
    }
  }),
  async (c) => {
    const { token } = c.req.valid("param");
    const state = await getShareState(hashSecret(token));

    if (!state) {
      return c.json({ success: false, message: "Invalid share link" }, 404);
    }

    const unavailableMessage = state.revoked
      ? "This share link has been revoked."
      : state.expired
        ? "This share link has expired."
        : state.consumed
          ? "This one-time link has already been used."
          : null;

    if (unavailableMessage) {
      return c.json({ success: false, message: unavailableMessage }, 410);
    }

    return c.json({
      success: true,
      requiresKey: state.protected,
    });
  },
);

export default share;
