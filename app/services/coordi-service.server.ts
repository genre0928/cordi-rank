import { supabase } from "~/services/supabase.server";
import type {
  AppearanceInfo,
  CashItem,
  CoordiEntry,
  GenderFilter,
  ItemSearchParams,
  JobGroup,
  RankingPeriod,
  SkinInfo,
} from "~/types/coordi";

/**
 * 데이터 접근 레이어 (Supabase 연동판).
 * 화면 쪽에서는 이 서비스 함수들만 호출하므로, 저장소를 다시 바꾸더라도 이 파일 내부만
 * 손보면 된다. 파일명이 `.server.ts`라 클라이언트 번들에는 절대 포함되지 않는다.
 *
 * characters는 캐릭터 한 명이 아니라 "코디 스냅샷" 한 장이 한 행이다. 같은 ocid(실제
 * 캐릭터)가 여러 행(코디 변천사)을 가질 수 있어, 화면에서 "이 코디 하나"를 가리킬 땐
 * 항상 스냅샷의 고유 id를 쓰고, ocid는 "같은 캐릭터의 다른 스냅샷을 제외"하는 용도로만
 * 쓴다(getCoordiWithSharedItems).
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
  /** 최신 스냅샷 위주로 정렬한다(무작위 샘플링 pool을 최근 것들로 한정할 때 사용). */
  orderByRecent?: boolean;
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
  if (opts.orderByRecent) query = query.order("id", { ascending: false });
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
const RANDOM_POOL_LIMIT = 500;

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

/** 아이템 이름(부위 무관) 다중 조건 + 성별로 캐릭터 코디 이미지를 찾는다. 프리즘 적용 여부는 아이템별로 검사한다. */
export async function searchCoordiByItems({
  items,
  gender,
}: ItemSearchParams): Promise<CoordiEntry[]> {
  const activeItems = items
    .map((entry) => ({ ...entry, keyword: entry.keyword.trim() }))
    .filter((entry) => entry.keyword.length > 0);
  if (activeItems.length === 0) return [];

  const idSets = await Promise.all(
    activeItems.map((item) => idsMatchingCondition(item.keyword, item.prismOnly)),
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

/** 검색 조건이 없을 때 기본 화면에 보여줄 무작위 코디 샘플. 스냅샷 단위로 무작위 추출하므로
 * 코디를 자주 바꾸는 캐릭터가 더 자주 노출될 수 있다(받아들이기로 한 트레이드오프). */
export async function getRandomCoordi(
  count: number,
  gender: GenderFilter = "all",
): Promise<CoordiEntry[]> {
  const pool = await fetchCoordiEntries({ gender, orderByRecent: true, limit: RANDOM_POOL_LIMIT });

  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
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

/** 이 캐릭터가 착용한 아이템 중 하나라도 겹치는 다른 캐릭터를 찾는다 (좋아요 순). 같은
 * 실제 캐릭터(ocid)의 다른 스냅샷은 "동일 아이템 코디"에서 제외한다. */
export async function getCoordiWithSharedItems(entry: CoordiEntry, limit = 4): Promise<CoordiEntry[]> {
  // "투명 OO"는 빈 슬롯을 감추는 placeholder라 대부분의 캐릭터가 겹쳐서 갖고 있다.
  // 매칭 기준에 넣으면 실제 코디가 다른데도 "동일 아이템"으로 뜨는 노이즈가 되므로 제외한다.
  const itemNames = [...new Set(entry.cashItems.map((item) => item.name))].filter(
    (name) => !name.startsWith("투명"),
  );
  if (itemNames.length === 0) return [];

  const itemRows = await selectAllRows<{ character_id: number }>("동일 아이템 캐릭터 조회", (from, to) =>
    supabase.from("cash_items").select("character_id").in("name", itemNames).range(from, to),
  );
  const candidateIds = [...new Set(itemRows.map((row) => row.character_id))];
  if (candidateIds.length === 0) return [];

  const characterRows = await selectAllRows<{ id: number; ocid: string }>("캐릭터 조회", (from, to) =>
    supabase.from("characters").select("id, ocid").in("id", candidateIds).range(from, to),
  );

  const otherIds = characterRows.filter((row) => row.ocid !== entry.ocid).map((row) => row.id);
  if (otherIds.length === 0) return [];

  return fetchCoordiEntries({ ids: otherIds, orderByLikes: true, limit });
}

export interface LikeResult {
  likeCount: number;
  liked: boolean;
}

// 로그인/세션이 따로 없어, "이 서버 프로세스에서 이미 좋아요를 눌렀는지"만 메모리로 기억한다.
// 실제 좋아요 수(like_count)는 Supabase에 저장되어 서버 재시작과 무관하게 유지된다.
const likedByUser = new Set<number>();

export async function toggleLikeCoordi(id: number): Promise<LikeResult> {
  const alreadyLiked = likedByUser.has(id);

  const { data: current, error: readError } = await supabase
    .from("characters")
    .select("like_count")
    .eq("id", id)
    .single();
  if (readError || !current) {
    throw new Error(`코디를 찾을 수 없습니다: ${readError?.message ?? id}`);
  }

  const next = Math.max(0, current.like_count + (alreadyLiked ? -1 : 1));
  const { error: updateError } = await supabase.from("characters").update({ like_count: next }).eq("id", id);
  if (updateError) throw new Error(`좋아요 반영 실패: ${updateError.message}`);

  if (alreadyLiked) {
    likedByUser.delete(id);
  } else {
    likedByUser.add(id);
  }

  return { likeCount: next, liked: !alreadyLiked };
}

export function isLikedByUser(id: number): boolean {
  return likedByUser.has(id);
}
