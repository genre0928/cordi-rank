import { toggleLikeCoordi } from "~/services/coordi-service.server";
import type { Route } from "./+types/like";

export async function action({ params }: Route.ActionArgs) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    throw new Response("Not Found", { status: 404 });
  }
  return toggleLikeCoordi(id);
}
