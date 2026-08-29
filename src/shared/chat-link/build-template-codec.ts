import type {
  Build,
  GameData,
  Profession,
  ProfessionId,
  RevenantSkillSelection,
  SkillSelection,
  StandardSkillSelection,
  TraitLineSlots
} from '../types'

/**
 * Encode/decode for the official GW2 "Build Template" chat link (`[&D...]`, type byte `0x0D`) —
 * covers Traits + Skills only, per TODO.md's "Official GW2 Build Template chat-link export/
 * import" scope. No equipment-template chat-link type exists at all (ArenaNet never solved the
 * rarity/stat-variance export problem either), so `Build.equipment`/`relicId`/`foodId`/`utilityId`
 * are never touched by either direction here.
 *
 * **Sources, since this format is undocumented by ArenaNet directly:**
 * - The wiki's [Chat link format](https://wiki.guildwars2.com/wiki/Chat_link_format) page
 *   documents the byte layout in prose (profession byte, 3×2 specialization/trait bytes, 10×2
 *   skill-palette bytes, a profession-specific tail, and the June-2023 Weaponmaster Training
 *   extension).
 * - Cross-checked byte-for-byte against `thatshaman/Buildtemplate` (MIT-licensed reference
 *   implementation, github.com/thatshaman/Buildtemplate) — confirms the exact offsets used below
 *   (specialization pairs at bytes 2-7, heal at 8-11, 3 utility pairs at 12-23, elite at 24-27,
 *   16-byte profession-specific tail from byte 28, `bytes.length >= 44` as the universal minimum).
 * - The specific meaning of the profession-specific tail's bytes (Ranger pet ids, Revenant legend
 *   codes + inactive-legend utility skills) is the wiki's own prose, independently verified
 *   2026-08-28 by decoding 3 real, currently-published Revenant build codes (MetaBattle) byte by
 *   byte: the tail's first 4 bytes line up exactly with the "Terrestrial Legend 1 (active)/2,
 *   Aquatic Legend 1/2" fields the wiki describes, and bytes 4-15 line up with 3 palette-id pairs
 *   matching the *other* (inactive) legend's utility skills — this also confirmed a Revenant
 *   legend's tail byte is the small 1-8 value the GW2 API itself exposes as `/v2/legends`'
 *   `code` field (`?v=latest` schema only — see `scripts/fetch-chat-link-ids.ts`), not derived by
 *   guesswork.
 * - Skill ids in the format are "palette ids" (a small, profession-scoped legacy engine id), not
 *   real `Skill.id`s — resolved via `Profession.skillPalette`, also only exposed under `?v=latest`
 *   (confirmed live: a plain `/v2/professions/:id` has neither field at all).
 *
 * **Deliberate v1 scoping decisions (2026-08-28, see project memory for the fuller writeup):**
 * - **Land/underwater skills are NOT modeled separately.** The real format stores independent
 *   terrestrial and aquatic Heal/Utility/Elite skills (and separate land/water Revenant legends /
 *   Ranger pets — 4 slots, not 2) — this app's `Build` has only one shared selection for both
 *   environments. Encoding mirrors the single selection into both halves; decoding reads only the
 *   terrestrial half and ignores any distinct aquatic value. A real chat link with a genuinely
 *   different underwater loadout loses that half on import — acceptable since underwater content
 *   is a small slice of the game and not this app's focus.
 * - **The Weaponmaster Training tail (equipped weapon-type list + skill-variant overrides) is
 *   parsed-but-skipped, never applied to the `Build`.** `decodeBuildTemplate` reads past it
 *   correctly (so a real modern chat-link code doesn't fail to parse) but ignores its content;
 *   `encodeBuildTemplate` always emits the spec-legal empty form (a zero weapon count, a zero
 *   override count). The wiki's own prose doesn't fully specify how an "override" entry ties back
 *   to a specific weapon-skill slot, and this app already tracks equipped weapon *types* directly
 *   via `Build.equipment` (chat links carry no equipment/rarity/stat data at all, so there's
 *   nothing here more authoritative to import anyway).
 */

const BUILD_TEMPLATE_LINK_TYPE = 0x0d
/** Header (1) + profession (1) + 3×(spec id + trait byte) (6) + 10×2-byte skill words (20) +
 *  profession-specific tail (16) — the reference implementation's own hard floor. Shorter than
 *  this and the link predates even the base Ranger/Revenant tail, or is truncated/corrupted. */
const MIN_BYTE_LENGTH = 44
const SPECIALIZATION_SLOT_COUNT = 3
const PROFESSION_TAIL_LENGTH = 16
const PROFESSION_TAIL_OFFSET = 28

export interface ChatLinkEncodeResult {
  code: string
  /** Non-fatal: something in `build` couldn't be represented (e.g. a chosen skill has no known
   *  palette id for this profession) and was encoded as empty instead. */
  warnings: string[]
}

export interface ChatLinkDecodeResult {
  /** Fields to merge onto the current draft build. Only ever touches profession/specializations/
   *  skills/(Ranger) pet fields — never equipment, name, notes, tags, or anything else a chat link
   *  has no concept of. Caller is responsible for the same profession-change resets
   *  `BuildEditorView`'s own picker already applies (clearing equipment/familiar/etc.) when
   *  `patch.profession` differs from the build being imported into. */
  patch: Partial<Build>
  /** Non-fatal: a byte in the code didn't resolve against the currently-loaded game data (e.g. an
   *  unrecognized skill-palette id, most likely a stale code from before a balance patch reused
   *  that id for something else) and was left blank instead. */
  warnings: string[]
}

function parseWrapper(input: string): Uint8Array | null {
  const trimmed = input.trim()
  const match = /^\[&([A-Za-z0-9+/]+=*)\]$/.exec(trimmed)
  const base64 = match ? match[1] : /^[A-Za-z0-9+/]+=*$/.test(trimmed) ? trimmed : null
  if (!base64) return null
  try {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

function toWrapper(bytes: number[]): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return `[&${btoa(binary)}]`
}

function readU16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] + (bytes[offset + 1] << 8)
}

function pushU16LE(bytes: number[], value: number): void {
  bytes.push(value & 0xff, (value >> 8) & 0xff)
}

/** `Profession.skillPalette` in both directions — built fresh per call since this only ever runs
 *  once per user-initiated encode/decode click, not a hot path. */
function paletteMaps(profession: Profession): { toPalette: Map<number, number>; toSkill: Map<number, number> } {
  return {
    toPalette: new Map(profession.skillPalette.map(([paletteId, skillId]) => [skillId, paletteId])),
    toSkill: new Map(profession.skillPalette)
  }
}

// --- Encode -------------------------------------------------------------------------------------

function encodeSpecializationBytes(
  slots: TraitLineSlots,
  traitsById: Map<number, { order: number }>
): number[] {
  const out: number[] = []
  for (const slot of slots) {
    if (!slot) {
      out.push(0, 0)
      continue
    }
    let traitByte = 0
    for (let tier = 0; tier < SPECIALIZATION_SLOT_COUNT; tier++) {
      const traitId = slot.chosenTraitIds[tier]
      if (traitId == null) continue
      const trait = traitsById.get(traitId)
      const choice = trait ? trait.order + 1 : 0 // wiki: 1=top, 2=middle, 3=bottom; 0=unchosen
      traitByte |= (choice & 0x3) << (tier * 2)
    }
    out.push(slot.specializationId & 0xff, traitByte)
  }
  return out
}

/** Active/inactive legend split for the Revenant tail — `Legend2`/`Legend2` etc. is impossible in
 *  practice (the editor never lets both slots hold the same legend) but this doesn't assume that. */
function activeInactiveLegends(skills: RevenantSkillSelection): [string | null, string | null] {
  const [a, b] = skills.legends
  return skills.activeLegendIndex === 0 ? [a, b] : [b, a]
}

export function encodeBuildTemplate(build: Build, gameData: GameData): ChatLinkEncodeResult {
  const warnings: string[] = []
  const profession = gameData.professions.find((p) => p.id === build.profession)
  if (!profession) throw new Error(`Unknown profession "${build.profession}" — can't build a chat link.`)

  const bytes: number[] = [BUILD_TEMPLATE_LINK_TYPE, profession.code]

  const traitsById = new Map(gameData.traits.map((t) => [t.id, t]))
  bytes.push(...encodeSpecializationBytes(build.specializations, traitsById))

  const { toPalette } = paletteMaps(profession)
  /** `silent` skips the warning: used for a Revenant's legend-kit skills, which the API's own
   *  `skillPalette` table only sparsely covers (confirmed live 2026-08-28 — most core/elite
   *  legends' heal/utility/elite ids simply aren't in it at all, apparently because those slots
   *  are never independently player-bound in the first place, unlike every other profession's).
   *  Harmless: `decodeBuildTemplate` never reads these bytes back for a Revenant anyway (it
   *  reconstructs skills purely from the tail's legend codes), so a gap here loses no information
   *  round-tripping through this app — only (best-effort) fidelity for a 3rd-party viewer that
   *  reads the main skill block directly. */
  const paletteOrZero = (skillId: number | null, label: string, silent = false): number => {
    if (skillId == null) return 0
    const palette = toPalette.get(skillId)
    if (palette == null) {
      if (!silent) {
        const skillName = gameData.skills.find((s) => s.id === skillId)?.name ?? `id ${skillId}`
        warnings.push(`Couldn't resolve a chat-link id for ${label} skill "${skillName}" — left blank in the code.`)
      }
      return 0
    }
    return palette
  }

  let healPalette = 0
  let elitePalette = 0
  const utilityPalettes: [number, number, number] = [0, 0, 0]

  if (build.skills.kind === 'standard') {
    healPalette = paletteOrZero(build.skills.heal, 'Heal')
    elitePalette = paletteOrZero(build.skills.elite, 'Elite')
    build.skills.utility.forEach((id, i) => {
      utilityPalettes[i] = paletteOrZero(id, `Utility ${i + 1}`)
    })
  } else {
    const [activeLegendId] = activeInactiveLegends(build.skills)
    const activeLegend = activeLegendId ? gameData.legends.find((l) => l.id === activeLegendId) : null
    if (activeLegend) {
      healPalette = paletteOrZero(activeLegend.heal, 'Heal', true)
      elitePalette = paletteOrZero(activeLegend.elite, 'Elite', true)
      activeLegend.utilities.forEach((id, i) => {
        utilityPalettes[i] = paletteOrZero(id, `Utility ${i + 1}`, true)
      })
    }
  }

  // Main skill block: terrestrial + aquatic mirrored — see module doc comment's land/water scoping
  // decision.
  pushU16LE(bytes, healPalette)
  pushU16LE(bytes, healPalette)
  for (const u of utilityPalettes) {
    pushU16LE(bytes, u)
    pushU16LE(bytes, u)
  }
  pushU16LE(bytes, elitePalette)
  pushU16LE(bytes, elitePalette)

  // Profession-specific tail — always 16 bytes, mostly unused outside Ranger/Revenant.
  const tail = new Array<number>(PROFESSION_TAIL_LENGTH).fill(0)
  if (build.skills.kind === 'revenant') {
    const [activeLegendId, inactiveLegendId] = activeInactiveLegends(build.skills)
    const legendCode = (id: string | null): number => {
      if (!id) return 0
      const legend = gameData.legends.find((l) => l.id === id)
      if (!legend) {
        warnings.push(`Unknown legend "${id}" — left blank in the code.`)
        return 0
      }
      return legend.code
    }
    const activeCode = legendCode(activeLegendId)
    const inactiveCode = legendCode(inactiveLegendId)
    tail[0] = activeCode
    tail[1] = inactiveCode
    tail[2] = activeCode // aquatic mirrored, see land/water scoping decision
    tail[3] = inactiveCode

    const inactiveLegend = inactiveLegendId ? gameData.legends.find((l) => l.id === inactiveLegendId) : null
    if (inactiveLegend) {
      const inactivePalettes = inactiveLegend.utilities.map((id) => paletteOrZero(id, 'inactive-legend Utility', true))
      for (let i = 0; i < 3; i++) {
        const lo = inactivePalettes[i] & 0xff
        const hi = (inactivePalettes[i] >> 8) & 0xff
        tail[4 + i * 2] = lo
        tail[5 + i * 2] = hi
        tail[10 + i * 2] = lo // aquatic mirrored
        tail[11 + i * 2] = hi
      }
    }
  } else if (build.profession === 'Ranger') {
    const pet0 = build.equippedPetIds[0] ?? 0
    const pet1 = build.equippedPetIds[1] ?? 0
    tail[0] = pet0 & 0xff
    tail[1] = pet1 & 0xff
    tail[2] = pet0 & 0xff // aquatic mirrored
    tail[3] = pet1 & 0xff
  }
  bytes.push(...tail)

  // Weaponmaster Training tail — parse-but-skip scope (see module doc comment): always emit the
  // spec-legal empty form rather than trying to derive it from `Build.equipment`.
  bytes.push(0, 0) // 0 terrestrial weapons, 0 skill overrides

  return { code: toWrapper(bytes), warnings }
}

// --- Decode -------------------------------------------------------------------------------------

function decodeSpecializationSlots(
  bytes: Uint8Array,
  gameData: GameData,
  professionId: ProfessionId,
  warnings: string[]
): TraitLineSlots {
  const slots: TraitLineSlots = [null, null, null]
  for (let s = 0; s < SPECIALIZATION_SLOT_COUNT; s++) {
    const specId = bytes[2 + s * 2]
    const traitByte = bytes[2 + s * 2 + 1]
    if (specId === 0) continue
    const spec = gameData.specializations.find((sp) => sp.id === specId)
    if (!spec) {
      warnings.push(`Unrecognized specialization id ${specId} — left blank.`)
      continue
    }
    if (spec.profession !== professionId) {
      warnings.push(`Specialization "${spec.name}" doesn't belong to ${professionId} — left blank.`)
      continue
    }
    const chosenTraitIds: [number | null, number | null, number | null] = [null, null, null]
    for (let tier = 0; tier < SPECIALIZATION_SLOT_COUNT; tier++) {
      const choice = (traitByte >> (tier * 2)) & 0x3
      if (choice === 0) continue
      const trait = gameData.traits.find(
        (t) => t.specializationId === specId && t.slot === 'Major' && t.tier === tier + 1 && t.order === choice - 1
      )
      if (!trait) {
        warnings.push(`Unrecognized trait pick (spec ${specId}, tier ${tier + 1}, choice ${choice}) — left blank.`)
        continue
      }
      chosenTraitIds[tier] = trait.id
    }
    slots[s] = { specializationId: specId, chosenTraitIds }
  }
  return slots
}

export function decodeBuildTemplate(code: string, gameData: GameData): ChatLinkDecodeResult {
  const bytes = parseWrapper(code)
  if (!bytes || bytes.length === 0) {
    throw new Error('Not a recognizable chat-link code.')
  }
  if (bytes[0] !== BUILD_TEMPLATE_LINK_TYPE) {
    throw new Error('That\'s not a Build Template chat link (expected a "[&D…]" code).')
  }
  if (bytes.length < MIN_BYTE_LENGTH) {
    throw new Error('That Build Template chat link is too short to be valid.')
  }

  const warnings: string[] = []
  const professionCode = bytes[1]
  const profession = gameData.professions.find((p) => p.code === professionCode)
  if (!profession) {
    throw new Error(`Unrecognized profession code ${professionCode} in that chat link.`)
  }

  const specializations = decodeSpecializationSlots(bytes, gameData, profession.id, warnings)
  const { toSkill } = paletteMaps(profession)
  const skillFromPalette = (palette: number, label: string): number | null => {
    if (palette === 0) return null
    const skillId = toSkill.get(palette)
    if (skillId == null) {
      warnings.push(`Unrecognized ${label} skill in that chat link (palette id ${palette}) — left blank.`)
      return null
    }
    return skillId
  }

  const patch: Partial<Build> = { profession: profession.id, specializations }
  const tail = bytes.slice(PROFESSION_TAIL_OFFSET, PROFESSION_TAIL_OFFSET + PROFESSION_TAIL_LENGTH)

  if (profession.id === 'Revenant') {
    const codeToLegend = (legendCode: number) => {
      if (legendCode === 0) return null
      const legend = gameData.legends.find((l) => l.code === legendCode) ?? null
      if (!legend) warnings.push(`Unrecognized legend code ${legendCode} in that chat link — left blank.`)
      return legend
    }
    const activeLegend = codeToLegend(tail[0])
    const inactiveLegend = codeToLegend(tail[1])
    const skills: RevenantSkillSelection = {
      kind: 'revenant',
      legends: [activeLegend?.id ?? null, inactiveLegend?.id ?? null],
      activeLegendIndex: 0
    }
    patch.skills = skills
  } else {
    const heal = skillFromPalette(readU16LE(bytes, 8), 'Heal')
    const utility: StandardSkillSelection['utility'] = [
      skillFromPalette(readU16LE(bytes, 12), 'Utility'),
      skillFromPalette(readU16LE(bytes, 16), 'Utility'),
      skillFromPalette(readU16LE(bytes, 20), 'Utility')
    ]
    const elite = skillFromPalette(readU16LE(bytes, 24), 'Elite')
    const skills: SkillSelection = { kind: 'standard', heal, utility, elite }
    patch.skills = skills

    if (profession.id === 'Ranger') {
      const petOrNull = (petId: number): number | null => {
        if (petId === 0) return null
        if (!gameData.pets.some((p) => p.id === petId)) {
          warnings.push(`Unrecognized pet id ${petId} in that chat link — left blank.`)
          return null
        }
        return petId
      }
      patch.equippedPetIds = [petOrNull(tail[0]), petOrNull(tail[1])]
      patch.activePetIndex = 0
    }
  }

  return { patch, warnings }
}
