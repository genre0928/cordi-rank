import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import { CoordiDetailContent } from "~/components/CoordiDetailContent";
import { isLikeAction } from "~/lib/should-revalidate";
import { getCoordiDetail, getCoordiWithSharedItems, isLikedByUser } from "~/services/coordi-service.server";
import type { Route } from "./+types/coordi-detail";

export function shouldRevalidate(args: ShouldRevalidateFunctionArgs) {
  if (isLikeAction(args)) return false;
  return args.defaultShouldRevalidate;
}

export async function loader({ params }: Route.LoaderArgs) {
  const entry = await getCoordiDetail(params.ocid);
  if (!entry) {
    throw new Response("코디를 찾을 수 없습니다.", { status: 404 });
  }

  const sameItemCoordi = await getCoordiWithSharedItems(entry);
  return { entry, sameItemCoordi, liked: isLikedByUser(entry.ocid) };
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
  const { entry, sameItemCoordi, liked } = loaderData;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-orange-500"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        코디 랭킹으로
      </Link>

      <CoordiDetailContent entry={entry} sameItemCoordi={sameItemCoordi} liked={liked} />
    </main>
  );
}
