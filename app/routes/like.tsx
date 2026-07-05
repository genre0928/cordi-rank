import { toggleLikeCoordi } from "~/services/coordi-service.server";
import type { Route } from "./+types/like";

export async function action({ params }: Route.ActionArgs) {
  const ocid = params.ocid;
  if (!ocid) {
    throw new Response("Not Found", { status: 404 });
  }
  return toggleLikeCoordi(ocid);
}
