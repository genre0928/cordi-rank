import { countWearersByAppearanceNames } from "~/services/coordi-service.server";
import type { Route } from "./+types/api.appearance-wearer-counts";

/**
 * 헤어/성형 착용자 수도 아이템처럼 자동완성 응답에서 분리했다(그래야 목록 자체가
 * 먼저 뜬다). 목록이 갱신될 때마다 이 라우트를 따로 호출해 착용자 수만 나중에 채운다.
 * 카운트는 `${kind}:${name}` 형태의 키로 반환한다.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const hairNames = url.searchParams.getAll("hair");
  const faceNames = url.searchParams.getAll("face");

  const targets = [
    ...hairNames.map((name) => ({ kind: "hair" as const, name })),
    ...faceNames.map((name) => ({ kind: "face" as const, name })),
  ];

  const counts = await countWearersByAppearanceNames(targets);
  return { counts };
}
