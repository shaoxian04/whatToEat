import Link from "next/link";

const MODES = [
  { href: "/surprise", emoji: "🎲", label: "Surprise me", sub: "Random nearby pick" },
  { href: "/browse", emoji: "🔍", label: "Browse restaurants", sub: "Filter what's nearby" },
  { href: "/vote", emoji: "✍️", label: "Quick group vote", sub: "Type options, vote now" },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="mb-2 text-center text-3xl font-bold">whatToEat</h1>
      {MODES.map((m) => (
        <Link
          key={m.href}
          href={m.href}
          className="flex items-center gap-4 rounded-2xl border border-gray-200 p-5 shadow-sm active:scale-[0.99]"
        >
          <span className="text-3xl">{m.emoji}</span>
          <span>
            <span className="block text-lg font-semibold">{m.label}</span>
            <span className="block text-sm text-gray-500">{m.sub}</span>
          </span>
        </Link>
      ))}
    </main>
  );
}
