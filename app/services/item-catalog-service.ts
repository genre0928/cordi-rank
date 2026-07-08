/**
 * 아이템 아이콘 자동완성용 데이터 소스.
 *
 * 넥슨 오픈 API에는 "이름으로 아이템을 검색"하는 엔드포인트가 없어서(캐릭터 장비 조회에만
 * 아이콘이 딸려 나옴), 비공식 커뮤니티 프로젝트인 maplestory.io의 아이템 카탈로그 API를
 * 검색 자동완성 전용으로 사용한다. 실제 코디 검색 결과(캐릭터 매칭)는 여전히 우리 DB(현재는
 * 목업)를 기준으로 하고, 여기서는 "이런 아이템이 있어요" 하고 아이콘을 보여주는 용도로만 쓴다.
 *
 * 실제 API 키로 /character/cashitem-equipment를 직접 호출해 확인한 결과, 응답에 나오는
 * cash_item_equipment_part는 모자/얼굴장식/눈장식/귀고리/반지/신발/장갑/망토/무기/방패/한벌옷
 * 뿐이었다 (헤어/성형/피부, 펫/펫장비 등은 이 엔드포인트에 없음). 반지와 "투명 OO"류(빈
 * 슬롯 placeholder)는 캐릭터 이미지에 실질적으로 안 보이거나 크롤링 대상이 아니므로
 * 자동완성에서도 노출하지 않는다.
 */

const MAPLESTORY_IO_BASE = "https://maplestory.io/api/KMS/389";

const WEAPON_CATEGORIES = new Set(["One-Handed Weapon", "Two-Handed Weapon", "Secondary Weapon"]);

/** cash_item_equipment_part 실측값에 대응하는 maplestory.io subCategory -> 우리 쪽 한글 부위명. */
const SUB_CATEGORY_TO_PART: Record<string, string> = {
  Hat: "모자",
  "Face Accessory": "얼굴장식",
  "Eye Decoration": "눈장식",
  Earrings: "귀고리",
  Earring: "귀고리", // 표기 변형
  Top: "상의",
  Bottom: "하의",
  Overall: "한벌옷",
  Shoes: "신발",
  Glove: "장갑",
  Cape: "망토",
  Shield: "방패",
};

const ALLOWED_SUB_CATEGORIES = new Set(Object.keys(SUB_CATEGORY_TO_PART));

function isRealCashEquipment(item: MapleStoryIoItem): boolean {
  if (!item.isCash || item.typeInfo?.overallCategory !== "Equip") return false;
  if (item.name.startsWith("투명")) return false;
  const category = item.typeInfo.category ?? "";
  const subCategory = item.typeInfo.subCategory ?? "";
  return WEAPON_CATEGORIES.has(category) || ALLOWED_SUB_CATEGORIES.has(subCategory);
}

/** 헤어/성형이 "헤어"/"성형"으로 뜨는 것처럼, 캐시 아이템도 착용 부위를 라벨로 보여준다. */
function toPartLabel(item: MapleStoryIoItem): string | null {
  const subCategory = item.typeInfo?.subCategory ?? "";
  if (SUB_CATEGORY_TO_PART[subCategory]) return SUB_CATEGORY_TO_PART[subCategory];
  const category = item.typeInfo?.category ?? "";
  return WEAPON_CATEGORIES.has(category) ? "무기" : null;
}

/** requiredGender: 0=남, 1=여, 3=공용(표시 안 함). 그 외 값도 표시하지 않는다. */
function toGenderLabel(requiredGender: number | undefined): "남" | "여" | null {
  if (requiredGender === 0) return "남";
  if (requiredGender === 1) return "여";
  return null;
}

/**
 * 같은 이름으로 여러 아이템 ID가 검색되는 경우(예: "투명 방패"가 설명 없는 것/있는 것
 * 두 개 ID로 존재)가 있다. 화면에 실제로 보이는 성별 라벨(genderLabel) 기준으로 묶어서
 * 처리하므로, "메소레인저 블랙 헬멧"처럼 이름은 같아도 남/여로 표시가 갈리는 진짜 별개
 * 아이템은 서로를 지우지 않는다. requiredGender 원본값(0/1/3/4/6...) 기준으로 묶으면,
 * "화이트 타임"처럼 화면엔 똑같이 라벨이 안 보이는데(둘 다 남/여가 아님) 원본 코드값만
 * 다른 항목(4, 6 등)이 서로 다른 그룹으로 남아 사용자 눈엔 완전히 똑같은 중복으로 보였다.
 *
 * 실제 코디 검색(searchCoordiByItems)은 우리 DB의 cash_items.name을 ILIKE로 매칭할 뿐,
 * maplestory.io의 아이템 ID는 전혀 쓰지 않는다. 즉 이름+성별 라벨이 같으면 어떤 ID를
 * 보여주든 검색 결과는 동일하므로, 자동완성 목록에는 그룹당 정확히 하나만 남겨야 한다.
 * "desc 있는 것이 하나라도 있으면 desc 있는 것들을 전부" 남기면 "마스터 타임"/"악몽
 * 진주"처럼 desc 있는 항목이 2개 이상인 경우 그대로 중복 노출되므로, desc 있는 것 중
 * 하나(없으면 그냥 첫 번째)만 남긴다.
 */
function dedupeByName(items: MapleStoryIoItem[]): MapleStoryIoItem[] {
  const groups = new Map<string, MapleStoryIoItem[]>();
  for (const item of items) {
    const key = `${item.name}|${toGenderLabel(item.requiredGender) ?? ""}`;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  const result: MapleStoryIoItem[] = [];
  for (const group of groups.values()) {
    const withDesc = group.filter((item) => (item.desc ?? "").trim().length > 0);
    result.push(...(withDesc.length > 0 ? withDesc.slice(0, 1) : group.slice(0, 1)));
  }
  return result;
}

interface MapleStoryIoItem {
  id: number;
  name: string;
  desc?: string;
  isCash?: boolean;
  requiredGender?: number;
  typeInfo?: {
    overallCategory?: string;
    category?: string;
    subCategory?: string;
  };
}

export interface ItemSuggestion {
  id: number;
  name: string;
  iconUrl: string;
  /** "남"/"여"만 표시하고, 공용(3)이거나 알 수 없는 값이면 null (표시 안 함). */
  genderLabel: "남" | "여" | null;
  /** 착용 부위(모자/상의/신발/무기 등). 헤어/성형/피부가 "헤어"/"성형"/"피부"로 뜨는 것과 같은 목적. */
  part: string | null;
  /** 이 아이템을 실제로 착용 중인 캐릭터 수. /api/item-suggestions 라우트에서 DB 조회 후 채워진다. */
  wearerCount?: number;
}

export async function searchItemSuggestions(
  query: string,
  limit = 15,
): Promise<ItemSuggestion[]> {
  const keyword = query.trim();
  if (keyword.length === 0) return [];

  const url = `${MAPLESTORY_IO_BASE}/item?searchFor=${encodeURIComponent(keyword)}&count=${limit * 4}`;

  let items: MapleStoryIoItem[];
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return [];
    items = await response.json();
  } catch {
    // maplestory.io 장애/타임아웃 시에도 검색 자체는 계속 쓸 수 있어야 하므로 조용히 빈 목록 반환.
    return [];
  }

  return dedupeByName(items.filter(isRealCashEquipment))
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      name: item.name,
      iconUrl: `${MAPLESTORY_IO_BASE}/item/${item.id}/icon`,
      genderLabel: toGenderLabel(item.requiredGender),
      part: toPartLabel(item),
    }));
}

/** 태그의 프리즘 토글 버튼에 쓰는 아이콘 (컬러링 프리즘). */
export const PRISM_ICON_URL = `${MAPLESTORY_IO_BASE}/item/5782000/icon`;

/** 장비 그리드의 헤어/성형/피부 칸에 쓰는 아이콘. */
export const HAIR_ICON_URL = "https://cdn.dak.gg/maple/images/analysis/hair-icon.png";
export const FACE_ICON_URL = "https://cdn.dak.gg/maple/images/analysis/face-icon.png";
export const SKIN_ICON_URL = "https://cdn.dak.gg/maple/images/analysis/skin-icon.png";
