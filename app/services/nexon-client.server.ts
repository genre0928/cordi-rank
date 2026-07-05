/**
 * 넥슨 오픈 API(메이플스토리) 실제 호출 클라이언트.
 *
 * 파일명이 `.server.ts`이므로 React Router가 클라이언트 번들에서 이 파일을 완전히
 * 제외한다 — API 키가 브라우저로 새어나갈 수 없다. 아직 화면에서는 목업 데이터
 * (services/coordi-service.ts)를 쓰고 있고, 이 클라이언트는 실 데이터 연동 시
 * 그 서비스 레이어 내부 구현을 교체할 때 사용한다.
 *
 * API 키는 .env의 NEXON_API_KEY로 관리한다 (레포에는 커밋되지 않음, .gitignore 처리됨).
 * 추후 Supabase 등 BaaS로 옮길 때는 이 키를 서버 환경변수/시크릿으로 그대로 이전하면 된다.
 */
import type {
  NexonCashItemEquipment,
  NexonCharacterBasic,
  NexonCharacterId,
  NexonOverallRankingResponse,
} from "~/types/nexon";

export const NEXON_API_KEY = process.env.NEXON_API_KEY ?? "";
const NEXON_API_BASE = "https://open.api.nexon.com/maplestory/v1";

async function nexonFetch<T>(path: string): Promise<T> {
  if (!NEXON_API_KEY) {
    throw new Error("NEXON_API_KEY가 설정되어 있지 않습니다 (.env 확인 필요).");
  }

  const res = await fetch(`${NEXON_API_BASE}${path}`, {
    headers: { "x-nxopen-api-key": NEXON_API_KEY },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Nexon API ${res.status} (${path}): ${body.slice(0, 300)}`);
  }

  return res.json() as Promise<T>;
}

export function fetchOverallRanking(date: string, page = 1): Promise<NexonOverallRankingResponse> {
  return nexonFetch(`/ranking/overall?date=${date}&page=${page}`);
}

export function fetchCharacterId(characterName: string): Promise<NexonCharacterId> {
  return nexonFetch(`/id?character_name=${encodeURIComponent(characterName)}`);
}

export function fetchCharacterBasic(ocid: string, date: string): Promise<NexonCharacterBasic> {
  return nexonFetch(`/character/basic?ocid=${ocid}&date=${date}`);
}

export function fetchCashItemEquipment(
  ocid: string,
  date: string,
): Promise<NexonCashItemEquipment> {
  return nexonFetch(`/character/cashitem-equipment?ocid=${ocid}&date=${date}`);
}
