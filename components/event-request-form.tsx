"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowUpRightIcon, CopyIcon } from "@phosphor-icons/react";
import {
  buildEventRequest,
  EventRequestError,
  eventRequestFilename,
  eventRequestGitHubUrl,
  eventRequestJson,
  type EventRequest,
  type EventRequestDraft,
} from "@/lib/event-request";

const emptyDraft: EventRequestDraft = {
  name: "", website: "", location: "", startDate: "", endDate: "", reason: "",
};

export default function EventRequestForm() {
  const [draft, setDraft] = useState(emptyDraft);
  const [request, setRequest] = useState<EventRequest | null>(null);
  const [error, setError] = useState<EventRequestError | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const reviewRef = useRef<HTMLHeadingElement>(null);
  const jsonRef = useRef<HTMLTextAreaElement>(null);

  function update(field: keyof EventRequestDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setError(null);
  }
  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setRequest(buildEventRequest(draft));
      setError(null);
      requestAnimationFrame(() => reviewRef.current?.focus());
    } catch (caught) {
      const issue = caught instanceof EventRequestError
        ? caught
        : new EventRequestError("name", "Check the event details and try again.");
      setError(issue);
      const field = issue.field === "slug" ? "name" : issue.field;
      formRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${field}"]`)?.focus();
    }
  }
  async function copyJson() {
    if (!request) return;
    try {
      await navigator.clipboard.writeText(eventRequestJson(request));
      setCopyStatus("Request JSON copied.");
    } catch {
      jsonRef.current?.focus();
      jsonRef.current?.select();
      setCopyStatus("Select and copy the request JSON below.");
    }
  }

  if (request) return (
    <div className="space-y-5">
      <div>
        <h3 ref={reviewRef} tabIndex={-1} className="text-xl font-medium outline-none">Review your event request</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Ready to review. Nothing submitted yet.
        </p>
      </div>
      <ol className="list-decimal space-y-2 ps-5 text-sm leading-relaxed">
        <li>Sign in to GitHub and review the file.</li>
        <li>Propose it on a new branch or fork.</li>
        <li>Open a pull request. Approval and a catalog update are required before listing.</li>
      </ol>
      <a href={eventRequestGitHubUrl(request)} target="_blank" rel="noopener noreferrer" className="button-primary">
        Review request on GitHub <ArrowUpRightIcon size={18} />
      </a>
      <div>
        <label htmlFor="event-request-json" className="block text-sm font-medium">Request JSON</label>
        <p className="mt-1 text-xs text-muted-foreground">{eventRequestFilename(request)}</p>
        <textarea id="event-request-json" ref={jsonRef} readOnly value={eventRequestJson(request)} rows={8} className="field mt-2 font-mono text-sm" />
        <button type="button" onClick={copyJson} className="button-secondary mt-3"><CopyIcon size={17} />Copy request JSON</button>
        <p role="status" className="mt-2 text-sm text-muted-foreground">{copyStatus}</p>
      </div>
      <button
        type="button"
        className="text-link"
        onClick={() => {
          setRequest(null);
          setCopyStatus("");
          requestAnimationFrame(() =>
            formRef.current?.querySelector<HTMLInputElement>('[name="name"]')?.focus(),
          );
        }}
      >
        Edit event details
      </button>
    </div>
  );

  return (
    <form ref={formRef} onSubmit={prepare} noValidate className="space-y-5">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Propose an event on GitHub. Public details only—no access codes or private contacts.
      </p>
      {([
        { field: "name", label: "Event name", type: "text", max: 100, placeholder: "Community Builders Summit" },
        { field: "website", label: "Public event website", type: "url", max: 300, placeholder: "https://example.org/summit" },
        { field: "location", label: "City or venue", type: "text", max: 120, placeholder: "Denver, Colorado · Convention Center" },
        { field: "startDate", label: "Start date", type: "date", max: 10, placeholder: undefined },
        { field: "endDate", label: "End date", type: "date", max: 10, placeholder: undefined },
      ] as const).map(({ field, label, type, max, placeholder }) => (
        <div key={field}>
          <label className="block text-sm font-medium" htmlFor={`event-request-${field}`}>{label}</label>
          <input id={`event-request-${field}`} name={field} type={type} value={draft[field]} onChange={(event) => update(field, event.target.value)} maxLength={max} placeholder={placeholder} required className="field mt-2" aria-invalid={error?.field === field} aria-describedby={error?.field === field ? `event-request-${field}-error` : undefined} />
          {error?.field === field && <p id={`event-request-${field}-error`} role="alert" className="mt-2 text-sm text-danger">{error.message}</p>}
        </div>
      ))}
      <div>
        <label htmlFor="event-request-reason" className="block text-sm font-medium">Why would Detour be useful here?</label>
        <textarea id="event-request-reason" name="reason" value={draft.reason} onChange={(event) => update("reason", event.target.value)} maxLength={400} rows={3} required className="field mt-2 resize-y" placeholder="Help attendees find collaborators between sessions." aria-invalid={error?.field === "reason"} aria-describedby={error?.field === "reason" ? "event-request-reason-error" : undefined} />
        {error?.field === "reason" && <p id="event-request-reason-error" role="alert" className="mt-2 text-sm text-danger">{error.message}</p>}
      </div>
      {error?.field === "slug" && <p role="alert" className="text-sm text-danger">{error.message}</p>}
      <button type="submit" className="button-primary w-full">Prepare event request<ArrowUpRightIcon size={18} /></button>
    </form>
  );
}
