import { Heart, Shirt } from "lucide-react";
import { CoordiPortrait } from "~/components/CoordiPortrait";
import { RankBadge } from "~/components/RankBadge";
import { useCoordiModal } from "~/context/coordi-modal";
import { useLike } from "~/hooks/useLike";
import { buildDisplayRows } from "~/lib/coordi-display-rows";
import { cn } from "~/lib/cn";
import { PRISM_ICON_URL } from "~/services/item-catalog-service";
import type { CoordiEntry } from "~/types/coordi";

/**
 * 이름/레벨/직업 같은 상세 정보 없이 이미지와 좋아요만 노출하는 단순 카드.
 * 아이템 검색 결과와 랭킹 사이드바 모두 이 카드를 사용한다.
 * 이미지 우측 상단에 착용 아이템 아이콘이 고정으로 떠 있고, 이 아이콘에 hover하면
 * 배지 오른쪽으로 착용 중인 아이템(부위: 이름) 목록 패널이 펼쳐진다(카드 전체가 아니라
 * 아이콘에만 반응). 패널은 이미지 높이에 갇히지 않고 필요한 만큼 늘어나므로(이미지
 * 위를 덮는 방식이 아니라 옆에 떠 있는 방식), 아이템이 많아도 잘리지 않는다.
 * 그리드에서는 패널이 옆 카드 위로 넘어가므로, hover 중인 카드 전체의 z-index를
 * 올려(has-[...]:z-40) 옆 카드의 배지/좋아요 버튼에 가려지지 않게 한다.
 * 착용하지 않은 부위는 목록에서 제외하고(반지는 아예 크롤링하지 않음), 헤어/성형/
 * 피부도 함께 보여준다. "투명 OO" 아이템은 이름 대신 맨 아래에 아이콘 한 줄로 모은다.
 */
export function CharacterImageCard({
  entry,
  rank,
  initiallyLiked,
  linkToDetail = false,
  showName = false,
}: {
  entry: CoordiEntry;
  rank?: number;
  initiallyLiked: boolean;
  /** true면 클릭 시 페이지 이동 대신 상세 정보 모달(CoordiDetailModal)을 연다. */
  linkToDetail?: boolean;
  /** 랭킹 사이드바처럼 이미지 아래에 캐릭터 닉네임을 보여줄 때 사용 */
  showName?: boolean;
}) {
  const { liked, count, toggle } = useLike(entry.ocid, initiallyLiked, entry.likeCount);
  const { rows, transparentItems } = buildDisplayRows(entry);
  const hasAnyItem = rows.length > 0 || transparentItems.length > 0;
  const { open: openDetailModal } = useCoordiModal();

  return (
    <div className="relative has-[.info-trigger:hover]:z-40">
      <div className="relative aspect-[3/4] w-full">
        <div className="absolute inset-0 overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
          {rank !== undefined && <RankBadge rank={rank} />}
          {linkToDetail ? (
            <button
              type="button"
              onClick={() => openDetailModal(entry.ocid)}
              aria-label={`${entry.characterName} 코디 상세보기`}
              className="block h-full w-full text-left"
            >
              <CoordiPortrait entry={entry} />
            </button>
          ) : (
            <div className="block h-full w-full">
              <CoordiPortrait entry={entry} />
            </div>
          )}

          <button
            type="button"
            onClick={toggle}
            aria-pressed={liked}
            aria-label={liked ? "좋아요 취소" : "좋아요"}
            className={cn(
              "absolute bottom-2 right-2 z-20 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-xs font-semibold text-white backdrop-blur transition active:scale-95",
              liked && "bg-red-500/90",
            )}
          >
            <Heart className="h-3.5 w-3.5" fill={liked ? "currentColor" : "none"} aria-hidden="true" />
            {count.toLocaleString("ko-KR")}
          </button>
        </div>

        {hasAnyItem && (
          <div className="info-trigger group/info absolute right-2 top-2 z-30">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur">
              <Shirt className="h-3.5 w-3.5" aria-hidden="true" />
            </div>

            <div className="pointer-events-none absolute left-full top-0 z-30 ml-1 w-56 max-w-[80vw] rounded-lg bg-black/90 p-2.5 opacity-0 shadow-xl transition-opacity duration-150 group-hover/info:opacity-100">
              <ul className="space-y-1 text-[11px] leading-tight text-white">
                {rows.map((row) => (
                  <li key={row.key}>
                    <div className="flex items-center gap-1">
                      <span className="shrink-0 text-white/55">{row.label}</span>
                      <span className="shrink-0 text-white/40">:</span>
                      <span className="flex min-w-0 items-center gap-1">
                        {row.prismApplied && (
                          <img src={PRISM_ICON_URL} alt="프리즘" className="h-3 w-3 shrink-0" />
                        )}
                        <span className="truncate">{row.name}</span>
                      </span>
                    </div>
                    {row.extra && <div className="pl-3 text-orange-200">{row.extra}</div>}
                  </li>
                ))}
                {transparentItems.length > 0 && (
                  <li className="flex flex-wrap items-center gap-1 pt-0.5">
                    {transparentItems.map((item) => (
                      <img
                        key={item.key}
                        src={item.iconUrl}
                        alt={item.name}
                        title={item.name}
                        className="h-4 w-4 rounded bg-white/10 object-contain"
                      />
                    ))}
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}
      </div>

      {showName && (
        <p className="mt-1.5 truncate text-center text-xs font-medium text-gray-600 dark:text-gray-300">
          {entry.characterName}
        </p>
      )}
    </div>
  );
}
