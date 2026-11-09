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
  ArrowDownIcon,
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
  ArrowUUpLeftIcon,
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

type View = "discover" | "detours" | "card";
type Overlay =
  | { type: "profile" }
  | { type: "circle" }
  | { type: "person"; person: Person }
  | { type: "about" }
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
const storageKey = "detour-preview-v1";

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
      className="m-auto max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl bg-background p-0 text-foreground shadow-xl backdrop:bg-foreground/30"
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
        A little context makes a much better introduction. You don’t have to be
        an expert to be helpful.
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
          This preview saves your introduction on this device.
        </p>
      </form>
    </Modal>
  );
}

function CircleDiagram({ profile }: { profile: Profile }) {
  const members = [
    {
      name: "You",
      initials: profile.name.slice(0, 2).toUpperCase(),
      color: "sage" as const,
      offer: profile.offer,
      to: "You can help Cara",
    },
    {
      name: "Cara",
      initials: "CN",
      color: "peach" as const,
      offer: "Accessibility & a fresh perspective",
      to: "Cara can help Ben",
    },
    {
      name: "Ben",
      initials: "BC",
      color: "lilac" as const,
      offer: "Getting things onto Kubernetes",
      to: "Ben can help you",
    },
  ];
  return (
    <div className="relative grid gap-5 sm:grid-cols-3 sm:gap-8">
      {members.map((member, i) => (
        <div
          key={member.name}
          className="relative flex items-center gap-4 sm:block"
        >
          <div className="flex items-center gap-3 sm:mb-4">
            <Avatar
              initials={member.initials}
              color={member.color}
              size="large"
            />
            <span className="hidden flex-1 text-border sm:block">
              <ArrowRightIcon size={30} weight="light" />
            </span>
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-medium">{member.name}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {member.offer}
            </p>
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium">
              <span className="size-1.5 rounded-full bg-accent" />
              {member.to}
            </p>
          </div>
          {i < 2 && (
            <ArrowDownIcon
              className="absolute -bottom-5 left-7 text-border sm:hidden"
              size={16}
            />
          )}
        </div>
      ))}
    </div>
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
          {person.available ? "Open to a detour" : "Back after the workshop"}
        </span>
        <button
          className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium hover:underline"
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
  profile,
  notify,
}: {
  profile: Profile;
  notify: (message: string) => void;
}) {
  const [link, setLink] = useState("");
  const [qr, setQr] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const url = `${window.location.origin}/?invite=circle`;
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
  }, []);
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
            <p className="font-display text-2xl font-medium">{profile.name}</p>
            <p className="mt-1 text-sm">Let’s take a detour.</p>
          </div>
          <div className="flex size-32 items-center justify-center rounded-lg bg-surface">
            {qr ? (
              <img
                src={qr}
                alt="Scan to open the sample circle invitation"
                width={120}
                height={120}
              />
            ) : (
              <p className="p-3 text-center text-xs" role="status">
                {error
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
          Show your QR code or put the invitation link on your NFC card. A tap
          opens the sample circle, ready to explore.
        </p>
        <label className="mt-8 block text-sm font-medium" htmlFor="share-link">
          Your invitation link
        </label>
        <input
          id="share-link"
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          className="field mt-2"
        />
        <button onClick={copy} disabled={!link} className="button-primary mt-4">
          <CopyIcon size={18} />
          Copy invitation link
        </button>
        <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">
          This is a demo invitation, not a personal contact card. For a phone to
          open it, Detour needs to be hosted at a URL your phone can reach.
        </p>
      </div>
    </div>
  );
}

export default function DetourApp() {
  const [view, setView] = useState<View>("discover");
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [saved, setSaved] = useState<string[]>([]);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<Topic>("All people");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [toast, setToast] = useState("");
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const stored = JSON.parse(raw);
        const p = stored.profile;
        if (
          p &&
          typeof p.name === "string" &&
          typeof p.offer === "string" &&
          typeof p.ask === "string" &&
          typeof p.available === "boolean" &&
          ["In person", "Text first"].includes(p.mode) &&
          !validateProfile(p)
        )
          setProfile(p);
        if (Array.isArray(stored.saved))
          setSaved([
            ...new Set<string>(
              stored.saved.filter(
                (id: unknown): id is string =>
                  typeof id === "string" &&
                  (id === "circle" ||
                    people.some((person) => person.id === id)),
              ),
            ),
          ]);
      }
    } catch {
      setStorageError(true);
    }
    if (new URLSearchParams(window.location.search).get("invite") === "circle")
      setOverlay({ type: "circle" });
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ profile, saved }));
    } catch {
      setStorageError(true);
    }
  }, [profile, saved, ready]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 4500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const visiblePeople = filterPeople(people, query, topic, availableOnly);
  const savedPeople = people.filter((person) => saved.includes(person.id));
  const circleSaved = saved.includes("circle");
  const originalCircleFits =
    profile.offer === defaultProfile.offer &&
    profile.ask === defaultProfile.ask;

  function navigate(next: View) {
    setView(next);
    requestAnimationFrame(() =>
      headingRef.current?.focus({ preventScroll: true }),
    );
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function saveDetour(id: string) {
    setSaved((current) => (current.includes(id) ? current : [...current, id]));
    setOverlay(null);
    setToast("Detour saved. Find it in My detours.");
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
            className="flex items-center gap-2.5 rounded-full text-sm"
            aria-label="Edit your introduction"
          >
            <span className="hidden md:inline">
              Hey, {profile.name.split(" ")[0]}
            </span>
            <Avatar
              initials={profile.name.slice(0, 2).toUpperCase()}
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
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <MapPinIcon size={16} />
            <span className="font-medium">Cloud Native Hackathon</span>
            <span className="text-muted-foreground">/ Salt Lake City</span>
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-accent" />
            Demo playground
          </span>
        </div>

        {view === "discover" && (
          <>
            <section className="flex items-center justify-between gap-8 pb-10 pt-3 sm:pb-12 sm:pt-5">
              <div>
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="max-w-3xl font-display text-5xl font-medium leading-none tracking-tight outline-none sm:text-6xl lg:text-7xl"
                >
                  Good things happen
                  <br className="hidden sm:block" /> off the agenda.
                </h1>
                <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                  A fresh perspective. A problem unstuck. Your next
                  collaborator.
                  <br className="hidden md:block" /> Take a little detour and
                  see who you find.
                </p>
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
                    {originalCircleFits
                      ? "A detour worth taking"
                      : "An example of a good detour"}
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
                        You each have a missing piece. You just haven’t met yet.
                      </p>
                    </div>
                    <UsersThreeIcon
                      size={32}
                      weight="light"
                      className="hidden shrink-0 sm:block"
                    />
                  </div>
                  <CircleDiagram
                    profile={originalCircleFits ? profile : defaultProfile}
                  />
                  <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPinIcon size={16} />
                      Coffee bar<span aria-hidden="true">/</span>Low pressure,
                      good company
                    </p>
                    <button
                      className="button-primary"
                      onClick={() => setOverlay({ type: "circle" })}
                    >
                      {circleSaved ? "View your circle" : "Meet your circle"}
                      <ArrowUpRightIcon size={18} />
                    </button>
                  </div>
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
                      className="-mr-2 inline-flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-background"
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
                      <p className="text-sm leading-relaxed">{profile.offer}</p>
                    </div>
                    <div>
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MagnifyingGlassIcon size={13} />
                        You’re looking for
                      </p>
                      <p className="text-sm leading-relaxed">{profile.ask}</p>
                    </div>
                  </div>
                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
                    <label className="flex cursor-pointer items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={profile.available}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            available: e.target.checked,
                          })
                        }
                        className="size-4 accent-success"
                      />
                      Open to a detour
                    </label>
                    <span className="text-xs text-muted-foreground">
                      {profile.mode}
                    </span>
                  </div>
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
                    Start with something you can give. Or something you’re
                    curious about.
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
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Try Kubernetes, design, AI…"
                    className="field py-3 pl-10 text-sm"
                  />
                </div>
              </div>
              <div className="mb-6 mt-6 flex flex-wrap items-center justify-between gap-4">
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="Filter by interest"
                >
                  {topics.map((item) => (
                    <button
                      key={item}
                      onClick={() => setTopic(item)}
                      aria-pressed={topic === item}
                      className={`min-h-10 rounded-full border px-4 py-2 text-xs font-medium transition-colors ${topic === item ? "border-foreground bg-foreground text-background" : "border-border hover:border-muted-foreground"}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
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
              {visiblePeople.length > 0 ? (
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
                    A little further off the beaten path.
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                    No one matches these filters yet. Try a broader skill or
                    explore everyone here.
                  </p>
                  <button
                    onClick={clearFilters}
                    className="button-secondary mt-5"
                  >
                    Clear filters
                    <ArrowUUpLeftIcon size={17} />
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
              Keep the connections you’re curious about in one place. Saved
              here, ready when you are.
            </p>
            {saved.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-16 text-center">
                <span className="mx-auto mb-5 flex size-20 items-center justify-center rounded-full bg-secondary">
                  <ArrowBendDownRightIcon size={38} weight="light" />
                </span>
                <h2 className="text-3xl font-medium">
                  Your route is wide open.
                </h2>
                <p className="mx-auto mt-3 max-w-sm px-4 text-sm leading-relaxed text-muted-foreground">
                  Meet a circle or save someone you’d like to talk to. Your
                  first detour starts with a little curiosity.
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
                          Your sample circle
                        </p>
                        <h2 className="text-3xl font-medium">
                          You, Cara & Ben.
                        </h2>
                      </div>
                      <span className="inline-flex items-center gap-2 rounded-full bg-success-subtle px-3 py-1.5 text-xs">
                        <CheckCircleIcon size={16} />
                        Saved for later
                      </span>
                    </div>
                    <CircleDiagram
                      profile={originalCircleFits ? profile : defaultProfile}
                    />
                    <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
                      <button
                        className="text-link text-muted-foreground"
                        onClick={() => removeDetour("circle")}
                      >
                        Remove saved circle
                      </button>
                      <button
                        className="button-primary"
                        onClick={() => setOverlay({ type: "circle" })}
                      >
                        See the plan
                        <ArrowRightIcon size={18} />
                      </button>
                    </div>
                  </article>
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
            <ShareCard profile={profile} notify={setToast} />
          </section>
        )}

        {storageError && (
          <p
            role="alert"
            className="mt-6 rounded-lg bg-accent-subtle p-4 text-sm"
          >
            Your browser couldn’t save changes on this device. You can keep
            exploring; your changes may be lost when you close this page.
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
            className="min-h-9 text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Sample people. Real possibilities.
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
            setProfile(next);
            setOverlay(null);
            setToast("Your introduction is saved.");
          }}
        />
      )}
      {overlay?.type === "circle" && (
        <Modal
          title="Three people. A little possibility."
          onClose={() => setOverlay(null)}
        >
          <p className="mb-6 leading-relaxed text-muted-foreground">
            A model to ship, a dashboard to improve, a fresh perspective to
            share. Here’s how this sample circle fits together.
          </p>
          <div className="space-y-3">
            {[
              {
                name: "Ben → you",
                color: "lilac",
                text: "Walk through a first Kubernetes deployment.",
              },
              {
                name: "You → Cara",
                color: "sage",
                text: "Explore a faster on-device model.",
              },
              {
                name: "Cara → Ben",
                color: "peach",
                text: "Give the dashboard an accessibility check.",
              },
            ].map((item) => (
              <div
                key={item.name}
                className="flex items-start gap-3 rounded-lg bg-surface p-4"
              >
                <span
                  className={`mt-1 size-3 shrink-0 rounded-full ${colors[item.color as Person["color"]]}`}
                />
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {item.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="my-6 flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-2">
              <ClockIcon size={18} />
              10 minutes
            </span>
            <span className="flex items-center gap-2">
              <MapPinIcon size={18} />
              Coffee bar
            </span>
            <span className="flex items-center gap-2">
              <ChatCircleDotsIcon size={18} />
              {profile.mode}
            </span>
          </div>
          <div className="rounded-xl bg-success-subtle p-5">
            <p className="text-xs text-muted-foreground">
              A good place to start
            </p>
            <p className="mt-2 font-display text-xl leading-snug">
              “What’s the one thing you’d love to get unstuck today?”
            </p>
          </div>
          <button
            onClick={() => saveDetour("circle")}
            className="button-primary mt-6 w-full"
          >
            {circleSaved ? "Keep this detour saved" : "Save this detour"}
            <BookmarkSimpleIcon size={18} />
          </button>
          <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
            A sample plan, saved on this device. No invitations are sent.
          </p>
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
              : "In a workshop right now"}
          </p>
          <div className={`rounded-xl p-5 ${colors[overlay.person.color]}`}>
            <p className="text-xs text-muted-foreground">Break the ice</p>
            <p className="mt-2 font-display text-xl leading-snug">
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
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Fictional attendee for this demo. No messages are sent.
          </p>
        </Modal>
      )}
      {overlay?.type === "about" && (
        <Modal title="Take the scenic route." onClose={() => setOverlay(null)}>
          <p className="leading-relaxed text-muted-foreground">
            The best part of a conference often isn’t on the schedule. Detour
            helps you find a reason to start a conversation.
          </p>
          <ol className="my-7 space-y-6">
            {[
              {
                title: "Bring something.",
                text: "A skill, a fresh pair of eyes, or a good question. Tell people what you can share and what you’re figuring out.",
              },
              {
                title: "Find your missing piece.",
                text: "Explore people with different skills, or a small circle where everyone can help someone else.",
              },
              {
                title: "See where it goes.",
                text: "Start with ten minutes and one question. Leave with a useful perspective and a reason to stay in touch.",
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
            You’re exploring a working UI prototype with fictional attendees.
            Profiles and saved detours stay in your browser. Matching, on-device
            AI, and live invitations will come with the connected version.
          </p>
        </Modal>
      )}
    </div>
  );
}
