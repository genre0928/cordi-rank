-- 아이템 검색량 집계용 테이블 + 원자적 증가 함수.
-- "홈 화면 통계 섹션 1: 가장 많이 검색된 아이템 TOP 5"를 위해 신규로 추가한다.
create table if not exists item_search_counts (
  item_name text primary key,
  search_count bigint not null default 0
);

-- upsert로 짜면(읽고-쓰기 두 단계) 동시 요청 시 카운트가 씹힐 수 있어, 한 번의 SQL
-- 문으로 원자적으로 증가시키는 함수를 둔다. 서버는 service role 키로만 호출한다.
create or replace function increment_item_search_count(p_item_name text)
returns void
language sql
as $$
  insert into item_search_counts (item_name, search_count)
  values (p_item_name, 1)
  on conflict (item_name) do update
    set search_count = item_search_counts.search_count + 1;
$$;

alter table item_search_counts enable row level security;

drop policy if exists "public read item_search_counts" on item_search_counts;
create policy "public read item_search_counts" on item_search_counts
  for select using (true);
