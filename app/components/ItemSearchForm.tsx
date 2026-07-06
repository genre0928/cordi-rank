import { Clock, RefreshCw, Search, Shirt, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useFetcher, useNavigate, useRevalidator } from "react-router";
import { encodeItemEntry } from "~/lib/item-search-params";
import { cn } from "~/lib/cn";
import { PRISM_ICON_URL, type ItemSuggestion } from "~/services/item-catalog-service";
import type { GenderFilter, ItemSearchEntry } from "~/types/coordi";

function buildSearchUrl(items: ItemSearchEntry[], gender: GenderFilter): string {
  const params = new URLSearchParams();
  for (const item of items) {
    params.append("item", encodeItemEntry(item));
  }
  if (gender !== "all") params.set("gender", gender);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

interface RecentItem {
  keyword: string;
  iconUrl?: string;
}

const RECENT_ITEMS_KEY = "recentItemSearches";
const MAX_RECENT_ITEMS = 8;

function loadRecentItems(): RecentItem[] {
  try {
    const raw = localStorage.getItem(RECENT_ITEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecentItems(items: RecentItem[]) {
  try {
    localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(items));
  } catch {
    // localStorage를 못 쓰는 환경(시크릿 모드 용량 제한 등)이면 그냥 무시한다.
  }
}

/** 입력한 이름과 정확히 일치하는 아이템(캐시 장비)이 실제로 있는지 조회한다. */
async function findExactSuggestion(keyword: string): Promise<ItemSuggestion | undefined> {
  try {
    const res = await fetch(`/api/item-suggestions?q=${encodeURIComponent(keyword)}`);
    if (!res.ok) return undefined;
    const data: { suggestions: ItemSuggestion[] } = await res.json();
    return data.suggestions.find((s) => s.name.toLowerCase() === keyword.toLowerCase());
  } catch {
    return undefined;
  }
}

export function ItemSearchForm({
  initialItems,
  initialGender,
}: {
  initialItems: ItemSearchEntry[];
  initialGender: GenderFilter;
}) {
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const suggestionFetcher = useFetcher<{ query: string; suggestions: ItemSuggestion[] }>();

  const [items, setItems] = useState<ItemSearchEntry[]>(initialItems);
  const [iconMap, setIconMap] = useState<Record<string, string>>({});
  const [inputValue, setInputValue] = useState("");
  const [gender, setGender] = useState<GenderFilter>(initialGender);
  const [notFound, setNotFound] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);

  // localStorage는 클라이언트에만 있으므로 마운트 후에 불러온다(서버 렌더와의 불일치 방지).
  useEffect(() => {
    setRecentItems(loadRecentItems());
  }, []);

  function recordRecentItem(keyword: string, iconUrl?: string) {
    setRecentItems((prev) => {
      const next = [{ keyword, iconUrl }, ...prev.filter((entry) => entry.keyword !== keyword)].slice(
        0,
        MAX_RECENT_ITEMS,
      );
      saveRecentItems(next);
      return next;
    });
  }

  function removeRecentItem(keyword: string) {
    setRecentItems((prev) => {
      const next = prev.filter((entry) => entry.keyword !== keyword);
      saveRecentItems(next);
      return next;
    });
  }

  const trimmedInput = inputValue.trim();
  const suggestions =
    suggestionFetcher.data?.query === trimmedInput ? suggestionFetcher.data.suggestions : [];

  useEffect(() => {
    if (trimmedInput.length === 0) return;
    const timer = setTimeout(() => {
      suggestionFetcher.load(`/api/item-suggestions?q=${encodeURIComponent(trimmedInput)}`);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedInput]);

  // 새로고침 등으로 URL에서 복원된 검색어는 아이콘을 아직 모르니 한 번 채워둔다.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      initialItems.map(async (item) => [item.keyword, await findExactSuggestion(item.keyword)] as const),
    ).then((entries) => {
      if (cancelled) return;
      setIconMap((prev) => {
        const next = { ...prev };
        for (const [keyword, suggestion] of entries) {
          if (suggestion) next[keyword] = suggestion.iconUrl;
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function runSearch(nextItems: ItemSearchEntry[], nextGender: GenderFilter) {
    navigate(buildSearchUrl(nextItems, nextGender));
  }

  function addKeyword(raw: string, iconUrl?: string) {
    const keyword = raw.trim();
    if (keyword.length === 0 || items.some((item) => item.keyword === keyword)) return;
    const next = [...items, { keyword, prismOnly: false }];
    setItems(next);
    if (iconUrl) setIconMap((prev) => ({ ...prev, [keyword]: iconUrl }));
    setInputValue("");
    setNotFound(false);
    recordRecentItem(keyword, iconUrl);
    runSearch(next, gender);
  }

  function removeKeyword(keyword: string) {
    const next = items.filter((item) => item.keyword !== keyword);
    setItems(next);
    runSearch(next, gender);
  }

  function setPrismOnly(keyword: string, prismOnly: boolean) {
    const next = items.map((item) => (item.keyword === keyword ? { ...item, prismOnly } : item));
    setItems(next);
    runSearch(next, gender);
  }

  async function commitPendingInput() {
    if (trimmedInput.length === 0 || isValidating) return;

    // 이미 로드된 자동완성 결과에 정확히 일치하는 항목이 있으면 바로 사용.
    const localMatch = suggestions.find((s) => s.name.toLowerCase() === trimmedInput.toLowerCase());
    if (localMatch) {
      addKeyword(localMatch.name, localMatch.iconUrl);
      return;
    }

    // 자동완성이 아직 이 검색어 기준으로 로드되지 않았을 수 있으니 직접 확인한다.
    setIsValidating(true);
    const exact = await findExactSuggestion(trimmedInput);
    setIsValidating(false);

    if (exact) {
      addKeyword(exact.name, exact.iconUrl);
    } else {
      // 목록에 없는 아이템은 태그로 추가하지 않는다.
      setNotFound(true);
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void commitPendingInput();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (trimmedInput.length > 0) {
      void commitPendingInput();
    } else {
      runSearch(items, gender);
    }
  }

  function handleReset() {
    const alreadyAtDefault = items.length === 0 && gender === "all";
    setItems([]);
    setInputValue("");
    setGender("all");

    if (alreadyAtDefault) {
      // 이미 기본 화면(검색어 없음)이라 URL이 바뀌지 않으므로, 무작위 코디를 다시
      // 뽑아오도록 로더 재실행을 직접 트리거한다.
      revalidator.revalidate();
    } else {
      navigate("/");
    }
  }

  function updateGender(next: GenderFilter) {
    setGender(next);
    runSearch(items, next);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-orange-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
    >
      <input
        type="text"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          setNotFound(false);
        }}
        onKeyDown={handleInputKeyDown}
        placeholder="아이템 이름을 입력하고 Enter (예: 황금 왕관)"
        aria-label="아이템 이름 검색어"
        autoComplete="off"
        aria-invalid={notFound}
        className={cn(
          "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-orange-400 dark:bg-gray-900",
          notFound ? "border-red-300" : "border-gray-200 dark:border-gray-700",
        )}
      />

      {notFound && (
        <p className="mt-1.5 text-xs text-red-500">목록에 없는 아이템이에요. 자동완성에서 골라주세요.</p>
      )}

      {trimmedInput.length === 0 && recentItems.length > 0 && (
        <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-100 dark:divide-gray-800 dark:border-gray-800">
          <li className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-400 dark:text-gray-500">
            <Clock className="h-3 w-3" aria-hidden="true" />
            최근 검색한 아이템
          </li>
          {recentItems.map((recent) => (
            <li key={recent.keyword} className="flex items-center">
              <button
                type="button"
                onClick={() => addKeyword(recent.keyword, recent.iconUrl)}
                className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-orange-50 dark:hover:bg-gray-800"
              >
                {recent.iconUrl ? (
                  <img src={recent.iconUrl} alt="" className="h-6 w-6 shrink-0 object-contain" loading="lazy" />
                ) : (
                  <Shirt className="h-6 w-6 shrink-0 text-gray-300" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-200">
                  {recent.keyword}
                </span>
              </button>
              <button
                type="button"
                onClick={() => removeRecentItem(recent.keyword)}
                aria-label={`${recent.keyword} 최근 검색어 삭제`}
                className="px-3 py-2 text-gray-300 transition hover:text-red-500"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {trimmedInput.length > 0 && suggestions.length > 0 && (
        <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-100 dark:divide-gray-800 dark:border-gray-800">
          {suggestions.map((suggestion) => (
            <li key={suggestion.id}>
              <button
                type="button"
                onClick={() => addKeyword(suggestion.name, suggestion.iconUrl)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-orange-50 dark:hover:bg-gray-800"
              >
                <img
                  src={suggestion.iconUrl}
                  alt=""
                  className="h-6 w-6 shrink-0 object-contain"
                  loading="lazy"
                />
                <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-200">
                  {suggestion.name}
                  {suggestion.genderLabel && (
                    <span className="text-gray-400 dark:text-gray-500"> ({suggestion.genderLabel})</span>
                  )}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-xs",
                    suggestion.wearerCount ? "text-gray-400 dark:text-gray-500" : "text-gray-300 dark:text-gray-600",
                  )}
                >
                  {(suggestion.wearerCount ?? 0).toLocaleString("ko-KR")}명 착용
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => {
            const iconUrl = iconMap[item.keyword];
            return (
              <li
                key={item.keyword}
                className="flex items-center gap-1.5 rounded-full border border-gray-200 py-1 pl-1.5 pr-2 dark:border-gray-700"
              >
                {iconUrl ? (
                  <img src={iconUrl} alt="" title={item.keyword} className="h-6 w-6 object-contain" />
                ) : (
                  <span title={item.keyword} className="inline-flex">
                    <Shirt className="h-5 w-5 text-gray-400" aria-hidden="true" />
                  </span>
                )}
                <span className="sr-only">{item.keyword}</span>

                <button
                  type="button"
                  onClick={() => setPrismOnly(item.keyword, !item.prismOnly)}
                  aria-pressed={item.prismOnly}
                  aria-label={`${item.keyword} 프리즘 적용 여부`}
                  title={item.prismOnly ? "프리즘 적용" : "프리즘 미적용"}
                  className="rounded-full p-0.5 transition hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <img
                    src={PRISM_ICON_URL}
                    alt=""
                    className={cn("h-5 w-5 object-contain transition", !item.prismOnly && "grayscale opacity-50")}
                  />
                </button>

                <button
                  type="button"
                  onClick={() => removeKeyword(item.keyword)}
                  aria-label={`${item.keyword} 검색어 삭제`}
                  className="text-gray-300 transition hover:text-red-500"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
        <div className="flex overflow-hidden rounded-full border border-gray-200 text-sm dark:border-gray-700">
          {(["all", "남", "여"] as GenderFilter[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => updateGender(option)}
              aria-pressed={gender === option}
              className={`px-3 py-1.5 font-medium transition ${
                gender === option
                  ? "bg-orange-500 text-white"
                  : "bg-white text-gray-500 dark:bg-gray-900"
              }`}
            >
              {option === "all" ? "전체" : option}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 rounded-full border border-gray-200 px-3.5 py-1.5 text-sm font-medium text-gray-500 transition hover:border-gray-300 dark:border-gray-700"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            새로고침
          </button>
          <button
            type="submit"
            className="flex items-center gap-1 rounded-full bg-orange-500 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            검색
          </button>
        </div>
      </div>
    </form>
  );
}
