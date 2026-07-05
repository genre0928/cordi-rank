import { Crown } from "lucide-react";
import { cn } from "~/lib/cn";

export function RankBadge({ rank }: { rank: number }) {
  const isTopThree = rank <= 3;

  return (
    <span
      className={cn(
        "absolute left-2 top-2 z-10 flex h-7 min-w-7 items-center justify-center gap-1 rounded-full px-2 text-xs font-bold shadow",
        isTopThree ? "bg-amber-400 text-amber-950" : "bg-black/60 text-white",
      )}
    >
      {isTopThree && <Crown className="h-3.5 w-3.5" aria-hidden="true" />}
      {rank}
    </span>
  );
}
