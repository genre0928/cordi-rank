import { Heart } from "lucide-react";
import { cn } from "~/lib/cn";

export function LikeButton({
  liked,
  count,
  onToggle,
  size = "md",
}: {
  liked: boolean;
  count: number;
  onToggle: () => void;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={liked}
      aria-label={liked ? "좋아요 취소" : "좋아요"}
      className={cn(
        "flex items-center gap-1.5 rounded-full border font-semibold transition active:scale-95",
        liked
          ? "border-red-200 bg-red-50 text-red-500 dark:border-red-900 dark:bg-red-950"
          : "border-gray-200 bg-white text-gray-500 hover:border-red-200 hover:text-red-400 dark:border-gray-700 dark:bg-gray-900",
        size === "sm" && "px-2.5 py-1 text-xs",
        size === "md" && "px-3 py-1.5 text-sm",
        size === "lg" && "px-4 py-2 text-base",
      )}
    >
      <Heart
        className={cn(
          size === "sm" && "h-3.5 w-3.5",
          size === "md" && "h-4 w-4",
          size === "lg" && "h-5 w-5",
        )}
        fill={liked ? "currentColor" : "none"}
        aria-hidden="true"
      />
      <span>{count.toLocaleString("ko-KR")}</span>
    </button>
  );
}
