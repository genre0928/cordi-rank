import { Palette, Search, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { FACE_ICON_URL, HAIR_ICON_URL } from "~/services/item-catalog-service";
import type {
  DyeRanking,
  ItemSearchStat,
  PrismRanking,
  StatTarget,
  StatTargetKind,
} from "~/types/coordi";

function targetIconUrl(target: StatTarget): string | null {
  if (target.kind === "hair") return HAIR_ICON_URL;
  if (target.kind === "face") return FACE_ICON_URL;
  return target.iconUrl ?? null;
}

function targetKindLabel(kind: StatTargetKind): string {
  if (kind === "hair") return "헤어";
  if (kind === "face") return "성형";
  return "아이템";
}

/** 예: "파란색 계열 (H110 S90 V80)" */
function formatPrismCombo(entry: PrismRanking["ranking"][number]): string {
  const label = entry.colorRange ?? "색상 정보 없음";
  return `${label} (H${entry.hue ?? "-"} S${entry.saturation ?? "-"} V${entry.value ?? "-"})`;
}

/** 예: "애쉬 브라운 + 웜 베이지 (50%)" */
function formatDyeCombo(entry: DyeRanking["ranking"][number]): string {
  if (!entry.baseColor) return "정보 없음";
  if (!entry.mixColor || entry.mixRate == null) return entry.baseColor;
  return `${entry.baseColor} + ${entry.mixColor} (${entry.mixRate}%)`;
}

interface RankingApiResponse {
  kind: StatTargetKind;
  name: string;
  dye: DyeRanking | null;
  prism: PrismRanking | null;
}

/**
 * 홈 화면 통계 섹션. 두 부분으로 구성된다.
 * 1) 가장 많이 검색된 아이템 TOP 5 (item_search_counts 집계).
 * 2) 아이템/헤어/성형 이름을 검색하면 그 프리즘(색상 계열+HSV) 또는 염색(기본색+혼합색+비율)
 *    조합별 순위를 보여주는 자체 미니 검색 위젯. 메인 코디 검색창과는 별개로 동작한다.
 */
export function RankingSidebar({ topSearchedItems }: { topSearchedItems: ItemSearchStat[] }) {
  const suggestionFetcher = useFetcher<{ query: string; suggestions: StatTarget[] }>();
  const rankingFetcher = useFetcher<RankingApiResponse>();

  const [inputValue, setInputValue] = useState("");
  const [selected, setSelected] = useState<StatTarget | null>(null);

  const trimmedInput = inputValue.trim();
  const suggestions =
    suggestionFetcher.data?.query === trimmedInput ? suggestionFetcher.data.suggestions : [];

  useEffect(() => {
    if (trimmedInput.length === 0) return;
    const timer = setTimeout(() => {
      suggestionFetcher.load(`/api/stat-suggestions?q=${encodeURIComponent(trimmedInput)}`);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedInput]);

  function selectTarget(target: StatTarget) {
    setSelected(target);
    setInputValue("");
    rankingFetcher.load(`/api/prism-ranking?kind=${target.kind}&name=${encodeURIComponent(target.name)}`);
  }

  const result = rankingFetcher.data;
  const isLoadingRanking = rankingFetcher.state !== "idle";
  const selectedIconUrl = selected ? targetIconUrl(selected) : null;

  return (
    <aside className="mt-10 space-y-8 lg:mt-0">
      <section>
        <h2 className="flex items-center gap-1.5 text-lg font-bold">
          <Trophy className="h-5 w-5 text-amber-500" aria-hidden="true" />
          가장 많이 검색된 아이템
        </h2>

        {topSearchedItems.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">아직 검색 기록이 없어요.</p>
        ) : (
          <ol className="mt-3 space-y-1.5">
            {topSearchedItems.map((item, idx) => (
              <li
                key={item.name}
                className="flex items-center gap-2 rounded-lg border border-gray-100 px-2.5 py-1.5 dark:border-gray-800"
              >
                <span className="w-4 shrink-0 text-center text-sm font-bold text-gray-400">{idx + 1}</span>
                {item.iconUrl ? (
                  <img src={item.iconUrl} alt="" className="h-6 w-6 shrink-0 object-contain" loading="lazy" />
                ) : (
                  <span className="h-6 w-6 shrink-0" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-200">
                  {item.name}
                </span>
                <span className="shrink-0 text-xs text-gray-400">
                  {item.searchCount.toLocaleString("ko-KR")}회
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h2 className="flex items-center gap-1.5 text-lg font-bold">
          <Palette className="h-5 w-5 text-amber-500" aria-hidden="true" />
          프리즘 · 염색 순위
        </h2>
        <p className="mt-1 text-xs text-gray-400">아이템/헤어/성형 이름을 검색해보세요.</p>

        <div className="relative mt-3">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-300"
            aria-hidden="true"
          />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="아이템/헤어/성형 이름"
            aria-label="프리즘 염색 순위 검색어"
            autoComplete="off"
            className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-orange-400 dark:border-gray-700 dark:bg-gray-900"
          />
        </div>

        {trimmedInput.length > 0 && suggestions.length > 0 && (
          <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-100 dark:divide-gray-800 dark:border-gray-800">
            {suggestions.map((target) => {
              const iconUrl = targetIconUrl(target);
              return (
                <li key={`${target.kind}-${target.name}`}>
                  <button
                    type="button"
                    onClick={() => selectTarget(target)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-orange-50 dark:hover:bg-gray-800"
                  >
                    {iconUrl ? (
                      <img src={iconUrl} alt="" className="h-5 w-5 shrink-0 object-contain" loading="lazy" />
                    ) : (
                      <span className="h-5 w-5 shrink-0" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-200">
                      {target.name}
                    </span>
                    <span className="shrink-0 text-xs text-gray-400">{targetKindLabel(target.kind)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {selected && (
          <div className="mt-4 rounded-lg border border-gray-100 p-3 dark:border-gray-800">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">
              {selectedIconUrl && <img src={selectedIconUrl} alt="" className="h-5 w-5 object-contain" />}
              {selected.name}
            </p>

            {isLoadingRanking ? (
              <p className="mt-2 text-xs text-gray-400">불러오는 중...</p>
            ) : result?.prism ? (
              result.prism.ranking.length === 0 ? (
                <p className="mt-2 text-xs text-gray-400">프리즘 적용 사례가 없어요.</p>
              ) : (
                <>
                  <p className="mt-2 text-xs text-gray-400">
                    프리즘 적용 {result.prism.prismAppliedCount.toLocaleString("ko-KR")}/
                    {result.prism.totalCount.toLocaleString("ko-KR")}건
                  </p>
                  <ol className="mt-1.5 space-y-1">
                    {result.prism.ranking.map((entry, idx) => (
                      <li key={idx} className="flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 flex-1 truncate text-gray-600 dark:text-gray-300">
                          {idx + 1}. {formatPrismCombo(entry)}
                        </span>
                        <span className="shrink-0 font-medium text-orange-500">{entry.percentage}%</span>
                      </li>
                    ))}
                  </ol>
                </>
              )
            ) : result?.dye ? (
              result.dye.ranking.length === 0 ? (
                <p className="mt-2 text-xs text-gray-400">색상 정보가 없어요.</p>
              ) : (
                <>
                  <p className="mt-2 text-xs text-gray-400">
                    총 {result.dye.totalCount.toLocaleString("ko-KR")}건
                  </p>
                  <ol className="mt-1.5 space-y-1">
                    {result.dye.ranking.map((entry, idx) => (
                      <li key={idx} className="flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 flex-1 truncate text-gray-600 dark:text-gray-300">
                          {idx + 1}. {formatDyeCombo(entry)}
                        </span>
                        <span className="shrink-0 font-medium text-orange-500">{entry.percentage}%</span>
                      </li>
                    ))}
                  </ol>
                </>
              )
            ) : null}
          </div>
        )}
      </section>
    </aside>
  );
}
