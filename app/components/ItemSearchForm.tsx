import { Clock, RefreshCw, Search, Shirt, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useFetcher, useNavigate, useRevalidator } from "react-router";
import { encodeItemEntry } from "~/lib/item-search-params";
import { cn } from "~/lib/cn";
import {
  FACE_ICON_URL,
  HAIR_ICON_URL,
  PRISM_ICON_URL,
  SKIN_ICON_URL,
  type ItemSuggestion,
} from "~/services/item-catalog-service";
import type { AppearanceSuggestion } from "~/services/coordi-service.server";
import type { GenderFilter, ItemSearchEntry, ItemSearchKind } from "~/types/coordi";

function buildSearchUrl(items: ItemSearchEntry[], gender: GenderFilter): string {
  const params = new URLSearchParams();
  for (const item of items) {
    params.append("item", encodeItemEntry(item));
  }
  if (gender !== "all") params.set("gender", gender);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

/** 헤어/성형/피부는 아이템 아이콘이 없어, 부위별 고정 아이콘을 대신 쓴다. */
function staticAppearanceIcon(kind: ItemSearchKind): string | null {
  if (kind === "hair") return HAIR_ICON_URL;
  if (kind === "face") return FACE_ICON_URL;
  if (kind === "skin") return SKIN_ICON_URL;
  return null;
}

function appearanceKindLabel(kind: ItemSearchKind): string {
  if (kind === "hair") return "헤어";
  if (kind === "face") return "성형";
  if (kind === "skin") return "피부";
  return "아이템";
}

/** 자동완성/최근검색/직접입력 등 어디서 오든, "이걸 태그로 추가하자"로 합류하는 공통 형태. */
interface Candidate {
  kind: ItemSearchKind;
  name: string;
  iconUrl?: string;
  /** kind가 "item"일 때만 있는 착용 부위(모자/상의/신발 등). */
  part?: string | null;
}

interface RecentItem {
  keyword: string;
  kind: ItemSearchKind;
  iconUrl?: string;
  part?: string | null;
}

const RECENT_ITEMS_KEY = "recentItemSearches";
const MAX_RECENT_ITEMS = 3;

function loadRecentItems(): RecentItem[] {
  try {
    const raw = localStorage.getItem(RECENT_ITEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // kind가 없는 예전 저장값(이 기능 추가 전)은 아이템으로 간주해 계속 동작하게 한다.
    return parsed.map((entry) => ({ ...entry, kind: entry.kind ?? "item" }));
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

interface SuggestResponse {
  query: string;
  suggestions: ItemSuggestion[];
  appearances: AppearanceSuggestion[];
}

/** 입력한 이름과 정확히 일치하는 후보(캐시 아이템 또는 헤어/성형/피부)가 실제로 있는지 조회한다. */
async function findExactCandidate(keyword: string): Promise<Candidate | undefined> {
  try {
    const res = await fetch(`/api/item-suggestions?q=${encodeURIComponent(keyword)}`);
    if (!res.ok) return undefined;
    const data: SuggestResponse = await res.json();
    const item = data.suggestions.find((s) => s.name.toLowerCase() === keyword.toLowerCase());
    if (item) return { kind: "item", name: item.name, iconUrl: item.iconUrl, part: item.part };
    const appearance = data.appearances.find((a) => a.name.toLowerCase() === keyword.toLowerCase());
    if (appearance) return { kind: appearance.kind, name: appearance.name };
    return undefined;
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
  const suggestionFetcher = useFetcher<SuggestResponse>();
  const wearerCountFetcher = useFetcher<{ counts: Record<string, number> }>();

  // "새로고침" 버튼은 이 버튼이 직접 시작한 로딩(revalidator)만 반영한다. 검색어 추가/
  // 성별 변경처럼 다른 동작으로 생기는 페이지 이동(navigation)까지 같이 반영하면, 새로고침을
  // 누르지 않았는데도 버튼이 "불러오는 중" 상태로 보이는 문제가 있었다. 전체 화면 로딩
  // 표시는 NavigationPinIndicator가 navigation 기준으로 따로 담당한다.
  const isRefreshing = revalidator.state === "loading";

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

  function recordRecentItem(entry: RecentItem) {
    setRecentItems((prev) => {
      const next = [
        entry,
        ...prev.filter((item) => !(item.keyword === entry.keyword && item.kind === entry.kind)),
      ].slice(0, MAX_RECENT_ITEMS);
      saveRecentItems(next);
      return next;
    });
  }

  function removeRecentItem(kind: ItemSearchKind, keyword: string) {
    setRecentItems((prev) => {
      const next = prev.filter((item) => !(item.keyword === keyword && item.kind === kind));
      saveRecentItems(next);
      return next;
    });
  }

  const trimmedInput = inputValue.trim();
  const suggestions =
    suggestionFetcher.data?.query === trimmedInput ? suggestionFetcher.data.suggestions : [];
  const appearances =
    suggestionFetcher.data?.query === trimmedInput ? suggestionFetcher.data.appearances : [];
  const wearerCounts = wearerCountFetcher.data?.counts ?? {};

  // 연관검색어가 뜨는 체감 속도를 위해 디바운스를 짧게 잡는다(예전 300ms). 실제 지연은
  // 대부분 서버 쪽(외부 카탈로그+DB 조회)이라 여기서 아주 크게 줄이진 못하지만, 타이핑을
  // 멈춘 뒤 요청이 나가기까지의 대기 시간 자체는 확실히 줄어든다.
  useEffect(() => {
    if (trimmedInput.length === 0) return;
    const timer = setTimeout(() => {
      suggestionFetcher.load(`/api/item-suggestions?q=${encodeURIComponent(trimmedInput)}`);
    }, 150);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedInput]);

  // 아이템 착용자 수는 일부러 자동완성 응답에서 분리했다(그래야 목록 자체가 먼저 뜬다).
  // 목록이 갱신될 때마다 그 안의 아이템들 착용자 수만 뒤이어 따로 받아온다.
  useEffect(() => {
    if (suggestions.length === 0) return;
    const params = suggestions.map((s) => `name=${encodeURIComponent(s.name)}`).join("&");
    wearerCountFetcher.load(`/api/item-wearer-counts?${params}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestionFetcher.data]);

  // 새로고침 등으로 URL에서 복원된 아이템 검색어는 아이콘을 아직 모르니 한 번 채워둔다
  // (헤어/성형/피부는 고정 아이콘을 쓰므로 조회할 필요가 없다).
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      initialItems
        .filter((item) => item.kind === "item")
        .map(async (item) => [item.keyword, await findExactCandidate(item.keyword)] as const),
    ).then((entries) => {
      if (cancelled) return;
      setIconMap((prev) => {
        const next = { ...prev };
        for (const [keyword, candidate] of entries) {
          if (candidate?.iconUrl) next[keyword] = candidate.iconUrl;
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

  function addKeyword(candidate: Candidate) {
    const keyword = candidate.name.trim();
    if (keyword.length === 0 || items.some((item) => item.keyword === keyword && item.kind === candidate.kind)) {
      return;
    }
    const next = [...items, { keyword, kind: candidate.kind, prismOnly: false }];
    setItems(next);
    if (candidate.iconUrl) setIconMap((prev) => ({ ...prev, [keyword]: candidate.iconUrl as string }));
    setInputValue("");
    setNotFound(false);
    recordRecentItem({ keyword, kind: candidate.kind, iconUrl: candidate.iconUrl, part: candidate.part });
    runSearch(next, gender);
  }

  function removeKeyword(kind: ItemSearchKind, keyword: string) {
    const next = items.filter((item) => !(item.kind === kind && item.keyword === keyword));
    setItems(next);
    runSearch(next, gender);
  }

  function setPrismOnly(kind: ItemSearchKind, keyword: string, prismOnly: boolean) {
    const next = items.map((item) =>
      item.kind === kind && item.keyword === keyword ? { ...item, prismOnly } : item,
    );
    setItems(next);
    runSearch(next, gender);
  }

  async function commitPendingInput() {
    if (trimmedInput.length === 0 || isValidating) return;

    // 이미 로드된 자동완성 결과에 정확히 일치하는 항목이 있으면 바로 사용.
    const localItemMatch = suggestions.find((s) => s.name.toLowerCase() === trimmedInput.toLowerCase());
    if (localItemMatch) {
      addKeyword({
        kind: "item",
        name: localItemMatch.name,
        iconUrl: localItemMatch.iconUrl,
        part: localItemMatch.part,
      });
      return;
    }
    const localAppearanceMatch = appearances.find((a) => a.name.toLowerCase() === trimmedInput.toLowerCase());
    if (localAppearanceMatch) {
      addKeyword({ kind: localAppearanceMatch.kind, name: localAppearanceMatch.name });
      return;
    }

    // 자동완성이 아직 이 검색어 기준으로 로드되지 않았을 수 있으니 직접 확인한다.
    setIsValidating(true);
    const exact = await findExactCandidate(trimmedInput);
    setIsValidating(false);

    if (exact) {
      addKeyword(exact);
    } else {
      // 목록에 없는 검색어는 태그로 추가하지 않는다.
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

  function handleRefresh() {
    setInputValue("");
    // 검색 조건(아이템/헤어/성형/피부 태그, 성별)은 그대로 두고 지금 화면만 새로 불러온다.
    // 예전엔 여기서 태그를 통째로 지웠는데, 그러면 검색 중에 새로고침을 눌렀을 때 검색
    // 자체가 사라지고 우측 프리즘·염색 순위(그 태그 기준으로 계산됨)도 같이 사라지는
    // 문제가 있었다. 검색 중이 아니면(태그 없음) 이 revalidate가 무작위 코디를 다시 뽑아준다.
    revalidator.revalidate();
  }

  function updateGender(next: GenderFilter) {
    setGender(next);
    runSearch(items, next);
  }

  const hasSuggestions = suggestions.length > 0 || appearances.length > 0;

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
        placeholder="아이템/헤어/성형/피부 이름을 입력하고 Enter (예: 황금 왕관)"
        aria-label="아이템 이름 검색어"
        autoComplete="off"
        aria-invalid={notFound}
        className={cn(
          "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-orange-400 dark:bg-gray-900",
          notFound ? "border-red-300" : "border-gray-200 dark:border-gray-700",
        )}
      />

      {notFound && (
        <p className="mt-1.5 text-xs text-red-500">목록에 없는 검색어예요. 자동완성에서 골라주세요.</p>
      )}

      {trimmedInput.length === 0 && recentItems.length > 0 && (
        <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-100 dark:divide-gray-800 dark:border-gray-800">
          <li className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-400 dark:text-gray-500">
            <Clock className="h-3 w-3" aria-hidden="true" />
            최근 검색한 아이템
          </li>
          {recentItems.map((recent) => (
            <li key={`${recent.kind}-${recent.keyword}`} className="flex items-center">
              <button
                type="button"
                onClick={() =>
                  addKeyword({ kind: recent.kind, name: recent.keyword, iconUrl: recent.iconUrl, part: recent.part })
                }
                className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-orange-50 dark:hover:bg-gray-800"
              >
                {recent.iconUrl || staticAppearanceIcon(recent.kind) ? (
                  <img
                    src={recent.iconUrl ?? (staticAppearanceIcon(recent.kind) as string)}
                    alt=""
                    className="h-6 w-6 shrink-0 object-contain"
                    loading="lazy"
                  />
                ) : (
                  <Shirt className="h-6 w-6 shrink-0 text-gray-300" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-200">
                  {recent.keyword}
                </span>
                <span className="shrink-0 text-xs text-gray-400">
                  {recent.kind === "item" ? recent.part : appearanceKindLabel(recent.kind)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => removeRecentItem(recent.kind, recent.keyword)}
                aria-label={`${recent.keyword} 최근 검색어 삭제`}
                className="px-3 py-2 text-gray-300 transition hover:text-red-500"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {trimmedInput.length > 0 && hasSuggestions && (
        <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-100 dark:divide-gray-800 dark:border-gray-800">
          {suggestions.map((suggestion) => (
            <li key={`item-${suggestion.id}`}>
              <button
                type="button"
                onClick={() =>
                  addKeyword({ kind: "item", name: suggestion.name, iconUrl: suggestion.iconUrl, part: suggestion.part })
                }
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
                {suggestion.part && (
                  <span className="shrink-0 text-xs text-gray-400">{suggestion.part}</span>
                )}
                <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                  {wearerCounts[suggestion.name] != null
                    ? `${wearerCounts[suggestion.name].toLocaleString("ko-KR")}명 착용`
                    : ""}
                </span>
              </button>
            </li>
          ))}
          {appearances.map((appearance) => (
            <li key={`${appearance.kind}-${appearance.name}`}>
              <button
                type="button"
                onClick={() => addKeyword({ kind: appearance.kind, name: appearance.name })}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-orange-50 dark:hover:bg-gray-800"
              >
                <img
                  src={staticAppearanceIcon(appearance.kind) as string}
                  alt=""
                  className="h-6 w-6 shrink-0 object-contain"
                  loading="lazy"
                />
                <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-200">
                  {appearance.name}
                  {appearance.genderLabel && (
                    <span className="text-gray-400 dark:text-gray-500"> ({appearance.genderLabel})</span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-gray-400">{appearanceKindLabel(appearance.kind)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => {
            const iconUrl = iconMap[item.keyword] ?? staticAppearanceIcon(item.kind);
            return (
              <li
                key={`${item.kind}-${item.keyword}`}
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

                {item.kind === "item" && (
                  <button
                    type="button"
                    onClick={() => setPrismOnly(item.kind, item.keyword, !item.prismOnly)}
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
                )}

                <button
                  type="button"
                  onClick={() => removeKeyword(item.kind, item.keyword)}
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
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-busy={isRefreshing}
            className={cn(
              "flex items-center gap-1 rounded-full border border-gray-200 px-3.5 py-1.5 text-sm font-medium text-gray-500 transition hover:border-gray-300 dark:border-gray-700",
              isRefreshing && "opacity-60",
            )}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} aria-hidden="true" />
            {isRefreshing ? "불러오는 중..." : "새로고침"}
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
