"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowBendDownRightIcon,
  QuestionIcon,
  LockSimpleIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  BookmarkSimpleIcon,
  CheckIcon,
  CheckCircleIcon,
  ClockIcon,
  CompassIcon,
  CopyIcon,
  HandWavingIcon,
  IdentificationCardIcon,
  MapPinIcon,
  PencilSimpleIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  SparkleIcon,
  UsersThreeIcon,
  XIcon,
  BroadcastIcon,
  ChatCircleDotsIcon,
} from "@phosphor-icons/react";
import {
  defaultProfile,
  filterPeople,
  people,
  validateProfile,
  type Person,
  type Profile,
  type Topic,
} from "@/lib/detour";
import { findDetours, helpTopics } from "@/lib/matching";
import { parseBrowserState, serializeBrowserState } from "@/lib/browser-state";
import type { Invitation } from "@/lib/server/network";
import { events, DEFAULT_EVENT_ID, type EventId } from "@/lib/events";
import EventAccessForm from "@/components/event-access-form";
import EventRequestForm from "@/components/event-request-form";

type View = "discover" | "detours" | "card";
type Overlay =
  | { type: "profile" }
  | { type: "circle"; members: Person[]; preview: boolean }
  | { type: "invitation"; id: string }
  | { type: "person"; person: Person & { mode?: Profile["mode"] } }
  | { type: "about" }
  | { type: "event-access" }
  | { type: "event-request" }
  | null;
const topics: Topic[] = [
  "All people",
  "AI & ML",
  "Cloud native",
  "Design",
  "Open source",
];
const colors = {
  lilac: "bg-secondary",
  peach: "bg-accent-subtle",
  sage: "bg-success-subtle",
  blue: "bg-info-subtle",
};
type Network = {
  mode: "preview" | "connected";
  people: (Person & { mode?: Profile["mode"] })[];
  me: { id: string; profile: Profile } | null;
};

function personFromProfile(profile: Profile, id = "you"): Person {
  return {
    ...profile,
    id,
    initials: profile.name.slice(0, 2).toUpperCase(),
    role: "Conference attendee",
    color: "sage",
    topic: "All people",
    location: profile.mode === "Text first" ? "Text first" : "Coffee bar",
  };
}

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : "The network couldn’t complete that request. Please try again.",
    );
  if (data === null)
    throw new Error(
      "The network returned an unreadable response. Please try again.",
    );
  return data as T;
}

function Logo({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2.5 font-display font-semibold tracking-tight ${small ? "text-2xl" : "text-3xl"}`}
    >
      <svg
        aria-hidden="true"
        width={small ? 26 : 32}
        height={small ? 26 : 32}
        viewBox="0 0 32 32"
        fill="none"
      >
        <path
          d="M5 27V7H18V20H27M20 13L27 20L20 27"
          stroke="currentColor"
          strokeWidth="4.5"
        />
      </svg>
      <span>
        detour<span className="text-accent">.</span>
      </span>
    </span>
  );
}

function Avatar({
  initials,
  color = "sage",
  size = "normal",
}: {
  initials: string;
  color?: Person["color"];
  size?: "small" | "normal" | "large";
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold ${colors[color]} ${size === "small" ? "size-9 text-xs" : size === "large" ? "size-16 text-xl" : "size-12 text-sm"}`}
    >
      {initials}
    </span>
  );
}

function RouteArtwork() {
  return (
    <div
      className="relative hidden h-56 w-80 shrink-0 lg:block"
      aria-hidden="true"
    >
      <svg viewBox="0 0 320 224" className="h-full w-full overflow-visible">
        <defs>
          <pattern
            id="route-dots"
            width="16"
            height="16"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="1" className="fill-border" />
          </pattern>
        </defs>
        <rect x="32" width="256" height="224" fill="url(#route-dots)" />
        <path
          d="M24 177H111V66H222V116H286"
          className="stroke-accent"
          fill="none"
          strokeWidth="38"
        />
        <path
          d="M260 83L293 116L260 149"
          className="stroke-accent"
          fill="none"
          strokeWidth="23"
        />
        <rect
          x="88"
          y="43"
          width="47"
          height="47"
          className="fill-secondary"
          transform="rotate(-12 111 66)"
        />
        <path
          d="M101 66H121M111 56V76"
          className="stroke-foreground"
          strokeWidth="2"
        />
        <circle cx="222" cy="66" r="25" className="fill-success-subtle" />
        <path
          d="M212 64L220 72L233 57"
          className="stroke-foreground"
          strokeWidth="2"
          fill="none"
        />
        <circle cx="24" cy="177" r="7" className="fill-foreground" />
      </svg>
      <span className="absolute bottom-0 right-0 -rotate-6 bg-background px-2 font-display text-sm">
        Worth going out of your way.
      </span>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      opener?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto max-h-[90dvh] w-full max-w-xl overflow-y-auto overscroll-contain rounded-2xl bg-background p-0 text-foreground shadow-xl backdrop:bg-foreground/30"
    >
      {/* A dynamic viewport limit keeps the native dialog usable above mobile keyboards. */}
      <div className="p-6 sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 id={id} className="text-3xl font-medium tracking-tight">
            {title}
          </h2>
          <button
            autoFocus
            onClick={onClose}
            aria-label="Close dialog"
            className="-mr-2 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-subtle"
          >
            <XIcon size={22} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

function PublishPrompt({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div className="mt-3 rounded-lg border border-border bg-subtle p-3 text-sm">
      <p role="status">Publish your introduction first.</p>
      <button type="button" className="text-link mt-1" onClick={onGetStarted}>
        Get started
        <ArrowRightIcon size={16} />
      </button>
    </div>
  );
}

function PublishAction({
  published,
  onGetStarted,
  onAction,
  children,
  className,
  disabled = false,
}: {
  published: boolean;
  onGetStarted: () => void;
  onAction: () => void;
  children: ReactNode;
  className: string;
  disabled?: boolean;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  return (
    <div>
      <button
        type="button"
        className={className}
        disabled={published && disabled}
        onClick={() => {
          if (!published) setShowPrompt(true);
          else onAction();
        }}
      >
        {children}
      </button>
      {showPrompt && !published && <PublishPrompt onGetStarted={onGetStarted} />}
    </div>
  );
}

function InvitationPlanForm({
  mode,
  locations,
  published,
  busy,
  label,
  primary = false,
  unavailableReason,
  onGetStarted,
  onCreate,
}: {
  mode: Profile["mode"];
  locations: readonly string[];
  published: boolean;
  busy: boolean;
  label: string;
  primary?: boolean;
  unavailableReason?: string;
  onGetStarted: () => void;
  onCreate: (meetingSpot: string) => void;
}) {
  const [meetingSpot, setMeetingSpot] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);
  const [error, setError] = useState("");
  const planRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const textFirst = mode === "Text first";
  const availableLocations = locations.length ? locations : ["Coffee bar"];
  const defaultLocation = availableLocations[0];
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!published) {
      setShowPrompt(true);
      return;
    }
    if (busy || unavailableReason) return;
    const plan = meetingSpot.trim();
    if (textFirst && !plan) {
      setError("Add a shared text channel or a plan for exchanging messages.");
      planRef.current?.focus();
      return;
    }
    setError("");
    onCreate(plan || defaultLocation);
  }
  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      {published && (
        <>
          {textFirst ? (
            <label className="block text-sm font-medium">
              Where will you exchange messages?
              <input
                ref={planRef}
                className="field mt-2"
                value={meetingSpot}
                onChange={(event) => {
                  setMeetingSpot(event.target.value);
                  setError("");
                }}
                maxLength={120}
                required
                aria-describedby={`${id}-note${error ? ` ${id}-error` : ""}`}
                aria-invalid={Boolean(error)}
                placeholder="Event Discord, #introductions channel"
              />
            </label>
          ) : (
            <div>
              <label className="block text-sm font-medium">
                Meeting spot (optional)
                <select
                  className="field mt-2"
                  value={meetingSpot}
                  onChange={(event) => setMeetingSpot(event.target.value)}
                  aria-describedby={`${id}-note`}
                >
                  <option value="">No preference · {defaultLocation}</option>
                  {availableLocations.map((location) => (
                    <option key={location} value={location}>{location}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="text-link mt-1"
                onClick={() =>
                  setMeetingSpot(availableLocations[Math.floor(Math.random() * availableLocations.length)])
                }
              >
                Choose for me
                <SparkleIcon size={16} />
              </button>
            </div>
          )}
          <p id={`${id}-note`} className="text-xs leading-relaxed text-muted-foreground">
            {textFirst
              ? "Anyone with the link can read this plan. No passwords or access codes."
              : "Suggested spots. Check availability at your event."}
          </p>
        </>
      )}
      {error && <p id={`${id}-error`} role="alert" className="text-sm text-danger">{error}</p>}
      {published && unavailableReason && (
        <p className="text-xs leading-relaxed text-muted-foreground">{unavailableReason}</p>
      )}
      <button
        type="submit"
        disabled={published && (busy || Boolean(unavailableReason))}
        className={`${primary ? "button-primary" : "button-secondary"} w-full`}
      >
        {busy ? "Creating invitation…" : label}
        <ArrowRightIcon size={18} />
      </button>
      {showPrompt && !published && <PublishPrompt onGetStarted={onGetStarted} />}
      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        Each person accepts from their own published profile.
      </p>
    </form>
  );
}

function ProfileEditor({
  profile,
  onSave,
  onClose,
}: {
  profile: Profile;
  onSave: (profile: Profile) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(profile);
  const [error, setError] = useState<string | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = validateProfile(draft);
    if (message) {
      setError(message);
      return;
    }
    onSave({
      ...draft,
      name: draft.name.trim(),
      offer: draft.offer.trim(),
      ask: draft.ask.trim(),
    });
  }
  return (
    <Modal title="What brings you here?" onClose={onClose}>
      <p className="-mt-2 mb-6 leading-relaxed text-muted-foreground">
        Share what you can offer and what you need.
      </p>
      <form onSubmit={submit} noValidate className="space-y-5">
        <label className="block text-sm font-medium">
          Your name
          <input
            className="field mt-2"
            value={draft.name}
            maxLength={60}
            autoComplete="given-name"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            required
          />
        </label>
        <label className="block text-sm font-medium">
          I can help with
          <textarea
            className="field mt-2 resize-y"
            rows={2}
            value={draft.offer}
            maxLength={180}
            onChange={(e) => setDraft({ ...draft, offer: e.target.value })}
            required
          />
        </label>
        <label className="block text-sm font-medium">
          I’m looking for help with
          <textarea
            className="field mt-2 resize-y"
            rows={2}
            value={draft.ask}
            maxLength={180}
            onChange={(e) => setDraft({ ...draft, ask: e.target.value })}
            required
          />
        </label>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">
            How would you like to connect?
          </legend>
          <div className="flex flex-wrap gap-3">
            {(["In person", "Text first"] as const).map((mode) => (
              <label
                key={mode}
                className={`flex flex-1 cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${draft.mode === mode ? "border-foreground bg-subtle" : "border-border"}`}
              >
                <input
                  type="radio"
                  name="mode"
                  value={mode}
                  checked={draft.mode === mode}
                  onChange={() => setDraft({ ...draft, mode })}
                  className="accent-foreground"
                />
                {mode}
              </label>
            ))}
          </div>
        </fieldset>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-accent-subtle p-3 text-sm text-danger"
          >
            {error}
          </p>
        )}
        <button className="button-primary w-full" type="submit">
          Save my introduction
          <CheckIcon size={18} />
        </button>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          Your draft stays on this device until you publish it.
        </p>
      </form>
    </Modal>
  );
}

function CircleDiagram({
  members,
  selfId,
}: {
  members?: Person[];
  selfId?: string;
}) {
  const id = useId();
  const connections = members
    ? members.map((member, i) => {
        const next = members[(i + 1) % members.length];
        return {
          name: member.id === selfId ? "You" : member.name,
          initials: member.initials,
          color: member.color,
          offer: member.offer,
          connection: `Helps ${next.id === selfId ? "you" : next.name} with ${helpTopics(member.offer, next.ask).join(", ")}`,
        };
      })
    : [
        {
          name: "You bring something.",
          initials: "01",
          color: "sage" as const,
          offer: "A skill, an idea, a fresh pair of eyes.",
          connection: "You help the next person.",
        },
        {
          name: "Someone needs it.",
          initials: "02",
          color: "lilac" as const,
          offer: "They have something to offer, too.",
          connection: "They help someone else.",
        },
        {
          name: "It comes back around.",
          initials: "03",
          color: "peach" as const,
          offer: "The third person has the help you need.",
          connection: "They help you. The circle closes.",
        },
      ];
  return (
    <figure className="@container">
      <div className="grid items-center gap-6 @xl:grid-cols-2">
        <div
          className="relative mx-auto aspect-square w-full max-w-96"
          aria-hidden="true"
        >
          {/* Fixed SVG geometry keeps three equal, overlapping circles and their clockwise return path aligned at every size. */}
          <svg viewBox="0 0 360 360" fill="none" className="size-full">
            <defs>
              <pattern
                id={`${id}-hatch`}
                width="7"
                height="7"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(-35)"
              >
                <path d="M0 0V7" className="stroke-accent" strokeWidth="2" />
              </pattern>
              <clipPath id={`${id}-overlap`}>
                <circle cx="135" cy="206" r="105" />
              </clipPath>
              <clipPath id={`${id}-center`}>
                <circle cx="180" cy="128" r="105" />
              </clipPath>
              <marker
                id={`${id}-arrow`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path
                  d="m2 1 5 4-5 4"
                  className="stroke-foreground"
                  strokeWidth="1.5"
                />
              </marker>
            </defs>
            <circle
              cx="180"
              cy="180"
              r="164"
              className="stroke-border"
              strokeDasharray="2 5"
            />
            <g className="stroke-muted-foreground/35">
              <circle cx="180" cy="128" r="105" />
              <circle cx="225" cy="206" r="105" />
              <circle cx="135" cy="206" r="105" />
            </g>
            <g clipPath={`url(#${id}-center)`}>
              <circle
                cx="225"
                cy="206"
                r="105"
                fill={`url(#${id}-hatch)`}
                clipPath={`url(#${id}-overlap)`}
                opacity="0.55"
              />
            </g>
            <g
              className="stroke-foreground"
              strokeWidth="1.5"
              markerEnd={`url(#${id}-arrow)`}
            >
              <path d="M215 49A136 136 0 0 1 312 213" />
              <path d="M275 278A136 136 0 0 1 85 278" />
              <path d="M48 213A136 136 0 0 1 145 49" />
            </g>
            {connections.map((member, i) => (
              <g
                key={i}
                transform={`translate(${[180, 298, 62][i]} ${[44, 248, 248][i]})`}
              >
                <circle r="29" className="fill-surface" />
                <circle
                  r="24"
                  className={
                    {
                      sage: "fill-success-subtle",
                      lilac: "fill-secondary",
                      peach: "fill-accent-subtle",
                      blue: "fill-info-subtle",
                    }[member.color]
                  }
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-foreground font-display text-base font-medium"
                >
                  {member.initials}
                </text>
                {members && (
                  <text
                    y="42"
                    textAnchor="middle"
                    className="fill-muted-foreground font-sans text-xs"
                  >
                    0{i + 1}
                  </text>
                )}
              </g>
            ))}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="rounded-full bg-surface px-3 py-2 text-center font-display text-base font-medium leading-tight @sm:text-xl">
              A little give.
              <br />A little get.
            </p>
          </div>
        </div>
        <ol className="space-y-6">
          {connections.map((member, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full font-display text-xs tabular-nums ${colors[member.color]}`}
                aria-hidden="true"
              >
                0{i + 1}
              </span>
              <div className="min-w-0">
                <h3 className="text-lg font-medium leading-snug">
                  {member.name}
                </h3>
                <p className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground">
                  {member.offer}
                </p>
                <p className="mt-2 text-xs leading-relaxed">
                  {member.connection}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      {!members && (
        <figcaption className="mt-5 text-xs leading-relaxed text-muted-foreground">
          An example of how a circle connects. No match yet.
        </figcaption>
      )}
    </figure>
  );
}

function PersonCard({
  person,
  saved,
  onOpen,
}: {
  person: Person;
  saved: boolean;
  onOpen: () => void;
}) {
  return (
    <article className="flex flex-col rounded-xl border border-border bg-surface p-5 transition-colors hover:border-muted-foreground/50 sm:p-6">
      <div className="flex items-start gap-3">
        <Avatar initials={person.initials} color={person.color} />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-medium">{person.name}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{person.role}</p>
        </div>
        {saved && (
          <BookmarkSimpleIcon weight="fill" size={18} aria-label="Saved" />
        )}
      </div>
      <div className="mb-6 mt-6 space-y-4">
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <PlusIcon size={13} />
            Can help with
          </p>
          <p className="text-sm leading-relaxed">{person.offer}</p>
        </div>
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MagnifyingGlassIcon size={13} />
            Looking for
          </p>
          <p className="text-sm leading-relaxed">{person.ask}</p>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={`size-1.5 rounded-full ${person.available ? "bg-success" : "bg-muted-foreground"}`}
          />
          {person.available ? "Open to a detour" : "Not available right now"}
        </span>
        <button
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium hover:underline"
          onClick={onOpen}
        >
          Say hello
          <ArrowUpRightIcon size={16} />
        </button>
      </div>
    </article>
  );
}

function ShareCard({
  eventId,
  profile,
  notify,
  invitationId,
  preview,
  onDiscover,
}: {
  eventId: EventId;
  profile: Profile;
  notify: (message: string) => void;
  invitationId: string | null;
  preview: boolean;
  onDiscover: () => void;
}) {
  const [link, setLink] = useState("");
  const [qr, setQr] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setQr("");
    setError(false);
    setLink("");
    const id = preview ? "circle" : invitationId;
    if (!id) return;
    const url = `${window.location.origin}/?event=${eventId}&invite=${encodeURIComponent(id)}`;
    setLink(url);
    import("qrcode")
      .then((module) =>
        module.toDataURL(url, {
          width: 240,
          margin: 2,
          errorCorrectionLevel: "M",
        }),
      )
      .then((result) => {
        if (active) setQr(result);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [invitationId, preview, eventId]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      notify("Invitation link copied.");
    } catch {
      notify("Couldn’t copy automatically. Select and copy the link below.");
    }
  }
  return (
    <div className="grid items-start gap-10 md:grid-cols-2 lg:gap-20">
      <div className="notched-surface bg-accent p-7 sm:p-10">
        <div className="flex items-center justify-between gap-4">
          <Logo small />
          <BroadcastIcon size={28} />
        </div>
        <p className="mt-12 font-display text-5xl font-medium leading-tight tracking-tight">
          A hello.
          <br />A little help.
          <br />A new direction.
        </p>
        <div className="my-8 h-px bg-foreground/25" />
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-display text-2xl font-medium">
              {profile.name || "Your next detour"}
            </p>
            <p className="mt-1 text-sm">Let’s take a detour.</p>
          </div>
          <div className="flex size-32 items-center justify-center rounded-lg bg-surface">
            {qr ? (
              <img
                src={qr}
                alt={
                  preview
                    ? "Scan to explore a sample circle"
                    : "Scan to open this detour invitation"
                }
                width={120}
                height={120}
              />
            ) : (
              <p className="p-3 text-center text-xs" role="status">
                {!preview && !invitationId
                  ? "Create a detour to get your QR code."
                  : error
                    ? "Use the invitation link instead."
                    : "Making your QR code…"}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="py-2">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-secondary">
          <IdentificationCardIcon size={24} />
        </span>
        <h2 className="mt-5 text-3xl font-medium tracking-tight">
          Good connections
          <br />
          start with a hello.
        </h2>
        <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
          {preview
            ? "Share this sample invitation by QR or NFC."
            : invitationId
              ? "Share with your invitees by QR or NFC. Each accepts from their own browser."
              : "Create an invitation, then share it by QR or NFC."}
        </p>
        {preview || invitationId ? (
          <>
            <label
              className="mt-8 block text-sm font-medium"
              htmlFor="share-link"
            >
              {preview
                ? "Sample invitation link"
                : "Invitation link"}
            </label>
            <input
              id="share-link"
              readOnly
              value={link}
              onFocus={(e) => e.target.select()}
              className="field mt-2"
            />
            <button
              onClick={copy}
              disabled={!link}
              className="button-primary mt-4"
            >
              <CopyIcon size={18} />
              Copy invitation link
            </button>
          </>
        ) : (
          <button onClick={onDiscover} className="button-primary mt-6">
            Find a detour
            <ArrowRightIcon size={18} />
          </button>
        )}
        <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">
          {preview
            ? "Fictional attendees. Use a hosted URL for phone demos; localhost stays on this computer."
            : "Invitations expire after 24 hours. Accept in the browser where you published. NFC doesn’t verify identity."}
        </p>
      </div>
    </div>
  );
}

export default function DetourApp({
  initialEventId,
}: {
  initialEventId: EventId;
}) {
  const eventId = initialEventId;
  const selectedEvent = events.find((event) => event.id === eventId)!;
  const storageKey =
    eventId === DEFAULT_EVENT_ID
      ? "detour-preview-v1"
      : `detour-preview-v1:${eventId}`;
  const [eventAccess, setEventAccess] = useState<{
    required: boolean;
    granted: boolean;
  } | null>(null);
  const [view, setView] = useState<View>("discover");
  // A displayed sample is not a draft until explicitly saved or replaced by a published profile.
  const [draft, setProfile] = useState<Profile | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [overlay, setOverlayState] = useState<Overlay>(null);
  const overlayRef = useRef<Overlay>(null);
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<Topic>("All people");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [toast, setToast] = useState("");
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [network, setNetwork] = useState<Network | null>(null);
  const profile =
    draft ??
    (network?.mode === "preview"
      ? defaultProfile
      : ({
          name: "",
          offer: "",
          ask: "",
          mode: "In person",
          available: true,
        } as Profile));
  const [networkError, setNetworkError] = useState("");
  const [networkLoading, setNetworkLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [searchPeople, setSearchPeople] = useState<Person[] | null>(null);
  const [searchError, setSearchError] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [invitationsError, setInvitationsError] = useState("");
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [inviteReload, setInviteReload] = useState(0);
  const [invitationDetail, setActiveInvitation] = useState<Invitation | null>(
    null,
  );
  const [invitationError, setInvitationError] = useState("");
  const [shareId, setShareId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasDraft = useRef(false);
  const connected = network?.mode === "connected";
  const preview = network?.mode === "preview";
  const locked = Boolean(eventAccess?.required && !eventAccess.granted);
  const invitationId = overlay?.type === "invitation" ? overlay.id : null;
  const activeInvitation =
    invitationDetail?.id === invitationId ? invitationDetail : null;

  function setOverlay(next: Overlay) {
    // Track navigation synchronously so delayed mutations cannot replace a newer dialog.
    overlayRef.current = next;
    setOverlayState(next);
  }

  useEffect(() => {
    try {
      const stored = parseBrowserState(localStorage.getItem(storageKey));
      if (stored.profile) {
        setProfile(stored.profile);
        hasDraft.current = true;
      }
      setSaved(stored.saved);
    } catch {
      setStorageError(true);
    }
    const invite = new URLSearchParams(window.location.search).get("invite");
    if (invite === "circle") {
      const sample = findDetours(
        personFromProfile(defaultProfile),
        people,
      ).circle;
      if (sample)
        setOverlay({ type: "circle", members: sample, preview: true });
    } else if (invite) setOverlay({ type: "invitation", id: invite });
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey, serializeBrowserState(draft, saved));
    } catch {
      setStorageError(true);
    }
  }, [draft, saved, ready]);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    requestJson<{ required: boolean; granted: boolean }>(
      `/api/events/access?event=${eventId}`,
      { signal: controller.signal },
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        setEventAccess(result);
        if (!result.granted) {
          setNetwork(null);
          setNetworkLoading(false);
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setNetworkError(
          error instanceof Error
            ? error.message
            : "Couldn’t check event access. Try again.",
        );
        setNetworkLoading(false);
      });
    return () => controller.abort();
  }, [ready, eventId, reload]);

  useEffect(() => {
    if (!ready || !eventAccess?.granted) return;
    const controller = new AbortController();
    setNetworkLoading(true);
    setNetworkError("");
    requestJson<Network>(`/api/network?event=${eventId}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        setNetwork(result);
        if (!hasDraft.current && result.mode === "connected") {
          setProfile(
            result.me?.profile ?? {
              name: "",
              offer: "",
              ask: "",
              mode: "In person",
              available: true,
            },
          );
          hasDraft.current = true;
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setNetworkError(
            error instanceof Error
              ? error.message
              : "Couldn’t load the event network.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setNetworkLoading(false);
      });
    return () => controller.abort();
  }, [ready, reload, eventId, eventAccess?.granted]);

  useEffect(() => {
    if (!connected || (!query.trim() && !availableOnly)) {
      setSearchPeople(null);
      setSearchError("");
      setSearchLoading(false);
      return;
    }
    const controller = new AbortController();
    setSearchPeople(null);
    setSearchLoading(true);
    setSearchError("");
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams({
        event: eventId,
        q: query,
        available: String(availableOnly),
      });
      requestJson<Network>(`/api/network?${params}`, {
        signal: controller.signal,
      })
        .then((result) => {
          if (controller.signal.aborted) return;
          if (result.mode !== "connected")
            throw new Error(
              "The event network disconnected. Refresh the network before continuing.",
            );
          setSearchPeople(result.people);
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setSearchError(
              error instanceof Error
                ? error.message
                : "Search couldn’t complete. Try again.",
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchLoading(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [connected, query, availableOnly, reload]);

  useEffect(() => {
    if (!connected || !network?.me) {
      setInvitations([]);
      setInvitationsError("");
      setInvitationsLoading(false);
      return;
    }
    const controller = new AbortController();
    setInvitationsLoading(true);
    setInvitationsError("");
    requestJson<{ invitations: Invitation[] }>(`/api/invitations?event=${eventId}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setInvitations(result.invitations);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setInvitationsError(
            error instanceof Error
              ? error.message
              : "Couldn’t load your invitations.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setInvitationsLoading(false);
      });
    return () => controller.abort();
  }, [connected, network?.me?.id, inviteReload]);

  useEffect(() => {
    if (!invitationId || !eventAccess?.granted) return;
    const controller = new AbortController();
    setActiveInvitation(null);
    setInvitationError("");
    requestJson<Invitation>(
      `/api/invitations/${encodeURIComponent(invitationId)}?event=${eventId}`,
      { signal: controller.signal },
    )
      .then((result) => {
        if (!controller.signal.aborted) setActiveInvitation(result);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setInvitationError(
            error instanceof Error
              ? error.message
              : "Couldn’t open this invitation.",
          );
      });
    return () => controller.abort();
  }, [invitationId, inviteReload, eventId, eventAccess?.granted]);

  useEffect(() => {
    setActionError("");
  }, [overlay]);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 4500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const allPeople = network?.people ?? [];
  const matchingProfile = connected ? network?.me?.profile : profile;
  const self = matchingProfile
    ? personFromProfile(matchingProfile, network?.me?.id ?? "you")
    : null;
  const candidates = allPeople.filter(
    (person) => !connected || person.mode === matchingProfile?.mode,
  );
  const matches = self
    ? findDetours(self, candidates)
    : { circle: null, pairs: [] };
  const circle = matches.circle;
  const hasFilters = Boolean(
    query.trim() || availableOnly || topic !== "All people",
  );
  const visiblePeople = connected
    ? query.trim() || availableOnly
      ? (searchPeople ?? [])
      : allPeople
    : filterPeople(allPeople, query, topic, availableOnly);
  const savedPeople = allPeople.filter((person) => saved.includes(person.id));
  const circleSaved = saved.includes("circle");
  const draftChanged =
    !!network?.me &&
    JSON.stringify(profile) !== JSON.stringify(network.me.profile);
  const selectedShare =
    invitations.find((invite) => invite.id === shareId) ?? invitations[0];
  const personCanInvite =
    overlay?.type === "person" &&
    !!self?.available &&
    overlay.person.available &&
    overlay.person.id !== self.id &&
    overlay.person.mode === matchingProfile?.mode;
  const viewerIsMember =
    !!activeInvitation?.viewerId &&
    activeInvitation.members.some(
      (member) => member.id === activeInvitation.viewerId,
    );

  function navigate(next: View) {
    setView(next);
    requestAnimationFrame(() =>
      headingRef.current?.focus({ preventScroll: true }),
    );
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function openCircle() {
    if (circle)
      setOverlay({ type: "circle", members: circle, preview: !connected });
  }
  function saveDetour(id: string) {
    setSaved((current) => (current.includes(id) ? current : [...current, id]));
    setOverlay(null);
    setToast(
      id === "circle"
        ? "Your latest circle suggestion is bookmarked."
        : "Detour saved. Find it in My detours.",
    );
  }
  function removeDetour(id: string) {
    setSaved((current) => current.filter((item) => item !== id));
    setToast("Detour removed from your saved list.");
  }
  function clearFilters() {
    setQuery("");
    setTopic("All people");
    setAvailableOnly(false);
    searchRef.current?.focus();
  }
  async function publish() {
    if (!eventAccess?.granted) {
      setOverlay({ type: "event-access" });
      return;
    }
    if (validateProfile(profile)) {
      setOverlay({ type: "profile" });
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      const me = await requestJson<{ id: string; profile: Profile }>(
        `/api/profile?event=${eventId}`,
        { method: "POST", body: JSON.stringify(profile) },
      );
      setNetwork((current) => (current ? { ...current, me } : current));
      setReload((value) => value + 1);
      setInviteReload((value) => value + 1);
      setToast("Your introduction is published to the event network.");
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Couldn’t publish your introduction.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function withdraw() {
    setBusy(true);
    setActionError("");
    try {
      await requestJson(`/api/profile?event=${eventId}`, { method: "DELETE" });
      setNetwork((current) => (current ? { ...current, me: null } : current));
      setInvitations([]);
      setShareId(null);
      setReload((value) => value + 1);
      setToast(
        "Your introduction is no longer public. Your local draft is kept.",
      );
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Couldn’t withdraw your introduction.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function createInvite(members: Person[], meetingSpot: string) {
    if (!network?.me || busy) return;
    const sourceOverlay = overlayRef.current;
    setBusy(true);
    setActionError("");
    try {
      const invitation = await requestJson<Invitation>(
        `/api/invitations?event=${encodeURIComponent(eventId)}`,
        {
          method: "POST",
          body: JSON.stringify({
            memberIds: members.map((member) => member.id),
            meetingSpot,
          }),
        },
      );
      setInvitations((current) => [
        invitation,
        ...current.filter((item) => item.id !== invitation.id),
      ]);
      setInviteReload((value) => value + 1);
      if (overlayRef.current === sourceOverlay) {
        setActiveInvitation(invitation);
        setShareId(invitation.id);
        setOverlay({ type: "invitation", id: invitation.id });
      }
      setToast("Invitation created. Find it in My detours to share the link.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Couldn’t create this invitation.";
      if (overlayRef.current === sourceOverlay) setActionError(message);
      else setToast(message);
    } finally {
      setBusy(false);
    }
  }
  async function acceptInvite(id: string) {
    setBusy(true);
    setActionError("");
    try {
      const invitation = await requestJson<Invitation>(
        `/api/invitations/${encodeURIComponent(id)}/accept?event=${eventId}`,
        { method: "POST", body: "{}" },
      );
      if (
        overlayRef.current?.type === "invitation" &&
        overlayRef.current.id === id
      )
        setActiveInvitation(invitation);
      setInvitations((current) =>
        current.map((item) => (item.id === id ? invitation : item)),
      );
      setInviteReload((value) => value + 1);
      setToast("Invitation accepted. Find it in My detours.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Couldn’t accept this invitation.";
      if (
        overlayRef.current?.type === "invitation" &&
        overlayRef.current.id === id
      )
        setActionError(message);
      else setToast(message);
    } finally {
      setBusy(false);
    }
  }

  async function unlockEvent(code: string) {
    const access = await requestJson<{ required: boolean; granted: boolean }>(
      `/api/events/access?event=${eventId}`,
      { method: "POST", body: JSON.stringify({ code }) },
    );
    setNetworkError("");
    setNetworkLoading(true);
    setEventAccess(access);
    if (overlayRef.current?.type === "event-access") setOverlay(null);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="fixed left-4 top-4 z-50 -translate-y-24 rounded-lg bg-foreground px-4 py-3 text-background focus:translate-y-0"
      >
        Skip to content
      </a>
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-5 sm:px-8 lg:px-12">
          <button
            onClick={() => navigate("discover")}
            aria-label="Detour home"
            className="shrink-0"
          >
            <Logo />
          </button>
          <nav
            aria-label="Main navigation"
            className="order-3 flex w-full items-center gap-1 sm:order-none sm:w-auto sm:gap-2"
          >
            {(
              [
                { id: "discover", label: "Discover", icon: CompassIcon },
                {
                  id: "detours",
                  label: "My detours",
                  icon: BookmarkSimpleIcon,
                },
                { id: "card", label: "My card", icon: IdentificationCardIcon },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => navigate(id)}
                aria-current={view === id ? "page" : undefined}
                className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs sm:flex-none sm:gap-2 sm:px-4 sm:text-sm ${view === id ? "bg-subtle font-medium" : "text-muted-foreground hover:bg-subtle/60 hover:text-foreground"}`}
              >
                <Icon size={18} weight={view === id ? "fill" : "regular"} />
                {label}
                {id === "detours" && saved.length > 0 && (
                  <span className="hidden rounded bg-foreground px-1.5 text-xs text-background sm:inline">
                    {saved.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <button
            onClick={() => setOverlay({ type: "profile" })}
            className="flex min-h-11 min-w-11 items-center justify-center gap-2.5 rounded-full text-sm"
            aria-label="Edit your introduction"
          >
            <span className="hidden md:inline">
              {profile.name
                ? `Hey, ${profile.name.split(" ")[0]}`
                : "Your introduction"}
            </span>
            <Avatar
              initials={profile.name.slice(0, 2).toUpperCase() || "?"}
              size="small"
            />
          </button>
        </div>
      </header>

      <main
        id="main"
        className="mx-auto w-full max-w-7xl flex-1 px-5 pb-16 sm:px-8 lg:px-12"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 py-6 text-xs sm:text-sm">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <label
              htmlFor="conference"
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <MapPinIcon size={16} />
              Conference
            </label>
            <select
              id="conference"
              value={eventId}
              onChange={(e) =>
                window.location.assign(
                  `/?event=${encodeURIComponent(e.target.value)}`,
                )
              }
              className="field w-auto max-w-full py-2 font-medium sm:text-sm"
            >
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
            <button
              className="text-link text-muted-foreground"
              onClick={() => setOverlay({ type: "event-request" })}
            >
              <PlusIcon size={16} />
              Add your event
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="inline-flex size-11 items-center justify-center rounded-full hover:bg-subtle"
              aria-label="How event access works"
              onClick={() => setOverlay({ type: "event-access" })}
            >
              <QuestionIcon size={20} />
            </button>
            <button
              onClick={() => setOverlay({ type: "event-access" })}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-3 py-2 text-xs"
            >
              {locked ? (
                <LockSimpleIcon size={16} />
              ) : (
                <span
                  className={`size-1.5 rounded-full ${connected ? "bg-success" : "bg-muted-foreground"}`}
                />
              )}
              {networkError
                ? "Network unavailable"
                : locked
                  ? "Event network · locked"
                  : connected
                    ? "Event network"
                    : preview
                      ? "Demo playground · fictional people"
                      : "Connecting…"}
            </button>
          </div>
        </div>

        {networkError && (
          <div
            role="alert"
            className="mb-5 rounded-xl bg-accent-subtle p-4 text-sm"
          >
            <p>{networkError}</p>
            <button
              className="text-link mt-2"
              onClick={() => setReload((value) => value + 1)}
              disabled={networkLoading}
            >
              Retry network
            </button>
          </div>
        )}
        {!overlay && actionError && (
          <p
            role="alert"
            className="mb-5 rounded-xl bg-accent-subtle p-4 text-sm"
          >
            {actionError}
          </p>
        )}

        {view === "discover" && (
          <>
            <section className="flex items-center justify-between gap-8 pb-10 pt-3 sm:pb-12 sm:pt-5">
              <div>
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="max-w-3xl text-balance font-display text-5xl font-medium leading-none tracking-tight outline-none sm:text-6xl lg:text-7xl"
                >
                  Good things happen
                  <br className="hidden sm:block" /> off the agenda.
                </h1>
                <div className="mt-6 max-w-2xl space-y-3 text-pretty text-base leading-relaxed text-muted-foreground">
                  <p>
                    Find people at {selectedEvent.name} through shared skills and needs.
                  </p>
                  <p>
                    Connect one-to-one or in a three-person circle.
                  </p>
                </div>
              </div>
              <RouteArtwork />
            </section>

            <div className="grid items-start gap-7 lg:grid-cols-3">
              <section
                className="overflow-hidden rounded-2xl border border-border bg-surface lg:col-span-2"
                aria-labelledby="circle-heading"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4 sm:px-7">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <SparkleIcon
                      weight="fill"
                      size={17}
                      className="text-accent"
                    />
                    {circle
                      ? preview
                        ? "Sample circle · fictional attendees"
                        : "Your suggested circle"
                      : "How a circle works"}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ClockIcon size={15} />
                    10 minutes, 3 perspectives
                  </span>
                </div>
                <div className="p-6 sm:p-7">
                  <div className="mb-7 flex items-start justify-between gap-4">
                    <div>
                      <h2
                        id="circle-heading"
                        className="text-3xl font-medium tracking-tight sm:text-4xl"
                      >
                        A small circle. A big unlock.
                      </h2>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        You help someone. Someone helps you.
                      </p>
                    </div>
                    <UsersThreeIcon
                      size={32}
                      weight="light"
                      className="hidden shrink-0 sm:block"
                    />
                  </div>
                  {circle && self ? (
                    <>
                      <CircleDiagram members={circle} selfId={self.id} />
                      <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
                        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                          Matched by shared keywords, not AI.{" "}
                          {connected && "Uses your published introduction."}
                        </p>
                        <button className="button-primary" onClick={openCircle}>
                          View circle
                          <ArrowUpRightIcon size={18} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div>
                      <CircleDiagram />
                      <div
                        className="mt-6 border-t border-border pt-5"
                        role="status"
                      >
                        <h3 className="text-xl font-medium">
                          {networkLoading
                            ? "Finding your next detour…"
                          : locked
                            ? "Unlock your event network."
                          : !network
                              ? "The network isn’t ready yet."
                              : connected && !self
                                ? "Start with an introduction."
                                : !self?.available
                                  ? "Take a detour when you’re ready."
                                  : "No circle yet."}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {networkLoading
                            ? "Checking for connections…"
                          : locked
                            ? "Enter the event code to see attendees. Your draft stays private until published."
                          : !network
                              ? "Retry the network to discover people."
                              : connected && !self
                                ? "Publish your offer and ask to find connections."
                                : !self?.available
                                  ? "Turn on availability. If published, update your introduction."
                                  : "A circle needs three people who can each help the next."}
                        </p>
                        {locked && (
                          <button
                            className="button-primary mt-4"
                            onClick={() => setOverlay({ type: "event-access" })}
                          >
                            Unlock event network
                            <ArrowRightIcon size={16} />
                          </button>
                        )}
                        {connected && !self && (
                          <button
                            className="text-link mt-2"
                            onClick={() => setOverlay({ type: "profile" })}
                          >
                            {profile.name
                              ? "Edit introduction"
                              : "Create introduction"}
                            <ArrowUpRightIcon size={16} />
                          </button>
                        )}
                      </div>
                      {matches.pairs.length > 0 && self && (
                        <div className="mt-5 space-y-3">
                          <p className="text-sm font-medium">
                            Start with a one-to-one detour.
                          </p>
                          {matches.pairs.slice(0, 3).map((person) => (
                            <button
                              key={person.id}
                              onClick={() =>
                                setOverlay({ type: "person", person })
                              }
                              className="flex w-full items-start justify-between gap-3 rounded-lg bg-background p-3 text-left text-sm"
                            >
                              <span>
                                <span className="block font-medium">
                                  {person.name}
                                </span>
                                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                                  {helpTopics(self.offer, person.ask).length > 0
                                    ? `You can help with ${helpTopics(self.offer, person.ask).join(", ")}.`
                                    : `Can help you with ${helpTopics(person.offer, self.ask).join(", ")}.`}
                                </span>
                              </span>
                              <ArrowUpRightIcon
                                size={18}
                                className="shrink-0"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              <aside className="space-y-4">
                <section
                  className="rounded-2xl bg-subtle p-6"
                  aria-labelledby="intro-heading"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2
                      id="intro-heading"
                      className="text-xl font-medium tracking-tight"
                    >
                      Your part of the story
                    </h2>
                    <button
                      onClick={() => setOverlay({ type: "profile" })}
                      aria-label="Edit your introduction"
                      className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-background"
                    >
                      <PencilSimpleIcon size={18} />
                    </button>
                  </div>
                  <div className="mt-5 space-y-5">
                    <div>
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <PlusIcon size={13} />
                        You can help with
                      </p>
                      <p className="text-sm leading-relaxed">
                        {profile.offer || "A skill or a fresh pair of eyes."}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MagnifyingGlassIcon size={13} />
                        You’re looking for
                      </p>
                      <p className="text-sm leading-relaxed">
                        {profile.ask || "One thing you’d like to get unstuck."}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={profile.available}
                        onChange={(e) => {
                          hasDraft.current = true;
                          setProfile({
                            ...profile,
                            available: e.target.checked,
                          });
                        }}
                        className="size-4 accent-success"
                      />
                      Open to a detour
                    </label>
                    <span className="text-xs text-muted-foreground">
                      {profile.mode}
                    </span>
                  </div>
                  {connected && (
                    <div className="mt-5 space-y-3 border-t border-border pt-4">
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {network.me
                          ? draftChanged
                            ? "Unpublished changes. Matching uses your published introduction."
                            : "Published. Manage your introduction and responses from this browser."
                          : "Publishing shares your name, offer, ask, availability and connection mode with this event. Your draft stays private until then."}
                      </p>
                      <button
                        onClick={publish}
                        disabled={busy || (!!network.me && !draftChanged)}
                        className="button-primary w-full"
                      >
                        {busy
                          ? "Saving…"
                          : network.me
                            ? "Update published introduction"
                            : "Publish introduction"}
                      </button>
                      {network.me && (
                        <button
                          onClick={withdraw}
                          disabled={busy}
                          className="text-link text-muted-foreground"
                        >
                          Withdraw introduction
                        </button>
                      )}
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {network.me
                          ? "Withdrawing closes active invitations. Keep this browser’s cookies to manage your profile."
                          : "No account needed. Return in this browser."}
                      </p>
                    </div>
                  )}
                  {preview && (
                    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                      Local draft. Fictional attendees.
                    </p>
                  )}
                </section>
                <button
                  onClick={() => navigate("card")}
                  className="group flex w-full items-center gap-4 rounded-xl bg-secondary px-5 py-4 text-left transition-colors hover:bg-secondary/70"
                >
                  <BroadcastIcon size={25} className="shrink-0" />
                  <span className="flex-1">
                    <span className="block font-display text-lg font-medium">
                      Make the first hello easy.
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Your card. A tap. A new connection.
                    </span>
                  </span>
                  <ArrowUpRightIcon size={20} />
                </button>
              </aside>
            </div>

            <section
              className="mt-12 sm:mt-14"
              aria-labelledby="people-heading"
            >
              <div className="flex flex-wrap items-end justify-between gap-5">
                <div>
                  <h2
                    id="people-heading"
                    className="text-3xl font-medium tracking-tight"
                  >
                    Different paths. Good people.
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Find a skill or a fresh perspective.
                  </p>
                </div>
                <div className="relative w-full sm:w-72">
                  <label htmlFor="people-search" className="sr-only">
                    Search people, skills, or interests
                  </label>
                  <MagnifyingGlassIcon
                    size={18}
                    className="pointer-events-none absolute left-3.5 top-3.5 text-muted-foreground"
                  />
                  <input
                    id="people-search"
                    ref={searchRef}
                    type="search"
                    maxLength={180}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Try Kubernetes, design, AI…"
                    className="field py-3 pl-10 text-base sm:text-sm"
                  />
                </div>
              </div>
              <div className="mb-6 mt-6 flex flex-wrap items-center justify-between gap-4">
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="Filter by interest"
                >
                  {preview &&
                    topics.map((item) => (
                      <button
                        key={item}
                        onClick={() => setTopic(item)}
                        aria-pressed={topic === item}
                        className={`min-h-11 rounded-full border px-4 py-2 text-xs font-medium transition-colors ${topic === item ? "border-foreground bg-foreground text-background" : "border-border hover:border-muted-foreground"}`}
                      >
                        {item}
                      </button>
                    ))}
                  {connected && (
                    <button
                      onClick={() => setReload((value) => value + 1)}
                      disabled={networkLoading}
                      className="text-link text-xs text-muted-foreground"
                    >
                      {networkLoading ? "Refreshing people…" : "Refresh people"}
                    </button>
                  )}
                </div>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={availableOnly}
                    onChange={(e) => setAvailableOnly(e.target.checked)}
                    className="size-4 accent-foreground"
                  />
                  Available now
                </label>
              </div>
              <p className="sr-only" role="status">
                {visiblePeople.length}{" "}
                {visiblePeople.length === 1 ? "person" : "people"} found
              </p>
              {networkLoading || searchLoading ? (
                <p
                  role="status"
                  className="py-10 text-sm text-muted-foreground"
                >
                  Finding people…
                </p>
              ) : searchError ? (
                <div
                  role="alert"
                  className="rounded-xl bg-accent-subtle p-5 text-sm"
                >
                  <p>{searchError}</p>
                  <button
                    onClick={() => setReload((value) => value + 1)}
                    className="text-link mt-2"
                  >
                    Retry search
                  </button>
                </div>
              ) : !network ? (
                <p className="py-10 text-sm text-muted-foreground">
                  People will appear when the event network is available.
                </p>
              ) : visiblePeople.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {visiblePeople.map((person) => (
                    <PersonCard
                      key={person.id}
                      person={person}
                      saved={saved.includes(person.id)}
                      onOpen={() => setOverlay({ type: "person", person })}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
                  <CompassIcon
                    size={36}
                    weight="light"
                    className="mx-auto mb-4"
                  />
                  <h3 className="text-2xl font-medium">
                    {hasFilters
                      ? "No introductions match these filters."
                      : network.me
                        ? "You’re the first one here."
                        : "Make the first introduction."}
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                    {hasFilters
                      ? "Try another skill or clear your filters."
                      : network.me
                        ? "Your introduction is live. Check back for more people."
                        : "Publish your offer and ask so others can find you."}
                  </p>
                  <button
                    onClick={
                      hasFilters
                        ? clearFilters
                        : network.me
                          ? () => setReload((value) => value + 1)
                          : () => setOverlay({ type: "profile" })
                    }
                    className="button-secondary mt-5"
                  >
                    {hasFilters
                      ? "Clear filters"
                      : network.me
                        ? "Refresh people"
                        : profile.name
                          ? "Edit introduction"
                          : "Create introduction"}
                    <ArrowRightIcon size={17} />
                  </button>
                </div>
              )}
            </section>
            <div className="mt-12 flex flex-wrap items-center justify-between gap-5 rounded-xl bg-success-subtle px-6 py-6 sm:px-8">
              <div className="flex items-center gap-4">
                <HandWavingIcon size={32} weight="light" className="shrink-0" />
                <p className="font-display text-xl font-medium sm:text-2xl">
                  You don’t need a perfect pitch. Just a little curiosity.
                </p>
              </div>
              <button
                className="text-link"
                onClick={() => setOverlay({ type: "about" })}
              >
                How Detour works
                <ArrowRightIcon size={17} />
              </button>
            </div>
          </>
        )}

        {view === "detours" && (
          <section className="pb-10 pt-7">
            <p className="mb-3 text-sm text-muted-foreground">
              A few good reasons to leave your seat.
            </p>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="text-5xl font-medium tracking-tight outline-none sm:text-6xl"
            >
              Your next detours.
            </h1>
            <p className="mb-10 mt-4 max-w-xl leading-relaxed text-muted-foreground">
              Your saved people and invitations.
            </p>
            {connected && (
              <div className="mb-10">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl font-medium">Your invitations</h2>
                  <PublishAction
                    published={Boolean(network.me)}
                    onGetStarted={() => setOverlay({ type: "profile" })}
                    onAction={() => setInviteReload((value) => value + 1)}
                    disabled={invitationsLoading}
                    className="text-link"
                  >
                    {invitationsLoading ? "Refreshing…" : "Refresh responses"}
                  </PublishAction>
                </div>
                {invitationsError && (
                  <p
                    role="alert"
                    className="mb-4 rounded-xl bg-accent-subtle p-4 text-sm"
                  >
                    {invitationsError}
                  </p>
                )}
                {invitations.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {invitations.map((invitation) => (
                      <article
                        key={invitation.id}
                        className="rounded-xl border border-border bg-surface p-5"
                      >
                        <h3 className="text-xl font-medium">
                          {invitation.members
                            .map((member) =>
                              member.id === network.me?.id
                                ? "You"
                                : member.name,
                            )
                            .join(" + ")}
                        </h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {invitation.acceptedIds.length} of{" "}
                          {invitation.members.length} accepted ·{" "}
                          {invitation.mode}
                        </p>
                        <p className="mt-2 text-sm">{invitation.meetingSpot}</p>
                        <button
                          onClick={() =>
                            setOverlay({
                              type: "invitation",
                              id: invitation.id,
                            })
                          }
                          className="text-link mt-4"
                        >
                          Open invitation
                          <ArrowRightIcon size={16} />
                        </button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {invitationsLoading
                      ? "Loading invitations…"
                      : network.me
                        ? "No invitations yet. Invite someone from Discover."
                        : "Publish your introduction to create and accept invitations."}
                  </p>
                )}
              </div>
            )}
            {saved.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-16 text-center">
                <span className="mx-auto mb-5 flex size-20 items-center justify-center rounded-full bg-secondary">
                  <ArrowBendDownRightIcon size={38} weight="light" />
                </span>
                <h2 className="text-3xl font-medium">
                  Your route is wide open.
                </h2>
                <p className="mx-auto mt-3 max-w-sm px-4 text-sm leading-relaxed text-muted-foreground">
                  Save someone you’d like to meet from Discover.
                </p>
                <button
                  onClick={() => navigate("discover")}
                  className="button-primary mt-6"
                >
                  Find a detour
                  <ArrowRightIcon size={18} />
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {circleSaved && (
                  <article className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="mb-2 text-xs text-muted-foreground">
                          Bookmark · follows your current introduction
                        </p>
                        <h2 className="text-3xl font-medium">
                          Latest suggested circle
                        </h2>
                      </div>
                      <span className="inline-flex items-center gap-2 rounded-full bg-success-subtle px-3 py-1.5 text-xs">
                        <CheckCircleIcon size={16} />
                        Saved for later
                      </span>
                    </div>
                    {circle && self ? (
                      <CircleDiagram members={circle} selfId={self.id} />
                    ) : (
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        No circle yet. Your next suggestion will appear here.
                      </p>
                    )}
                    <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
                      <button
                        className="text-link text-muted-foreground"
                        onClick={() => removeDetour("circle")}
                      >
                        Remove saved circle
                      </button>
                      <button
                        className="button-primary"
                        onClick={openCircle}
                        disabled={!circle}
                      >
                        See the plan
                        <ArrowRightIcon size={18} />
                      </button>
                    </div>
                  </article>
                )}
                {savedPeople.length === 0 &&
                  saved.some((id) => id !== "circle") && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Saved people aren’t in this list. Refresh or explore Discover.
                    </p>
                  )}
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {savedPeople.map((person) => (
                    <div key={person.id}>
                      <PersonCard
                        person={person}
                        saved
                        onOpen={() => setOverlay({ type: "person", person })}
                      />
                      <button
                        className="text-link mt-1 text-muted-foreground"
                        onClick={() => removeDetour(person.id)}
                      >
                        Remove {person.name.split(" ")[0]} from saved
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {view === "card" && (
          <section className="pb-10 pt-7">
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="text-5xl font-medium tracking-tight outline-none sm:text-6xl"
            >
              Your hello, to go.
            </h1>
            <p className="mb-10 mt-4 leading-relaxed text-muted-foreground">
              Small card. Interesting possibilities.
            </p>
            {selectedShare && !preview && (
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                Invitation for{" "}
                {selectedShare.members.map((member) => member.name).join(", ")}{" "}
                · {selectedShare.meetingSpot}
              </p>
            )}
            <ShareCard
              eventId={eventId}
              profile={network?.me?.profile ?? profile}
              notify={setToast}
              invitationId={selectedShare?.id ?? null}
              preview={preview}
              onDiscover={() => navigate("discover")}
            />
          </section>
        )}

        {storageError && (
          <p
            role="alert"
            className="mt-6 rounded-lg bg-accent-subtle p-4 text-sm"
          >
            Changes couldn’t be saved. Copy your introduction before closing.
          </p>
        )}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-6 sm:px-8 lg:px-12">
          <Logo small />
          <p className="text-xs text-muted-foreground">
            Made for the conversations between the talks.
          </p>
          <button
            onClick={() => setOverlay({ type: "about" })}
            className="min-h-11 text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            {preview
              ? "Sample people. Real possibilities."
              : "A little help goes a long way."}
          </button>
        </div>
      </footer>

      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed inset-x-5 bottom-6 z-50 mx-auto w-fit rounded-xl bg-foreground px-5 py-3 text-sm text-background shadow-lg transition-opacity ${toast ? "opacity-100" : "opacity-0"}`}
      >
        {toast}
      </div>

      {overlay?.type === "profile" && (
        <ProfileEditor
          profile={profile}
          onClose={() => setOverlay(null)}
          onSave={(next) => {
            hasDraft.current = true;
            setProfile(next);
            setOverlay(null);
            setToast("Your draft is saved on this device.");
          }}
        />
      )}
      {overlay?.type === "circle" && (
        <Modal
          title="Your circle"
          onClose={() => setOverlay(null)}
        >
          <p className="mb-6 leading-relaxed text-muted-foreground">
            {overlay.preview
              ? "Fictional attendees. "
              : ""}
            Shared keywords connect each offer to the next person’s ask.
          </p>
          <div className="space-y-3">
            {overlay.members.map((member, i) => {
              const next = overlay.members[(i + 1) % overlay.members.length];
              return (
                <div key={member.id} className="rounded-lg bg-surface p-4">
                  <p className="text-sm font-medium">
                    {member.name} → {next.name}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Can help with{" "}
                    {helpTopics(member.offer, next.ask).join(", ")}.
                  </p>
                </div>
              );
            })}
          </div>
          <div className="my-6 flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-2">
              <ClockIcon size={18} />
              Start with 10 minutes
            </span>
            <span className="flex items-center gap-2">
              <ChatCircleDotsIcon size={18} />
              {overlay.preview ? "Sample plan" : matchingProfile?.mode}
            </span>
          </div>
          <div className="rounded-xl bg-success-subtle p-5">
            <p className="text-xs text-muted-foreground">
              A good place to start
            </p>
            <p className="mt-2 text-pretty font-display text-xl leading-relaxed">
              “What would you like help with today?”
            </p>
          </div>
          {actionError && (
            <p role="alert" className="mt-4 text-sm text-danger">
              {actionError}
            </p>
          )}
          {overlay.preview ? (
            <>
              <button
                onClick={() => saveDetour("circle")}
                className="button-primary mt-6 w-full"
              >
                Bookmark latest suggestion
                <BookmarkSimpleIcon size={18} />
              </button>
              <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
                Saved locally. Follows your latest introduction; creates no invitation.
              </p>
            </>
          ) : (
            <InvitationPlanForm
              key={matchingProfile?.mode}
              mode={matchingProfile?.mode ?? profile.mode}
              locations={selectedEvent.locations}
              published={Boolean(network?.me)}
              busy={busy}
              label="Create circle invitation"
              primary
              onGetStarted={() => setOverlay({ type: "profile" })}
              onCreate={(meetingSpot) => createInvite(overlay.members, meetingSpot)}
            />
          )}
        </Modal>
      )}
      {overlay?.type === "invitation" && (
        <Modal title="A detour, together." onClose={() => setOverlay(null)}>
          {locked ? (
            <EventAccessForm
              name={selectedEvent.name}
              granted={false}
              required
              onUnlock={unlockEvent}
            />
          ) : invitationError || networkError ? (
            <div role="alert">
              <p className="text-sm leading-relaxed text-danger">
                {invitationError || networkError}
              </p>
              <button
                className="button-secondary mt-4"
                onClick={() => {
                  setInviteReload((value) => value + 1);
                  setReload((value) => value + 1);
                }}
              >
                Retry invitation
              </button>
            </div>
          ) : !activeInvitation ? (
            <p role="status" className="text-sm text-muted-foreground">
              Opening invitation…
            </p>
          ) : (
            <>
              <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                {activeInvitation.mode} · {activeInvitation.meetingSpot}
                <br />
                Expires {new Date(activeInvitation.expiresAt).toLocaleString()}.
              </p>
              <ul className="space-y-3">
                {activeInvitation.members.map((member) => (
                  <li
                    key={member.id}
                    className="flex items-start gap-3 rounded-xl bg-subtle p-4"
                  >
                    <Avatar initials={member.initials} color={member.color} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {member.name}
                        {member.id === activeInvitation.viewerId && " (you)"}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {member.offer}
                      </p>
                      <p className="mt-2 flex items-center gap-1 text-xs">
                        {activeInvitation.acceptedIds.includes(member.id) ? (
                          <>
                            <CheckCircleIcon size={15} />
                            Accepted
                          </>
                        ) : (
                          <>
                            <ClockIcon size={15} />
                            Waiting for their response
                          </>
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              {actionError && (
                <p role="alert" className="mt-4 text-sm text-danger">
                  {actionError}
                </p>
              )}
              {viewerIsMember ? (
                <div className="mt-6 space-y-3">
                  {!activeInvitation.acceptedIds.includes(
                    activeInvitation.viewerId!,
                  ) && (
                    <button
                      onClick={() => acceptInvite(activeInvitation.id)}
                      disabled={
                        busy ||
                        Date.parse(activeInvitation.expiresAt) <= Date.now()
                      }
                      className="button-primary w-full"
                    >
                      {busy ? "Accepting…" : "Accept this detour"}
                      <CheckIcon size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setInvitations((current) =>
                        current.some((item) => item.id === activeInvitation.id)
                          ? current
                          : [activeInvitation, ...current],
                      );
                      setShareId(activeInvitation.id);
                      setOverlay(null);
                      navigate("card");
                    }}
                    className="button-secondary w-full"
                  >
                    Share invitation
                    <BroadcastIcon size={18} />
                  </button>
                </div>
              ) : (
                <p className="mt-5 rounded-xl bg-accent-subtle p-4 text-sm leading-relaxed">
                  Listed invitees only. Accept in the browser where you published;
                  the link alone can’t claim a place.
                </p>
              )}
              <PublishAction
                className="text-link mt-4"
                published={Boolean(network?.me)}
                onGetStarted={() => setOverlay({ type: "profile" })}
                onAction={() => setInviteReload((value) => value + 1)}
              >
                Refresh responses
              </PublishAction>
            </>
          )}
        </Modal>
      )}
      {overlay?.type === "person" && (
        <Modal
          title={`Say hello to ${overlay.person.name.split(" ")[0]}.`}
          onClose={() => setOverlay(null)}
        >
          <div className="mb-6 flex items-center gap-4">
            <Avatar
              initials={overlay.person.initials}
              color={overlay.person.color}
              size="large"
            />
            <div>
              <h3 className="text-xl font-medium">{overlay.person.name}</h3>
              <p className="text-sm text-muted-foreground">
                {overlay.person.role}
              </p>
            </div>
          </div>
          <div className="space-y-5">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">
                Can help with
              </p>
              <p className="leading-relaxed">{overlay.person.offer}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Looking for</p>
              <p className="leading-relaxed">{overlay.person.ask}</p>
            </div>
          </div>
          <p className="my-6 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPinIcon size={18} />
            {overlay.person.location}
            <span aria-hidden="true">/</span>
            {overlay.person.available
              ? "Open to a detour"
              : "Not available right now"}
          </p>
          <div className={`rounded-xl p-5 ${colors[overlay.person.color]}`}>
            <p className="text-xs text-muted-foreground">Break the ice</p>
            <p className="mt-2 text-pretty font-display text-xl leading-relaxed">
              “I saw you’re looking for{" "}
              {overlay.person.ask.charAt(0).toLowerCase() +
                overlay.person.ask.slice(1)}
              . What have you tried so far?”
            </p>
          </div>
          <button
            onClick={() => {
              if (overlay?.type === "person") saveDetour(overlay.person.id);
            }}
            className="button-primary mt-6 w-full"
          >
            <BookmarkSimpleIcon size={18} />
            {saved.includes(overlay.person.id)
              ? "Keep this detour saved"
              : "Save this detour"}
          </button>
          {connected && (
            <>
              <InvitationPlanForm
                key={`${overlay.person.id}-${matchingProfile?.mode}`}
                mode={matchingProfile?.mode ?? profile.mode}
                locations={selectedEvent.locations}
                published={Boolean(network?.me)}
                busy={busy}
                label="Create one-to-one invitation"
                unavailableReason={
                  personCanInvite
                    ? undefined
                    : "Both people must be available and use the same connection mode."
                }
                onGetStarted={() => setOverlay({ type: "profile" })}
                onCreate={(meetingSpot) => {
                  if (self && personCanInvite)
                    createInvite([self, overlay.person], meetingSpot);
                }}
              />
              {actionError && (
                <p role="alert" className="mt-3 text-sm text-danger">
                  {actionError}
                </p>
              )}
            </>
          )}
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {preview
              ? "Fictional attendee for this demo."
              : "Saved people stay on this device. Share invitations yourself."}
          </p>
        </Modal>
      )}
      {overlay?.type === "event-access" && (
        <Modal title="Your event network" onClose={() => setOverlay(null)}>
          <EventAccessForm
            name={selectedEvent.name}
            granted={Boolean(eventAccess?.granted)}
            required={eventAccess?.required ?? true}
            onUnlock={unlockEvent}
          />
        </Modal>
      )}
      {overlay?.type === "event-request" && (
        <Modal title="Add your event" onClose={() => setOverlay(null)}>
          <EventRequestForm />
        </Modal>
      )}
      {overlay?.type === "about" && (
        <Modal title="Take the scenic route." onClose={() => setOverlay(null)}>
          <p className="leading-relaxed text-muted-foreground">
            Find people who can help—and people you can help.
          </p>
          <ol className="my-7 space-y-6">
            {[
              {
                title: "Bring something.",
                text: "Share what you can offer and what you need.",
              },
              {
                title: "Find your missing piece.",
                text: "Find a person or a circle with complementary skills.",
              },
              {
                title: "See where it goes.",
                text: "Choose a meeting spot or text channel and share an invitation.",
              },
            ].map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-xl font-medium">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {step.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="rounded-xl bg-subtle p-4 text-sm leading-relaxed text-muted-foreground">
            {preview
              ? "Fictional attendees. Drafts and bookmarks stay in this browser."
              : "Drafts and bookmarks stay local. Published introductions are shared with the event; this browser’s cookie controls yours."}{" "}
            Circles use keywords, not AI. Each invitee accepts separately. No messages are sent.
          </p>
        </Modal>
      )}
    </div>
  );
}
