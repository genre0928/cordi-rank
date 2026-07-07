import { useState } from "react";
import { useComboModal } from "~/context/combo-modal";

export interface DonutSegment {
  /** 모달 제목 등 전체 맥락에 쓰는 라벨(비율 %까지 포함). */
  modalLabel: string;
  /** 가운데 caption처럼 짧게 보여줄 라벨(비율 % 제외, 숫자는 옆에 크게 따로 보여주므로). */
  caption: string;
  percentage: number;
  color: string;
  entryIds: number[];
}

const SIZE = 140;
const STROKE_WIDTH = 18;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * 프리즘/염색 조합 비율을 도넛(원) 그래프로 보여준다. 구간에 hover하면 가운데 숫자가
 * 그 구간 비율로 바뀌고, 클릭하면 그 조합과 일치하는 코디 모음 모달이 뜬다
 * (ComboCoordiModal, useComboModal 재사용). hover/클릭 대상이 없는 마우스가 없는 상태
 * 기본값은 1위(가장 많이 적용된) 조합을 가운데에 보여준다.
 */
export function ComboDonutChart({ segments }: { segments: DonutSegment[] }) {
  const { open } = useComboModal();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (segments.length === 0) return null;

  const top = segments[0];
  const shown = hoveredIndex !== null ? segments[hoveredIndex] : top;

  let cumulativePercent = 0;

  return (
    <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE_WIDTH}
          className="stroke-gray-100 dark:stroke-gray-800"
        />
        {segments.map((segment, idx) => {
          const dash = (segment.percentage / 100) * CIRCUMFERENCE;
          const offset = -((cumulativePercent / 100) * CIRCUMFERENCE);
          cumulativePercent += segment.percentage;

          return (
            <circle
              key={idx}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={segment.color}
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
              strokeDashoffset={offset}
              className="cursor-pointer transition-opacity duration-150"
              style={{ opacity: hoveredIndex === null || hoveredIndex === idx ? 1 : 0.3 }}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => open({ label: segment.modalLabel, entryIds: segment.entryIds })}
            >
              <title>{`${segment.caption} ${segment.percentage}%`}</title>
            </circle>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
        <span className="text-xl font-black text-gray-800 dark:text-gray-100">{shown.percentage}%</span>
        <span className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-gray-400">{shown.caption}</span>
      </div>
    </div>
  );
}
