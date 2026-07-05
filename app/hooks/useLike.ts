import { useState } from "react";
import { useFetcher } from "react-router";

/**
 * 좋아요 버튼의 낙관적 업데이트 훅.
 * 클릭 즉시 화면을 갱신하고, /like/:ocid 리소스 라우트로 실제 반영을 요청한다.
 */
export function useLike(ocid: string, initialLiked: boolean, initialCount: number) {
  const fetcher = useFetcher();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);

  function toggle() {
    const nextLiked = !liked;
    setLiked(nextLiked);
    setCount((current) => current + (nextLiked ? 1 : -1));
    fetcher.submit(null, { method: "post", action: `/like/${ocid}` });
  }

  return { liked, count, toggle };
}
