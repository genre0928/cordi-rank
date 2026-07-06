-- 코디랭킹 스키마
-- 부분 일치 검색(ILIKE) 성능을 위한 확장
create extension if not exists pg_trgm;

-- 캐릭터 한 명이 아니라 "코디 스냅샷" 한 장이 한 행이다. 같은 캐릭터(ocid)를 다시
-- 크롤링했을 때 착용 조합이 바뀌었으면 새 행이 추가되고, 안 바뀌었으면 아무것도
-- 쓰지 않는다(크롤러의 coordi_hash 비교로 판단). 그래서 ocid는 더 이상 유니크가
-- 아니고, 같은 캐릭터의 코디 변천사가 여러 행으로 쌓인다.
create table if not exists characters (
  id bigint generated always as identity primary key,
  ocid text not null,
  character_name text not null,
  world_name text not null,
  -- 실제 API에는 남/여 외에 "기타"도 나올 수 있어(예: 넥슨 캐시샵 성별중립 캐릭터) 값을 강제하지 않는다.
  gender text not null,
  -- 제로/메카닉/제논 등 5개 직업군에 안 맞는 특수 직업은 "기타" 버킷 없이 크롤링 단계에서 제외한다.
  job_group text not null check (job_group in ('전사', '마법사', '궁수', '도적', '해적')),
  job_class text not null,
  level integer not null,
  guild_name text,
  character_image_url text not null,
  -- 캐시 장비가 아닌 외형 커스터마이징 (character/beauty-equipment 응답 기준)
  hair_name text,
  hair_base_color text,
  hair_mix_color text,
  hair_mix_rate integer,
  face_name text,
  face_base_color text,
  face_mix_color text,
  face_mix_rate integer,
  skin_name text,
  skin_color_style text,
  skin_hue integer,
  skin_saturation integer,
  skin_brightness integer,
  -- 착용 조합 + 외형 커스터마이징을 합쳐 만든 서명. 같은 ocid의 최신 스냅샷과 비교해
  -- 크롤러가 "코디가 바뀌었는지"를 값 하나로 빠르게 판단하는 데 쓴다.
  coordi_hash text,
  like_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists characters_ocid_idx on characters (ocid);
create index if not exists characters_like_count_idx on characters (like_count desc);
create index if not exists characters_created_at_idx on characters (created_at desc);
create index if not exists characters_gender_idx on characters (gender);

create table if not exists cash_items (
  id bigint generated always as identity primary key,
  character_id bigint not null references characters (id) on delete cascade,
  part text not null,
  name text not null,
  icon_url text,
  prism_applied boolean not null default false,
  color_range text,
  -- 프리즘 적용 시의 색조/채도/명도 (cash_item_coloring_prism 또는 effect_prism)
  hue integer,
  saturation integer,
  value integer
);

create index if not exists cash_items_character_id_idx on cash_items (character_id);
create index if not exists cash_items_name_trgm_idx on cash_items using gin (name gin_trgm_ops);

-- 스냅샷 하나(character_id)당 부위 하나는 항상 한 행만 있도록 강제한다.
alter table cash_items
  drop constraint if exists cash_items_id_part_unique;
alter table cash_items
  add constraint cash_items_id_part_unique unique (character_id, part);

-- 읽기는 누구나(anon key), 쓰기는 service role 키로만 (RLS는 service role에 적용되지 않음)
alter table characters enable row level security;
alter table cash_items enable row level security;

drop policy if exists "public read characters" on characters;
create policy "public read characters" on characters
  for select using (true);

drop policy if exists "public read cash_items" on cash_items;
create policy "public read cash_items" on cash_items
  for select using (true);

-- 크롤러가 매번 랭킹 1페이지부터 다시 상위권만 긁지 않도록, 다음 크롤에서 시작할
-- 랭킹 페이지를 기억해두는 단일 행 커서. 랭킹 끝에 도달하면 1로 되돌아간다.
create table if not exists crawl_cursor (
  id smallint primary key default 1,
  next_page integer not null default 1
);

insert into crawl_cursor (id, next_page)
values (1, 1)
on conflict (id) do nothing;

-- 크롤러(service role)만 읽고 쓰면 되므로 공개 읽기 정책 없이 RLS만 켜둔다.
alter table crawl_cursor enable row level security;
