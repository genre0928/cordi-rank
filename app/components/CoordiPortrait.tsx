import { JobIcon } from "~/components/JobIcon";
import { cn } from "~/lib/cn";
import type { CoordiEntry } from "~/types/coordi";

const JOB_GRADIENT: Record<CoordiEntry["jobGroup"], string> = {
  전사: "from-rose-400 to-orange-500",
  마법사: "from-violet-400 to-indigo-500",
  궁수: "from-emerald-400 to-teal-500",
  도적: "from-slate-500 to-gray-700",
  해적: "from-sky-400 to-blue-600",
  "메이플M": "from-amber-300 to-pink-400",
};

/**
 * 실제 Nexon character_image 연동 전까지 사용하는 코디 이미지 자리표시자.
 * characterImageUrl이 채워지면 실제 렌더링 이미지로 자연스럽게 대체된다.
 */
export function CoordiPortrait({
  entry,
  className,
}: {
  entry: CoordiEntry;
  className?: string;
}) {
  if (entry.characterImageUrl) {
    return (
      <img
        src={entry.characterImageUrl}
        alt={`${entry.characterName} 캐릭터 코디`}
        className={cn("h-full w-full object-cover", className)}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center bg-gradient-to-br text-white",
        JOB_GRADIENT[entry.jobGroup],
        className,
      )}
    >
      <JobIcon jobGroup={entry.jobGroup} className="h-1/3 w-1/3 opacity-90" />
    </div>
  );
}
