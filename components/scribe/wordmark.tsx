import { cn } from "@/lib/utils";

/**
 * The Scribe brand wordmark — "Scribe" set in Cause ExtraBold (800), the app's
 * display face (wired in app/layout.tsx as --font-brand). Size and colour are
 * the caller's job via className; this only fixes the family, weight, and the
 * mild negative tracking that keeps Cause's rounded letterforms from reading
 * too loose at large sizes.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-brand font-extrabold tracking-tight select-none",
        className,
      )}
    >
      Scribe
    </span>
  );
}
