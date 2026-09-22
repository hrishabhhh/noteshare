"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CopyFieldProps = {
  id: string;
  label: string;
  value: string;
};

export default function CopyField({ id, label, value }: CopyFieldProps) {
  const [message, setMessage] = useState("");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Copied!");
    } catch {
      setMessage("Could not copy. Select the value and copy it manually.");
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>

      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          readOnly
          onFocus={(event) => event.target.select()}
          className="font-mono text-sm"
        />

        <Button type="button" variant="outline" onClick={handleCopy}>
          Copy
        </Button>
      </div>

      <p role="status" className="text-xs text-muted-foreground">
        {message}
      </p>
    </div>
  );
}
