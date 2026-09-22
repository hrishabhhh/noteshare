"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export default function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  async function handleLogout() {
    if (submitting.current) return;

    submitting.current = true;
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      // Leave the authenticated page and clear its in-memory UI state.
      window.location.replace("/login");
    } catch {
      setError("Could not confirm logout. Please try again.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={handleLogout}
      >
        {busy ? "Logging out..." : "Log out"}
      </Button>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
