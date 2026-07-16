import type { SortedScoreData } from './services/ScoreDataService'
import type { Badge, Difficulty } from './ratingTypes'
import type { DifficultyType } from '../../types'
import { TIER_ORDER, DIFFCHART_10_TIERS, DFC_TIER_ORDER, DIFFCHART_10_DFC_TIERS, dfcTierRank } from '../../lib/diffchartTiers'

export type SortKey =
  | 'name'
  | 'diff'
  | 'level'
  | 'play'
  | 'score'
  | 'badge'
  | 'goodpercent'
  | 'goods'
  | 'okays'
  | 'bads'
  | 'roll'
  | 'clear'
  | 'fullcombo'
  | 'donderfullcombo'
  | 'songduration'
  | 'maxbpm'
  | 'lastplayed'
  | 'lastupscored'
  | 'tier'
  | 'dfctier'
  | 'dan'

export function badgeToNumber(badge: Badge): number {
  switch (badge) {
    case 'rainbow': return 8
    case 'purple': return 7
    case 'pink': return 6
    case 'gold': return 5
    case 'silver': return 4
    case 'bronze': return 3
    case 'white': return 2
    case null: return 1
  }
}

export function getBadgeName(badge: Badge): string {
  switch (badge) {
    case 'rainbow': return 'rainbow'
    case 'purple': return 'purple'
    case 'pink': return 'pink'
    case 'gold': return 'gold'
    case 'silver': return 'silver'
    case 'bronze': return 'bronze'
    case 'white': return 'white'
    case null: return 'none'
  }
}

export function getTotalNotes(scoreData: SortedScoreData): number {
  return scoreData.score.good + scoreData.score.ok + scoreData.score.bad
}

export function getGoodPercent(scoreData: SortedScoreData): number {
  const totalNotes = getTotalNotes(scoreData)
  return totalNotes > 0 ? scoreData.score.good / totalNotes : 0
}

export function getDifficultyType(diff: Difficulty): DifficultyType {
  return diff === 'ura' ? 'oni_ura' : 'oni'
}

export function getSongTier(s: SortedScoreData): string | null {
  return DIFFCHART_10_TIERS[`${s.songNo}:${s.difficulty}`] ?? null
}

export function getSongDfcTier(s: SortedScoreData): string | null {
  return DIFFCHART_10_DFC_TIERS[`${s.songNo}:${s.difficulty}`] ?? null
}

export function formatLevel(level: number): string {
  if (level <= 0) return '-'
  const trimmed = Math.round(level * 10) / 10
  return trimmed % 1 === 0 ? String(Math.trunc(trimmed)) : trimmed.toFixed(1)
}

export function formatHours(totalSeconds: number): string {
  const hours = Math.max(0, totalSeconds) / 3600
  return `${hours.toFixed(2)} hours`
}

export function daysSince(ts: number | null): string {
  if (ts === null) return '-'
  const days = Math.floor((Date.now() - ts) / 86400000)
  if (days < 1) return '<1d'
  return `${days}d`
}

export function normalizeFilterQuery(q: string): string {
  return q.replace(/([a-z%]+)\s*(>=|<=|=|>|<|:)\s*([^\s"]+)/gi, (_m, field, op, value) => {
    return `${field}${op}${value}`
  })
}

export function parseTierValue(val: string): number {
  const upper = val.toUpperCase().replace('SS+', 'SSS') // common typo guard
  const idx = TIER_ORDER.findIndex(t => t.toUpperCase() === upper)
  return idx >= 0 ? idx : -1
}

export function parseDfcTierValue(val: string): number {
  const upper = val.toUpperCase()
  const idx = DFC_TIER_ORDER.findIndex(t => t.toUpperCase() === upper)
  return idx >= 0 ? idx : -1
}

export function songNoNum(songNo: string): number {
  const n = Number(songNo)
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY
}

export function cmp(a: number | string, b: number | string): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

export const DIST_LEVEL_LABELS: { top: string; bottom?: string }[] = [
  { top: '1–5' },
  { top: '6' },
  { top: '7' },
  { top: '8' },
  { top: '9' },
  { top: 'Low 10' },
  { top: 'Mid 10' },
  { top: 'High 10' },
]

/** Returns 0-based bucket index for a song's level + clear tier, or -1 to exclude. */
export function getLevelBucket(level: number, tier: string | null): number {
  if (!Number.isFinite(level) || level < 1) return -1
  if (level < 6) return 0
  if (level < 7) return 1
  if (level < 8) return 2
  if (level < 9) return 3
  if (level < 10) return 4
  // level >= 10: sub-bucket by tier
  if (!tier || ['F', 'E', 'D', 'X' ].includes(tier)) return 5 
  if (['C', 'B', 'A', ].includes(tier)) return 6 
  return 7
}

/** Returns 0-based bucket index for a song's level + DFC tier, or -1 to exclude. */
export function getDfcLevelBucket(level: number, dfcTier: string | null): number {
  if (!Number.isFinite(level) || level < 1) return -1
  if (level < 6) return 0
  if (level < 7) return 1
  if (level < 8) return 2
  if (level < 9) return 3
  if (level < 10) return 4
  // level >= 10: sub-bucket by DFC tier
  if (!dfcTier || ['F', 'E', 'D'].includes(dfcTier)) return 5
  if (['C', 'B', 'A', 'A+'].includes(dfcTier)) return 6
  return 7
}
