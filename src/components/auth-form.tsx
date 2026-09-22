"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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

type AuthFormProps = {
  mode: "login" | "register";
};

type AuthResponse = {
  success: boolean;
  message?: string;
  errors?: {
    field: string;
    message: string;
  }[];
};

export default function AuthForm({ mode }: AuthFormProps) {
  const isRegister = mode === "register";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const submitting = useRef(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting.current) return;

    setError("");
    setSuccess("");

    if (new TextEncoder().encode(password).length > 72) {
      setError("Password must not exceed 72 bytes.");
      return;
    }

    submitting.current = true;
    setLoading(true);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data: AuthResponse = await response.json();

      if (!response.ok || !data.success) {
        setError(
          data.errors?.[0]?.message ??
            data.message ??
            "Unable to complete the request.",
        );
        return;
      }

      setPassword("");

      if (isRegister) {
        setSuccess("Account created. You can now log in.");
      } else {
        setSuccess("Logged in. Opening your notes...");
        router.replace("/notes/new");
      }
    } catch {
      setError(
        "Unable to complete the request. Check your connection and try again.",
      );
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <p className="text-2xl font-semibold tracking-tight">NoteShare</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Simple notes. Controlled sharing.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              {isRegister ? "Create your account" : "Welcome back"}
            </CardTitle>
            <CardDescription>
              {isRegister
                ? "Create and manage notes with expiring share links."
                : "Log in to create notes and manage your share links."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={254}
                  required
                  disabled={loading}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={
                    isRegister ? "new-password" : "current-password"
                  }
                  minLength={isRegister ? 12 : 1}
                  maxLength={72}
                  required
                  disabled={loading}
                  aria-describedby={isRegister ? "password-help" : undefined}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />

                {isRegister && (
                  <p
                    id="password-help"
                    className="text-xs text-muted-foreground"
                  >
                    Use at least 12 characters. Maximum 72 bytes.
                  </p>
                )}
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                >
                  {error}
                </p>
              )}

              {success && (
                <div
                  role="status"
                  className="space-y-2 rounded-md border p-3 text-sm"
                >
                  <p>{success}</p>

                  {isRegister && (
                    <Link
                      href="/login"
                      className="inline-block font-medium underline underline-offset-4"
                    >
                      Continue to login
                    </Link>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading || Boolean(success)}
              >
                {loading
                  ? "Please wait..."
                  : isRegister
                    ? "Create account"
                    : "Log in"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {isRegister
                ? "Already have an account?"
                : "Don't have an account?"}{" "}
              <Link
                href={isRegister ? "/login" : "/register"}
                className="font-medium text-foreground underline underline-offset-4"
              >
                {isRegister ? "Log in" : "Register"}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
