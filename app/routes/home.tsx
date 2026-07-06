import { Shuffle } from "lucide-react";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import { isLikeAction } from "~/lib/should-revalidate";
import { CharacterImageCard } from "~/components/CharacterImageCard";
import { ItemSearchForm } from "~/components/ItemSearchForm";
import { RankingSidebar } from "~/components/RankingSidebar";
import { TopRankingBanner } from "~/components/TopRankingBanner";
import { decodeItemEntry } from "~/lib/item-search-params";
import {
  getCoordiStats,
  getLikedRanking,
  getRandomCoordi,
  isLikedByUser,
  searchCoordiByItems,
} from "~/services/coordi-service.server";
import type { GenderFilter, ItemSearchEntry, RankingPeriod } from "~/types/coordi";
import type { Route } from "./+types/home";

/** 사이드바 랭킹 섹션에 노출할 순위 범위(4~10위). 1~3위는 TopRankingBanner가 담당한다. */
const RANKING_OFFSET = 3;
const RANKING_LIMIT = 7;
const TOP_BANNER_LIMIT = 3;
const RANDOM_SAMPLE_SIZE = 20;

function parseItems(searchParams: URLSearchParams): ItemSearchEntry[] {
  return searchParams
    .getAll("item")
    .map(decodeItemEntry)
    .filter((entry): entry is ItemSearchEntry => entry !== null);
}

/** "15시 24분"처럼 한국 시간 기준 시:분만 뽑아낸다. */
function formatUpdatedAt(iso: string): string {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).formatToParts(new Date(iso));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}시 ${minute}분`;
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const items = parseItems(url.searchParams);
  const gender = (url.searchParams.get("gender") as GenderFilter) || "all";
  const period = (url.searchParams.get("period") as RankingPeriod) || "today";
  const hasSearched = items.length > 0;

  const [displayResults, ranking, topRanking, stats] = await Promise.all([
    hasSearched
      ? searchCoordiByItems({ items, gender })
      : getRandomCoordi(RANDOM_SAMPLE_SIZE, gender),
    getLikedRanking(period, RANKING_LIMIT, RANKING_OFFSET),
    getLikedRanking("weekly", TOP_BANNER_LIMIT),
    getCoordiStats(),
  ]);

  const likedMap = Object.fromEntries(
    [...displayResults, ...ranking, ...topRanking].map((entry) => [entry.id, isLikedByUser(entry.id)]),
  );

  return { items, gender, period, hasSearched, displayResults, ranking, topRanking, likedMap, stats };
}

export function shouldRevalidate(args: ShouldRevalidateFunctionArgs) {
  // 좋아요 버튼은 카드 자체 상태로만 반영하면 되므로, 이 때문에 무작위 목록/랭킹을
  // 다시 불러와 화면 전체가 리셔플되는 걸 막는다.
  if (isLikeAction(args)) return false;
  return args.defaultShouldRevalidate;
}

export const meta: Route.MetaFunction = ({ data }) => {
  const hasSearched = (data?.items.length ?? 0) > 0;
  const title = hasSearched
    ? `"${data?.items.map((entry) => entry.keyword).join(", ")}" 아이템 코디 검색 | 코디랭킹`
    : "아이템으로 코디 찾기 | 코디랭킹";
  const description =
    "메이플스토리 아이템 이름으로 착용 캐릭터의 코디 이미지를 검색하고, 마음에 드는 코디에 좋아요를 눌러 랭킹을 만들어보세요.";

  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
  ];
};

export default function Home({ loaderData }: Route.ComponentProps) {
  const { items, gender, period, hasSearched, displayResults, ranking, topRanking, likedMap, stats } = loaderData;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
      <section>
        <div className="mb-6">
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">아이템으로 코디 찾기</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            아이템 이름을 입력하고 Enter를 누르면 그 아이템을 착용한 캐릭터의 코디 이미지를 모아
            보여드려요.
          </p>
        </div>

        <TopRankingBanner items={topRanking} likedMap={likedMap} />

        <ItemSearchForm initialItems={items} initialGender={gender} />

        <div className="mt-6">
          {!hasSearched && (
            <div className="mb-3 space-y-1">
              <p className="flex items-center gap-1.5 text-sm text-gray-400">
                <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
                무작위로 뽑아본 코디예요. 새로고침을 누르면 다른 코디를 볼 수 있어요.
              </p>
              <p className="text-xs text-gray-400">
                현재 캐릭터 갯수 : {stats.totalCount.toLocaleString("ko-KR")}개
                {stats.lastUpdatedAt && ` (최근 업데이트 ${formatUpdatedAt(stats.lastUpdatedAt)})`}
              </p>
            </div>
          )}

          {hasSearched && displayResults.length === 0 ? (
            <p className="py-16 text-center text-gray-400">조건에 맞는 코디를 찾지 못했어요.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {displayResults.map((entry) => (
                <li key={entry.id}>
                  <CharacterImageCard
                    entry={entry}
                    initiallyLiked={likedMap[entry.id] ?? false}
                    linkToDetail
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <RankingSidebar period={period} items={ranking} likedMap={likedMap} />
    </main>
  );
}
