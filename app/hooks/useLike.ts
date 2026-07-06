import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { addLikedId, loadLikedIds, removeLikedId } from "~/lib/liked-storage";

/**
 * 좋아요 버튼의 낙관적 업데이트 훅.
 * 로그인/세션이 없어 "이 브라우저가 이미 좋아요했는지"는 서버가 알 수 없다(예전엔
 * 서버 메모리로 흉내냈는데, Vercel 서버리스에선 요청마다 다른 인스턴스가 처리할 수
 * 있어 거의 항상 틀렸다 - 좋아요 후 새로고침하면 하트가 꺼져 보이고, 심하면 취소
 * 클릭도 서버가 "새 좋아요"로 착각해 카운트가 계속 올라가기만 했다). 그래서 "좋아요
 * 했는지"는 이 브라우저의 localStorage(likedIds, 내 좋아요 페이지와 동일한 저장소)만
 * 믿고, 서버에는 "지금부터 좋아요/취소해줘"라는 방향을 명시적으로 알려준다.
 */
export function useLike(id: number, initialCount: number) {
  const fetcher = useFetcher();
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);

  // SSR은 localStorage를 모르므로, 하이드레이션 후 이 브라우저의 실제 좋아요 여부로 보정한다.
  useEffect(() => {
    setLiked(loadLikedIds().includes(id));
  }, [id]);

  function toggle() {
    const nextLiked = !liked;
    setLiked(nextLiked);
    setCount((current) => current + (nextLiked ? 1 : -1));
    if (nextLiked) {
      addLikedId(id);
    } else {
      removeLikedId(id);
    }
    const formData = new FormData();
    formData.set("liked", String(nextLiked));
    fetcher.submit(formData, { method: "post", action: `/like/${id}` });
  }

  return { liked, count, toggle };
}
