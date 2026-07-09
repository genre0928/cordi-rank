import { useEffect, useRef, useState } from "react";
import { CoordiPortrait } from "~/components/CoordiPortrait";
import { buildEquipmentGridLayout, type GridSlot } from "~/lib/coordi-display-rows";
import { cn } from "~/lib/cn";
import { FACE_ICON_URL, HAIR_ICON_URL, PRISM_ICON_URL, SKIN_ICON_URL } from "~/services/item-catalog-service";
import type { CoordiEntry } from "~/types/coordi";

/** 헤어/성형/피부는 아이템 아이콘이 없어, 부위별 고정 아이콘을 대신 쓴다. */
const APPEARANCE_ICON_URLS: Record<string, string> = {
  hair: HAIR_ICON_URL,
  face: FACE_ICON_URL,
  skin: SKIN_ICON_URL,
};

function SlotBox({ slot }: { slot: GridSlot }) {
  const appearanceIconUrl = APPEARANCE_ICON_URLS[slot.key];
  const boxRef = useRef<HTMLDivElement>(null);
  const [forceShow, setForceShow] = useState(false);

  // 마우스가 없는 모바일/터치 환경에서는 hover가 발생하지 않으므로, 슬롯을 탭하면
  // 이름 툴팁이 토글되고 바깥을 탭하면 닫히게 해서 데스크톱 hover와 동등하게 동작한다.
  useEffect(() => {
    if (!forceShow) return;
    function handleOutsideClick(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setForceShow(false);
    }
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [forceShow]);

  function handleClick(event: React.MouseEvent) {
    if (!slot.name) return;
    event.stopPropagation();
    setForceShow((current) => !current);
  }

  return (
    <div
      ref={boxRef}
      onClick={handleClick}
      className="group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-gray-100 dark:border-gray-700 dark:bg-gray-800 sm:h-14 sm:w-14"
    >
      {slot.iconUrl ? (
        <img src={slot.iconUrl} alt={slot.name ?? slot.label} className="h-5 w-5 object-contain sm:h-9 sm:w-9" />
      ) : slot.name && appearanceIconUrl ? (
        <img src={appearanceIconUrl} alt={slot.name} className="h-5 w-5 object-contain sm:h-9 sm:w-9" />
      ) : (
        <span className="px-0.5 text-center text-[7px] font-bold leading-tight text-gray-400 dark:text-gray-600 sm:text-[9px]">
          {slot.label}
        </span>
      )}

      {slot.prismApplied && (
        <img
          src={PRISM_ICON_URL}
          alt="프리즘"
          className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-white shadow sm:h-4 sm:w-4"
        />
      )}

      {slot.name && (
        <div
          className={cn(
            "pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 w-max max-w-[180px] -translate-x-1/2 rounded bg-black/90 px-2 py-1 text-center text-[11px] leading-tight text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100",
            forceShow && "opacity-100",
          )}
        >
          {slot.name}
          {slot.extra && <div className="text-orange-200">{slot.extra}</div>}
        </div>
      )}
    </div>
  );
}

/**
 * 메이플스토리 인벤토리 창의 실제 슬롯 배치를 참고한 장비 그리드.
 * 이미지 왼쪽엔 반지 4칸과 얼굴장식/눈장식/귀고리, 오른쪽엔 모자/망토/한벌옷·상의/장갑/
 * 하의/신발/무기/방패(보조무기)를 2열로 배치하고, 이미지 아래엔 헤어/성형/피부를 둔다.
 * 슬롯에 hover하면 아이템 이름이 뜬다. 착용하지 않은 부위(반지 포함)는 부위명만 적힌
 * 빈 슬롯으로, "투명 OO" 아이템은 따로 모으지 않고 원래 부위 칸에 그대로 보여준다.
 */
export function EquipmentGrid({ entry }: { entry: CoordiEntry }) {
  const { left, right, appearance } = buildEquipmentGridLayout(entry);

  return (
    <div className="flex flex-col items-center gap-2 pt-1 sm:gap-3">
      <div className="flex items-start justify-center gap-1 sm:gap-3">
        <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
          {left.map((slot) => (
            <SlotBox key={slot.key} slot={slot} />
          ))}
        </div>

        <div className="aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 sm:w-56 lg:w-72">
          <CoordiPortrait entry={entry} />
        </div>

        <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
          {right.map((slot) => (
            <SlotBox key={slot.key} slot={slot} />
          ))}
        </div>
      </div>

      <div className="flex gap-1 sm:gap-1.5">
        {appearance.map((slot) => (
          <SlotBox key={slot.key} slot={slot} />
        ))}
      </div>
    </div>
  );
}
