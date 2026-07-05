import type {
  CharacterGender,
  NexonCashItemEquipmentItem,
} from "./nexon";

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

/** 검색창에 추가된 아이템 하나. 프리즘 적용 여부는 아이템별로 따로 설정한다. */
export interface ItemSearchEntry {
  keyword: string;
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

export function toCashItem(item: NexonCashItemEquipmentItem): CashItem {
  const prism = item.cash_item_coloring_prism ?? item.cash_item_effect_prism;
  return {
    part: item.cash_item_equipment_part as CashPart,
    name: item.cash_item_name,
    iconUrl: item.cash_item_icon,
    prismApplied: prism !== null,
    colorRange: prism?.color_range ?? null,
    hue: prism?.hue ?? null,
    saturation: prism?.saturation ?? null,
    value: prism?.value ?? null,
  };
}
