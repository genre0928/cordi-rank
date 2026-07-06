import { getCoordiByIds } from "~/services/coordi-service.server";
import type { Route } from "./+types/api.liked-coordi";

/** "내가 좋아요한 코디" 페이지가 현재 페이지에 보여줄 id들의 상세 정보만 그때그때 가져온다. */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const ids = (url.searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => Number(id.trim()))
    .filter((id) => Number.isFinite(id));

  const entries = await getCoordiByIds(ids);
  return { entries };
}
