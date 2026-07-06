import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { useFetcher, useSearchParams } from "react-router";
import { CharacterImageCard } from "~/components/CharacterImageCard";
import { cn } from "~/lib/cn";
import { loadLikedIds } from "~/lib/liked-storage";
import type { CoordiEntry } from "~/types/coordi";

const PAGE_SIZE = 20;

interface LikedCoordiResponse {
  entries: CoordiEntry[];
}

/**
 * 로그인/세션이 없어 "내가 좋아요한 코디"는 서버가 아니라 이 브라우저의
 * localStorage(likedIds)에만 기억된다. 그래서 이 페이지는 로더 없이, 마운트 후
 * localStorage에서 id 목록을 읽고 현재 페이지분만 /api/liked-coordi로 가져온다.
 */
export default function LikedCoordi() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPage = Math.max(1, Number(searchParams.get("page")) || 1);

  // null이면 아직 localStorage를 안 읽은 상태(SSR/하이드레이션 전)라는 뜻이라,
  // "좋아요한 코디가 없어요"가 먼저 잘못 뜨는 걸 막을 수 있다.
  const [likedIds, setLikedIds] = useState<number[] | null>(null);
  const fetcher = useFetcher<LikedCoordiResponse>();

  useEffect(() => {
    setLikedIds(loadLikedIds());
  }, []);

  const totalCount = likedIds?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageIds = (likedIds ?? []).slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageKey = pageIds.join(",");

  useEffect(() => {
    if (pageIds.length === 0) return;
    fetcher.load(`/api/liked-coordi?ids=${encodeURIComponent(pageKey)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey]);

  function goToPage(next: number) {
    const params = new URLSearchParams(searchParams);
    if (next <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(next));
    }
    setSearchParams(params);
    window.scrollTo({ top: 0 });
  }

  const entries = pageKey.length === 0 ? [] : (fetcher.data?.entries ?? []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight sm:text-3xl">
          <Heart className="h-6 w-6 text-red-500" fill="currentColor" aria-hidden="true" />
          내가 좋아요한 코디
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          이 브라우저에서 좋아요를 누른 코디를 모아서 볼 수 있어요.
        </p>
      </div>

      {likedIds === null ? (
        <p className="py-16 text-center text-gray-400">불러오는 중...</p>
      ) : totalCount === 0 ? (
        <p className="py-16 text-center text-gray-400">아직 좋아요한 코디가 없어요.</p>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {entries.map((entry) => (
              <li key={entry.id}>
                <CharacterImageCard entry={entry} linkToDetail showName />
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className={cn(
                  "rounded-full border border-gray-200 px-3.5 py-1.5 text-sm font-medium text-gray-500 transition dark:border-gray-700 dark:text-gray-300",
                  currentPage <= 1
                    ? "opacity-40"
                    : "hover:border-orange-300 hover:text-orange-500",
                )}
              >
                이전
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className={cn(
                  "rounded-full border border-gray-200 px-3.5 py-1.5 text-sm font-medium text-gray-500 transition dark:border-gray-700 dark:text-gray-300",
                  currentPage >= totalPages
                    ? "opacity-40"
                    : "hover:border-orange-300 hover:text-orange-500",
                )}
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
