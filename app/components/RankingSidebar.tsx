import { Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { CharacterImageCard } from "~/components/CharacterImageCard";
import { cn } from "~/lib/cn";
import type { CoordiEntry, RankingPeriod } from "~/types/coordi";

const PERIOD_OPTIONS: { value: RankingPeriod; label: string }[] = [
  { value: "today", label: "오늘" },
  { value: "weekly", label: "이번 주" },
  { value: "monthly", label: "이번 달" },
];

interface RankingResponse {
  period: RankingPeriod;
  ranking: CoordiEntry[];
  likedMap: Record<string, boolean>;
}

export function RankingSidebar({
  period: initialPeriod,
  items: initialItems,
  likedMap: initialLikedMap,
}: {
  period: RankingPeriod;
  items: CoordiEntry[];
  likedMap: Record<string, boolean>;
}) {
  const fetcher = useFetcher<RankingResponse>();

  const [period, setPeriod] = useState(initialPeriod);
  const [items, setItems] = useState(initialItems);
  const [likedMap, setLikedMap] = useState(initialLikedMap);

  // 다른 곳(예: 좋아요 버튼)에서 이 라우트가 revalidate되어도 랭킹 섹션은 그대로 두고,
  // 기간 탭을 눌렀을 때만 /api/ranking으로 이 섹션만 새로 받아온다.
  useEffect(() => {
    if (fetcher.data && fetcher.data.period === period) {
      setItems(fetcher.data.ranking);
      setLikedMap(fetcher.data.likedMap);
    }
  }, [fetcher.data, period]);

  function selectPeriod(next: RankingPeriod) {
    if (next === period) return;
    setPeriod(next);
    fetcher.load(`/api/ranking?period=${next}`);
  }

  return (
    <aside className="mt-10 lg:mt-0">
      <h2 className="flex items-center gap-1.5 text-lg font-bold">
        <Trophy className="h-5 w-5 text-amber-500" aria-hidden="true" />
        좋아요 랭킹
      </h2>

      <div
        role="tablist"
        aria-label="랭킹 기간"
        className="mt-3 flex flex-nowrap gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {PERIOD_OPTIONS.map((option) => {
          const isActive = option.value === period;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => selectPeriod(option.value)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                isActive
                  ? "border-orange-500 bg-orange-500 text-white shadow-sm"
                  : "border-gray-200 bg-white text-gray-600 hover:border-orange-300 hover:text-orange-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-gray-400">아직 좋아요를 받은 코디가 없어요.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-2">
          {items.map((entry, idx) => (
            <li key={entry.ocid}>
              <CharacterImageCard
                entry={entry}
                rank={idx + 4}
                initiallyLiked={likedMap[entry.ocid] ?? false}
                linkToDetail
                showName
              />
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
