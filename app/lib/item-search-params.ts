import type { ItemSearchEntry } from "~/types/coordi";

const PRISM_SEPARATOR = "::";

/** 아이템 검색어 + 프리즘 적용 여부를 하나의 쿼리 값으로 직렬화한다. */
export function encodeItemEntry(entry: ItemSearchEntry): string {
  return `${entry.keyword}${PRISM_SEPARATOR}${entry.prismOnly ? "1" : "0"}`;
}

export function decodeItemEntry(raw: string): ItemSearchEntry | null {
  const separatorIndex = raw.lastIndexOf(PRISM_SEPARATOR);
  const keyword = (separatorIndex === -1 ? raw : raw.slice(0, separatorIndex)).trim();
  if (keyword.length === 0) return null;

  const prismFlag = separatorIndex === -1 ? "0" : raw.slice(separatorIndex + PRISM_SEPARATOR.length);
  return { keyword, prismOnly: prismFlag === "1" };
}
