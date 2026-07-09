import { Sparkle } from "lucide-react";
import { Link, useLocation } from "react-router";

export function Header() {
  const location = useLocation();
  // 이미 홈에서 검색 중(태그/성별 필터로 쿼리스트링이 붙은 상태)이면, 로고를 눌러도
  // 그 검색을 그대로 유지한 채 머문다. 다른 페이지(상세)에 있을 때는 이 링크가 기본
  // 홈으로 보내는 평범한 "홈으로" 역할을 그대로 한다.
  const homeHref = location.pathname === "/" ? `${location.pathname}${location.search}` : "/";

  return (
    <header className="sticky top-0 z-20 border-b border-orange-100 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
      <div className="mx-auto flex max-w-6xl items-center px-4 py-3">
        <Link to={homeHref} className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-white">
            <Sparkle className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
            코디랭킹
          </span>
        </Link>
      </div>
    </header>
  );
}
