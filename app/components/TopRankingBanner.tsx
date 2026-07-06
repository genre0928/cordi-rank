import { Crown } from "lucide-react";
import { CharacterImageCard } from "~/components/CharacterImageCard";
import type { CoordiEntry } from "~/types/coordi";

/**
 * 검색창 위에 노출되는 이번 주 좋아요 상위 1~3위 배너.
 * 기존 사이드바 랭킹 섹션은 이 배너와 중복되지 않도록 4~10위만 보여준다.
 */
export function TopRankingBanner({
  items,
  likedMap,
}: {
  items: CoordiEntry[];
  likedMap: Record<string, boolean>;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
      <h2 className="flex items-center gap-1.5 text-sm font-bold text-amber-700 dark:text-amber-400">
        <Crown className="h-4 w-4" aria-hidden="true" />
        이번 주 좋아요 TOP 3
      </h2>
      <ul className="mt-3 grid grid-cols-3 gap-3">
        {items.map((entry, idx) => (
          <li key={entry.ocid}>
            <CharacterImageCard
              entry={entry}
              rank={idx + 1}
              initiallyLiked={likedMap[entry.ocid] ?? false}
              linkToDetail
              showName
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
