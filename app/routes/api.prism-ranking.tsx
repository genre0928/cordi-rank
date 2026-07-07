import { getDyeRankingForAppearance, getPrismRankingForItem } from "~/services/coordi-service.server";
import type { StatTargetKind } from "~/types/coordi";
import type { Route } from "./+types/api.prism-ranking";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const kind = (url.searchParams.get("kind") as StatTargetKind) || "item";
  const name = (url.searchParams.get("name") ?? "").trim();
  if (name.length === 0) {
    throw new Response("name이 필요합니다.", { status: 400 });
  }

  if (kind === "hair" || kind === "face") {
    const dye = await getDyeRankingForAppearance(kind, name);
    return { kind, name, dye, prism: null };
  }

  const prism = await getPrismRankingForItem(name);
  return { kind: "item" as const, name, dye: null, prism };
}
