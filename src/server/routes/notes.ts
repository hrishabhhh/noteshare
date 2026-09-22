import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { zValidator } from "@hono/zod-validator";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { generateSecret, hashSecret } from "@/lib/secrets";
import { createNoteSchema, noteIdSchema } from "@/server/validators/note";

type NotesEnv = {
  Variables: {
    userId: string;
  };
};

const notes = new Hono<NotesEnv>();

// Every owner-facing note endpoint requires a valid session.
notes.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");

  const session = await getSession(c);

  if (!session) {
    return c.json(
      {
        success: false,
        message: "Please log in to continue",
      },
      401,
    );
  }

  c.set("userId", session.user.id);
  await next();
});

notes.use(
  "*",
  bodyLimit({
    maxSize: 128 * 1024,
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

notes.post(
  "/",
  zValidator("json", createNoteSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          message: "Invalid note details",
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
    const input = c.req.valid("json");
    const ownerId = c.get("userId");

    const appUrl = process.env.APP_URL;

    if (!appUrl) {
      throw new Error("APP_URL is not configured");
    }

    const token = generateSecret();
    const accessKey =
      input.accessType === "PASSWORD" ? generateSecret(16) : null;

    const shareUrl = new URL(`/share/${token}`, appUrl).toString();

    const note = await db.note.create({
      data: {
        ownerId,
        title: input.title,
        content: input.content,
        shareLink: {
          create: {
            tokenHash: hashSecret(token),
            accessKeyHash: accessKey ? hashSecret(accessKey) : null,
            shareType: input.shareType,
            accessType: input.accessType,
            expiresAt: new Date(input.expiresAt),
          },
        },
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        shareLink: {
          select: {
            shareType: true,
            accessType: true,
            expiresAt: true,
            viewCount: true,
          },
        },
      },
    });

    return c.json(
      {
        success: true,
        message: "Note created. Copy your sharing details now.",
        note,
        shareUrl,
        accessKey,
      },
      201,
    );
  },
);

notes.get(
  "/:id",
  zValidator("param", noteIdSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          message: "Invalid note ID",
        },
        400,
      );
    }
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const ownerId = c.get("userId");

    const note = await db.note.findFirst({
      where: {
        id,
        ownerId,
      },
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        shareLink: {
          select: {
            shareType: true,
            accessType: true,
            expiresAt: true,
            consumedAt: true,
            revokedAt: true,
            viewCount: true,
          },
        },
      },
    });

    if (!note) {
      return c.json(
        {
          success: false,
          message: "Note not found",
        },
        404,
      );
    }

    return c.json({
      success: true,
      note,
    });
  },
);

notes.post(
  "/:id/revoke",
  zValidator("param", noteIdSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          message: "Invalid note ID",
        },
        400,
      );
    }
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const ownerId = c.get("userId");

    const result = await db.shareLink.updateMany({
      where: {
        noteId: id,
        note: {
          ownerId,
        },
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    if (result.count === 0) {
      const ownedNote = await db.note.findFirst({
        where: {
          id,
          ownerId,
        },
        select: {
          shareLink: {
            select: {
              revokedAt: true,
            },
          },
        },
      });

      if (!ownedNote?.shareLink) {
        return c.json(
          {
            success: false,
            message: "Share link not found",
          },
          404,
        );
      }
    }

    return c.json({
      success: true,
      message: "Share link revoked",
    });
  },
);

export default notes;
