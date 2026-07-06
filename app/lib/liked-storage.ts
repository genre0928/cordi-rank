/**
 * "내가 좋아요한 코디" 목록을 브라우저에 기억해두는 헬퍼.
 *
 * 로그인/세션이 없어 서버는 "이 코디를 좋아요한 사람이 있는지"만 알 뿐 "누가"
 * 좋아요했는지는 모른다(coordi-service.server.ts의 likedByUser는 서버리스 인스턴스
 * 메모리라 사용자 구분과도 무관하다). 그래서 "내" 좋아요 목록은 이 브라우저의
 * localStorage에 코디 스냅샷 id만 저장해두고, 상세 정보는 /api/liked-coordi에서
 * 그때그때 가져온다.
 */

const LIKED_IDS_KEY = "likedIds";

export function loadLikedIds(): number[] {
  try {
    const raw = localStorage.getItem(LIKED_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLikedIds(ids: number[]) {
  try {
    localStorage.setItem(LIKED_IDS_KEY, JSON.stringify(ids));
  } catch {
    // localStorage를 못 쓰는 환경이면 그냥 무시한다.
  }
}

/** 최근 좋아요한 순으로 맨 앞에 추가한다(이미 있으면 중복 추가하지 않음). */
export function addLikedId(id: number) {
  const current = loadLikedIds();
  if (current.includes(id)) return;
  saveLikedIds([id, ...current]);
}

export function removeLikedId(id: number) {
  const current = loadLikedIds();
  saveLikedIds(current.filter((existing) => existing !== id));
}
