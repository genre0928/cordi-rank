/**
 * 넥슨 오픈 API로 캐릭터를 수집해 Supabase에 채워 넣는 크롤 로직.
 *
 * 로컬 1회성 실행(scripts/crawl-nexon.ts)과 Vercel Cron으로 매일 자동 실행되는
 * app/routes/api.cron.crawl.tsx 양쪽에서 이 모듈을 그대로 가져다 쓴다. `~/` 경로
 * 별칭 없이 자기 완결적으로 작성한 이유는, scripts/crawl-nexon.ts가 tsx로 바로
 * 실행될 때 alias 해석 없이도 상대 경로 import만으로 이 파일을 가져올 수 있게 하기 위함이다.
 */
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const NEXON_BASE = "https://open.api.nexon.com/maplestory/v1";

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * 실제 랭킹 표본에서 확인된 직업들 위주의 직업군 매핑.
 * job_group은 전사/마법사/궁수/도적/해적 5종만 허용(DB 체크 제약)하고,
 * 여기 없는 특수 직업(제로, 메카닉, 제논, 라라, 일리움, 윈드브레이커 등)은
 * "기타" 버킷을 만들지 않고 크롤링 대상에서 제외한다.
 */
const JOB_GROUP_MAP: Record<string, string> = {
  히어로: "전사",
  팔라딘: "전사",
  다크나이트: "전사",
  소울마스터: "전사",
  미하일: "전사",
  데몬슬레이어: "전사",
  데몬어벤져: "전사",
  아란: "전사",
  카이저: "전사",
  아델: "전사",
  "아크메이지(불,독)": "마법사",
  "아크메이지(썬,콜)": "마법사",
  비숍: "마법사",
  플레임위자드: "마법사",
  배틀메이지: "마법사",
  은월: "마법사",
  루미너스: "마법사",
  에반: "마법사",
  키네시스: "마법사",
  보우마스터: "궁수",
  신궁: "궁수",
  패스파인더: "궁수",
  와일드헌터: "궁수",
  메르세데스: "궁수",
  카인: "궁수",
  나이트로드: "도적",
  섀도어: "도적",
  듀얼블레이드: "도적",
  듀얼블레이더: "도적", // 표기가 "듀얼블레이드"에서 바뀐 이후 버전 대응
  나이트워커: "도적",
  팬텀: "도적",
  카데나: "도적",
  바이퍼: "해적",
  캡틴: "해적",
  캐논슈터: "해적",
  캐논마스터: "해적", // 표기가 "캐논슈터"에서 바뀐 이후 버전 대응
  스트라이커: "해적",
  호영: "해적",
  엔젤릭버스터: "해적",
};

function toJobGroup(className: string): string | null {
  return JOB_GROUP_MAP[className] ?? null;
}

interface NexonRankingEntry {
  character_name: string;
}

interface NexonCharacterBasic {
  character_name: string;
  world_name: string;
  character_gender: string;
  character_class: string;
  character_level: number;
  character_guild_name: string | null;
  character_image: string;
}

interface NexonPrism {
  color_range: string;
  hue: number;
  saturation: number;
  value: number;
}

interface NexonCashItem {
  cash_item_equipment_part: string;
  cash_item_equipment_slot: string;
  cash_item_name: string;
  cash_item_icon: string;
  cash_item_coloring_prism: NexonPrism | null;
  cash_item_effect_prism: NexonPrism | null;
}

interface NexonCashItemEquipment {
  preset_no: number;
  cash_item_equipment_base: NexonCashItem[];
  cash_item_equipment_preset_1: NexonCashItem[];
  cash_item_equipment_preset_2: NexonCashItem[];
  cash_item_equipment_preset_3: NexonCashItem[];
}

interface NexonCharacterHair {
  hair_name: string;
  base_color: string;
  mix_color: string | null;
  mix_rate: string;
}

interface NexonCharacterFace {
  face_name: string;
  base_color: string;
  mix_color: string | null;
  mix_rate: string;
}

interface NexonCharacterSkin {
  skin_name: string;
  color_style: string | null;
  hue: number | null;
  saturation: number | null;
  brightness: number | null;
}

/** GET /character/beauty-equipment: 캐시 장비가 아닌 헤어/성형/피부 커스터마이징 정보. */
interface NexonBeautyEquipment {
  character_hair: NexonCharacterHair;
  character_face: NexonCharacterFace;
  character_skin: NexonCharacterSkin;
}

/**
 * 코디 프리셋 대응. cash_item_equipment_preset_N은 "전체 착용 목록"이 아니라, base에서
 * 해당 프리셋만 다르게 바뀐 부위만 담고 있다. base를 깔고 preset_no에 해당하는 프리셋으로
 * 부위(part)별로 덮어쓰는 병합이 필요하다.
 */
function selectActiveCashItems(cash: NexonCashItemEquipment): NexonCashItem[] {
  const presetByNo: Record<number, NexonCashItem[] | undefined> = {
    1: cash.cash_item_equipment_preset_1,
    2: cash.cash_item_equipment_preset_2,
    3: cash.cash_item_equipment_preset_3,
  };
  const preset = presetByNo[cash.preset_no] ?? [];

  const byPart = new Map<string, NexonCashItem>();
  for (const item of cash.cash_item_equipment_base ?? []) {
    byPart.set(item.cash_item_equipment_part, item);
  }
  for (const item of preset) {
    byPart.set(item.cash_item_equipment_part, item);
  }
  return [...byPart.values()];
}

const DELAY_MS = 150;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface CrawlResult {
  date: string;
  total: number;
  success: number;
  fail: number;
  skipped: number;
}

/** 이 서버 프로세스 안에서 크롤이 겹쳐 실행되지 않도록 막는 아주 단순한 잠금. */
let isCrawlRunning = false;

/**
 * 넥슨 전체 랭킹에서 상위 sampleSize명을 뽑아 캐릭터/캐시 장비/헤어·성형·피부 정보를
 * Supabase에 채운다. cash_items는 (character_ocid, part) 유니크 제약을 활용한 upsert +
 * 더 이상 착용하지 않는 부위만 정리 삭제하는 방식이라, 몇 번을 다시 실행해도(혹은 중간에
 * 실패해도) 중복 없이 항상 같은 결과로 수렴한다.
 */
export async function runCrawl(sampleSize = 100): Promise<CrawlResult> {
  if (isCrawlRunning) {
    throw new Error("이미 크롤이 진행 중입니다. 중복 실행을 건너뜁니다.");
  }
  isCrawlRunning = true;

  try {
    const nexonApiKey = process.env.NEXON_API_KEY;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!nexonApiKey || !supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("NEXON_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
      realtime: { transport: WebSocket as never },
    });

    async function nexonFetch<T>(path: string): Promise<T> {
      const res = await fetch(`${NEXON_BASE}${path}`, {
        headers: { "x-nxopen-api-key": nexonApiKey as string },
      });
      if (!res.ok) {
        throw new Error(`${res.status} ${path}: ${(await res.text()).slice(0, 200)}`);
      }
      return res.json() as Promise<T>;
    }

    async function fetchRankingSample(date: string, count: number): Promise<NexonRankingEntry[]> {
      const characters: NexonRankingEntry[] = [];
      let page = 1;
      while (characters.length < count && page <= 10) {
        const res = await nexonFetch<{ ranking: NexonRankingEntry[] }>(
          `/ranking/overall?date=${date}&page=${page}`,
        );
        if (res.ranking.length === 0) break;
        characters.push(...res.ranking);
        page++;
      }
      return characters.slice(0, count);
    }

    const date = ymd(new Date(Date.now() - 24 * 60 * 60 * 1000));
    console.log(`[크롤러] ${date} 기준 랭킹에서 ${sampleSize}명 수집 시작`);

    const targets = await fetchRankingSample(date, sampleSize);
    console.log(`[크롤러] 랭킹에서 ${targets.length}명 확보, 캐릭터별 상세 조회 시작`);

    let success = 0;
    let fail = 0;
    let skipped = 0;

    for (const [i, char] of targets.entries()) {
      try {
        const { ocid } = await nexonFetch<{ ocid: string }>(
          `/id?character_name=${encodeURIComponent(char.character_name)}`,
        );
        const basic = await nexonFetch<NexonCharacterBasic>(
          `/character/basic?ocid=${ocid}&date=${date}`,
        );

        const jobGroup = toJobGroup(basic.character_class);
        if (!jobGroup) {
          skipped++;
          console.log(
            `[${i + 1}/${targets.length}] ${char.character_name} 건너뜀 (미분류 직업: ${basic.character_class})`,
          );
          await sleep(DELAY_MS);
          continue;
        }

        const cash = await nexonFetch<NexonCashItemEquipment>(
          `/character/cashitem-equipment?ocid=${ocid}&date=${date}`,
        );
        const beauty = await nexonFetch<NexonBeautyEquipment>(
          `/character/beauty-equipment?ocid=${ocid}&date=${date}`,
        );

        const { error: upsertError } = await supabase.from("characters").upsert({
          ocid,
          character_name: basic.character_name,
          world_name: basic.world_name,
          gender: basic.character_gender,
          job_group: jobGroup,
          job_class: basic.character_class,
          level: basic.character_level,
          guild_name: basic.character_guild_name,
          character_image_url: basic.character_image,
          hair_name: beauty.character_hair.hair_name,
          hair_base_color: beauty.character_hair.base_color,
          hair_mix_color: beauty.character_hair.mix_color,
          hair_mix_rate: Number(beauty.character_hair.mix_rate),
          face_name: beauty.character_face.face_name,
          face_base_color: beauty.character_face.base_color,
          face_mix_color: beauty.character_face.mix_color,
          face_mix_rate: Number(beauty.character_face.mix_rate),
          skin_name: beauty.character_skin.skin_name,
          skin_color_style: beauty.character_skin.color_style,
          skin_hue: beauty.character_skin.hue,
          skin_saturation: beauty.character_skin.saturation,
          skin_brightness: beauty.character_skin.brightness,
          updated_at: new Date().toISOString(),
        });
        if (upsertError) throw new Error(upsertError.message);

        // 반지는 캐릭터 이미지에 렌더링되지 않아 크롤링 자체에서 제외한다.
        const cashItems = selectActiveCashItems(cash).filter(
          (item) => item.cash_item_equipment_part !== "반지",
        );

        const items = cashItems.map((item) => {
          const prism = item.cash_item_coloring_prism ?? item.cash_item_effect_prism;
          return {
            character_ocid: ocid,
            part: item.cash_item_equipment_part,
            name: item.cash_item_name,
            icon_url: item.cash_item_icon,
            prism_applied: prism !== null,
            color_range: prism?.color_range ?? null,
            hue: prism?.hue ?? null,
            saturation: prism?.saturation ?? null,
            value: prism?.value ?? null,
          };
        });

        if (items.length > 0) {
          const { error: itemsError } = await supabase
            .from("cash_items")
            .upsert(items, { onConflict: "character_ocid,part" });
          if (itemsError) throw new Error(itemsError.message);
        }

        // 더 이상 착용하지 않는 부위(교체/해제된 아이템)는 남아있으면 안 되므로 정리한다.
        let cleanup = supabase.from("cash_items").delete().eq("character_ocid", ocid);
        if (items.length > 0) {
          const wornParts = items.map((item) => `"${item.part}"`).join(",");
          cleanup = cleanup.not("part", "in", `(${wornParts})`);
        }
        const { error: cleanupError } = await cleanup;
        if (cleanupError) throw new Error(cleanupError.message);

        success++;
        console.log(`[${i + 1}/${targets.length}] ${char.character_name} 저장 완료 (아이템 ${items.length}개)`);
      } catch (e) {
        fail++;
        console.error(`[${i + 1}/${targets.length}] ${char.character_name} 실패:`, e instanceof Error ? e.message : e);
      }

      await sleep(DELAY_MS);
    }

    console.log(`\n완료: 성공 ${success} / 실패 ${fail} / 미분류로 건너뜀 ${skipped}`);
    return { date, total: targets.length, success, fail, skipped };
  } finally {
    isCrawlRunning = false;
  }
}
