import { BarChart3, Heart, History, Palette, Trophy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFetcher, useSearchParams } from "react-router";
import { CharacterImageCard } from "~/components/CharacterImageCard";
import { ComboDonutChart, type DonutSegment } from "~/components/ComboDonutChart";
import { cn } from "~/lib/cn";
import { formatSigned, shortColorRangeLabel } from "~/lib/coordi-display-rows";
import { loadLikedIds } from "~/lib/liked-storage";
import { loadRecentlyViewed, type RecentlyViewedItem } from "~/lib/recently-viewed-storage";
import type {
  CoordiEntry,
  DyeRanking,
  ItemSearchKind,
  ItemSearchStat,
  PrismRanking,
  SearchColorInfo,
} from "~/types/coordi";

const PAGE_SIZE = 8;

function kindLabel(kind: ItemSearchKind): string {
  if (kind === "hair") return "헤어";
  if (kind === "face") return "성형";
  if (kind === "skin") return "피부";
  return "아이템";
}

/** 두 줄: 색상 계열 축약("전체", "초록" 등) + 색조/채도/명도. 코디 상세의 프리즘 표기와 형식을 맞췄다. */
function prismComboCaption(entry: PrismRanking["ranking"][number]): string[] {
  const rangeLabel = entry.colorRange ? shortColorRangeLabel(entry.colorRange) : "정보 없음";
  const numbers = [entry.hue, entry.saturation, entry.value].map((n) => formatSigned(n ?? 0)).join(" ");
  return [rangeLabel, numbers];
}

/** 예: "초41:갈59". 혼합색이 없으면 기본색 하나만. */
function dyeComboCaption(entry: DyeRanking["ranking"][number]): string[] {
  if (!entry.baseColor) return ["정보 없음"];
  const baseAbbr = entry.baseColor.charAt(0);
  if (!entry.mixColor || entry.mixRate == null) return [`${baseAbbr}100`];
  const mixAbbr = entry.mixColor.charAt(0);
  const baseShare = 100 - entry.mixRate;
  return [`${baseAbbr}${baseShare}:${mixAbbr}${entry.mixRate}`];
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
        modalLabel: `${prismComboCaption(entry).join(" ")} (${entry.percentage}%)`,
        caption: prismComboCaption(entry),
        percentage: entry.percentage,
        color: prismSegmentColor(entry),
        entryIds: entry.entryIds,
      }))
    : info.dye
      ? info.dye.ranking.map((entry) => ({
          modalLabel: `${dyeComboCaption(entry).join(" ")} (${entry.percentage}%)`,
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

function StatsTab({
  topSearchedItems,
  searchColorInfo,
}: {
  topSearchedItems: ItemSearchStat[];
  searchColorInfo: SearchColorInfo[];
}) {
  return (
    <div className="space-y-8">
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
    </div>
  );
}

/** "3분 전"/"2시간 전"/"5일 전" 형태의 상대 시각. */
function formatRelativeTime(timestamp: number): string {
  const diffMin = Math.floor((Date.now() - timestamp) / 60000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  return `${Math.floor(diffHour / 24)}일 전`;
}

/**
 * "내 좋아요"/"최근 본 캐릭터" 탭이 공유하는 페이징 그리드. 둘 다 로그인이 없어
 * localStorage에만 id 목록이 있고, 상세 정보는 /api/liked-coordi에서 그때그때
 * 가져온다는 점이 같다(그 라우트는 좋아요 전용이 아니라 id로 코디를 조회하는
 * 범용 엔드포인트라 최근 본 탭에도 그대로 쓸 수 있다). 탭이 열릴 때(마운트될
 * 때)마다 localStorage를 다시 읽으므로, 탭을 전환할 때마다 최신 상태로 갱신된다.
 */
function PagedCoordiGrid({
  ids,
  emptyMessage,
  viewedAtById,
}: {
  ids: number[];
  emptyMessage: string;
  viewedAtById?: Map<number, number>;
}) {
  const [page, setPage] = useState(1);
  const fetcher = useFetcher<{ entries: CoordiEntry[] }>();

  const totalCount = ids.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageIds = ids.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageKey = pageIds.join(",");

  useEffect(() => {
    if (pageIds.length === 0) return;
    fetcher.load(`/api/liked-coordi?ids=${encodeURIComponent(pageKey)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey]);

  const entries = pageKey.length === 0 ? [] : (fetcher.data?.entries ?? []);

  if (totalCount === 0) {
    return <p className="mt-3 text-sm text-gray-400">{emptyMessage}</p>;
  }

  return (
    <div className="mt-3">
      <ul className="grid grid-cols-2 gap-3">
        {entries.map((entry) => (
          <li key={entry.id}>
            <CharacterImageCard entry={entry} linkToDetail showName />
            {viewedAtById?.has(entry.id) && (
              <p className="mt-0.5 text-center text-[11px] text-gray-400">
                {formatRelativeTime(viewedAtById.get(entry.id)!)}
              </p>
            )}
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className={cn(
              "rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-500 transition dark:border-gray-700 dark:text-gray-300",
              currentPage <= 1 ? "opacity-40" : "hover:border-orange-300 hover:text-orange-500",
            )}
          >
            이전
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className={cn(
              "rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-500 transition dark:border-gray-700 dark:text-gray-300",
              currentPage >= totalPages ? "opacity-40" : "hover:border-orange-300 hover:text-orange-500",
            )}
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}

function LikedTab() {
  const [likedIds, setLikedIds] = useState<number[] | null>(null);

  useEffect(() => {
    setLikedIds(loadLikedIds());
  }, []);

  return (
    <section>
      <h2 className="flex items-center gap-1.5 text-lg font-bold">
        <Heart className="h-5 w-5 text-red-500" aria-hidden="true" />내 좋아요
      </h2>
      {likedIds === null ? (
        <p className="mt-3 text-sm text-gray-400">불러오는 중...</p>
      ) : (
        <PagedCoordiGrid ids={likedIds} emptyMessage="아직 좋아요한 코디가 없어요." />
      )}
    </section>
  );
}

function RecentTab() {
  const [recent, setRecent] = useState<RecentlyViewedItem[] | null>(null);

  useEffect(() => {
    setRecent(loadRecentlyViewed());
  }, []);

  const ids = recent?.map((item) => item.id) ?? [];
  const viewedAtById = new Map((recent ?? []).map((item) => [item.id, item.viewedAt]));

  return (
    <section>
      <h2 className="flex items-center gap-1.5 text-lg font-bold">
        <History className="h-5 w-5 text-amber-500" aria-hidden="true" />
        최근 본 캐릭터
      </h2>
      {recent === null ? (
        <p className="mt-3 text-sm text-gray-400">불러오는 중...</p>
      ) : (
        <PagedCoordiGrid ids={ids} emptyMessage="아직 본 캐릭터가 없어요." viewedAtById={viewedAtById} />
      )}
    </section>
  );
}

type TabKey = "stats" | "liked" | "recent";

const TABS: { key: TabKey; label: string; icon: typeof BarChart3 }[] = [
  { key: "stats", label: "통계", icon: BarChart3 },
  { key: "liked", label: "내 좋아요", icon: Heart },
  { key: "recent", label: "최근 본 캐릭터", icon: History },
];

/**
 * 우측 사이드바. 통계/내 좋아요/최근 본 캐릭터 3개 탭으로 구성되고 기본은 통계 탭이다.
 * 좋아요·최근 본 탭은 로그인이 없어 이 브라우저의 localStorage만 보고 그리므로,
 * 서버 loader 데이터(topSearchedItems/searchColorInfo)와 무관하게 클라이언트에서만 동작한다.
 * 좋아요/최근 본 탭에 있는 상태에서 왼쪽 검색창으로 새 검색을 하면(쿼리스트링이 바뀌면)
 * 그 검색 결과의 통계를 바로 볼 수 있도록 통계 탭으로 자동 전환한다.
 */
export function RankingSidebar({
  topSearchedItems,
  searchColorInfo,
}: {
  topSearchedItems: ItemSearchStat[];
  searchColorInfo: SearchColorInfo[];
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("stats");
  const [searchParams] = useSearchParams();
  const searchKey = searchParams.toString();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setActiveTab("stats");
  }, [searchKey]);

  return (
    <aside className="mt-10 lg:mt-0">
      <div className="flex gap-1 rounded-full border border-gray-100 p-1 dark:border-gray-800">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 rounded-full px-2 py-1.5 text-xs font-semibold transition",
              activeTab === key
                ? "bg-orange-500 text-white"
                : "text-gray-500 hover:text-orange-500 dark:text-gray-400",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeTab === "stats" && (
          <StatsTab topSearchedItems={topSearchedItems} searchColorInfo={searchColorInfo} />
        )}
        {activeTab === "liked" && <LikedTab />}
        {activeTab === "recent" && <RecentTab />}
      </div>
    </aside>
  );
}
