import { X } from "lucide-react";
import { useEffect } from "react";
import { Link, useFetcher } from "react-router";
import { CoordiPortrait } from "~/components/CoordiPortrait";
import { useComboModal } from "~/context/combo-modal";
import type { CoordiEntry } from "~/types/coordi";

/**
 * 통계 사이드바에서 색상 조합 한 줄을 클릭했을 때 뜨는 모달. 그 조합과 정확히 일치하는
 * 코디들을 작은 카드 그리드로 보여준다. 카드를 클릭하면(상세 모달을 또 띄우는 대신)
 * 상세 페이지로 실제 이동한다 — 모달 위에 모달이 쌓이는 걸 피하기 위해서다.
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
        className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 pt-8 shadow-2xl dark:bg-gray-900"
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
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Link
                  to={`/coordi/${entry.id}`}
                  onClick={close}
                  aria-label={`${entry.characterName} 코디 상세화면으로 이동`}
                  className="block aspect-[3/4] overflow-hidden rounded-lg border border-gray-100 dark:border-gray-800"
                >
                  <CoordiPortrait entry={entry} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
