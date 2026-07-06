import { Heart, Shirt } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
 * 착용 중인 아이템(부위: 이름) 목록 패널이 펼쳐진다(카드 전체가 아니라 아이콘에만 반응).
 * 패널은 이미지 높이에 갇히지 않고 필요한 만큼 늘어나므로(이미지 위를 덮는 방식이 아니라
 * 옆에 떠 있는 방식), 아이템이 많아도 잘리지 않는다.
 * 패널이 배지 오른쪽/왼쪽 중 어느 쪽으로 펼쳐질지는 hover 시점에 실제 남은 공간을 재서
 * 자동으로 정한다(모달/그리드가 몇 열이든, 카드가 맨 오른쪽에 있어도 화면 밖으로 잘리지 않음).
 * 마우스가 없는 모바일/터치 환경에서는 hover가 아예 발생하지 않으므로, 배지를 탭하면
 * 패널이 토글되고 바깥을 탭하면 닫히게 해서 데스크톱 hover와 동등하게 동작한다.
 * 그리드에서는 패널이 옆 카드 위로 넘어가므로, hover/탭으로 열린 카드 전체의 z-index를
 * 올려(has-[...]:z-40) 옆 카드의 배지/좋아요 버튼에 가려지지 않게 한다.
 * 착용하지 않은 부위는 목록에서 제외하고(반지는 아예 크롤링하지 않음), 헤어/성형/
 * 피부도 함께 보여준다. "투명 OO" 아이템은 이름 대신 맨 아래에 아이콘 한 줄로 모은다.
 */
export function CharacterImageCard({
  entry,
  rank,
  linkToDetail = false,
  showName = false,
}: {
  entry: CoordiEntry;
  rank?: number;
  /** true면 클릭 시 페이지 이동 대신 상세 정보 모달(CoordiDetailModal)을 연다. */
  linkToDetail?: boolean;
  /** 랭킹 사이드바처럼 이미지 아래에 캐릭터 닉네임을 보여줄 때 사용 */
  showName?: boolean;
}) {
  const { liked, count, toggle } = useLike(entry.id, entry.likeCount);
  const { rows, transparentItems } = buildDisplayRows(entry);
  const hasAnyItem = rows.length > 0 || transparentItems.length > 0;
  const { open: openDetailModal } = useCoordiModal();

  const triggerRef = useRef<HTMLDivElement>(null);
  // 상호작용 전 기본값은 "left"(왼쪽으로 펼침 = right-full로 카드 왼쪽 밖에 위치)여야 한다.
  // "right"를 기본값으로 두면 상호작용하지 않은 모든 카드의 숨겨진(opacity-0) 패널이
  // 카드 오른쪽 밖(양의 x 방향)으로 걸쳐 있게 되고, 이게 페이지 전체의 scrollWidth를
  // 늘려서 모바일에서 실제로 좌우로 밀리는 원인이 됐다. "left"가 기본이면 숨겨진 패널이
  // 왼쪽(음의 x 방향)으로 걸치는데, 이쪽은 scrollWidth에 영향을 주지 않는다. 실제 보여줄
  // 때는 hover/탭 시점에 updateOverlayAlign이 다시 계산하므로 최종 위치는 항상 정확하다.
  const [overlayAlign, setOverlayAlign] = useState<"right" | "left">("left");
  const [forceShow, setForceShow] = useState(false);

  function updateOverlayAlign() {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // 모달 안이면 뷰포트가 아니라 모달 박스 경계를 기준으로 남은 공간을 재야 한다.
    const dialog = el.closest('[role="dialog"]');
    const container = dialog?.querySelector<HTMLElement>(":scope > div") ?? document.documentElement;
    const containerRect = container.getBoundingClientRect();
    const spaceOnRight = containerRect.right - rect.right;
    const spaceOnLeft = rect.left - containerRect.left;
    // 절대 여유 공간이 아니라 좌/우 중 더 넓은 쪽으로 편다. 모바일 2열 그리드처럼 컨테이너
    // 전체 폭 기준으로는 양쪽 다 패널 폭보다 좁은 경우에도, 왼쪽 카드는 오른쪽으로(옆 카드
    // 위로), 오른쪽 카드는 왼쪽으로 펼쳐져야 자연스럽기 때문이다.
    setOverlayAlign(spaceOnRight >= spaceOnLeft ? "right" : "left");
  }

  function handleBadgeClick(event: React.MouseEvent) {
    event.stopPropagation();
    updateOverlayAlign();
    setForceShow((current) => !current);
  }

  // 모바일에서 패널을 연 채로 바깥을 탭하면 닫히게 한다.
  useEffect(() => {
    if (!forceShow) return;
    function handleOutsideClick(event: MouseEvent) {
      if (!triggerRef.current?.contains(event.target as Node)) setForceShow(false);
    }
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [forceShow]);

  return (
    <div className="relative has-[.info-trigger:hover]:z-40 has-[.info-trigger[data-open=true]]:z-40">
      <div className="relative aspect-[3/4] w-full">
        <div className="absolute inset-0 overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
          {rank !== undefined && <RankBadge rank={rank} />}
          {linkToDetail ? (
            <button
              type="button"
              onClick={() => openDetailModal(entry.id)}
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
          <div
            ref={triggerRef}
            data-open={forceShow}
            className="info-trigger group/info absolute right-2 top-2 z-30"
            onMouseEnter={updateOverlayAlign}
            onFocus={updateOverlayAlign}
          >
            <button
              type="button"
              onClick={handleBadgeClick}
              aria-pressed={forceShow}
              aria-label="착용 아이템 정보 보기"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur"
            >
              <Shirt className="h-3.5 w-3.5" aria-hidden="true" />
            </button>

            <div
              className={cn(
                "pointer-events-none absolute top-0 z-30 w-56 max-w-[80vw] rounded-lg bg-black/90 p-2.5 opacity-0 shadow-xl transition-opacity duration-150 group-hover/info:opacity-100",
                overlayAlign === "right" ? "left-full ml-1" : "right-full mr-1",
                forceShow && "opacity-100",
              )}
            >
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
