-- 크롤러가 매번 랭킹 1페이지부터 다시 상위권만 긁는 문제를 해결하기 위한 커서 테이블.
-- 단일 행(id=1)에 "다음 크롤에서 시작할 랭킹 페이지"를 저장해두고, 크롤이 끝날 때마다
-- 다음 페이지 번호로 갱신한다(랭킹 끝에 도달하면 1로 되돌아간다). 기존 운영 Supabase의
-- SQL 에디터에서 수동으로 실행한다.
create table if not exists crawl_cursor (
  id smallint primary key default 1,
  next_page integer not null default 1
);

insert into crawl_cursor (id, next_page)
values (1, 1)
on conflict (id) do nothing;

-- 크롤러(service role)만 읽고 쓰면 되므로 공개 읽기 정책 없이 RLS만 켜둔다.
alter table crawl_cursor enable row level security;
