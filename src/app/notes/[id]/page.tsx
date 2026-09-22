"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import LogoutButton from "@/components/logout-button";

type OwnerNote = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  shareLink: {
    shareType: "ONE_TIME" | "TIME_BASED";
    accessType: "PUBLIC" | "PASSWORD";
    expiresAt: string;
    consumedAt: string | null;
    revokedAt: string | null;
    viewCount: number;
  } | null;
};

export default function NotePage() {
  const { id } = useParams<{ id: string }>();

  return <OwnerNoteViewer key={id} id={id} />;
}

function OwnerNoteViewer({ id }: { id: string }) {
  const router = useRouter();

  const [note, setNote] = useState<OwnerNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const revoking = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadNote() {
      try {
        const response = await fetch(`/api/notes/${encodeURIComponent(id)}`, {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        const data = await response.json();

        if (controller.signal.aborted) return;

        if (!response.ok || !data.success) {
          setError(data.message ?? "Unable to load note.");
          return;
        }

        setCheckedAt(Date.now());
        setNote(data.note);
      } catch {
        if (!controller.signal.aborted) {
          setError("Unable to load note. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadNote();

    return () => controller.abort();
  }, [id, router]);

  async function handleRevoke() {
    if (revoking.current) return;

    if (!window.confirm("Revoke this share link? This cannot be undone.")) {
      return;
    }

    revoking.current = true;
    setBusy(true);
    setError("");

    try {
      const response = await fetch(
        `/api/notes/${encodeURIComponent(id)}/revoke`,
        {
          method: "POST",
          credentials: "same-origin",
        },
      );

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message ?? "Unable to revoke link.");
        return;
      }

      window.location.reload();
    } catch {
      setError(
        "Could not confirm revocation. Refresh to check its current status.",
      );
    } finally {
      revoking.current = false;
      setBusy(false);
    }
  }

  const share = note?.shareLink;

  const status = !share
    ? "No share link"
    : share.revokedAt
      ? "Revoked"
      : checkedAt !== null && new Date(share.expiresAt).getTime() <= checkedAt
        ? "Expired"
        : share.shareType === "ONE_TIME" && share.consumedAt
          ? "Used"
          : "Active";

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center justify-between gap-4">
          <p className="text-xl font-semibold">NoteShare</p>
          <Link
            href="/notes/new"
            className="text-sm underline underline-offset-4"
          >
            Create a note
          </Link>
        </header>

        {loading ? (
          <p role="status">Loading note...</p>
        ) : (
          <>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            {note && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="break-words">{note.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap break-words leading-7">
                      {note.content}
                    </p>
                  </CardContent>
                </Card>

                {share && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Sharing details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <Badge variant="outline">{status}</Badge>

                      <dl className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <dt className="text-muted-foreground">
                            Successful views
                          </dt>
                          <dd className="mt-1 text-2xl font-semibold">
                            {share.viewCount}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-muted-foreground">Expires</dt>
                          <dd className="mt-1">
                            {new Date(share.expiresAt).toLocaleString()}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-muted-foreground">Share type</dt>
                          <dd className="mt-1">
                            {share.shareType === "ONE_TIME"
                              ? "One-time"
                              : "Time-based"}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-muted-foreground">Access</dt>
                          <dd className="mt-1">
                            {share.accessType === "PASSWORD"
                              ? "Password protected"
                              : "Public"}
                          </dd>
                        </div>
                      </dl>

                      <p className="text-xs text-muted-foreground">
                        Viewing this owner page does not increase the count.
                        Refresh to fetch the latest count and status.
                      </p>

                      <Button
                        variant="destructive"
                        disabled={busy || Boolean(share.revokedAt)}
                        onClick={handleRevoke}
                      >
                        {busy
                          ? "Revoking..."
                          : share.revokedAt
                            ? "Link revoked"
                            : "Revoke share link"}
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            <Button
              variant="outline"
              disabled={busy}
              onClick={() => window.location.reload()}
            >
              Refresh
            </Button>
          </>
        )}
      </div>
      <LogoutButton />
    </main>
  );
}
