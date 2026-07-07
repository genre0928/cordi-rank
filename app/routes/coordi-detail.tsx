import { ArrowLeft } from "lucide-react";
import { Link, useLocation } from "react-router";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import { CoordiDetailContent } from "~/components/CoordiDetailContent";
import { isLikeAction } from "~/lib/should-revalidate";
import { getCoordiDetail } from "~/services/coordi-service.server";
import type { Route } from "./+types/coordi-detail";

export function shouldRevalidate(args: ShouldRevalidateFunctionArgs) {
  if (isLikeAction(args)) return false;
  return args.defaultShouldRevalidate;
}

export async function loader({ params }: Route.LoaderArgs) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    throw new Response("코디를 찾을 수 없습니다.", { status: 404 });
  }

  const entry = await getCoordiDetail(id);
  if (!entry) {
    throw new Response("코디를 찾을 수 없습니다.", { status: 404 });
  }

  return { entry };
}

export const meta: Route.MetaFunction = ({ data }) => {
  if (!data) return [{ title: "코디를 찾을 수 없습니다 | 코디랭킹" }];

  const { entry } = data;
  const title = `${entry.characterName}님의 ${entry.jobClass} 코디 | 코디랭킹`;
  const description = `${entry.worldName} 서버 Lv.${entry.level} ${entry.jobClass} ${entry.characterName}님의 코디, 좋아요 ${entry.likeCount.toLocaleString(
    "ko-KR",
  )}개.`;

  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "profile" },
  ];
};

/**
 * 카드를 클릭하면 홈/상세 화면에서는 모달(CoordiDetailModal)로 뜨지만, 이 라우트 자체는
 * 직접 URL 접근·공유·검색엔진을 위해 그대로 풀 페이지로 남겨둔다.
 */
export default function CoordiDetail({ loaderData }: Route.ComponentProps) {
  const { entry } = loaderData;
  // 색상 조합 모달(ComboCoordiModal)의 카드를 클릭해 여기로 넘어온 경우, 그때 검색
  // 중이던 화면(아이템 태그 등)으로 돌아가야 한다. 무조건 "/"로 보내면 검색 조건이
  // 사라져서 우측 프리즘·염색 순위도 같이 사라지는 문제가 있었다.
  const location = useLocation();
  const backTo = (location.state as { from?: string } | null)?.from ?? "/";

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link
        to={backTo}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-orange-500"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        코디 랭킹으로
      </Link>

      <CoordiDetailContent entry={entry} />
    </main>
  );
}
