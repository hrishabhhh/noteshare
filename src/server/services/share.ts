import { db } from "@/lib/db";

type OpenedNote = {
  title: string;
  content: string;
};

export async function openSharedNote(
  tokenHash: string,
  accessKeyHash: string | null,
) {
  const rows = await db.$queryRaw<OpenedNote[]>`
    WITH granted AS (
      UPDATE "ShareLink"
      SET
        "viewCount" = "viewCount" + 1,
        "consumedAt" = CASE
          WHEN "shareType" = 'ONE_TIME'
            THEN clock_timestamp()
          ELSE "consumedAt"
        END
      WHERE
        "tokenHash" = ${tokenHash}
        AND "revokedAt" IS NULL
        AND "expiresAt" > clock_timestamp()
        AND (
          "shareType" = 'TIME_BASED'
          OR (
            "shareType" = 'ONE_TIME'
            AND "consumedAt" IS NULL
          )
        )
        AND (
          "accessType" = 'PUBLIC'
          OR (
            "accessType" = 'PASSWORD'
            AND "accessKeyHash" = ${accessKeyHash}::text
          )
        )
      RETURNING "noteId"
    )
    SELECT n."title", n."content"
    FROM "Note" AS n
    INNER JOIN granted AS g ON n."id" = g."noteId"
  `;

  return rows[0] ?? null;
}

type ShareState = {
  revoked: boolean;
  expired: boolean;
  consumed: boolean;
  protected: boolean;
};

export async function getShareState(tokenHash: string) {
  const rows = await db.$queryRaw<ShareState[]>`
    SELECT
      ("revokedAt" IS NOT NULL) AS "revoked",
      ("expiresAt" <= clock_timestamp()) AS "expired",
      (
        "shareType" = 'ONE_TIME'
        AND "consumedAt" IS NOT NULL
      ) AS "consumed",
      ("accessType" = 'PASSWORD') AS "protected"
    FROM "ShareLink"
    WHERE "tokenHash" = ${tokenHash}
  `;

  return rows[0] ?? null;
}
