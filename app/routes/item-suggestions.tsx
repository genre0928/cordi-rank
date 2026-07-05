import { searchItemSuggestions } from "~/services/item-catalog-service";
import type { Route } from "./+types/item-suggestions";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const suggestions = await searchItemSuggestions(query);
  return { query, suggestions };
}
