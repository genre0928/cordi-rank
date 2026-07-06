import { setCoordiLiked } from "~/services/coordi-service.server";
import type { Route } from "./+types/like";

export async function action({ params, request }: Route.ActionArgs) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    throw new Response("Not Found", { status: 404 });
  }
  const formData = await request.formData();
  const liked = formData.get("liked") === "true";
  return setCoordiLiked(id, liked);
}
