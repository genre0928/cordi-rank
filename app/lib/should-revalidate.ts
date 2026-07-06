import type { ShouldRevalidateFunctionArgs } from "react-router";

/** 좋아요 토글(/like/:id) 제출로 인한 리로드인지 판별한다. */
export function isLikeAction({ formAction }: ShouldRevalidateFunctionArgs): boolean {
  return formAction?.startsWith("/like/") ?? false;
}
