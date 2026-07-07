import { searchStatTargets } from "~/services/coordi-service.server";
import type { Route } from "./+types/api.stat-suggestions";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const suggestions = await searchStatTargets(query);
  return { query, suggestions };
}
