-- 코디 스냅샷 히스토리 마이그레이션
-- 기존 운영 Supabase 프로젝트의 SQL 에디터에서 수동으로 실행한다.
-- (이 프로젝트는 @supabase/supabase-js REST 클라이언트만 쓰고 direct DB 연결이 없어서
--  DDL을 코드로 실행할 수 없다.)
--
-- 실행 순서 주의: 이 마이그레이션을 먼저 실행하고, 다 실행되면 되도록 빨리(같은 날 안에,
-- 다음 크론 크롤링 전에) 새 코드를 배포해야 한다. 코드를 먼저 배포하면 아직 없는 컬럼을
-- 참조하게 되어 즉시 전면 장애가 나고, 반대로 이 SQL만 먼저 실행한 상태로 오래 두면
-- (특히 마지막 줄인 cash_items.character_ocid 컬럼 삭제 이후) 기존 코드의 읽기 경로가
-- 깨진다. 크롤러는 하루 1번만 도니 SQL 실행 후 코드 배포까지는 여유가 있다.

-- 1) characters: 새 PK(id) 추가, ocid는 비고유 컬럼으로 강등
alter table characters add column id bigint generated always as identity;
alter table characters add column coordi_hash text;

-- 2) cash_items -> characters FK를 끊어야 characters의 PK를 바꿀 수 있음
alter table cash_items drop constraint cash_items_character_ocid_fkey;

-- 3) characters PK 교체
alter table characters drop constraint characters_pkey;
alter table characters add constraint characters_pkey primary key (id);
create index if not exists characters_ocid_idx on characters (ocid);

-- 4) cash_items에 character_id 추가 후 백필
--    (이 시점엔 ocid당 characters 행이 정확히 1개뿐이라 조인이 명확함 -
--     반드시 새 크롤러 코드 배포 전에 실행해야 함)
alter table cash_items add column character_id bigint;
update cash_items ci set character_id = c.id
  from characters c where c.ocid = ci.character_ocid;

-- 아래 alter 실행 전에 이 쿼리 결과가 0인지 확인:
--   select count(*) from cash_items where character_id is null;
alter table cash_items alter column character_id set not null;

alter table cash_items drop constraint cash_items_ocid_part_unique;
alter table cash_items add constraint cash_items_id_part_unique unique (character_id, part);
alter table cash_items add constraint cash_items_character_id_fkey
  foreign key (character_id) references characters (id) on delete cascade;

drop index if exists cash_items_character_ocid_idx;
create index if not exists cash_items_character_id_idx on cash_items (character_id);

-- 5) 이 컬럼을 지우는 순간부터 예전 코드(character_ocid를 select("*")로 읽는 코드)는
--    깨진다. 코드 배포 직전에 실행하거나, 코드 배포와 최대한 붙여서 실행할 것.
alter table cash_items drop column character_ocid;
