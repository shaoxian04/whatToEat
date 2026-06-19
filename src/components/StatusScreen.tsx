import { BackHome } from "@/components/BackHome";

/** Full-screen status message (loading / error / location prompts) with a way back home. */
export function StatusScreen({ emoji, text }: { emoji: string; text: string }) {
  return (
    <main className="placemat mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-5 py-8">
      <BackHome />
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <p className="text-5xl">{emoji}</p>
        <p className="font-display text-xl font-bold">{text}</p>
      </div>
    </main>
  );
}
