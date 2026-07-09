-- Supabase Advisor 경고 조치: public.crawl_cursor 테이블에 RLS가 꺼져 있어서
-- "프로젝트 URL만 알면 누구나 이 테이블을 읽고 고치고 지울 수 있다"고 표시됨.
-- 0002_crawl_cursor.sql 마이그레이션에 enable row level security 구문이 있었지만
-- 실제 운영 DB에는 반영되지 않은 것으로 보인다. 몇 번 실행해도 안전(멱등)하다.

alter table crawl_cursor enable row level security;

-- 이 테이블은 크롤러(service role)만 읽고 쓰면 되므로 공개 정책은 일부러 두지 않는다.
-- (정책이 없으면 anon/authenticated는 완전히 차단되고, service role은 RLS를 우회하므로
-- 크롤러 동작에는 영향 없다.)
