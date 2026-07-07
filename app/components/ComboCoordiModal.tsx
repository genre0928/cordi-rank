import { X } from "lucide-react";
import { useEffect } from "react";
import { useFetcher } from "react-router";
import { CharacterImageCard } from "~/components/CharacterImageCard";
import { useComboModal } from "~/context/combo-modal";
import type { CoordiEntry } from "~/types/coordi";

/**
 * 통계 사이드바에서 색상 조합 한 줄을 클릭했을 때 뜨는 모달. 그 조합과 정확히 일치하는
 * 코디들을 카드로 보여준다. 카드 이미지를 크게 보여주기 위해 한 줄에 3~4장만 놓고
 * (overflow-x-auto + snap) 좌우로 슬라이드해서 나머지를 보게 했다. 카드 자체는
 * CharacterImageCard를 그대로 써서 좋아요/착용 아이템 정보 hover도 그대로 쓸 수 있다.
 * 카드를 클릭하면(상세 모달을 또 띄우는 대신) 실제 상세 페이지로 이동한다 — 모달 위에
 * 모달이 쌓이는 걸 피하기 위해서다.
 */
export function ComboCoordiModal() {
  const { target, close } = useComboModal();
  const fetcher = useFetcher<{ entries: CoordiEntry[] }>();

  useEffect(() => {
    if (target) fetcher.load(`/api/liked-coordi?ids=${target.entryIds.join(",")}`);
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={close}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-4 pt-8 shadow-2xl dark:bg-gray-900"
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
          <ul
            className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {entries.map((entry) => (
              <li key={entry.id} className="w-[28%] shrink-0 snap-start sm:w-[23%]">
                <CharacterImageCard entry={entry} navigateToDetail onNavigate={close} showName />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
