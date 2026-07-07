/** character/basic 응답 기준. 남/여 외에 "기타"도 나올 수 있어 characters.gender 컬럼 자체는 강제하지 않지만, 성별 필터 UI는 이 두 값만 다룬다. */
export type CharacterGender = "남" | "여";

export type JobGroup =
  | "전사"
  | "마법사"
  | "궁수"
  | "도적"
  | "해적"
  | "메이플M";

/**
 * /maplestory/v1/character/cashitem-equipment 응답에 실제로 나오는
 * cash_item_equipment_part 값만 포함한다 (헤어/성형/피부는 이 엔드포인트에 없고,
 * 펫/펫장비 등도 별도 API라 제외). 반지는 캐릭터 이미지에 렌더링되지 않아
 * 크롤링 단계에서부터 제외한다.
 */
export const CASH_PARTS = [
  "모자",
  "얼굴장식",
  "눈장식",
  "귀고리",
  "상의",
  "하의",
  "한벌옷",
  "신발",
  "장갑",
  "망토",
  "무기",
  "방패",
] as const;

export type CashPart = (typeof CASH_PARTS)[number];

export type RankingPeriod = "today" | "weekly" | "monthly";

export type GenderFilter = "all" | CharacterGender;

/** 검색어가 캐시 아이템인지, 헤어/성형/피부(캐릭터 외형)인지. 후자는 characters 테이블에서 직접 찾는다. */
export type ItemSearchKind = "item" | "hair" | "face" | "skin";

/** 검색창에 추가된 아이템 하나. 프리즘 적용 여부는 캐시 아이템(kind === "item")에만 의미가 있다. */
export interface ItemSearchEntry {
  keyword: string;
  kind: ItemSearchKind;
  prismOnly: boolean;
}

export interface ItemSearchParams {
  /** 부위 구분 없이, 여러 개를 조합하면 AND 조건이 된다. */
  items: ItemSearchEntry[];
  gender: GenderFilter;
}

export interface CashItem {
  part: CashPart;
  name: string;
  iconUrl: string;
  /** 프리즘 적용 여부 (cash_item_coloring_prism/effect_prism 존재 여부) */
  prismApplied: boolean;
  /** 프리즘 적용 시의 색상 계열 */
  colorRange: string | null;
  /** 색조 */
  hue: number | null;
  /** 채도 */
  saturation: number | null;
  /** 명도 */
  value: number | null;
}

/** 헤어/성형처럼 기본색+혼합색 비율로 표현되는 외형 커스터마이징. */
export interface AppearanceInfo {
  name: string;
  baseColor: string | null;
  mixColor: string | null;
  mixRate: number | null;
}

/** 피부는 색조/채도/명도로 표현된다 (프리셋 피부는 셋 다 null). */
export interface SkinInfo {
  name: string;
  colorStyle: string | null;
  hue: number | null;
  saturation: number | null;
  brightness: number | null;
}

/** 넥슨 API 응답을 화면에서 쓰기 좋게 정규화한 코디 엔트리. */
export interface CoordiEntry {
  /** 이 코디 스냅샷의 고유 id. 라우팅/좋아요/React key 등 "이 코디 한 장"을 가리킬 때 쓴다. */
  id: number;
  /** 실제 캐릭터(넥슨 ocid). 같은 ocid로 여러 스냅샷(코디 변천사)이 있을 수 있어 더 이상 유니크하지 않다. */
  ocid: string;
  characterName: string;
  worldName: string;
  gender: CharacterGender;
  jobGroup: JobGroup;
  jobClass: string;
  level: number;
  guildName: string | null;
  characterImageUrl: string;
  cashItems: CashItem[];
  hair: AppearanceInfo;
  face: AppearanceInfo;
  skin: SkinInfo;
  likeCount: number;
  createdAt: string;
  tags: string[];
}

/** 홈 화면 통계 섹션 1: 가장 많이 검색된 아이템 한 줄. */
export interface ItemSearchStat {
  name: string;
  iconUrl: string | null;
  searchCount: number;
}

/** 캐시 아이템(또는 피부)의 색상 조합별 집계 한 줄. 피부는 프리즘 on/off 대신 커스텀 색상 적용 여부로 판단한다. */
export interface PrismRankingEntry {
  colorRange: string | null;
  hue: number | null;
  saturation: number | null;
  value: number | null;
  count: number;
  percentage: number;
  /** 이 조합에 해당하는 코디 스냅샷 id 일부(hover 미리보기용, 최대 COMBO_PREVIEW_SAMPLE_SIZE개). */
  entryIds: number[];
}

export interface PrismRanking {
  /** 이 아이템을 착용 중인 전체 스냅샷 수(프리즘 미적용 포함). */
  totalCount: number;
  /** 그중 프리즘을 적용한 스냅샷 수. */
  prismAppliedCount: number;
  /** 프리즘 적용 스냅샷 중 색상 조합별 비율 상위 목록. */
  ranking: PrismRankingEntry[];
}

/** 헤어/성형 하나의 색상 조합(기본색+혼합색+비율)별 집계 한 줄. */
export interface DyeRankingEntry {
  baseColor: string | null;
  mixColor: string | null;
  mixRate: number | null;
  count: number;
  percentage: number;
  /** 이 조합에 해당하는 코디 스냅샷 id 일부(hover 미리보기용, 최대 COMBO_PREVIEW_SAMPLE_SIZE개). */
  entryIds: number[];
}

export interface DyeRanking {
  totalCount: number;
  ranking: DyeRankingEntry[];
}

/**
 * 홈 화면 통계 섹션 2: 왼쪽 검색창에서 지금 검색 중인 검색어 하나에 대한 색상 정보.
 * 더 이상 별도의 검색창이 아니라, 왼쪽 검색 상태를 그대로 반영해서 채운다.
 */
export interface SearchColorInfo {
  kind: ItemSearchKind;
  keyword: string;
  /** kind === "item"일 때만 채워지는 원본(염색 안 된) 아이콘. 헤어/성형/피부는 고정 아이콘을 쓰므로 null. */
  iconUrl: string | null;
  prism: PrismRanking | null;
  dye: DyeRanking | null;
}
