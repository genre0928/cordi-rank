import { Palette, Trophy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { CoordiPortrait } from "~/components/CoordiPortrait";
import { useCoordiModal } from "~/context/coordi-modal";
import { cn } from "~/lib/cn";
import type {
  CoordiEntry,
  DyeRanking,
  ItemSearchKind,
  ItemSearchStat,
  PrismRanking,
  SearchColorInfo,
} from "~/types/coordi";

function kindLabel(kind: ItemSearchKind): string {
  if (kind === "hair") return "헤어";
  if (kind === "face") return "성형";
  if (kind === "skin") return "피부";
  return "아이템";
}

/** 예: "색110채90명80 24%" */
function formatPrismCombo(entry: PrismRanking["ranking"][number]): string {
  return `색${entry.hue ?? "-"}채${entry.saturation ?? "-"}명${entry.value ?? "-"} ${entry.percentage}%`;
}

/** 예: "(초41:갈59) 24%". 혼합색이 없으면 기본색 하나만(100%로 취급). */
function formatDyeCombo(entry: DyeRanking["ranking"][number]): string {
  if (!entry.baseColor) return `정보 없음 ${entry.percentage}%`;
  const baseAbbr = entry.baseColor.charAt(0);
  if (!entry.mixColor || entry.mixRate == null) {
    return `(${baseAbbr}100) ${entry.percentage}%`;
  }
  const mixAbbr = entry.mixColor.charAt(0);
  const baseShare = 100 - entry.mixRate;
  return `(${baseAbbr}${baseShare}:${mixAbbr}${entry.mixRate}) ${entry.percentage}%`;
}

/**
 * 색상 조합 한 줄. hover(데스크톱) 또는 탭(모바일)하면 그 조합과 정확히 일치하는
 * 코디 카드들을 아래에 작은 미리보기로 띄운다. entryIds는 조합당 최대
 * COMBO_PREVIEW_SAMPLE_SIZE개만 들고 있으므로(서비스 레이어 주석 참고), 처음 열 때
 * 딱 한 번만 그 id들의 상세 정보를 가져온다(/api/liked-coordi가 getCoordiByIds를 그대로
 * 재사용하는 범용 라우트라 여기서도 그대로 쓴다).
 */
function ComboRow({ index, label, entryIds }: { index: number; label: string; entryIds: number[] }) {
  const fetcher = useFetcher<{ entries: CoordiEntry[] }>();
  const { open } = useCoordiModal();
  const [forceShow, setForceShow] = useState(false);
  const rowRef = useRef<HTMLLIElement>(null);
  const loadedRef = useRef(false);

  function ensureLoaded() {
    if (loadedRef.current || entryIds.length === 0) return;
    loadedRef.current = true;
    fetcher.load(`/api/liked-coordi?ids=${entryIds.join(",")}`);
  }

  // 모바일에서 미리보기를 연 채로 바깥을 탭하면 닫히게 한다.
  useEffect(() => {
    if (!forceShow) return;
    function handleOutsideClick(event: MouseEvent) {
      if (!rowRef.current?.contains(event.target as Node)) setForceShow(false);
    }
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [forceShow]);

  if (entryIds.length === 0) {
    return (
      <li className="text-xs text-gray-600 dark:text-gray-300">
        {index + 1}. {label}
      </li>
    );
  }

  return (
    <li
      ref={rowRef}
      onMouseEnter={ensureLoaded}
      className="group/combo relative hover:z-20"
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          ensureLoaded();
          setForceShow((current) => !current);
        }}
        aria-pressed={forceShow}
        aria-label={`${label} 코디 미리보기`}
        className="w-full rounded px-0.5 text-left text-xs text-gray-600 transition hover:text-orange-500 dark:text-gray-300"
      >
        {index + 1}. {label}
      </button>

      <div
        className={cn(
          "pointer-events-none absolute left-0 top-full z-30 mt-1 w-60 max-w-[85vw] rounded-lg bg-black/90 p-2 opacity-0 shadow-xl transition-opacity duration-150",
          "group-hover/combo:pointer-events-auto group-hover/combo:opacity-100",
          forceShow && "pointer-events-auto opacity-100",
        )}
      >
        {!fetcher.data ? (
          <p className="p-1 text-center text-[11px] text-white/60">불러오는 중...</p>
        ) : fetcher.data.entries.length === 0 ? (
          <p className="p-1 text-center text-[11px] text-white/60">표시할 코디가 없어요.</p>
        ) : (
          <div className="grid grid-cols-4 gap-1">
            {fetcher.data.entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  open(entry.id);
                }}
                aria-label={`${entry.characterName} 코디 상세보기`}
                className="aspect-[3/4] overflow-hidden rounded"
              >
                <CoordiPortrait entry={entry} />
              </button>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

function SearchColorInfoCard({ info }: { info: SearchColorInfo }) {
  return (
    <div className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">
        <span className="min-w-0 flex-1 truncate">{info.keyword}</span>
        <span className="shrink-0 text-xs font-normal text-gray-400">{kindLabel(info.kind)}</span>
      </p>

      {info.prism ? (
        info.prism.ranking.length === 0 ? (
          <p className="mt-2 text-xs text-gray-400">
            {info.kind === "skin" ? "커스텀 색상 적용 사례가 없어요." : "프리즘 적용 사례가 없어요."}
          </p>
        ) : (
          <>
            <p className="mt-2 text-xs text-gray-400">
              {info.kind === "skin" ? "커스텀 색상 적용" : "프리즘 적용"}{" "}
              {info.prism.prismAppliedCount.toLocaleString("ko-KR")}/{info.prism.totalCount.toLocaleString("ko-KR")}건
            </p>
            <ol className="mt-1.5 space-y-2.5">
              {info.prism.ranking.map((entry, idx) => (
                <ComboRow
                  key={idx}
                  index={idx}
                  label={formatPrismCombo(entry)}
                  entryIds={entry.entryIds}
                />
              ))}
            </ol>
          </>
        )
      ) : info.dye ? (
        info.dye.ranking.length === 0 ? (
          <p className="mt-2 text-xs text-gray-400">색상 정보가 없어요.</p>
        ) : (
          <>
            <p className="mt-2 text-xs text-gray-400">총 {info.dye.totalCount.toLocaleString("ko-KR")}건</p>
            <ol className="mt-1.5 space-y-2.5">
              {info.dye.ranking.map((entry, idx) => (
                <ComboRow key={idx} index={idx} label={formatDyeCombo(entry)} entryIds={entry.entryIds} />
              ))}
            </ol>
          </>
        )
      ) : null}
    </div>
  );
}

/**
 * 홈 화면 통계 섹션. 두 부분으로 구성된다.
 * 1) 가장 많이 검색된 아이템 TOP 5 (item_search_counts 집계).
 * 2) 왼쪽 검색창에 지금 걸린 검색어들의 색상 정보 — 아이템/피부는 색조·채도·명도 조합
 *    순위를, 헤어/성형은 기본색+혼합색 비율 조합 순위를 보여준다. 예전엔 이 섹션 자체가
 *    독립된 검색창이었지만, 왼쪽 검색과 별개로 또 검색해야 하는 게 번거로워 왼쪽 검색
 *    상태를 그대로 반영하도록 바꿨다(별도 fetcher 없이 loader가 내려주는 데이터를 그대로 씀).
 *    각 조합 줄은 hover/탭하면 그 조합과 일치하는 코디를 미리보기로 보여준다(ComboRow).
 */
export function RankingSidebar({
  topSearchedItems,
  searchColorInfo,
}: {
  topSearchedItems: ItemSearchStat[];
  searchColorInfo: SearchColorInfo[];
}) {
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

        {searchColorInfo.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">
            왼쪽에서 아이템/헤어/성형/피부를 검색하면 색상 정보를 보여드려요.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {searchColorInfo.map((info) => (
              <SearchColorInfoCard key={`${info.kind}-${info.keyword}`} info={info} />
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}
