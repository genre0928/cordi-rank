import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { CharacterImageCard } from "~/components/CharacterImageCard";
import { cn } from "~/lib/cn";
import { useComboModal } from "~/context/combo-modal";
import type { CoordiEntry } from "~/types/coordi";

/** 한 페이지에 보여줄 카드 수. 한 줄(가로 스크롤/줄바꿈 없이)에 고정으로 들어가는 개수라, 세로 방향으로는 절대 넘치지 않는다. */
const CARDS_PER_PAGE = 3;

/**
 * 통계 사이드바에서 색상 조합 한 줄을 클릭했을 때 뜨는 모달. 그 조합과 정확히 일치하는
 * 코디들을 카드로 보여준다. 카드 이미지를 크게 보여주려고 한 줄에 3장만 고정으로 놓고,
 * 스크롤/스와이프 대신 좌우 화살표 버튼으로 페이지를 넘긴다(스크롤 컨테이너를 쓰면
 * 세로 방향 여유 공간이 있어도 트랙패드/터치에서 위아래로도 딸려 움직이는 경우가 있어,
 * 아예 스크롤 자체를 없앴다). 카드는 CharacterImageCard를 그대로 써서 좋아요/착용
 * 아이템 정보 hover도 그대로 쓸 수 있다. 카드를 클릭하면(상세 모달을 또 띄우는 대신)
 * 실제 상세 페이지로 이동한다 — 모달 위에 모달이 쌓이는 걸 피하기 위해서다.
 */
export function ComboCoordiModal() {
  const { target, close } = useComboModal();
  const fetcher = useFetcher<{ entries: CoordiEntry[] }>();
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (target) fetcher.load(`/api/liked-coordi?ids=${target.entryIds.join(",")}`);
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.label]);

  useEffect(() => {
    if (!target) return;
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
  }, [target, close]);

  if (!target) return null;

  const entries = fetcher.data?.entries;
  const totalPages = entries ? Math.ceil(entries.length / CARDS_PER_PAGE) : 0;
  const pageEntries = entries?.slice(page * CARDS_PER_PAGE, page * CARDS_PER_PAGE + CARDS_PER_PAGE) ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={close}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl bg-white p-6 pt-9 shadow-2xl dark:bg-gray-900"
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

        <h2 className="pr-8 text-sm font-semibold text-gray-700 dark:text-gray-200">{target.label}</h2>

        {!entries ? (
          <p className="py-16 text-center text-gray-400">불러오는 중...</p>
        ) : entries.length === 0 ? (
          <p className="py-16 text-center text-gray-400">표시할 코디가 없어요.</p>
        ) : (
          <div className="mt-4 flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={page === 0}
              aria-label="이전 코디"
              className={cn(
                "shrink-0 rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 dark:hover:bg-gray-800",
                page === 0 && "invisible",
              )}
            >
              <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            </button>

            <ul className="grid flex-1 grid-cols-3 gap-3 sm:gap-4">
              {pageEntries.map((entry) => (
                <li key={entry.id}>
                  <CharacterImageCard entry={entry} navigateToDetail onNavigate={close} showName />
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
              disabled={page >= totalPages - 1}
              aria-label="다음 코디"
              className={cn(
                "shrink-0 rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 dark:hover:bg-gray-800",
                page >= totalPages - 1 && "invisible",
              )}
            >
              <ChevronRight className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
        )}

        {totalPages > 1 && (
          <p className="mt-3 text-center text-xs text-gray-400">
            {page + 1} / {totalPages}
          </p>
        )}
      </div>
    </div>
  );
}
