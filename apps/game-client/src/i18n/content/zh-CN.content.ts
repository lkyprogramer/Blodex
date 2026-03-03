import {
  BIOME_MAP,
  BOSS_DEFS,
  BLUEPRINT_DEFS,
  ITEM_DEFS,
  MONSTER_AFFIX_DEFS,
  MONSTER_ARCHETYPES,
  MUTATION_DEFS,
  RANDOM_EVENT_DEFS,
  SKILL_DEFS,
  TALENT_DEFS,
  UNLOCK_DEFS
} from "@blodex/content";
import {
  contentAffixDescriptionKey,
  contentAffixNameKey,
  contentBiomeNameKey,
  contentBossNameKey,
  contentBlueprintNameKey,
  contentEventChoiceDescriptionKey,
  contentEventChoiceNameKey,
  contentEventDescriptionKey,
  contentEventNameKey,
  contentItemNameKey,
  contentMonsterNameKey,
  contentMutationNameKey,
  contentSkillDescriptionKey,
  contentSkillNameKey,
  contentTalentDescriptionKey,
  contentTalentNameKey,
  contentUnlockDescriptionKey,
  contentUnlockNameKey
} from "./contentKeys";

const ITEM_NAME_ZH: Readonly<Record<string, string>> = {
  rusted_sabre: "锈蚀军刀",
  pilgrim_mace: "朝圣钉锤",
  dusk_halberd: "暮色长戟",
  penitent_blade: "忏悔之刃",
  sanctified_greatsword: "祝圣巨剑",
  grim_helm: "冷峻头盔",
  chapel_cowl: "礼拜堂兜帽",
  warden_greathelm: "守望者巨盔",
  revenant_mask: "亡魂面具",
  patchwork_hauberk: "拼缀锁甲",
  cathedral_plate: "大教堂板甲",
  oathbound_cuirass: "誓约胸甲",
  wanderer_boots: "漫游者之靴",
  pilgrim_treads: "朝圣者便靴",
  catacomb_greaves: "地穴胫甲",
  iron_vow_loop: "钢誓指环",
  oath_ring: "誓约戒",
  bloodsigil_band: "血印指环",
  sovereign_requiem: "君王安魂",
  crown_of_bone: "白骨王冠",
  cataclysm_mail: "浩劫战铠",
  echostep_greaves: "回响胫甲",
  voidsigil_band: "虚印指环"
};

const SKILL_ZH: Readonly<Record<string, { name: string; description: string }>> = {
  cleave: {
    name: "横扫",
    description: "对自身周围进行大范围挥砍。"
  },
  war_cry: {
    name: "战吼",
    description: "提升攻击力与攻击速度。"
  },
  shield_slam: {
    name: "盾击",
    description: "重击并击退附近敌人。"
  },
  quake_strike: {
    name: "裂地击",
    description: "猛击地面并释放短距离冲击波。"
  },
  execution_drive: {
    name: "处决突刺",
    description: "对单体目标发动终结突刺。"
  },
  shadow_step: {
    name: "影袭步",
    description: "闪现至附近敌人并触发一次必定暴击。"
  },
  blade_fan: {
    name: "刃扇",
    description: "向前方短锥形区域抛射飞刃。"
  },
  mark_prey: {
    name: "猎物标记",
    description: "暴露目标弱点并造成额外伤害。"
  },
  venom_volley: {
    name: "毒雨连矢",
    description: "向小范围区域倾泻附毒弹幕。"
  },
  wind_dash: {
    name: "风行突袭",
    description: "快速突进并斩击最近目标。"
  },
  blood_drain: {
    name: "血能汲取",
    description: "吸取最近敌人的生命。"
  },
  frost_nova: {
    name: "冰霜新星",
    description: "释放环形寒潮并施加减速。"
  },
  chain_lightning: {
    name: "连锁闪电",
    description: "释放撕裂目标的奥术电弧。"
  },
  spirit_burst: {
    name: "灵爆",
    description: "释放环形灵体冲击。"
  },
  rift_step: {
    name: "裂隙步",
    description: "进行奥术位移并打击目标。"
  }
};

const EVENT_ZH: Readonly<
  Record<
    string,
    {
      name: string;
      description: string;
      choices: Readonly<Record<string, { name: string; description: string }>>;
    }
  >
> = {
  mysterious_shrine: {
    name: "神秘祭坛",
    description: "一座脉动的祭坛索取你的献祭。",
    choices: {
      offer_obol: { name: "献上欧铂", description: "花费 8 欧铂换取祝福。" },
      touch_relic: { name: "触碰遗物", description: "获得奖励，但可能受诅咒。" },
      leave: { name: "离开", description: "悄然离去。" }
    }
  },
  trapped_chest: {
    name: "陷阱宝箱",
    description: "华丽的宝箱发出符文嗡鸣。",
    choices: {
      force_open: { name: "强行开启", description: "获取战利品，但有受伤风险。" },
      disarm: { name: "解除机关", description: "消耗法力，更安全地开启。" },
      ignore: { name: "无视", description: "无收益，也无风险。" }
    }
  },
  wandering_merchant: {
    name: "流浪商人",
    description: "披着斗篷的商人愿以欧铂交易遗物。",
    choices: {
      browse: { name: "查看货品", description: "浏览可购买的物品。" },
      leave: { name: "离开", description: "暂时不需要。" }
    }
  },
  cursed_altar: {
    name: "诅咒祭坛",
    description: "血色符印承诺以痛苦换取力量。",
    choices: {
      blood_trade: { name: "血之交易", description: "消耗生命，换取稀有奖励。" },
      drain_mana: { name: "奥术交易", description: "消耗法力，换取欧铂。" },
      reject: { name: "拒绝", description: "不进行任何交易。" }
    }
  },
  fallen_adventurer: {
    name: "陨落冒险者",
    description: "一名濒死战士递出最后的补给。",
    choices: {
      aid: { name: "援助", description: "消耗法力并获得补给。" },
      loot: { name: "搜刮", description: "带走遗物，但有道德风险。" }
    }
  },
  unstable_portal: {
    name: "不稳定传送门",
    description: "噼啪作响的裂隙正在扭曲现实。",
    choices: {
      attune: { name: "调谐", description: "获得洞察并揭示地图目标。" },
      harvest: { name: "萃取", description: "提取欧铂，但可能反噬。" },
      seal: { name: "封印", description: "稳定裂隙后离开。" }
    }
  }
};

const UNLOCK_ZH: Readonly<Record<string, { name: string; description: string }>> = {
  u_starting_hp_10: { name: "坚韧血肉", description: "初始生命值 +10。" },
  u_unlock_cleave: { name: "解锁：横扫", description: "将横扫加入奖励池。" },
  u_skill_slot_3: { name: "第三技能槽", description: "技能槽提升至 3。" },
  u_skill_slot_4: { name: "第四技能槽", description: "技能槽提升至 4。" },
  u_starting_armor_2: { name: "钢铁之肤", description: "初始护甲 +2。" },
  u_luck_bonus_5: { name: "命运之眼", description: "基础暴击/幸运 +5%。" },
  u_potion_charge_1: { name: "药剂充能", description: "药剂充能次数 +1。" },
  u_unlock_shadow_step: { name: "解锁：影袭步", description: "解锁影袭步技能。" },
  u_unlock_affix_frenzied: { name: "词缀：狂热", description: "在高阶楼层启用狂热怪物。" },
  u_unlock_affix_armored: { name: "词缀：重甲", description: "在高阶楼层启用重甲怪物。" },
  u_unlock_event_merchant: { name: "事件：流浪商人", description: "允许在对局中遭遇商人。" },
  u_unlock_affix_vampiric: { name: "词缀：吸血", description: "启用吸血怪物。" },
  u_unlock_affix_splitting: { name: "词缀：分裂", description: "启用分裂怪物。" },
  u_unlock_event_unstable_portal: { name: "事件：不稳定传送门", description: "允许不稳定传送门事件出现。" }
};

const TALENT_ZH: Readonly<Record<string, { name: string; description: string }>> = {
  core_vitality_training: { name: "体能训练", description: "提升基础最大生命值。" },
  core_iron_skin: { name: "钢铁皮肤", description: "提升基础护甲。" },
  core_keen_eye: { name: "敏锐之眼", description: "提升基础暴击率。" },
  warrior_blooded_edge: { name: "血刃", description: "提升力量。" },
  warrior_crushing_weight: { name: "碎骨重压", description: "提升攻击力。" },
  warrior_brutal_momentum: { name: "残暴势能", description: "提升攻击速度。" },
  warrior_colossus_frame: { name: "巨像之躯", description: "提升体质。" },
  warrior_executioner_instinct: { name: "处刑本能", description: "按百分比提升攻击力。" },
  warrior_undying_stride: { name: "不灭步伐", description: "提升最大生命值。" },
  ranger_shadow_step: { name: "影步", description: "提升敏捷。" },
  ranger_quickdraw: { name: "快拔", description: "提升攻击速度。" },
  ranger_hawk_eye: { name: "鹰眼", description: "提升暴击率。" },
  ranger_windrunner: { name: "风行者", description: "提升移动速度。" },
  ranger_venom_threads: { name: "毒丝", description: "提升攻击力。" },
  ranger_predator_focus: { name: "猎食专注", description: "进一步提升敏捷。" },
  arcanist_mindforge: { name: "心铸", description: "提升智力。" },
  arcanist_aether_pool: { name: "以太之池", description: "提升最大法力。" },
  arcanist_sigil_acceleration: { name: "符印加速", description: "提升攻击速度。" },
  arcanist_crystal_focus: { name: "晶核专注", description: "提升攻击力。" },
  arcanist_phase_dodge: { name: "相位闪避", description: "获得相位闪避触发概率。" },
  arcanist_mana_shield: { name: "法力护盾", description: "获得法力护盾触发概率。" },
  utility_potion_satchel: { name: "药剂囊", description: "提升药剂容量。" },
  utility_skill_slot_i: { name: "第三技能槽", description: "额外解锁 1 个技能槽。" },
  utility_skill_slot_ii: { name: "第四技能槽", description: "额外解锁 1 个技能槽。" },
  utility_merchant_sense: { name: "商路直觉", description: "对局内获得商人折扣。" },
  utility_death_ledger: { name: "亡者账本", description: "失败时保留更多碎片。" },
  utility_lethal_guard: { name: "致命守护", description: "获得致命守护触发概率。" }
};

const BLUEPRINT_NAME_ZH: Readonly<Record<string, string>> = {
  bp_skill_frost_nova: "冰封符印草图",
  bp_skill_war_cry: "战吼蚀刻",
  bp_skill_chain_lightning: "风暴晶格",
  bp_skill_spirit_burst: "灵爆矩阵",
  bp_skill_rift_step: "裂隙步铭纹",
  bp_weapon_axe: "战斧框架",
  bp_weapon_dagger: "匕首样式图",
  bp_weapon_staff: "奥术法杖构架",
  bp_weapon_hammer: "战锤蓝图",
  bp_weapon_sword_master: "剑宗晶格",
  bp_consumable_mapping_plus: "制图师墨水",
  bp_consumable_frenzy_tonic: "狂热药剂配方",
  bp_consumable_phantom_brew: "幻影酿剂配方",
  bp_mutation_berserk_echo: "狂战回响符印",
  bp_mutation_guarded_core: "守护核心矩阵",
  bp_mutation_void_exchange: "虚空交换密纹",
  bp_mutation_revenant_blood: "亡魂之血卷轴",
  bp_mutation_hidden_cartography: "隐匿制图符文",
  bp_event_merchant_plus: "商人账簿",
  bp_event_ritual_chamber: "仪式密室图"
};

const MUTATION_NAME_ZH: Readonly<Record<string, string>> = {
  mut_battle_instinct: "战斗本能",
  mut_berserk_echo: "狂战回响",
  mut_revenant_blood: "亡魂之血",
  mut_thorn_reflex: "荆刺反射",
  mut_emergency_aegis: "应急神盾",
  mut_guarded_core: "守护核心",
  mut_phase_skin: "相位皮层",
  mut_iron_nerves: "钢铁神经",
  mut_scavenger_mark: "拾荒标记",
  mut_void_exchange: "虚空交换",
  mut_hidden_cartography: "隐匿制图",
  mut_hematic_elixir: "血质药剂"
};

const BIOME_NAME_ZH: Readonly<Record<string, string>> = {
  forgotten_catacombs: "遗忘地穴",
  molten_caverns: "熔火洞窟",
  frozen_halls: "霜冻长廊",
  phantom_graveyard: "幽影墓园",
  venom_swamp: "毒沼泽地",
  bone_throne: "白骨王座"
};

const MONSTER_NAME_ZH: Readonly<Record<string, string>> = {
  melee_grunt: "地穴猎犬",
  ranged_caster: "灰烬侍僧",
  elite_bruiser: "钢铁亡魂",
  magma_crawler: "熔岩爬行者",
  ember_wraith: "余烬幽魂",
  flame_brute: "烈焰暴徒",
  frost_warden: "寒霜守卫",
  ice_specter: "冰魄幽灵",
  shadow_lurker: "暗影潜伏者",
  bone_priest: "白骨祭司",
  wraith_knight: "幽魂骑士",
  soul_eater: "噬魂者",
  venom_spitter: "毒液喷吐者",
  swamp_hulk: "沼泽巨怪",
  fungal_host: "真菌宿主"
};

const AFFIX_ZH: Readonly<Record<string, { name: string; description: string }>> = {
  frenzied: { name: "狂热", description: "移动与攻击速度更快。" },
  armored: { name: "重甲", description: "拥有强化生命池。" },
  vampiric: { name: "吸血", description: "攻击时会汲取生命。" },
  splitting: { name: "分裂", description: "死亡时分裂为弱体。" }
};

const BOSS_NAME_ZH: Readonly<Record<string, string>> = {
  bone_sovereign: "白骨君王"
};

export function buildZhCnContentMessages(): Record<string, string> {
  const messages: Record<string, string> = {};

  for (const item of ITEM_DEFS) {
    messages[contentItemNameKey(item.id)] = ITEM_NAME_ZH[item.id] ?? item.name;
  }

  for (const skill of SKILL_DEFS) {
    const translated = SKILL_ZH[skill.id];
    messages[contentSkillNameKey(skill.id)] = translated?.name ?? skill.name;
    messages[contentSkillDescriptionKey(skill.id)] = translated?.description ?? skill.description;
  }

  for (const eventDef of RANDOM_EVENT_DEFS) {
    const translatedEvent = EVENT_ZH[eventDef.id];
    messages[contentEventNameKey(eventDef.id)] = translatedEvent?.name ?? eventDef.name;
    messages[contentEventDescriptionKey(eventDef.id)] = translatedEvent?.description ?? eventDef.description;
    for (const choice of eventDef.choices) {
      const translatedChoice = translatedEvent?.choices[choice.id];
      messages[contentEventChoiceNameKey(eventDef.id, choice.id)] = translatedChoice?.name ?? choice.name;
      messages[contentEventChoiceDescriptionKey(eventDef.id, choice.id)] =
        translatedChoice?.description ?? choice.description;
    }
  }

  for (const unlock of UNLOCK_DEFS) {
    const translated = UNLOCK_ZH[unlock.id];
    messages[contentUnlockNameKey(unlock.id)] = translated?.name ?? unlock.name;
    messages[contentUnlockDescriptionKey(unlock.id)] = translated?.description ?? unlock.description;
  }

  for (const talent of TALENT_DEFS) {
    const translated = TALENT_ZH[talent.id];
    messages[contentTalentNameKey(talent.id)] = translated?.name ?? talent.name;
    messages[contentTalentDescriptionKey(talent.id)] = translated?.description ?? talent.description;
  }

  for (const blueprint of BLUEPRINT_DEFS) {
    messages[contentBlueprintNameKey(blueprint.id)] = BLUEPRINT_NAME_ZH[blueprint.id] ?? blueprint.name;
  }

  for (const mutation of MUTATION_DEFS) {
    messages[contentMutationNameKey(mutation.id)] = MUTATION_NAME_ZH[mutation.id] ?? mutation.name;
  }

  for (const biome of Object.values(BIOME_MAP)) {
    messages[contentBiomeNameKey(biome.id)] = BIOME_NAME_ZH[biome.id] ?? biome.name;
  }

  for (const monster of MONSTER_ARCHETYPES) {
    messages[contentMonsterNameKey(monster.id)] = MONSTER_NAME_ZH[monster.id] ?? monster.name;
  }

  for (const affix of MONSTER_AFFIX_DEFS) {
    const translated = AFFIX_ZH[affix.id];
    messages[contentAffixNameKey(affix.id)] = translated?.name ?? affix.name;
    messages[contentAffixDescriptionKey(affix.id)] = translated?.description ?? affix.description;
  }

  for (const boss of BOSS_DEFS) {
    messages[contentBossNameKey(boss.id)] = BOSS_NAME_ZH[boss.id] ?? boss.name;
  }

  return messages;
}
