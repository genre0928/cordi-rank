import { CharacterImageCard } from "~/components/CharacterImageCard";
import { EquipmentGrid } from "~/components/EquipmentGrid";
import { LikeButton } from "~/components/LikeButton";
import { useLike } from "~/hooks/useLike";
import type { CoordiEntry } from "~/types/coordi";

/**
 * 코디 상세 화면의 본문(장비 그리드 + 캐릭터 정보 + 같은 아이템 코디).
 * /coordi/:ocid 풀 페이지와 카드 클릭 시 뜨는 모달이 이 컴포넌트를 함께 쓴다.
 */
export function CoordiDetailContent({
  entry,
  sameItemCoordi,
  liked,
}: {
  entry: CoordiEntry;
  sameItemCoordi: CoordiEntry[];
  liked: boolean;
}) {
  const { liked: isLiked, count, toggle } = useLike(entry.ocid, liked, entry.likeCount);

  return (
    <div>
      <EquipmentGrid entry={entry} />

      <div className="mt-4 text-center">
        <h1 className="text-xl font-black">{entry.characterName}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {entry.worldName} · {entry.jobClass} · Lv.{entry.level}
        </p>
        {entry.guildName && <p className="mt-0.5 text-xs text-gray-400">{entry.guildName} 길드</p>}
        <div className="mt-3 flex justify-center">
          <LikeButton liked={isLiked} count={count} onToggle={toggle} size="lg" />
        </div>
      </div>

      {sameItemCoordi.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-base font-bold">같은 아이템을 착용한 코디</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {sameItemCoordi.map((item) => (
              <li key={item.ocid}>
                <CharacterImageCard entry={item} initiallyLiked={false} linkToDetail />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
