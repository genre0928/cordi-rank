import { getLikedRanking, isLikedByUser } from "~/services/coordi-service.server";
import type { RankingPeriod } from "~/types/coordi";
import type { Route } from "./+types/api.ranking";

const RANKING_LIMIT = 10;

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const period = (url.searchParams.get("period") as RankingPeriod) || "today";

  const ranking = await getLikedRanking(period, RANKING_LIMIT);
  const likedMap = Object.fromEntries(ranking.map((entry) => [entry.ocid, isLikedByUser(entry.ocid)]));

  return { period, ranking, likedMap };
}
