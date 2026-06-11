/**
 * Dan rank calculation based on note accuracy criteria.
 *
 * Ranks in ascending order:
 *   Shodan, 2nd–10th Dan, Kuroto, Meijin, Chojin, Tatsujin
 *
 * Two threshold types are supported:
 *
 * - 'percentage': constraints are expressed as percentages of total notes.
 *   minGoodPct, maxOkayPct, and maxBadPct are all optional; absent fields
 *   impose no constraint.
 *
 * - 'flat': constraints are expressed as absolute note counts across 3 songs.
 *   The per-song limit is (value / 3), which is what we compare against a
 *   single song's score.
 *
 * Each rank additionally has optional gold requirements (stricter thresholds).
 * getDanRank returns { rank, gold } where gold indicates whether the gold
 * thresholds were also met.
 *
 * The highest rank whose every specified constraint is satisfied is returned.
 */

export type DanRank =
  | 'Shodan'
  | '2nd Dan'
  | '3rd Dan'
  | '4th Dan'
  | '5th Dan'
  | '6th Dan'
  | '7th Dan'
  | '8th Dan'
  | '9th Dan'
  | '10th Dan'
  | 'Kuroto'
  | 'Meijin'
  | 'Chojin'
  | 'Tatsujin'

export interface DanRankResult {
  rank: DanRank
  gold: boolean
  /** Human-readable tooltip: shows gold requirements and your actual values. */
  goldTooltip: string
}

interface PercentageConstraints {
  minGoodPct?: number
  maxOkayPct?: number
  maxBadPct: number
}

interface FlatConstraints {
  /** Total maximum Okay notes across all 3 dan songs (per-song limit = value / 3). */
  maxOkayTotal: number
  /** Total maximum Bad notes across all 3 dan songs (per-song limit = value / 3). */
  maxBadTotal: number
}

interface PercentageThreshold extends PercentageConstraints {
  rank: DanRank
  metricsType: 'percentage'
  gold?: PercentageConstraints
}

interface FlatThreshold extends FlatConstraints {
  rank: DanRank
  metricsType: 'flat'
  gold?: FlatConstraints
}

export type DanThreshold = PercentageThreshold | FlatThreshold

/** Thresholds listed from lowest to highest rank. */
export const DAN_THRESHOLDS: DanThreshold[] = [
  { rank: 'Shodan',   metricsType: 'percentage', minGoodPct: 68.46,                   maxBadPct: 3.07 },
  { rank: '2nd Dan',  metricsType: 'percentage', minGoodPct: 71.37,                   maxBadPct: 2.45 },
  { rank: '3rd Dan',  metricsType: 'percentage', minGoodPct: 74.34,                   maxBadPct: 1.95 },
  { rank: '4th Dan',  metricsType: 'percentage', minGoodPct: 77.44,                   maxBadPct: 1.56 },
  { rank: '5th Dan',  metricsType: 'percentage', minGoodPct: 80.67,                   maxBadPct: 1.25 },
  { rank: '6th Dan',  metricsType: 'percentage',                   maxOkayPct: 15.91, maxBadPct: 0.91 },
  { rank: '7th Dan',  metricsType: 'percentage',                   maxOkayPct: 12.43, maxBadPct: 0.70 },
  { rank: '8th Dan',  metricsType: 'percentage',                   maxOkayPct:  8.77, maxBadPct: 0.50 },
  { rank: '9th Dan',  metricsType: 'percentage',                   maxOkayPct:  5.45, maxBadPct: 0.35 },
  { rank: '10th Dan', metricsType: 'percentage',                   maxOkayPct:  2.93, maxBadPct: 0.27 },
  { rank: 'Kuroto',   metricsType: 'flat', maxOkayTotal: 50, maxBadTotal: 6 },
  { rank: 'Meijin',   metricsType: 'flat', maxOkayTotal: 30, maxBadTotal: 5 },
  { rank: 'Chojin',   metricsType: 'flat', maxOkayTotal: 15, maxBadTotal: 4 },
  { rank: 'Tatsujin', metricsType: 'flat', maxOkayTotal:  8, maxBadTotal: 3, gold: { maxOkayTotal: 0, maxBadTotal: 0 } },
]

function meetsPercentageConstraints(
  goodPct: number, okayPct: number, badPct: number,
  c: PercentageConstraints
): boolean {
  return (c.minGoodPct === undefined || goodPct >= c.minGoodPct)
      && (c.maxOkayPct === undefined || okayPct <= c.maxOkayPct)
      && badPct <= c.maxBadPct
}

function meetsFlatConstraints(ok: number, bad: number, c: FlatConstraints): boolean {
  return ok  <= c.maxOkayTotal / 3
      && bad <= c.maxBadTotal  / 3
}

function buildGoldTooltip(
  threshold: DanThreshold,
  goodPct: number, okayPct: number, badPct: number,
  ok: number, bad: number,
  isGold: boolean
): string {
  const prefix = isGold ? 'Gold ✓' : 'Gold req'
  if (threshold.metricsType === 'percentage') {
    const g = threshold.gold
    if (!g) return ''
    const parts: string[] = []
    if (g.minGoodPct !== undefined) parts.push(`good ≥ ${g.minGoodPct}% (yours: ${goodPct.toFixed(2)}%)`)
    if (g.maxOkayPct !== undefined) parts.push(`okay ≤ ${g.maxOkayPct}% (yours: ${okayPct.toFixed(2)}%)`)
    parts.push(`bad ≤ ${g.maxBadPct}% (yours: ${badPct.toFixed(2)}%)`)
    return `${prefix}: ${parts.join(', ')}`
  } else {
    const g = threshold.gold
    if (!g) return ''
    const okLimit = g.maxOkayTotal / 3
    const badLimit = g.maxBadTotal / 3
    return `${prefix}: okay ≤ ${okLimit.toFixed(1)}/song (yours: ${ok}), bad ≤ ${badLimit.toFixed(1)}/song (yours: ${bad})`
  }
}

/**
 * Returns the highest Dan rank the given single-song note stats qualify for,
 * along with whether the gold thresholds were also met.
 * Returns null if no threshold is met at all.
 *
 * @param good  Number of Good hits
 * @param ok    Number of Okay hits
 * @param bad   Number of Bad hits
 */
export function getDanRank(good: number, ok: number, bad: number): DanRankResult | null {
  const total = good + ok + bad
  if (total === 0) return null

  const goodPct = (good / total) * 100
  const okayPct = (ok   / total) * 100
  const badPct  = (bad  / total) * 100

  let result: DanRankResult | null = null

  for (const threshold of DAN_THRESHOLDS) {
    const met = threshold.metricsType === 'percentage'
      ? meetsPercentageConstraints(goodPct, okayPct, badPct, threshold)
      : meetsFlatConstraints(ok, bad, threshold)

    if (met) {
      const gold = threshold.gold !== undefined && (
        threshold.metricsType === 'percentage'
          ? meetsPercentageConstraints(goodPct, okayPct, badPct, threshold.gold)
          : meetsFlatConstraints(ok, bad, threshold.gold)
      )
      const goldTooltip = threshold.gold
        ? buildGoldTooltip(threshold, goodPct, okayPct, badPct, ok, bad, gold)
        : ''
      result = { rank: threshold.rank, gold, goldTooltip }
    }
  }

  return result
}
