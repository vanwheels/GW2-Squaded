import type { AuraName, BoonName, ConditionName } from './constants'

/**
 * Icon URL for each boon/condition name, keyed the same way as `BOON_NAMES`/
 * `CONDITION_NAMES` in ./constants. Like those name lists, this is a stable
 * game constant rather than fetched data — but the URLs themselves come
 * straight from real GW2 API responses already on disk: every `Buff`-type
 * `Fact` in data/game-data/skills.json and traits.json carries an `icon` for
 * the boon/condition it grants, and that icon is the same CDN URL across
 * every skill/trait that grants a given boon (e.g. every Aegis-granting fact
 * points at the one Aegis icon). Extracted once by scanning those files for
 * the first `Fact.icon` matching each name in BOON_NAMES/CONDITION_NAMES.
 */
export const BOON_CONDITION_ICONS: Record<BoonName | ConditionName, string> = {
  Aegis: 'https://render.guildwars2.com/file/DFB4D1B50AE4D6A275B349E15B179261EE3EB0AF/102854.png',
  Alacrity: 'https://render.guildwars2.com/file/4FDAC2113B500104121753EF7E026E45C141E94D/1938787.png',
  Fury: 'https://render.guildwars2.com/file/96D90DF84CAFE008233DD1C2606A12C1A0E68048/102842.png',
  Might: 'https://render.guildwars2.com/file/2FA9DF9D6BC17839BBEA14723F1C53D645DDB5E1/102852.png',
  Protection: 'https://render.guildwars2.com/file/CD77D1FAB7B270223538A8F8ECDA1CFB044D65F4/102834.png',
  Quickness: 'https://render.guildwars2.com/file/D4AB6401A6D6917C3D4F230764452BCCE1035B0D/1012835.png',
  Regeneration: 'https://render.guildwars2.com/file/F69996772B9E18FD18AD0AABAB25D7E3FC42F261/102835.png',
  Resistance: 'https://render.guildwars2.com/file/50BAC1B8E10CFAB9E749A5D910D4A9DCF29EBB7C/961398.png',
  Resolution: 'https://render.guildwars2.com/file/D104A6B9344A2E2096424A3C300E46BC2926E4D7/2440718.png',
  Stability: 'https://render.guildwars2.com/file/3D3A1C2D6D791C05179AB871902D28782C65C244/415959.png',
  Swiftness: 'https://render.guildwars2.com/file/20CFC14967E67F7A3FD4A4B8722B4CF5B8565E11/102836.png',
  Vigor: 'https://render.guildwars2.com/file/58E92EBAF0DB4DA7C4AC04D9B22BCA5ECF0100DE/102843.png',
  Bleeding: 'https://render.guildwars2.com/file/79FF0046A5F9ADA3B4C4EC19ADB4CB124D5F0021/102848.png',
  Blinded: 'https://render.guildwars2.com/file/09770136BB76FD0DBE1CC4267DEED54774CB20F6/102837.png',
  Burning: 'https://render.guildwars2.com/file/B47BF5803FED2718D7474EAF9617629AD068EE10/102849.png',
  Chilled: 'https://render.guildwars2.com/file/28C4EC547A3516AF0242E826772DA43A5EAC3DF3/102839.png',
  Confusion: 'https://render.guildwars2.com/file/289AA0A4644F0E044DED3D3F39CED958E1DDFF53/102880.png',
  Crippled: 'https://render.guildwars2.com/file/070325E519C178D502A8160523766070D30C0C19/102838.png',
  Fear: 'https://render.guildwars2.com/file/30307A6E766D74B6EB09EDA12A4A2DE50E4D76F4/102869.png',
  Immobile: 'https://render.guildwars2.com/file/397A613651BFCA2832B6469CE34735580A2C120E/102844.png',
  Poisoned: 'https://render.guildwars2.com/file/559B0AF9FB5E1243D2649FAAE660CCB338AACC19/102840.png',
  Slow: 'https://render.guildwars2.com/file/F60D1EF5271D7B9319610855676D320CD25F01C6/961397.png',
  Taunt: 'https://render.guildwars2.com/file/02EED459AD65FAF7DF32A260E479C625070841B9/1228472.png',
  Torment: 'https://render.guildwars2.com/file/10BABF2708CA3575730AC662A2E72EC292565B08/598887.png',
  Vulnerability: 'https://render.guildwars2.com/file/3A394C1A0A3257EB27A44842DDEEF0DF000E1241/102850.png',
  Weakness: 'https://render.guildwars2.com/file/6CB0E64AF9AA292E332A38C1770CE577E2CDE0E8/102853.png'
}

/** Icon URL for each `AURA_NAMES` entry — same sourcing method as `BOON_CONDITION_ICONS`. */
export const AURA_ICONS: Record<AuraName, string> = {
  'Chaos Aura': 'https://render.guildwars2.com/file/FEF378D8A91D0523A04A380ED0547F0BF944A967/2261518.png',
  'Dark Aura': 'https://render.guildwars2.com/file/9471B12401BB04730A0614E277FEFD6AE43C5251/2261519.png',
  'Fire Aura': 'https://render.guildwars2.com/file/2E7050E44690AFE0A396FA0DAD526699392743F3/2261521.png',
  'Frost Aura': 'https://render.guildwars2.com/file/719B80E35C276D68EF0AABB79126CF4CD42E3AF6/2261522.png',
  'Light Aura': 'https://render.guildwars2.com/file/62405ED2322E80A4A95663BA6C6804DB0962E6B0/867451.png',
  'Magnetic Aura': 'https://render.guildwars2.com/file/33D27C7FE0017F70749DE84576F56F381DDF0C30/2261524.png',
  'Shocking Aura': 'https://render.guildwars2.com/file/79F60BF40AB3F306E7367CF3479A4163F76F3944/2261527.png'
}

/** Icon URL for each `CONTROL_MATCHERS` key (see sources.ts) — Stun/Daze reuse the same icon
 *  whether the underlying fact is the `Time`-typed or `Buff`-typed variant (confirmed identical
 *  CDN URL across both shapes this session). */
export const CONTROL_ICONS: Record<string, string> = {
  Stun: 'https://render.guildwars2.com/file/1999B9DB355005D2DD19F66DFFBAA6D466057508/522727.png',
  Daze: 'https://render.guildwars2.com/file/9AE125E930C92FEA0DD99E7EBAEDE4CF5EC556B6/433474.png',
  Knockdown: 'https://render.guildwars2.com/file/7632087376D36B0D100F1B07BE53F154BC337D7C/2440716.png',
  Knockback: 'https://render.guildwars2.com/file/400B7FD39724FBD700B94AB8AB52B5B9167646F4/2440715.png',
  Launch: 'https://render.guildwars2.com/file/B4087CEB5CC006172E0A09DADC5452807A0CA3F7/2440712.png',
  Pull: 'https://render.guildwars2.com/file/D5F6EBC4630F0E10F3DDB7A6DBB63592CD4B00BC/2440717.png'
}

/** Icon URL for each `MISCELLANEOUS_MATCHERS` key (see sources.ts). */
export const MISCELLANEOUS_ICONS: Record<string, string> = {
  Stealth: 'https://render.guildwars2.com/file/3BD4670638470439F3325B444FAF7D5FA620CCE5/62777.png',
  Superspeed: 'https://render.guildwars2.com/file/E04392C3D8ED985125973AEB99D8460C483263F9/103458.png',
  Evade: 'https://render.guildwars2.com/file/9F19DB1D3E1629390F2360F2D866651BBC0F6155/1938788.png',
  'Breaks Stun': 'https://render.guildwars2.com/file/DCF0719729165FD8910E034CA4E0780F90582D15/156654.png',
  Barrier: 'https://render.guildwars2.com/file/357922487919E8E84B914EAC13D5796DDDC42D14/1770209.png'
}

/** The API has no dedicated Strip/Corrupt icon — both read a `Number`-type fact that reuses the
 *  same generic icon every other `Number` fact without a more specific one does (confirmed via
 *  scan). Distinguished by row label instead (see `BoonConditionSummaryPanel`), same as
 *  `COMBO_ICONS`'s Field/Finisher not having per-type icons. */
export const BOON_STRIP_CORRUPT_ICONS: Record<string, string> = {
  Strip: 'https://render.guildwars2.com/file/9352ED3244417304995F26CB01AE76BB7E547052/156661.png',
  Corrupt: 'https://render.guildwars2.com/file/9352ED3244417304995F26CB01AE76BB7E547052/156661.png'
}

/** Every `AttributeAdjust` fact with `target: 'Healing'` shares this one icon across every skill
 *  (confirmed via a scan of data/game-data/skills.json) — used for the `BoonConditionSummaryPanel`'s
 *  "Healing" row (see `computeHealingSources` in boon-calc/sources.ts). */
export const HEALING_ICON = 'https://render.guildwars2.com/file/D4347C52157B040943051D7E09DEAD7AF63D4378/156662.png'

/** Every `Damage`-type fact shares this one icon across every skill (confirmed via a scan of
 *  data/game-data/skills.json) — used for the `BoonConditionSummaryPanel`'s "Damage" row (see
 *  `computeDamageSources` in boon-calc/sources.ts). */
export const DAMAGE_ICON = 'https://render.guildwars2.com/file/61AA4919C4A7990903241B680A69530121E994C7/156657.png'

/** The API exposes exactly one icon per Combo Field fact and one per Combo Finisher fact,
 *  regardless of `field_type`/`finisher_type` (confirmed via a scan of data/game-data/skills.json)
 *  — unlike boons/conditions/auras, there's no per-type icon to look up here. */
export const COMBO_ICONS = {
  field: 'https://render.guildwars2.com/file/59E0DB6A699810641C959926ADFEF73E08CC255B/156655.png',
  finisher: 'https://render.guildwars2.com/file/A513F3653D33FBA4220D2D307799F8A327A36A3B/156656.png'
}
