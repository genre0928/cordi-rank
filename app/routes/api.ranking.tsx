import { getLikedRanking, isLikedByUser } from "~/services/coordi-service.server";
import type { RankingPeriod } from "~/types/coordi";
import type { Route } from "./+types/api.ranking";

/** 사이드바 랭킹 섹션은 4~10위만 담당한다 (1~3위는 홈 화면 상단 배너). */
const RANKING_OFFSET = 3;
const RANKING_LIMIT = 7;

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const period = (url.searchParams.get("period") as RankingPeriod) || "today";

  const ranking = await getLikedRanking(period, RANKING_LIMIT, RANKING_OFFSET);
  const likedMap = Object.fromEntries(ranking.map((entry) => [entry.ocid, isLikedByUser(entry.ocid)]));

  return { period, ranking, likedMap };
}
