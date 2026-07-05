/**
 * Supabase 서버 클라이언트. 파일명이 `.server.ts`라 클라이언트 번들에는 절대 포함되지 않는다.
 *
 * 이 앱은 브라우저가 Supabase를 직접 호출하지 않고 항상 React Router 로더/액션을 통해서만
 * 접근하므로, service role 키 하나로 서버에서 읽기/쓰기를 모두 처리한다 (RLS는 별도로
 * public read 정책을 걸어뒀지만, service role은 어차피 RLS를 우회한다).
 *
 * 참고: 이 프로젝트의 Node 버전(21)은 아직 네이티브 WebSocket이 없어서 `@supabase/supabase-js`의
 * realtime 클라이언트 초기화가 실패한다. 우리는 realtime을 쓰지 않지만, 생성 시점에 WebSocket
 * 구현체를 넘겨줘야 크래시 없이 초기화된다 (Node 22+ 환경에서는 없어도 무방).
 */
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 설정되어 있지 않습니다 (.env 확인 필요).");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: WebSocket as never },
});
