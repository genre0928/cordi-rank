import { countWearersByItemNames } from "~/services/coordi-service.server";
import { searchItemSuggestions } from "~/services/item-catalog-service";
import type { Route } from "./+types/item-suggestions";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const suggestions = await searchItemSuggestions(query);

  const wearerCounts = await countWearersByItemNames(suggestions.map((s) => s.name));
  const suggestionsWithCounts = suggestions.map((s) => ({ ...s, wearerCount: wearerCounts[s.name] ?? 0 }));

  return { query, suggestions: suggestionsWithCounts };
}
