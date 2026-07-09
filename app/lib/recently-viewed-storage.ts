/**
 * "최근 본 캐릭터" 목록을 브라우저에 기억해두는 헬퍼. liked-storage.ts와 같은 이유로
 * (로그인/세션 없음) localStorage에만 저장한다. 각 항목은 id와 마지막으로 본 시각(ms)을
 * 함께 저장해서 "N분 전" 같은 표시에 쓴다.
 */

const RECENTLY_VIEWED_KEY = "recentlyViewedCoordi";
const MAX_RECENTLY_VIEWED = 50;

export interface RecentlyViewedItem {
  id: number;
  viewedAt: number;
}

export function loadRecentlyViewed(): RecentlyViewedItem[] {
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecentlyViewed(items: RecentlyViewedItem[]) {
  try {
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(items));
  } catch {
    // localStorage를 못 쓰는 환경이면 그냥 무시한다.
  }
}

/** 최근 본 순으로 맨 앞에 추가한다(이미 있으면 시각만 갱신해서 맨 앞으로 옮김). 최근 N개만 남긴다. */
export function recordRecentlyViewed(id: number) {
  const current = loadRecentlyViewed().filter((item) => item.id !== id);
  const next = [{ id, viewedAt: Date.now() }, ...current].slice(0, MAX_RECENTLY_VIEWED);
  saveRecentlyViewed(next);
}
