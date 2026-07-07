import { Palette, Trophy } from "lucide-react";
import { ComboDonutChart, type DonutSegment } from "~/components/ComboDonutChart";
import type { DyeRanking, ItemSearchKind, ItemSearchStat, PrismRanking, SearchColorInfo } from "~/types/coordi";

function kindLabel(kind: ItemSearchKind): string {
  if (kind === "hair") return "헤어";
  if (kind === "face") return "성형";
  if (kind === "skin") return "피부";
  return "아이템";
}

/** 부호를 항상 붙이고 자리수를 0으로 채운다 (예: signedPad(96, 3) -> "+096", signedPad(-76, 2) -> "-76"). */
function signedPad(n: number, width: number): string {
  const sign = n < 0 ? "-" : "+";
  return `${sign}${Math.abs(n).toString().padStart(width, "0")}`;
}

/** 예: "색 +110 채 +90 명 +80" (비율은 도넛 차트 숫자로 따로 보여주니 여기엔 안 붙인다). */
function prismComboCaption(entry: PrismRanking["ranking"][number]): string {
  const hue = signedPad(entry.hue ?? 0, 3);
  const saturation = signedPad(entry.saturation ?? 0, 2);
  const value = signedPad(entry.value ?? 0, 2);
  return `색 ${hue} 채 ${saturation} 명 ${value}`;
}

/** 예: "초41:갈59". 혼합색이 없으면 기본색 하나만. */
function dyeComboCaption(entry: DyeRanking["ranking"][number]): string {
  if (!entry.baseColor) return "정보 없음";
  const baseAbbr = entry.baseColor.charAt(0);
  if (!entry.mixColor || entry.mixRate == null) return `${baseAbbr}100`;
  const mixAbbr = entry.mixColor.charAt(0);
  const baseShare = 100 - entry.mixRate;
  return `${baseAbbr}${baseShare}:${mixAbbr}${entry.mixRate}`;
}

/** hue(0~359)를 그대로 HSL 색상값으로 써서, 실제 적용된 색상 계열과 비슷한 색으로 구간을 칠한다. */
function prismSegmentColor(entry: PrismRanking["ranking"][number]): string {
  return `hsl(${entry.hue ?? 0}, 65%, 55%)`;
}

/** 헤어/성형 색상 이름(한국어)을 도넛 구간 색상으로 대략 매핑한다. */
const KOREAN_COLOR_HEX: Record<string, string> = {
  파란색: "#3b82f6",
  빨간색: "#ef4444",
  초록색: "#22c55e",
  보라색: "#a855f7",
  주황색: "#f97316",
  갈색: "#92400e",
  검은색: "#374151",
  노란색: "#eab308",
  자수정: "#8b5cf6",
  에메랄드: "#10b981",
};

function dyeSegmentColor(entry: DyeRanking["ranking"][number]): string {
  return (entry.baseColor && KOREAN_COLOR_HEX[entry.baseColor]) || "#9ca3af";
}

function SearchColorInfoCard({ info }: { info: SearchColorInfo }) {
  const segments: DonutSegment[] | null = info.prism
    ? info.prism.ranking.map((entry) => ({
        modalLabel: `${prismComboCaption(entry)} (${entry.percentage}%)`,
        caption: prismComboCaption(entry),
        percentage: entry.percentage,
        color: prismSegmentColor(entry),
        entryIds: entry.entryIds,
      }))
    : info.dye
      ? info.dye.ranking.map((entry) => ({
          modalLabel: `${dyeComboCaption(entry)} (${entry.percentage}%)`,
          caption: dyeComboCaption(entry),
          percentage: entry.percentage,
          color: dyeSegmentColor(entry),
          entryIds: entry.entryIds,
        }))
      : null;

  return (
    <div className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">
        {info.iconUrl && (
          <img src={info.iconUrl} alt="" className="h-5 w-5 shrink-0 object-contain" loading="lazy" />
        )}
        <span className="min-w-0 flex-1 truncate">{info.keyword}</span>
        <span className="shrink-0 text-xs font-normal text-gray-400">{kindLabel(info.kind)}</span>
      </p>

      {info.prism && info.prism.ranking.length === 0 ? (
        <p className="mt-2 text-xs text-gray-400">
          {info.kind === "skin" ? "커스텀 색상 적용 사례가 없어요." : "프리즘 적용 사례가 없어요."}
        </p>
      ) : info.dye && info.dye.ranking.length === 0 ? (
        <p className="mt-2 text-xs text-gray-400">색상 정보가 없어요.</p>
      ) : segments ? (
        <>
          {info.dye && (
            <p className="mt-2 text-center text-xs text-gray-400">
              총 {info.dye.totalCount.toLocaleString("ko-KR")}건
            </p>
          )}
          <div className="mt-2">
            <ComboDonutChart segments={segments} />
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * 홈 화면 통계 섹션. 두 부분으로 구성된다.
 * 1) 가장 많이 검색된 아이템 TOP 5 (item_search_counts 집계).
 * 2) 왼쪽 검색창에 지금 걸린 검색어들의 색상 정보 — 아이템/피부는 색조·채도·명도 조합
 *    순위를, 헤어/성형은 기본색+혼합색 비율 조합 순위를 도넛 차트로 보여준다. 예전엔 이
 *    섹션 자체가 독립된 검색창이었지만, 왼쪽 검색과 별개로 또 검색해야 하는 게 번거로워
 *    왼쪽 검색 상태를 그대로 반영하도록 바꿨다(별도 fetcher 없이 loader가 내려주는
 *    데이터를 그대로 씀). 차트 구간을 hover하면 가운데 숫자가 그 구간 비율로 바뀌고,
 *    클릭하면 그 조합과 일치하는 코디 모음 모달(ComboCoordiModal)이 뜬다.
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
