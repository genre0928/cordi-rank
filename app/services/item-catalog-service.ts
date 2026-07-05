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
 * 뿐이었다 (헤어/성형/피부, 펫/펫장비 등은 이 엔드포인트에 없음). 반지는 캐릭터 이미지에
 * 렌더링되지 않아 크롤링 자체에서 제외하므로, 자동완성에서도 노출하지 않는다.
 */

const MAPLESTORY_IO_BASE = "https://maplestory.io/api/KMS/389";

const WEAPON_CATEGORIES = new Set(["One-Handed Weapon", "Two-Handed Weapon", "Secondary Weapon"]);

/** cash_item_equipment_part 실측값에 대응하는 maplestory.io subCategory만 허용한다. */
const ALLOWED_SUB_CATEGORIES = new Set([
  "Hat", // 모자
  "Face Accessory", // 얼굴장식
  "Eye Decoration", // 눈장식
  "Earrings", // 귀고리
  "Earring", // 귀고리 (표기 변형)
  "Top", // 상의
  "Bottom", // 하의
  "Overall", // 한벌옷
  "Shoes", // 신발
  "Glove", // 장갑
  "Cape", // 망토
  "Shield", // 방패
]);

function isRealCashEquipment(item: MapleStoryIoItem): boolean {
  if (!item.isCash || item.typeInfo?.overallCategory !== "Equip") return false;
  const category = item.typeInfo.category ?? "";
  const subCategory = item.typeInfo.subCategory ?? "";
  return WEAPON_CATEGORIES.has(category) || ALLOWED_SUB_CATEGORIES.has(subCategory);
}

interface MapleStoryIoItem {
  id: number;
  name: string;
  isCash?: boolean;
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
}

export async function searchItemSuggestions(
  query: string,
  limit = 8,
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

  return items
    .filter(isRealCashEquipment)
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      name: item.name,
      iconUrl: `${MAPLESTORY_IO_BASE}/item/${item.id}/icon`,
    }));
}

/** 태그의 프리즘 토글 버튼에 쓰는 아이콘 (컬러링 프리즘). */
export const PRISM_ICON_URL = `${MAPLESTORY_IO_BASE}/item/5782000/icon`;

/**
 * 헤어/성형/피부 칸에 쓰는 아이콘. 실제 "마네킹"(id 5680222) 캐시 아이템의 아이콘으로,
 * 게임 내에서 헤어·성형·피부 룩을 저장할 때 쓰는 바로 그 아이템이다.
 */
export const MANNEQUIN_ICON_URL = `${MAPLESTORY_IO_BASE}/item/5680222/icon`;
