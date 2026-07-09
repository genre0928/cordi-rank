import { searchAppearanceSuggestions, searchCrawledItemSuggestions } from "~/services/coordi-service.server";
import { searchItemSuggestions } from "~/services/item-catalog-service";
import type { Route } from "./+types/item-suggestions";

/** 캐시 아이템 자동완성에서 보여줄 최대 개수(카탈로그+보조 검색 합산). */
const ITEM_SUGGESTION_LIMIT = 15;

/**
 * 메인 검색창 자동완성. 예전엔 여기서 아이템 착용자 수(countWearersByItemNames)까지
 * 같이 조회했는데, 그 쪽 쿼리가 캐시 아이템 조회(maplestory.io)와 별개로 수백ms가 더
 * 걸려 "연관검색어가 뜨는 데 오래 걸린다"는 원인이 됐다. 그래서 착용자 수는 이 응답에서
 * 완전히 빼고 /api/item-wearer-counts로 분리해, 화면엔 검색어 목록(캐시 아이템+헤어/성형/
 * 피부)부터 먼저 보여주고 착용자 수는 나중에 따로 채워 넣는다.
 * 캐시 아이템(maplestory.io)과 헤어/성형/피부(우리 DB)는 서로 의존관계가 없어 병렬로 조회한다.
 *
 * 캐시 아이템은 maplestory.io 카탈로그를 우선으로 쓰되, "젤리 버블 풍선"처럼 그 카탈로그에
 * 아직 없는 최신 아이템도 찾을 수 있도록 우리 DB(cash_items)에서 보조로 한 번 더 찾는다.
 * 이 보조 조회는 카탈로그 결과가 이미 한도를 채웠으면 아예 실행되지 않으므로(자세한 설명은
 * searchCrawledItemSuggestions 참고), 평소 검색 속도에는 영향이 없다.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();

  const [catalogSuggestions, appearances] = await Promise.all([
    searchItemSuggestions(query),
    searchAppearanceSuggestions(query),
  ]);

  const remaining = ITEM_SUGGESTION_LIMIT - catalogSuggestions.length;
  const fallbackSuggestions = await searchCrawledItemSuggestions(
    query,
    new Set(catalogSuggestions.map((s) => s.name)),
    remaining,
  );

  return { query, suggestions: [...catalogSuggestions, ...fallbackSuggestions], appearances };
}
