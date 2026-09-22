"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import CopyField from "@/components/copy-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import LogoutButton from "@/components/logout-button";

type CreatedNote = {
  note: {
    id: string;
    title: string;
  };
  shareUrl: string;
  accessKey: string | null;
};

type CreateResponse =
  | ({
      success: true;
    } & CreatedNote)
  | {
      success: false;
      message?: string;
      errors?: { field: string; message: string }[];
    };

export default function NewNotePage() {
  const router = useRouter();

  const [sessionState, setSessionState] = useState<
    "loading" | "ready" | "error"
  >("loading");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedNote | null>(null);

  const submitting = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    async function checkSession() {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (!response.ok) {
          throw new Error("Session check failed");
        }

        setSessionState("ready");
      } catch {
        if (!controller.signal.aborted) {
          setSessionState("error");
        }
      }
    }

    void checkSession();

    return () => controller.abort();
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting.current) return;

    setError("");

    const formData = new FormData(event.currentTarget);
    const expiry = new Date(String(formData.get("expiresAt") ?? ""));

    if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now()) {
      setError("Choose an expiry date and time in the future.");
      return;
    }

    const payload = {
      title: String(formData.get("title") ?? ""),
      content: String(formData.get("content") ?? ""),
      expiresAt: expiry.toISOString(),
      shareType: String(formData.get("shareType")),
      accessType: String(formData.get("accessType")),
    };

    submitting.current = true;
    setLoading(true);

    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        setError(
          "Your session has expired. Log in in another tab, then submit again.",
        );
        return;
      }

      const data: CreateResponse = await response.json();

      if (!data.success) {
        setError(
          data.errors?.[0]?.message ??
            data.message ??
            "Unable to create the note.",
        );
        return;
      }

      if (!response.ok) {
        throw new Error("Unexpected response");
      }

      setCreated({
        note: data.note,
        shareUrl: data.shareUrl,
        accessKey: data.accessKey,
      });
    } catch {
      setError(
        "Could not confirm creation. The note may have been saved; submitting again could create another note.",
      );
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  if (sessionState === "loading") {
    return (
      <main className="p-8 text-center" role="status">
        Checking your session...
      </main>
    );
  }

  if (sessionState === "error") {
    return (
      <main className="mx-auto max-w-md space-y-4 p-8 text-center">
        <p role="alert">Unable to check your session. Please try again.</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <p className="text-xl font-semibold tracking-tight">NoteShare</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Write a note. Choose who can open it and for how long.
          </p>
        </header>

        {created ? (
          <Card>
            <CardHeader>
              <CardTitle>Your note is ready</CardTitle>
              <CardDescription>
                Copy these sharing details before leaving or refreshing this
                page. They cannot be recovered later.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <p className="break-words font-medium">{created.note.title}</p>

              <CopyField
                id="share-url"
                label="Share link"
                value={created.shareUrl}
              />

              {created.accessKey !== null && (
                <>
                  <CopyField
                    id="access-key"
                    label="Access key"
                    value={created.accessKey}
                  />
                  <p className="text-sm text-muted-foreground">
                    Send the access key separately from the link.
                  </p>
                </>
              )}

              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href={`/notes/${created.note.id}`}
                  className="text-sm font-medium underline underline-offset-4"
                >
                  Manage this note
                </Link>

                <Button
                  variant="outline"
                  onClick={() => {
                    setCreated(null);
                    setError("");
                  }}
                >
                  Create another note
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Create a note</CardTitle>
              <CardDescription>
                Only you can manage this note. Recipients access it through the
                generated share link.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit}>
                <fieldset disabled={loading} className="min-w-0 space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      name="title"
                      placeholder="Project handover"
                      maxLength={200}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content">Content</Label>
                    <Textarea
                      id="content"
                      name="content"
                      placeholder="Write your note here..."
                      rows={8}
                      maxLength={10_000}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expiresAt">Expires at</Label>
                    <Input
                      id="expiresAt"
                      name="expiresAt"
                      type="datetime-local"
                      required
                      aria-describedby="expiry-help"
                    />
                    <p
                      id="expiry-help"
                      className="text-xs text-muted-foreground"
                    >
                      Uses your device’s local timezone. Both sharing modes
                      expire at this time.
                    </p>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="shareType">Share type</Label>
                      <select
                        id="shareType"
                        name="shareType"
                        defaultValue="ONE_TIME"
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      >
                        <option value="ONE_TIME">One-time access</option>
                        <option value="TIME_BASED">Time-based access</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="accessType">Access type</Label>
                      <select
                        id="accessType"
                        name="accessType"
                        defaultValue="PASSWORD"
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      >
                        <option value="PASSWORD">Password protected</option>
                        <option value="PUBLIC">Public — no key required</option>
                      </select>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Protected links receive an automatically generated access
                    key.
                  </p>

                  {error && (
                    <p role="alert" className="text-sm text-destructive">
                      {error}
                    </p>
                  )}

                  <Button type="submit" className="w-full">
                    {loading ? "Creating..." : "Create share link"}
                  </Button>
                </fieldset>
              </form>
            </CardContent>
            <div className="px-[16px]">
              <LogoutButton />
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
