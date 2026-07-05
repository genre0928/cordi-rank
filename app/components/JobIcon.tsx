import { Anchor, Sparkles, Swords, Target, VenetianMask, Wand2 } from "lucide-react";
import type { JobGroup } from "~/types/coordi";

const JOB_ICON_MAP: Record<JobGroup, typeof Swords> = {
  전사: Swords,
  마법사: Wand2,
  궁수: Target,
  도적: VenetianMask,
  해적: Anchor,
  "메이플M": Sparkles,
};

export function JobIcon({ jobGroup, className }: { jobGroup: JobGroup; className?: string }) {
  const Icon = JOB_ICON_MAP[jobGroup];
  return <Icon className={className} aria-hidden="true" />;
}
