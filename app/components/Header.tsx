import { Sparkle } from "lucide-react";
import { Link } from "react-router";

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-orange-100 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-white">
            <Sparkle className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
            코디랭킹
          </span>
        </Link>
        <nav aria-label="주요 메뉴" className="flex items-center gap-4 text-sm font-medium">
          <Link
            to="/"
            className="text-gray-600 transition hover:text-orange-500 dark:text-gray-300"
          >
            코디 랭킹
          </Link>
        </nav>
      </div>
    </header>
  );
}
