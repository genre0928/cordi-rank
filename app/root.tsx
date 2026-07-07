import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import { ComboCoordiModal } from "~/components/ComboCoordiModal";
import { CoordiDetailModal } from "~/components/CoordiDetailModal";
import { Footer } from "~/components/Footer";
import { Header } from "~/components/Header";
import { NavigationPinIndicator } from "~/components/NavigationPinIndicator";
import { ComboModalProvider } from "~/context/combo-modal";
import { CoordiModalProvider } from "~/context/coordi-modal";
import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap",
  },
];

export const meta: Route.MetaFunction = () => [
  { title: "코디랭킹 | 메이플스토리 캐릭터 코디 랭킹" },
  {
    name: "description",
    content:
      "메이플스토리 캐릭터의 코디(패션) 사진을 모아 좋아요로 랭킹을 매기는 팬 사이트, 코디랭킹입니다.",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />
        <Meta />
        <Links />
      </head>
      <body className="flex min-h-screen flex-col overflow-x-hidden bg-orange-50/40 text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100">
        <Header />
        <div className="flex-1">{children}</div>
        <Footer />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <CoordiModalProvider>
      <ComboModalProvider>
        <NavigationPinIndicator />
        <Outlet />
        <CoordiDetailModal />
        <ComboCoordiModal />
      </ComboModalProvider>
    </CoordiModalProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "예상치 못한 오류가 발생했습니다.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "요청하신 페이지를 찾을 수 없습니다."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-24 text-center">
      <h1 className="text-3xl font-bold">{message}</h1>
      <p className="mt-2 text-gray-500">{details}</p>
      {stack && (
        <pre className="mt-4 w-full overflow-x-auto rounded-lg bg-gray-100 p-4 text-left text-xs dark:bg-gray-900">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
