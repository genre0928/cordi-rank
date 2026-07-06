import { useState } from "react";
import { useFetcher } from "react-router";
import { addLikedId, removeLikedId } from "~/lib/liked-storage";

/**
 * 좋아요 버튼의 낙관적 업데이트 훅.
 * 클릭 즉시 화면을 갱신하고, /like/:id 리소스 라우트로 실제 반영을 요청한다.
 * "내가 좋아요한 코디" 목록(브라우저 localStorage)도 함께 갱신한다.
 */
export function useLike(id: number, initialLiked: boolean, initialCount: number) {
  const fetcher = useFetcher();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);

  function toggle() {
    const nextLiked = !liked;
    setLiked(nextLiked);
    setCount((current) => current + (nextLiked ? 1 : -1));
    if (nextLiked) {
      addLikedId(id);
    } else {
      removeLikedId(id);
    }
    fetcher.submit(null, { method: "post", action: `/like/${id}` });
  }

  return { liked, count, toggle };
}
