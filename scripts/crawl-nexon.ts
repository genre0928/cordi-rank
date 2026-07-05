/**
 * 넥슨 오픈 API로 캐릭터를 수집해 Supabase에 채워 넣는 크롤러의 로컬 실행 진입점.
 * 실제 크롤 로직은 app/services/crawler.server.ts에 있고(앱의 크론 라우트와 공유),
 * 이 파일은 그 함수를 호출하고 결과를 콘솔에 찍는 얇은 래퍼다.
 *
 * 실행: npm run crawl -- 100   (100명, 생략 시 기본 100명)
 */
import { runCrawl } from "../app/services/crawler.server";

const sampleSize = Number(process.argv[2] ?? 100);

// 완료 로그는 runCrawl 내부(app/services/crawler.server.ts)에서 이미 찍으므로 여기서는 실패만 처리한다.
runCrawl(sampleSize).catch((error) => {
  console.error("크롤 실패:", error instanceof Error ? error.message : error);
  process.exit(1);
});
