import { countWearersByItemNames } from "~/services/coordi-service.server";
import type { Route } from "./+types/api.item-wearer-counts";

/**
 * 아이템 착용자 수는 /api/item-suggestions 응답에서 분리했다(그 쪽 설명 참고).
 * 자동완성 목록이 먼저 뜬 다음, 화면이 이 라우트를 별도로 호출해 착용자 수만 나중에 채운다.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const names = url.searchParams.getAll("name");
  const counts = await countWearersByItemNames(names);
  return { counts };
}
