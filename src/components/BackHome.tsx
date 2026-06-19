import Link from "next/link";

/** Consistent "back to home" control shown at the top-left of every non-home screen. */
export function BackHome() {
  return (
    <Link
      href="/"
      className="tile-sm tile-press inline-flex w-fit items-center gap-1.5 bg-white px-3 py-1.5 font-display text-sm font-bold text-ink"
    >
      <span aria-hidden="true">←</span> Home
    </Link>
  );
}
