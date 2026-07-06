import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useFetcher } from "react-router";
import { CoordiDetailContent } from "~/components/CoordiDetailContent";
import { useCoordiModal } from "~/context/coordi-modal";
import type { loader } from "~/routes/coordi-detail";

/**
 * 카드를 클릭했을 때 페이지 이동 없이 뜨는 상세 정보 모달.
 * /coordi/:id 라우트의 loader를 fetcher로 그대로 재사용해 데이터를 가져오고,
 * 화면은 페이지와 동일한 CoordiDetailContent로 그린다. 주소창 URL은 바뀌지 않는다.
 */
export function CoordiDetailModal() {
  const { id, close } = useCoordiModal();
  const fetcher = useFetcher<typeof loader>();
  const loadedIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (id && loadedIdRef.current !== id) {
      loadedIdRef.current = id;
      fetcher.load(`/coordi/${id}`);
    }
    if (!id) loadedIdRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [id, close]);

  if (!id) return null;

  const data = fetcher.data;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={close}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto overflow-x-hidden rounded-2xl bg-white p-4 pt-8 shadow-2xl [-ms-overflow-style:none] [scrollbar-width:none] dark:bg-gray-900 sm:p-6 sm:pt-10 [&::-webkit-scrollbar]:hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="닫기"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        {!data ? (
          <div className="py-24 text-center text-gray-400">불러오는 중...</div>
        ) : (
          <CoordiDetailContent entry={data.entry} sameItemCoordi={data.sameItemCoordi} liked={data.liked} />
        )}
      </div>
    </div>
  );
}
