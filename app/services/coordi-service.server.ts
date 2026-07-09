import { searchItemSuggestions, type ItemSuggestion } from "~/services/item-catalog-service";
import { supabase } from "~/services/supabase.server";
import type {
  AppearanceInfo,
  CashItem,
  CoordiEntry,
  DyeRanking,
  DyeRankingEntry,
  GenderFilter,
  ItemSearchKind,
  ItemSearchParams,
  ItemSearchStat,
  JobGroup,
  PrismRanking,
  PrismRankingEntry,
  RankingPeriod,
  SearchColorInfo,
  SkinInfo,
} from "~/types/coordi";

/**
 * 데이터 접근 레이어 (Supabase 연동판).
 * 화면 쪽에서는 이 서비스 함수들만 호출하므로, 저장소를 다시 바꾸더라도 이 파일 내부만
 * 손보면 된다. 파일명이 `.server.ts`라 클라이언트 번들에는 절대 포함되지 않는다.
 *
 * characters는 캐릭터 한 명이 아니라 "코디 스냅샷" 한 장이 한 행이다. 같은 ocid(실제
 * 캐릭터)가 여러 행(코디 변천사)을 가질 수 있어, 화면에서 "이 코디 하나"를 가리킬 땐
 * 항상 스냅샷의 고유 id를 쓴다.
 */

interface CharacterRow {
  id: number;
  ocid: string;
  character_name: string;
  world_name: string;
  gender: string;
  job_group: string;
  job_class: string;
  level: number;
  guild_name: string | null;
  character_image_url: string;
  hair_name: string | null;
  hair_base_color: string | null;
  hair_mix_color: string | null;
  hair_mix_rate: number | null;
  face_name: string | null;
  face_base_color: string | null;
  face_mix_color: string | null;
  face_mix_rate: number | null;
  skin_name: string | null;
  skin_color_style: string | null;
  skin_hue: number | null;
  skin_saturation: number | null;
  skin_brightness: number | null;
  like_count: number;
  created_at: string;
}

function toAppearanceInfo(
  name: string | null,
  baseColor: string | null,
  mixColor: string | null,
  mixRate: number | null,
): AppearanceInfo {
  return { name: name ?? "", baseColor, mixColor, mixRate };
}

function toSkinInfo(row: CharacterRow): SkinInfo {
  return {
    name: row.skin_name ?? "",
    colorStyle: row.skin_color_style,
    hue: row.skin_hue,
    saturation: row.skin_saturation,
    brightness: row.skin_brightness,
  };
}

interface CashItemRow {
  character_id: number;
  part: string;
  name: string;
  icon_url: string | null;
  prism_applied: boolean;
  color_range: string | null;
  hue: number | null;
  saturation: number | null;
  value: number | null;
}

/** Supabase 프로젝트 설정상 select 한 번에 돌아오는 행 수 기본 상한(보통 1000)보다
 * 넉넉히 낮게 잡은 페이지 크기. 이 한도를 넘는 select는 에러 없이 조용히 잘려서 오므로,
 * cash_items처럼 행이 많이 쌓이는 조회는 항상 이 헬퍼로 끝까지 이어받아야 한다. */
const SUPABASE_PAGE_SIZE = 500;

async function selectAllRows<T>(
  label: string,
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) throw new Error(`${label} 실패: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < SUPABASE_PAGE_SIZE) break;
    from += SUPABASE_PAGE_SIZE;
  }
  return rows;
}

function toCoordiEntry(row: CharacterRow, items: CashItem[]): CoordiEntry {
  return {
    id: row.id,
    ocid: row.ocid,
    characterName: row.character_name,
    worldName: row.world_name,
    gender: row.gender as CoordiEntry["gender"],
    jobGroup: row.job_group as JobGroup,
    jobClass: row.job_class,
    level: row.level,
    guildName: row.guild_name,
    characterImageUrl: row.character_image_url,
    cashItems: items,
    hair: toAppearanceInfo(row.hair_name, row.hair_base_color, row.hair_mix_color, row.hair_mix_rate),
    face: toAppearanceInfo(row.face_name, row.face_base_color, row.face_mix_color, row.face_mix_rate),
    skin: toSkinInfo(row),
    likeCount: row.like_count,
    createdAt: row.created_at,
    // 넥슨 API에는 목업에 있던 "무드 태그" 개념이 없어 실 데이터에는 채우지 않는다.
    tags: [],
  };
}

interface FetchOptions {
  ids?: number[];
  gender?: GenderFilter;
  jobGroup?: JobGroup;
  since?: Date;
  orderByLikes?: boolean;
  limit?: number;
  offset?: number;
}

async function fetchCoordiEntries(opts: FetchOptions): Promise<CoordiEntry[]> {
  let query = supabase.from("characters").select("*");

  if (opts.ids) query = query.in("id", opts.ids);
  if (opts.gender && opts.gender !== "all") query = query.eq("gender", opts.gender);
  if (opts.jobGroup) query = query.eq("job_group", opts.jobGroup);
  if (opts.since) query = query.gte("created_at", opts.since.toISOString());
  if (opts.orderByLikes) query = query.order("like_count", { ascending: false });
  if (opts.offset) {
    query = query.range(opts.offset, opts.offset + (opts.limit ?? 10) - 1);
  } else if (opts.limit) {
    query = query.limit(opts.limit);
  }

  const { data: characterRows, error } = await query;
  if (error) throw new Error(`characters 조회 실패: ${error.message}`);
  if (!characterRows || characterRows.length === 0) return [];

  const ids = characterRows.map((row) => row.id);
  const itemRows = await selectAllRows<CashItemRow>("cash_items 조회", (from, to) =>
    supabase.from("cash_items").select("*").in("character_id", ids).range(from, to),
  );

  const itemsById = new Map<number, CashItem[]>();
  for (const row of itemRows) {
    const list = itemsById.get(row.character_id) ?? [];
    list.push({
      part: row.part as CashItem["part"],
      name: row.name,
      iconUrl: row.icon_url ?? "",
      prismApplied: row.prism_applied,
      colorRange: row.color_range,
      hue: row.hue,
      saturation: row.saturation,
      value: row.value,
    });
    itemsById.set(row.character_id, list);
  }

  return characterRows.map((row) => toCoordiEntry(row, itemsById.get(row.id) ?? []));
}

const MAX_SEARCH_RESULTS = 60;

async function idsMatchingCondition(keyword: string, prismOnly: boolean): Promise<Set<number>> {
  // prismOnly는 켜짐/꺼짐 둘 다 조건이다: 켜짐이면 프리즘 적용 아이템만, 꺼짐이면 프리즘 미적용 아이템만.
  const rows = await selectAllRows<{ character_id: number }>("아이템 검색", (from, to) =>
    supabase
      .from("cash_items")
      .select("character_id")
      .ilike("name", `%${keyword}%`)
      .eq("prism_applied", prismOnly)
      .range(from, to),
  );
  return new Set(rows.map((row) => row.character_id));
}

/**
 * 헤어/성형/피부는 cash_items가 아니라 characters 테이블에 직접 이름이 있으므로,
 * 그 컬럼(hair_name/face_name/skin_name)을 바로 검색해 스냅샷 id를 반환한다.
 */
async function idsMatchingAppearanceCondition(
  kind: Exclude<ItemSearchKind, "item">,
  keyword: string,
): Promise<Set<number>> {
  const column = `${kind}_name`;
  const rows = await selectAllRows<{ id: number }>(`${kind} 검색`, (from, to) =>
    supabase.from("characters").select("id").ilike(column, `%${keyword}%`).range(from, to),
  );
  return new Set(rows.map((row) => row.id));
}

/**
 * 아이템 이름별로 실제 착용 중인 캐릭터 수를 센다 (자동완성에서 "0명"인 아이템을
 * 미리 보여줘서 검색해도 결과가 없는 걸 검색 전에 알 수 있게 한다).
 * 캐릭터 한 명이 여러 스냅샷(코디 변천사)을 가질 수 있으므로, cash_items의 행 수가
 * 아니라 characters.ocid 기준으로 중복 제거해서 세야 "실제 착용 중인 캐릭터 수"가 된다.
 */
export async function countWearersByItemNames(names: string[]): Promise<Record<string, number>> {
  if (names.length === 0) return {};

  const rows = await selectAllRows<{ name: string; characters: { ocid: string } }>(
    "아이템 착용자 수 조회",
    (from, to) =>
      supabase
        .from("cash_items")
        .select("name, characters!inner(ocid)")
        .in("name", names)
        .range(from, to) as unknown as PromiseLike<{
        data: { name: string; characters: { ocid: string } }[] | null;
        error: { message: string } | null;
      }>,
  );

  const ocidsByName = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = ocidsByName.get(row.name) ?? new Set<string>();
    set.add(row.characters.ocid);
    ocidsByName.set(row.name, set);
  }
  return Object.fromEntries([...ocidsByName].map(([name, ocids]) => [name, ocids.size]));
}

/**
 * "가장 많이 검색된 아이템" 집계용. 검색창은 자동완성에서 고른 정확한 아이템 이름만
 * 태그로 추가하므로(목록에 없는 이름은 애초에 막힘), searchCoordiByItems가 실행될 때마다
 * 그 이름 그대로 카운트를 올리면 된다. 집계 실패가 검색 자체를 막으면 안 되므로 에러는
 * 조용히 무시한다. 로컬 개발(`npm run dev`) 중 테스트 삼아 한 검색은 운영 DB의 통계를
 * 오염시키면 안 되므로, DEV 환경에서는 아예 기록하지 않는다(배포된 프로덕션 빌드는
 * import.meta.env.DEV가 false라 정상적으로 집계된다).
 */
async function logItemSearch(names: string[]): Promise<void> {
  if (import.meta.env.DEV) return;
  await Promise.allSettled(
    names.map((name) => supabase.rpc("increment_item_search_count", { p_item_name: name })),
  );
}

/** 아이템 이름(부위 무관) 다중 조건 + 성별로 캐릭터 코디 이미지를 찾는다. 프리즘 적용 여부는 아이템별로 검사한다. */
export async function searchCoordiByItems({
  items,
  gender,
}: ItemSearchParams): Promise<CoordiEntry[]> {
  const activeItems = items
    .map((entry) => ({ ...entry, keyword: entry.keyword.trim() }))
    .filter((entry) => entry.keyword.length > 0);
  if (activeItems.length === 0) return [];

  void logItemSearch(activeItems.filter((item) => item.kind === "item").map((item) => item.keyword));

  const idSets = await Promise.all(
    activeItems.map((item) =>
      item.kind === "item"
        ? idsMatchingCondition(item.keyword, item.prismOnly)
        : idsMatchingAppearanceCondition(item.kind, item.keyword),
    ),
  );

  let matched = idSets[0];
  for (const set of idSets.slice(1)) {
    matched = new Set([...matched].filter((id) => set.has(id)));
  }
  if (matched.size === 0) return [];

  return fetchCoordiEntries({
    ids: [...matched],
    gender,
    orderByLikes: true,
    limit: MAX_SEARCH_RESULTS,
  });
}

export interface CoordiStats {
  /** 현재 저장된 코디 스냅샷(characters 행) 총 개수. */
  totalCount: number;
  /** 가장 최근에 새로 쌓인 스냅샷의 시각(크롤이 새 코디를 발견한 시점). 하나도 없으면 null. */
  lastUpdatedAt: string | null;
}

/** 홈 화면에 "현재 캐릭터 개수 / 최근 업데이트 시각"을 보여주기 위한 통계. */
export async function getCoordiStats(): Promise<CoordiStats> {
  const { count, error: countError } = await supabase
    .from("characters")
    .select("*", { count: "exact", head: true });
  if (countError) throw new Error(`캐릭터 수 조회 실패: ${countError.message}`);

  const { data: latestRow, error: latestError } = await supabase
    .from("characters")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw new Error(`최근 업데이트 조회 실패: ${latestError.message}`);

  return { totalCount: count ?? 0, lastUpdatedAt: latestRow?.created_at ?? null };
}

/**
 * 검색 조건이 없을 때 기본 화면에 보여줄 무작위 코디 샘플.
 * 이전엔 500명 pool을 통째로 가져와(그때마다 cash_items도 pool 전체 분량, 평균
 * 캐릭터당 아이템 9개면 4000행 이상) 클라이언트에서 섞은 뒤 20개만 썼는데, DB가
 * 커질수록 새로고침이 점점 느려졌다. 전체 개수를 세서 무작위 시작 위치 하나만 고르고
 * 그 지점부터 필요한 개수만큼만 연속으로 가져오는 방식으로 바꿔, 실제 보여줄 만큼만
 * 조회한다(완전한 셔플은 아니고 무작위 구간 하나지만, 새로고침마다 다른 코디가
 * 보인다는 목적엔 충분하고 훨씬 가볍다).
 */
export async function getRandomCoordi(
  count: number,
  gender: GenderFilter = "all",
): Promise<CoordiEntry[]> {
  let countQuery = supabase.from("characters").select("*", { count: "exact", head: true });
  if (gender !== "all") countQuery = countQuery.eq("gender", gender);
  const { count: total, error: countError } = await countQuery;
  if (countError) throw new Error(`캐릭터 수 조회 실패: ${countError.message}`);
  if (!total || total === 0) return [];

  const maxOffset = Math.max(0, total - count);
  const offset = Math.floor(Math.random() * (maxOffset + 1));

  return fetchCoordiEntries({ gender, offset, limit: count });
}

function periodCutoff(period: RankingPeriod): Date {
  const cutoff = new Date();
  if (period === "today") {
    cutoff.setHours(0, 0, 0, 0);
  } else if (period === "weekly") {
    cutoff.setDate(cutoff.getDate() - 7);
  } else {
    cutoff.setDate(cutoff.getDate() - 30);
  }
  return cutoff;
}

/** 좋아요를 받은 캐릭터 이미지 기준 랭킹 (오늘 / 이번 주 / 이번 달). offset을 주면 그만큼 건너뛴 순위부터 가져온다. */
export async function getLikedRanking(
  period: RankingPeriod,
  limit = 10,
  offset = 0,
): Promise<CoordiEntry[]> {
  return fetchCoordiEntries({
    since: periodCutoff(period),
    orderByLikes: true,
    limit,
    offset,
  });
}

export async function getCoordiDetail(id: number): Promise<CoordiEntry | null> {
  const [entry] = await fetchCoordiEntries({ ids: [id] });
  return entry ?? null;
}

/**
 * "내가 좋아요한 코디" 목록용. ids는 브라우저 localStorage에 저장된 순서(최근 좋아요
 * 순)로 넘어오는데, Supabase의 `in()` 조회는 그 순서를 보장하지 않으므로 결과를
 * 입력 순서에 맞춰 다시 정렬해서 돌려준다.
 */
export async function getCoordiByIds(ids: number[]): Promise<CoordiEntry[]> {
  if (ids.length === 0) return [];
  const entries = await fetchCoordiEntries({ ids });
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return ids.map((id) => byId.get(id)).filter((entry): entry is CoordiEntry => entry !== undefined);
}

export interface LikeResult {
  likeCount: number;
}

/**
 * 로그인/세션이 없어 "이 브라우저가 이미 좋아요했는지"는 서버가 판단할 수 없다(예전엔
 * 서버 메모리 Set으로 흉내냈는데, Vercel 서버리스에선 요청마다 다른 인스턴스가 처리할
 * 수 있어 거의 항상 틀렸다 - 새로고침하면 하트가 꺼져 보이고, 취소 클릭도 서버가 "새
 * 좋아요"로 착각해 카운트가 계속 올라가기만 하는 버그가 있었다). 그래서 방향(liked)은
 * 클라이언트(브라우저 localStorage 기준으로 이미 정확히 알고 있음)가 명시적으로
 * 알려주고, 서버는 그 방향대로 like_count만 반영한다.
 */
export async function setCoordiLiked(id: number, liked: boolean): Promise<LikeResult> {
  const { data: current, error: readError } = await supabase
    .from("characters")
    .select("like_count")
    .eq("id", id)
    .single();
  if (readError || !current) {
    throw new Error(`코디를 찾을 수 없습니다: ${readError?.message ?? id}`);
  }

  const next = Math.max(0, current.like_count + (liked ? 1 : -1));

  // 로컬 개발 중 테스트 삼아 누른 좋아요가 운영 DB의 실제 좋아요 수를 오염시키면 안
  // 되므로, DEV 환경에서는 DB에 반영하지 않고 화면에 보여줄 값만 돌려준다(새로고침하면
  // 원래 값으로 돌아간다 - 로컬 테스트용이라 문제 없음).
  if (import.meta.env.DEV) return { likeCount: next };

  const { error: updateError } = await supabase.from("characters").update({ like_count: next }).eq("id", id);
  if (updateError) throw new Error(`좋아요 반영 실패: ${updateError.message}`);

  return { likeCount: next };
}

interface ItemSearchCountRow {
  item_name: string;
  search_count: number;
}

/**
 * 아이템 이름 목록에 대해 "염색 안 된 원본 아이콘"을 찾는다.
 * 1) cash_items에서 prism_applied = false인 행의 아이콘 우선.
 * 2) 크롤링된 인스턴스가 전부 프리즘 적용이라 염색 안 된 행이 아예 없으면, maplestory.io
 *    카탈로그(항상 기본 아이콘)에서 이름이 정확히 일치하는 아이콘을 찾는다.
 * 3) 카탈로그에도 없으면(비매너 아이템 등) 프리즘 적용된 아이콘이라도 최후의 수단으로 쓴다
 *    — 아이콘이 아예 없는 것보다는 낫다.
 */
async function resolveUndyedIconUrls(names: string[]): Promise<Map<string, string | null>> {
  if (names.length === 0) return new Map();

  const { data: plainIconRows, error: plainIconError } = await supabase
    .from("cash_items")
    .select("name, icon_url")
    .in("name", names)
    .eq("prism_applied", false);
  if (plainIconError) throw new Error(`아이템 아이콘 조회 실패: ${plainIconError.message}`);

  const iconByName = new Map<string, string | null>();
  for (const row of plainIconRows ?? []) {
    if (!iconByName.has(row.name)) iconByName.set(row.name, row.icon_url);
  }

  const missingAfterPlain = names.filter((name) => !iconByName.has(name));
  if (missingAfterPlain.length > 0) {
    const catalogResults = await Promise.all(missingAfterPlain.map((name) => searchItemSuggestions(name)));
    catalogResults.forEach((suggestions, idx) => {
      const name = missingAfterPlain[idx];
      const exact = suggestions.find((s) => s.name.toLowerCase() === name.toLowerCase());
      if (exact) iconByName.set(name, exact.iconUrl);
    });
  }

  const stillMissing = names.filter((name) => !iconByName.has(name));
  if (stillMissing.length > 0) {
    const { data: fallbackRows, error: fallbackError } = await supabase
      .from("cash_items")
      .select("name, icon_url")
      .in("name", stillMissing);
    if (fallbackError) throw new Error(`아이템 아이콘 조회 실패: ${fallbackError.message}`);
    for (const row of fallbackRows ?? []) {
      if (!iconByName.has(row.name)) iconByName.set(row.name, row.icon_url);
    }
  }

  return iconByName;
}

/** 홈 화면 통계 섹션 1: 가장 많이 검색된 아이템 TOP N. 아이콘은 cash_items에 저장된 값을 재사용한다. */
export async function getTopSearchedItems(limit = 5): Promise<ItemSearchStat[]> {
  const { data: countRows, error } = await supabase
    .from("item_search_counts")
    .select("item_name, search_count")
    .order("search_count", { ascending: false })
    .limit(limit)
    .returns<ItemSearchCountRow[]>();
  if (error) throw new Error(`아이템 검색량 조회 실패: ${error.message}`);
  if (!countRows || countRows.length === 0) return [];

  const iconByName = await resolveUndyedIconUrls(countRows.map((row) => row.item_name));

  return countRows.map((row) => ({
    name: row.item_name,
    iconUrl: iconByName.get(row.item_name) ?? null,
    searchCount: row.search_count,
  }));
}

interface CashItemPrismRow {
  character_id: number;
  prism_applied: boolean;
  color_range: string | null;
  hue: number | null;
  saturation: number | null;
  value: number | null;
}

/** 색상 조합 하나에 hover했을 때 미리보기로 보여줄 코디 카드 수 상한(전체 개수/비율 계산엔 영향 없음). */
const COMBO_PREVIEW_SAMPLE_SIZE = 12;

/**
 * 특정 캐시 아이템의 프리즘 색상 조합 순위. 착용 중인 모든 스냅샷(검색 조건과 무관하게
 * 그 아이템 이름 전체)을 기준으로 집계한다. color_range+hue+saturation+value가 모두
 * 같은 조합을 하나로 묶어 개수/비율을 낸다. hover 미리보기용으로 조합별 스냅샷 id도
 * 함께 들고 있는다(조합당 상한 개수만).
 */
export async function getPrismRankingForItem(itemName: string): Promise<PrismRanking> {
  const rows = await selectAllRows<CashItemPrismRow>("아이템 프리즘 조회", (from, to) =>
    supabase
      .from("cash_items")
      .select("character_id, prism_applied, color_range, hue, saturation, value")
      .eq("name", itemName)
      .range(from, to),
  );

  const prismRows = rows.filter((row) => row.prism_applied);
  const groups = new Map<string, { row: CashItemPrismRow; count: number; ids: number[] }>();
  for (const row of prismRows) {
    const key = `${row.color_range}|${row.hue}|${row.saturation}|${row.value}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      if (existing.ids.length < COMBO_PREVIEW_SAMPLE_SIZE) existing.ids.push(row.character_id);
    } else {
      groups.set(key, { row, count: 1, ids: [row.character_id] });
    }
  }

  const ranking: PrismRankingEntry[] = [...groups.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(({ row, count, ids }) => ({
      colorRange: row.color_range,
      hue: row.hue,
      saturation: row.saturation,
      value: row.value,
      count,
      percentage: prismRows.length > 0 ? Math.round((count / prismRows.length) * 1000) / 10 : 0,
      entryIds: ids,
    }));

  return { totalCount: rows.length, prismAppliedCount: prismRows.length, ranking };
}

interface AppearanceDyeRow {
  id: number;
  base: string | null;
  mix: string | null;
  rate: number | null;
}

/** hair_base_color에 실제로 나오는 색상 이름 전체(자동완성/염색 순위에서 접두사 판별에 재사용). */
const HAIR_COLOR_PREFIXES = new Set([
  "파란색",
  "빨간색",
  "초록색",
  "보라색",
  "주황색",
  "갈색",
  "검은색",
  "노란색",
]);

/**
 * "파란색 쿼츠 헤어"처럼 헤어 이름 맨 앞에는 항상 hair_base_color와 같은 색상 형용사가
 * 붙는다(같은 스타일이라도 색상마다 아이템 이름 자체가 다름). 염색 순위/자동완성은 "이
 * 스타일"을 보고 싶은 것이므로, 맨 앞이 실제 색상 단어일 때만 떼어 스타일명만 남긴다
 * (이미 접두사가 없는 이름을 넣어도 아무 단어나 잘려나가지 않도록 방어).
 */
function stripHairColorPrefix(hairName: string): string {
  const spaceIndex = hairName.indexOf(" ");
  if (spaceIndex === -1) return hairName;
  const firstWord = hairName.slice(0, spaceIndex);
  return HAIR_COLOR_PREFIXES.has(firstWord) ? hairName.slice(spaceIndex + 1) : hairName;
}

/**
 * 헤어/성형 하나의 색상 조합(기본색+혼합색+비율) 순위. characters 테이블에서 해당
 * 이름(hair_name 또는 face_name)과 일치하는 모든 스냅샷을 기준으로 집계한다.
 * 헤어는 색상 접두사를 뗀 스타일명 기준(뒤가 일치)으로, 성형은 이름 그대로(정확히
 * 일치)로 찾는다 — 성형은 이름 자체에 색상이 섞여 있지 않기 때문이다.
 */
export async function getDyeRankingForAppearance(
  part: "hair" | "face",
  name: string,
): Promise<DyeRanking> {
  const baseColumn = part === "hair" ? "hair_base_color" : "face_base_color";
  const mixColumn = part === "hair" ? "hair_mix_color" : "face_mix_color";
  const rateColumn = part === "hair" ? "hair_mix_rate" : "face_mix_rate";

  const rows = await selectAllRows<Record<string, string | number | null>>(
    `${part} 색상 조회`,
    (from, to) => {
      const query = supabase.from("characters").select(`id, ${baseColumn}, ${mixColumn}, ${rateColumn}`);
      return (
        part === "hair"
          ? query.ilike("hair_name", `%${stripHairColorPrefix(name)}`)
          : query.eq("face_name", name)
      ).range(from, to);
    },
  );

  const normalized: AppearanceDyeRow[] = rows.map((row) => ({
    id: row.id as number,
    base: (row[baseColumn] as string | null) ?? null,
    mix: (row[mixColumn] as string | null) ?? null,
    rate: (row[rateColumn] as number | null) ?? null,
  }));

  const groups = new Map<string, { row: AppearanceDyeRow; count: number; ids: number[] }>();
  for (const row of normalized) {
    const key = `${row.base}|${row.mix}|${row.rate}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      if (existing.ids.length < COMBO_PREVIEW_SAMPLE_SIZE) existing.ids.push(row.id);
    } else {
      groups.set(key, { row, count: 1, ids: [row.id] });
    }
  }

  const ranking: DyeRankingEntry[] = [...groups.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(({ row, count, ids }) => ({
      baseColor: row.base,
      mixColor: row.mix,
      mixRate: row.rate,
      count,
      percentage: normalized.length > 0 ? Math.round((count / normalized.length) * 1000) / 10 : 0,
      entryIds: ids,
    }));

  return { totalCount: normalized.length, ranking };
}

const STAT_SUGGESTION_SCAN_LIMIT = 60;

/** 이름 목록에서 중복을 없애고 앞에서부터 limit개만 남긴다. */
function dedupeNames(names: (string | null)[], limit: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    result.push(name);
    if (result.length >= limit) break;
  }
  return result;
}

interface SkinPrismRow {
  id: number;
  skin_color_style: string | null;
  skin_hue: number | null;
  skin_saturation: number | null;
  skin_brightness: number | null;
}

/**
 * 피부는 프리즘 같은 on/off 플래그가 없다 — 커스텀 색상을 적용하면 hue/saturation/
 * brightness가 채워지고, 기본 피부 그대로면 셋 다 null이다. 그래서 hue가 null이 아닌
 * 행을 "커스텀 적용"으로 간주해 아이템 프리즘과 같은 방식(PrismRanking)으로 집계한다.
 */
export async function getPrismRankingForSkin(skinName: string): Promise<PrismRanking> {
  const rows = await selectAllRows<SkinPrismRow>("피부 색상 조회", (from, to) =>
    supabase
      .from("characters")
      .select("id, skin_color_style, skin_hue, skin_saturation, skin_brightness")
      .eq("skin_name", skinName)
      .range(from, to),
  );

  const customRows = rows.filter((row) => row.skin_hue !== null);
  const groups = new Map<string, { row: SkinPrismRow; count: number; ids: number[] }>();
  for (const row of customRows) {
    const key = `${row.skin_color_style}|${row.skin_hue}|${row.skin_saturation}|${row.skin_brightness}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      if (existing.ids.length < COMBO_PREVIEW_SAMPLE_SIZE) existing.ids.push(row.id);
    } else {
      groups.set(key, { row, count: 1, ids: [row.id] });
    }
  }

  const ranking: PrismRankingEntry[] = [...groups.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(({ row, count, ids }) => ({
      colorRange: row.skin_color_style,
      hue: row.skin_hue,
      saturation: row.skin_saturation,
      value: row.skin_brightness,
      count,
      percentage: customRows.length > 0 ? Math.round((count / customRows.length) * 1000) / 10 : 0,
      entryIds: ids,
    }));

  return { totalCount: rows.length, prismAppliedCount: customRows.length, ranking };
}

/**
 * 홈 화면 통계 섹션 2: 왼쪽 검색창에 지금 걸려 있는 검색어 하나에 대한 색상 정보.
 * 예전엔 이 섹션 자체가 독립된 검색창이었는데, 왼쪽 검색과 별개로 또 검색해야 하는 게
 * 번거로워서 왼쪽 검색 상태를 그대로 반영하도록 바꿨다 — 종류(kind)별로 어떤 집계
 * 함수를 쓸지만 갈라주면 된다.
 */
export async function getSearchColorInfo(entry: {
  kind: ItemSearchKind;
  keyword: string;
}): Promise<SearchColorInfo> {
  if (entry.kind === "item") {
    const [prism, iconByName] = await Promise.all([
      getPrismRankingForItem(entry.keyword),
      resolveUndyedIconUrls([entry.keyword]),
    ]);
    return {
      kind: "item",
      keyword: entry.keyword,
      prism,
      dye: null,
      iconUrl: iconByName.get(entry.keyword) ?? null,
    };
  }
  if (entry.kind === "skin") {
    return {
      kind: "skin",
      keyword: entry.keyword,
      prism: await getPrismRankingForSkin(entry.keyword),
      dye: null,
      iconUrl: null,
    };
  }
  return {
    kind: entry.kind,
    keyword: entry.keyword,
    dye: await getDyeRankingForAppearance(entry.kind, entry.keyword),
    prism: null,
    iconUrl: null,
  };
}

export interface AppearanceSuggestion {
  kind: Exclude<ItemSearchKind, "item">;
  name: string;
  /** 헤어/성형만 채워진다(피부는 성별 제한이 없음). 그 이름을 착용한 캐릭터가 한 성별뿐이면
   * 그 성별, 남/여 둘 다 있으면(사실상 없겠지만 방어적으로) null. */
  genderLabel?: "남" | "여" | null;
  /** 이 헤어/성형을 실제로 착용 중인 캐릭터 수. /api/appearance-wearer-counts 라우트에서 DB 조회 후 채워진다. */
  wearerCount?: number;
}

/** 이름별로 관측된 성별이 하나뿐이면 그 성별을, 여러 성별이 섞여 있으면 null을 돌려준다. */
function buildGenderLabelByName(rows: { name: string | null; gender: string }[]): Map<string, "남" | "여" | null> {
  const gendersByName = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.name) continue;
    const set = gendersByName.get(row.name) ?? new Set<string>();
    set.add(row.gender);
    gendersByName.set(row.name, set);
  }

  const result = new Map<string, "남" | "여" | null>();
  for (const [name, genders] of gendersByName) {
    const only = genders.size === 1 ? [...genders][0] : null;
    result.set(name, only === "남" || only === "여" ? only : null);
  }
  return result;
}

/**
 * 메인 검색창 자동완성용 헤어/성형/피부 후보. 캐시 아이템은 maplestory.io 카탈로그를 쓰지만
 * 헤어/성형/피부는 그런 외부 카탈로그가 없으므로, 우리 DB에 실제로 크롤링된 이름만 후보로 준다.
 */
export async function searchAppearanceSuggestions(keyword: string): Promise<AppearanceSuggestion[]> {
  const trimmed = keyword.trim();
  if (trimmed.length === 0) return [];

  const [hairRows, faceRows, skinRows] = await Promise.all([
    supabase
      .from("characters")
      .select("hair_name, gender")
      .ilike("hair_name", `%${trimmed}%`)
      .limit(STAT_SUGGESTION_SCAN_LIMIT),
    supabase
      .from("characters")
      .select("face_name, gender")
      .ilike("face_name", `%${trimmed}%`)
      .limit(STAT_SUGGESTION_SCAN_LIMIT),
    supabase.from("characters").select("skin_name").ilike("skin_name", `%${trimmed}%`).limit(STAT_SUGGESTION_SCAN_LIMIT),
  ]);
  if (hairRows.error) throw new Error(`헤어 후보 조회 실패: ${hairRows.error.message}`);
  if (faceRows.error) throw new Error(`성형 후보 조회 실패: ${faceRows.error.message}`);
  if (skinRows.error) throw new Error(`피부 후보 조회 실패: ${skinRows.error.message}`);

  // 헤어는 "파란색 쿼츠 헤어"/"초록색 쿼츠 헤어"처럼 색상 접두사만 다른 같은 스타일이
  // 흔해서, 접두사를 뗀 스타일명으로 묶어야 자동완성에 중복(사실상 같은 헤어)이 안 뜬다.
  const hairRawRows = (hairRows.data ?? []).map((row) => ({
    name: row.hair_name ? stripHairColorPrefix(row.hair_name) : null,
    gender: row.gender,
  }));
  const hairNames = dedupeNames(hairRawRows.map((row) => row.name), 5);
  const hairGenderByName = buildGenderLabelByName(hairRawRows);

  const faceRawRows = (faceRows.data ?? []).map((row) => ({ name: row.face_name, gender: row.gender }));
  const faceNames = dedupeNames(faceRawRows.map((row) => row.name), 5);
  const faceGenderByName = buildGenderLabelByName(faceRawRows);

  const skinNames = dedupeNames((skinRows.data ?? []).map((row) => row.skin_name), 5);

  return [
    ...hairNames.map(
      (name): AppearanceSuggestion => ({ kind: "hair", name, genderLabel: hairGenderByName.get(name) ?? null }),
    ),
    ...faceNames.map(
      (name): AppearanceSuggestion => ({ kind: "face", name, genderLabel: faceGenderByName.get(name) ?? null }),
    ),
    ...skinNames.map((name): AppearanceSuggestion => ({ kind: "skin", name })),
  ];
}

/**
 * 헤어/성형 하나를 실제로 착용 중인 캐릭터 수(스냅샷이 아니라 ocid 기준 중복 제거).
 * 헤어는 색상 접두사를 뗀 스타일명으로 묶여 있으므로, 염색(색상 변형) 상관없이 그
 * 스타일의 모든 색상 변형을 합산해서 센다 — hair_name ILIKE 접미사 매칭을 쓰는 이유.
 * 성형은 이름 자체에 색상이 안 섞여 있어 정확히 일치하는 것만 세면 된다.
 */
async function countWearersByAppearanceName(kind: "hair" | "face", name: string): Promise<number> {
  const rows = await selectAllRows<{ ocid: string }>(`${kind} 착용자 수 조회`, (from, to) => {
    const query = supabase.from("characters").select("ocid");
    return (kind === "hair" ? query.ilike("hair_name", `%${name}`) : query.eq("face_name", name)).range(from, to);
  });
  return new Set(rows.map((row) => row.ocid)).size;
}

export async function countWearersByAppearanceNames(
  targets: { kind: "hair" | "face"; name: string }[],
): Promise<Record<string, number>> {
  const entries = await Promise.all(
    targets.map(async (target) => {
      const count = await countWearersByAppearanceName(target.kind, target.name);
      return [`${target.kind}:${target.name}`, count] as const;
    }),
  );
  return Object.fromEntries(entries);
}

interface CrawledItemRow {
  id: number;
  name: string;
  icon_url: string | null;
  part: string | null;
  characters: { gender: string } | { gender: string }[] | null;
}

/**
 * maplestory.io 카탈로그는 커뮤니티가 관리하는 비공식 데이터라 "젤리 버블 풍선"처럼 갓
 * 나온 최신 아이템은 아직 안 올라와 있는 경우가 있다. 그런 아이템도 실제로 우리 DB에
 * 크롤링돼 있으면(누군가 이미 착용 중이면) 검색에서 찾을 수 있어야 하므로, 카탈로그
 * 검색으로 못 찾은 이름만 cash_items에서 직접 보조로 찾는다. "투명 OO" 빈 슬롯
 * placeholder는 실제 아이템이 아니므로 제외한다.
 */
export async function searchCrawledItemSuggestions(
  keyword: string,
  excludeNames: Set<string>,
  limit: number,
): Promise<ItemSuggestion[]> {
  const trimmed = keyword.trim();
  if (trimmed.length === 0 || limit <= 0) return [];

  const { data, error } = await supabase
    .from("cash_items")
    .select("id, name, icon_url, part, characters!inner(gender)")
    .ilike("name", `%${trimmed}%`)
    .not("name", "ilike", "투명%")
    .limit(STAT_SUGGESTION_SCAN_LIMIT)
    .returns<CrawledItemRow[]>();
  if (error) throw new Error(`크롤링된 아이템 후보 조회 실패: ${error.message}`);

  const byName = new Map<
    string,
    { id: number; iconUrl: string | null; part: string | null; genders: Set<string> }
  >();
  for (const row of data ?? []) {
    if (excludeNames.has(row.name)) continue;
    const genderRow = Array.isArray(row.characters) ? row.characters[0] : row.characters;
    const gender = genderRow?.gender;

    const existing = byName.get(row.name);
    if (existing) {
      if (gender) existing.genders.add(gender);
    } else {
      byName.set(row.name, {
        id: row.id,
        iconUrl: row.icon_url,
        part: row.part,
        genders: new Set(gender ? [gender] : []),
      });
    }
  }

  return [...byName.entries()].slice(0, limit).map(([name, info]) => ({
    id: info.id,
    name,
    iconUrl: info.iconUrl ?? "",
    genderLabel: info.genders.size === 1 ? ([...info.genders][0] as "남" | "여") : null,
    part: info.part,
  }));
}
