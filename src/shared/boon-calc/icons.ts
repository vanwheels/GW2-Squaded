import type { BoonName, ConditionName } from './constants'

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
