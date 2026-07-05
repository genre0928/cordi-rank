import type { AppearanceInfo, CashItem, CoordiEntry, SkinInfo } from "~/types/coordi";

/**
 * 캐릭터가 착용 중인 항목(캐시 아이템 + 헤어/성형/피부)을 화면에 보여줄 순서대로 정리한다.
 * 캐릭터 카드 hover 레이어, 코디 상세 페이지, 상세 모달의 장비 그리드가 이 로직을 함께 쓴다.
 */

const NON_WEAPON_PARTS = new Set<string>([
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
  "방패",
]);

/** 무기 종류는 "두손검"/"블레이드"처럼 구체적인 이름으로 저장돼 있어, 목록 표시용으로 "무기"로 묶는다. */
function normalizePart(part: string): string {
  return NON_WEAPON_PARTS.has(part) || part === "무기" ? part : "무기";
}

/** 부위(정규화됨)별로 착용 중인 캐시 아이템 하나씩만 남긴 맵. */
function buildItemsByPart(entry: CoordiEntry): Map<string, CashItem> {
  const byPart = new Map<string, CashItem>();
  for (const item of entry.cashItems) {
    const normalized = normalizePart(item.part);
    if (!byPart.has(normalized)) byPart.set(normalized, item);
  }
  return byPart;
}

/** 양수는 +를 붙이고, 음수는 원래 - 부호를 그대로 둔다. */
function formatSigned(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/** color_range 첫 단어("빨간색", "전체" 등)를 짧은 색 이름으로 축약. 목록에 없으면 "색" 접미사만 뗀다. */
const COLOR_RANGE_LABELS: Record<string, string> = {
  빨간색: "빨강",
  주황색: "주황",
  노란색: "노랑",
  초록색: "초록",
  파란색: "파랑",
  남색: "남색",
  보라색: "보라",
  자주색: "자주",
  청록색: "청록",
  하얀색: "하양",
  검은색: "검정",
  분홍색: "분홍",
};

function shortColorRangeLabel(colorRange: string): string {
  const firstWord = colorRange.split(" ")[0];
  return COLOR_RANGE_LABELS[firstWord] ?? firstWord.replace(/색$/, "");
}

/** 프리즘 적용 아이템 옆에 붙일 색상 계열 + 색조/채도/명도 표기. ex) (전체 +344 +99 +75) */
function formatPrismInfo(item: CashItem): string | null {
  if (!item.prismApplied || item.hue === null || item.saturation === null || item.value === null) {
    return null;
  }
  const rangeLabel = item.colorRange ? shortColorRangeLabel(item.colorRange) : null;
  const parts = [rangeLabel, formatSigned(item.hue), formatSigned(item.saturation), formatSigned(item.value)].filter(
    (part): part is string => !!part,
  );
  return `(${parts.join(" ")})`;
}

/** 헤어/성형처럼 기본색+혼합색 비율로 표현되는 항목의 표기. 혼합색이 없으면(단색) 표시하지 않는다. */
function formatMixInfo(info: AppearanceInfo): string | null {
  if (!info.mixColor || info.mixRate === null) return null;
  const baseChar = info.baseColor?.[0] ?? "";
  const mixChar = info.mixColor[0];
  return `(${baseChar}${100 - info.mixRate}:${mixChar}${info.mixRate})`;
}

/** 헤어 이름 앞에 붙는 "갈색 어비스 헤어"의 색상 접두어("갈색")를 떼고 "어비스 헤어"만 남긴다. */
function stripLeadingColor(name: string, baseColor: string | null): string {
  if (!baseColor || !name.startsWith(baseColor)) return name;
  return name.slice(baseColor.length).trimStart();
}

/** 피부는 색조/채도/명도로 표현된다. 프리셋 피부는 값이 없어 표시하지 않는다. */
function formatSkinInfo(skin: SkinInfo): string | null {
  if (skin.hue === null || skin.saturation === null || skin.brightness === null) return null;
  return `(색${skin.hue} 채${skin.saturation} 명${skin.brightness})`;
}

/** 부위 하나의 착용 정보. name이 null이면 미착용(빈 슬롯)이다. */
interface RawSlot {
  key: string;
  label: string;
  name: string | null;
  /** 캐시 아이템만 아이콘이 있다. 헤어/성형/피부는 null (아이콘 그리드에서 대체 아이콘을 쓴다). */
  iconUrl: string | null;
  prismApplied: boolean;
  extra: string | null;
}

/** 빈 슬롯을 감추는 "투명 OO" 아이템. 이름 대신 아이콘 한 줄로 따로 모아 보여준다. */
export interface TransparentItem {
  key: string;
  name: string;
  iconUrl: string;
}

const SLOT_ORDER = [
  "모자",
  "헤어",
  "성형",
  "피부",
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

/** 부위별 착용 정보를 SLOT_ORDER 순서대로 만든다. 투명 아이템은 미착용과 동일하게(빈 슬롯) 취급한다. */
function buildRawSlots(entry: CoordiEntry): RawSlot[] {
  const byPart = buildItemsByPart(entry);

  function cashSlot(part: string): RawSlot {
    const item = byPart.get(part);
    if (!item || item.name.startsWith("투명")) {
      return { key: part, label: part, name: null, iconUrl: null, prismApplied: false, extra: null };
    }
    return {
      key: part,
      label: part,
      name: item.name,
      iconUrl: item.iconUrl,
      prismApplied: item.prismApplied,
      extra: formatPrismInfo(item),
    };
  }

  const slotByKey: Record<(typeof SLOT_ORDER)[number], RawSlot> = {
    모자: cashSlot("모자"),
    헤어: entry.hair.name
      ? {
          key: "헤어",
          label: "헤어",
          name: stripLeadingColor(entry.hair.name, entry.hair.baseColor),
          iconUrl: null,
          prismApplied: false,
          extra: formatMixInfo(entry.hair),
        }
      : { key: "헤어", label: "헤어", name: null, iconUrl: null, prismApplied: false, extra: null },
    성형: entry.face.name
      ? {
          key: "성형",
          label: "성형",
          name: entry.face.name,
          iconUrl: null,
          prismApplied: false,
          extra: formatMixInfo(entry.face),
        }
      : { key: "성형", label: "성형", name: null, iconUrl: null, prismApplied: false, extra: null },
    피부: entry.skin.name
      ? {
          key: "피부",
          label: "피부",
          name: entry.skin.name,
          iconUrl: null,
          prismApplied: false,
          extra: formatSkinInfo(entry.skin),
        }
      : { key: "피부", label: "피부", name: null, iconUrl: null, prismApplied: false, extra: null },
    눈장식: cashSlot("눈장식"),
    귀고리: cashSlot("귀고리"),
    상의: cashSlot("상의"),
    하의: cashSlot("하의"),
    한벌옷: cashSlot("한벌옷"),
    신발: cashSlot("신발"),
    장갑: cashSlot("장갑"),
    망토: cashSlot("망토"),
    무기: cashSlot("무기"),
    방패: cashSlot("방패"),
  };

  return SLOT_ORDER.map((key) => slotByKey[key]);
}

function buildTransparentItems(entry: CoordiEntry): TransparentItem[] {
  const byPart = buildItemsByPart(entry);

  return [...byPart.values()]
    .filter((item) => item.name.startsWith("투명"))
    .map((item) => ({ key: item.part, name: item.name, iconUrl: item.iconUrl }));
}

export interface DisplayRow {
  key: string;
  label: string;
  name: string;
  iconUrl: string | null;
  prismApplied: boolean;
  extra: string | null;
}

export interface DisplayRowsResult {
  rows: DisplayRow[];
  transparentItems: TransparentItem[];
}

/** 착용 순서대로 행을 만든다. 착용하지 않은 부위는 목록에서 제외한다(hover 텍스트 목록용). */
export function buildDisplayRows(entry: CoordiEntry): DisplayRowsResult {
  const rows = buildRawSlots(entry).filter(
    (slot): slot is RawSlot & { name: string } => slot.name !== null,
  );
  return { rows, transparentItems: buildTransparentItems(entry) };
}

/** 장비 그리드(모달/상세) 한 칸. name이 null이면 미착용(빈 슬롯)이다. */
export interface GridSlot extends RawSlot {}

export interface EquipmentGridLayout {
  /** 반지 4칸 + 얼굴장식/눈장식/귀고리, 2열로 배치한다(반지는 항상 빈 슬롯). */
  left: GridSlot[];
  /** 모자/망토/한벌옷·상의/장갑/하의/신발/무기/방패(보조무기), 2열로 배치한다. */
  right: GridSlot[];
  /** 헤어/성형/피부. 캐릭터 이미지 아래에 마네킹 아이콘으로 표시한다. */
  appearance: GridSlot[];
}

/**
 * 메이플스토리 인벤토리 창의 실제 슬롯 배치를 참고한 장비 그리드 레이아웃을 만든다.
 * 반지는 크롤링하지 않으므로 항상 빈 슬롯이다. 한벌옷/상의는 한 칸에 합쳐서(있는 쪽을)
 * 보여준다. 그리드에서는 "투명 OO" 아이템도 숨기지 않고 원래 부위 칸에 그대로 보여준다
 * (hover 텍스트 목록과 달리 부위별 고정 칸이 있어 따로 모아둘 필요가 없다).
 */
export function buildEquipmentGridLayout(entry: CoordiEntry): EquipmentGridLayout {
  const byPart = buildItemsByPart(entry);

  function slot(item: CashItem | undefined, key: string, label: string): GridSlot {
    if (!item) return { key, label, name: null, iconUrl: null, prismApplied: false, extra: null };
    return {
      key,
      label,
      name: item.name,
      iconUrl: item.iconUrl,
      prismApplied: item.prismApplied,
      extra: formatPrismInfo(item),
    };
  }

  function emptyRing(key: string): GridSlot {
    return { key, label: "반지", name: null, iconUrl: null, prismApplied: false, extra: null };
  }

  const topOrOverall = byPart.get("한벌옷") ?? byPart.get("상의");

  const left: GridSlot[] = [
    emptyRing("ring-1"),
    slot(byPart.get("얼굴장식"), "얼굴장식", "얼굴장식"),
    emptyRing("ring-2"),
    slot(byPart.get("눈장식"), "눈장식", "눈장식"),
    emptyRing("ring-3"),
    slot(byPart.get("귀고리"), "귀고리", "귀고리"),
    emptyRing("ring-4"),
  ];

  const right: GridSlot[] = [
    slot(byPart.get("모자"), "모자", "모자"),
    slot(byPart.get("망토"), "망토", "망토"),
    slot(topOrOverall, "한벌옷", "상의"),
    slot(byPart.get("장갑"), "장갑", "장갑"),
    slot(byPart.get("하의"), "하의", "하의"),
    slot(byPart.get("신발"), "신발", "신발"),
    slot(byPart.get("무기"), "무기", "무기"),
    slot(byPart.get("방패"), "방패", "보조무기"),
  ];

  const appearance: GridSlot[] = [
    entry.hair.name
      ? {
          key: "hair",
          label: "헤어",
          name: stripLeadingColor(entry.hair.name, entry.hair.baseColor),
          iconUrl: null,
          prismApplied: false,
          extra: formatMixInfo(entry.hair),
        }
      : { key: "hair", label: "헤어", name: null, iconUrl: null, prismApplied: false, extra: null },
    entry.face.name
      ? {
          key: "face",
          label: "성형",
          name: entry.face.name,
          iconUrl: null,
          prismApplied: false,
          extra: formatMixInfo(entry.face),
        }
      : { key: "face", label: "성형", name: null, iconUrl: null, prismApplied: false, extra: null },
    entry.skin.name
      ? {
          key: "skin",
          label: "피부",
          name: entry.skin.name,
          iconUrl: null,
          prismApplied: false,
          extra: formatSkinInfo(entry.skin),
        }
      : { key: "skin", label: "피부", name: null, iconUrl: null, prismApplied: false, extra: null },
  ];

  return { left, right, appearance };
}
