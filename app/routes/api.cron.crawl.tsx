import { runCrawl } from "~/services/crawler.server";
import type { Route } from "./+types/api.cron.crawl";

/**
 * Vercel Cron이 매일 호출하는 리소스 라우트. Vercel은 CRON_SECRET 환경변수가 설정돼 있으면
 * 크론 요청에 자동으로 `Authorization: Bearer <CRON_SECRET>` 헤더를 붙여준다. 그 값이
 * 일치하지 않으면(= Vercel Cron이 아닌 외부 요청) 401로 거절해 아무나 크롤을 트리거하지 못하게 막는다.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const result = await runCrawl(100);
  return Response.json(result);
}
