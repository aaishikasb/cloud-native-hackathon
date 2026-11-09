"use client";

import { useState, type FormEvent } from "react";
import { ArrowRightIcon, CheckCircleIcon } from "@phosphor-icons/react";

export default function EventAccessForm({
  name,
  granted,
  required,
  onUnlock,
}: {
  name: string;
  granted: boolean;
  required: boolean;
  onUnlock: (code: string) => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onUnlock(code);
      setCode("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Couldn’t check that code. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Ask the organizer for the {name} access code.
      </p>
      <p className="rounded-xl bg-subtle p-4 text-sm leading-relaxed">
        Code access lasts 12 hours. Wi-Fi and location aren’t checked.
      </p>
      {granted ? (
        <p className="flex items-start gap-2 text-sm">
          <CheckCircleIcon size={20} className="shrink-0 text-success" />
          {required
            ? "Event unlocked."
            : "Open local demo. No code needed."}
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label
              htmlFor="event-code"
              className="mb-2 block text-sm font-medium"
            >
              Event access code
            </label>
            <input
              id="event-code"
              type="password"
              autoComplete="off"
              required
              maxLength={80}
              className="field"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              aria-describedby={error ? "event-code-error" : undefined}
              aria-invalid={Boolean(error)}
            />
          </div>
          {error && (
            <p
              id="event-code-error"
              role="alert"
              className="text-sm leading-relaxed text-danger"
            >
              {error}
            </p>
          )}
          <button className="button-primary w-full" disabled={busy}>
            {busy ? "Checking code…" : "Unlock event network"}
            <ArrowRightIcon size={18} />
          </button>
        </form>
      )}
    </div>
  );
}
