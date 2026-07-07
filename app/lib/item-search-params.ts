import type { ItemSearchEntry, ItemSearchKind } from "~/types/coordi";

const SEP = "::";
const VALID_KINDS = new Set<ItemSearchKind>(["item", "hair", "face", "skin"]);

/** 아이템 검색어 + 프리즘 적용 여부 + 종류(아이템/헤어/성형/피부)를 하나의 쿼리 값으로 직렬화한다. */
export function encodeItemEntry(entry: ItemSearchEntry): string {
  return `${entry.kind}${SEP}${entry.prismOnly ? "1" : "0"}${SEP}${entry.keyword}`;
}

/**
 * kind::prismFlag::keyword 형식. kind/prismFlag는 값이 고정돼 있어 앞에서부터 잘라내고,
 * keyword는 어떤 문자든 올 수 있으니 나머지 전부를 그대로 쓴다.
 * kind가 추가되기 전(구버전) 링크는 keyword::prismFlag 형식이라 구분자가 하나뿐이므로,
 * 그 경우엔 item으로 간주해 계속 동작하게 한다.
 */
export function decodeItemEntry(raw: string): ItemSearchEntry | null {
  const firstSep = raw.indexOf(SEP);
  const secondSep = firstSep === -1 ? -1 : raw.indexOf(SEP, firstSep + SEP.length);

  if (firstSep !== -1 && secondSep !== -1) {
    const kindRaw = raw.slice(0, firstSep);
    const prismFlag = raw.slice(firstSep + SEP.length, secondSep);
    const keyword = raw.slice(secondSep + SEP.length).trim();
    if (keyword.length > 0 && VALID_KINDS.has(kindRaw as ItemSearchKind)) {
      return { keyword, prismOnly: prismFlag === "1", kind: kindRaw as ItemSearchKind };
    }
  }

  const legacySep = raw.lastIndexOf(SEP);
  const keyword = (legacySep === -1 ? raw : raw.slice(0, legacySep)).trim();
  if (keyword.length === 0) return null;
  const prismFlag = legacySep === -1 ? "0" : raw.slice(legacySep + SEP.length);
  return { keyword, prismOnly: prismFlag === "1", kind: "item" };
}
