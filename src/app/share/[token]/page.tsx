"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SharedNote = {
  title: string;
  content: string;
};

export default function SharePage() {
  const { token } = useParams<{ token: string }>();

  return <ShareViewer key={token} token={token} />;
}

function ShareViewer({ token }: { token: string }) {
  const [checking, setChecking] = useState(true);
  const [requiresKey, setRequiresKey] = useState(false);
  const [accessKey, setAccessKey] = useState("");
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<SharedNote | null>(null);

  const opening = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    async function checkLink() {
      try {
        const response = await fetch(
          `/api/share/${encodeURIComponent(token)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const data = await response.json();

        if (controller.signal.aborted) return;

        if (!response.ok || !data.success) {
          setError(data.message ?? "Unable to check this link.");
          setBlocked(true);
          return;
        }

        setRequiresKey(data.requiresKey);
      } catch {
        if (!controller.signal.aborted) {
          setError("Unable to check this link. Try reloading the page.");
          setBlocked(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setChecking(false);
        }
      }
    }

    void checkLink();

    return () => controller.abort();
  }, [token]);

  async function handleOpen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (opening.current || blocked || note) return;

    opening.current = true;
    setBusy(true);
    setError("");

    try {
      const response = await fetch(
        `/api/share/${encodeURIComponent(token)}/open`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requiresKey ? { accessKey } : {}),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message ?? "Unable to open the note.");

        if (response.status === 404 || response.status === 410) {
          setBlocked(true);
        }

        return;
      }

      setNote(data.note);
      setAccessKey("");
    } catch {
      setError(
        "Could not confirm access. A one-time link may already have been consumed. This request will not be retried automatically.",
      );
    } finally {
      opening.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <p className="text-center text-xl font-semibold">NoteShare</p>

        <Card>
          <CardHeader>
            <CardTitle className="break-words">
              {note ? note.title : "A note has been shared with you"}
            </CardTitle>
          </CardHeader>

          <CardContent>
            {checking ? (
              <p role="status" className="text-sm text-muted-foreground">
                Checking link...
              </p>
            ) : note ? (
              <div className="space-y-6">
                <p className="whitespace-pre-wrap break-words leading-7">
                  {note.content}
                </p>
                <p className="border-t pt-4 text-xs text-muted-foreground">
                  If this is a one-time link, it cannot be opened again.
                </p>
              </div>
            ) : (
              <form onSubmit={handleOpen} className="space-y-5">
                {!blocked && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {requiresKey
                        ? "Enter the access key provided by the sender."
                        : "No password is required. Click below to open the note."}
                    </p>

                    {requiresKey && (
                      <div className="space-y-2">
                        <Label htmlFor="accessKey">Access key</Label>
                        <Input
                          id="accessKey"
                          type="password"
                          autoComplete="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          maxLength={128}
                          value={accessKey}
                          onChange={(event) => setAccessKey(event.target.value)}
                          disabled={busy}
                          required
                        />
                      </div>
                    )}

                    <Button type="submit" disabled={busy}>
                      {busy
                        ? "Opening..."
                        : requiresKey
                          ? "Unlock note"
                          : "Open note"}
                    </Button>
                  </>
                )}

                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}

                {blocked && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => window.location.reload()}
                  >
                    Check again
                  </Button>
                )}
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
