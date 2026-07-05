/**
 * 넥슨 오픈 API(메이플스토리) 응답 형태를 그대로 반영한 타입.
 * https://openapi.nexon.com/ko/game/maplestory/
 *
 * 실제 API 키로 직접 호출해 확인한 필드 구성을 반영했다 (2026-07 기준, KMS).
 * Supabase 연동 전까지는 이 타입을 기준으로 목업 데이터를 생성하고,
 * 실제 API 연동 시 서비스 레이어(services/coordi-service.ts) 내부 구현만 교체한다.
 */

export interface NexonCharacterId {
  ocid: string;
}

export type CharacterGender = "남" | "여";

/** GET /maplestory/v1/character/basic */
export interface NexonCharacterBasic {
  date: string;
  character_name: string;
  world_name: string;
  character_gender: CharacterGender;
  character_class: string;
  character_class_level: string;
  character_level: number;
  character_exp: number;
  character_exp_rate: string;
  character_guild_name: string | null;
  character_image: string;
  character_date_create: string;
  access_flag: string;
  liberation_quest_clear_flag: string;
}

export interface NexonCashItemOption {
  option_type: string;
  option_value: string;
}

/** "컬러링 프리즘"으로 염색했을 때의 색상 정보. 실제 API 응답 기준. */
export interface NexonCashItemColoringPrism {
  color_range: string;
  hue: number;
  saturation: number;
  value: number;
}

/**
 * 실제 cashitem-equipment 응답에서 확인된 cash_item_equipment_part 값
 * (2026-07, 랭킹 상위 캐릭터 20명 표본 기준):
 * 모자, 얼굴장식, 눈장식, 귀고리, 반지, 신발, 장갑, 망토, 무기, 방패, 한벌옷
 * (상의/하의는 표본에 없었지만 한벌옷과 동일 카테고리의 개별 부위로 존재할 수 있음)
 * 헤어/성형/피부는 이 엔드포인트에 포함되지 않는다 (캐릭터 외형 커스터마이징이지 캐시 장비가 아님).
 */
export interface NexonCashItemEquipmentItem {
  cash_item_equipment_part: string;
  cash_item_equipment_slot: string;
  cash_item_name: string;
  cash_item_icon: string;
  cash_item_description: string | null;
  cash_item_option: NexonCashItemOption[];
  date_expire: string | null;
  date_option_expire: string | null;
  cash_item_label: string | null;
  cash_item_coloring_prism: NexonCashItemColoringPrism | null;
  cash_item_effect_prism: NexonCashItemColoringPrism | null;
  item_gender: CharacterGender | null;
  skills: string[];
  freestyle_flag: string;
  emotion_name: string | null;
}

/** GET /maplestory/v1/character/cashitem-equipment */
export interface NexonCashItemEquipment {
  date: string;
  character_gender: CharacterGender;
  character_class: string;
  character_look_mode: string | null;
  preset_no: number;
  cash_item_equipment_base: NexonCashItemEquipmentItem[];
  cash_item_equipment_preset_1: NexonCashItemEquipmentItem[];
  cash_item_equipment_preset_2: NexonCashItemEquipmentItem[];
  cash_item_equipment_preset_3: NexonCashItemEquipmentItem[];
  additional_character_look: unknown | null;
}

/** GET /maplestory/v1/ranking/overall 응답의 개별 항목 */
export interface NexonOverallRankingEntry {
  date: string;
  ranking: number;
  character_name: string;
  world_name: string;
  class_name: string;
  sub_class_name: string;
  character_level: number;
  character_exp: number;
  character_popularity: number;
  character_guildname: string | null;
}

export interface NexonOverallRankingResponse {
  ranking: NexonOverallRankingEntry[];
}
