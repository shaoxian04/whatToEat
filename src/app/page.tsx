import Link from "next/link";

const MODES = [
  {
    href: "/surprise",
    emoji: "🎲",
    label: "Surprise me",
    sub: "Roll the dice on a nearby spot",
    badge: "bg-tomato",
    arrow: "text-tomato-ink",
    tint: "hover:bg-tomato/10",
  },
  {
    href: "/browse",
    emoji: "🔍",
    label: "Browse nearby",
    sub: "Filter by price, rating & distance",
    badge: "bg-mustard",
    arrow: "text-mustard-ink",
    tint: "hover:bg-mustard/20",
  },
  {
    href: "/vote",
    emoji: "🗳️",
    label: "Quick group vote",
    sub: "Throw out options, settle it together",
    badge: "bg-herb",
    arrow: "text-herb-ink",
    tint: "hover:bg-herb/10",
  },
];

export default function Home() {
  return (
    <main className="placemat mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-7 px-5 py-10">
      <header className="flex flex-col gap-4">
        <span className="tile-sm w-fit bg-paper-2 px-3 py-1 font-mono text-xs font-semibold uppercase tracking-widest">
          🍜 whatToEat
        </span>
        <h1 className="font-display text-[2.7rem] font-extrabold leading-[0.98] tracking-tight">
          what&rsquo;s it gonna <span className="swipe">be</span> today?
        </h1>
        <p className="text-[0.95rem] text-ink-soft">
          Three ways to kill the lunch debate — pick your move.
        </p>
      </header>

      <nav className="flex flex-col gap-4">
        {MODES.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className={`group tile tile-press flex items-center gap-4 bg-white p-4 ${m.tint}`}
          >
            <span
              className={`grid size-14 shrink-0 place-items-center rounded-2xl border-[2.5px] border-ink ${m.badge} text-2xl`}
            >
              <span className="wobble inline-block">{m.emoji}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-xl font-bold leading-tight">{m.label}</span>
              <span className="block text-sm text-ink-soft">{m.sub}</span>
            </span>
            <span className={`text-2xl font-black ${m.arrow}`} aria-hidden="true">
              →
            </span>
          </Link>
        ))}
      </nav>

      <p className="text-center font-mono text-xs text-ink-soft">for you &amp; your hungry coworkers</p>
    </main>
  );
}
