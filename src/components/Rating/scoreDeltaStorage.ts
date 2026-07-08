import type { Difficulty } from './ratingTypes'
import type RecentScoreStorage from './recentScoreStorage'
import { badgeToNumber } from './scoreTableUtils'
import { getDanRank, DAN_THRESHOLDS } from './danRank'

export interface SnapshotEntry {
  title: string
  songNo: string
  difficulty: Difficulty
  score: number
  good: number
  ok: number
  bad: number
  roll: number
  play: number
  fc: number
  dfc: number
  badge: number
  /** Index into DAN_THRESHOLDS, or -1 if unranked */
  danIdx: number
}

/** Map of "songNo:difficulty" -> fields */
export type ScoreSnapshot = Record<string, SnapshotEntry>

export interface DeltaEntry {
  title: string
  songNo: string
  difficulty: Difficulty
  /** Absolute values in the "after" snapshot */
  after: {
    score: number
    good: number
    ok: number
    bad: number
    roll: number
    play: number
    fc: number
    dfc: number
    badge: number
    danIdx: number
  }
  /** Differences (after - before) */
  diff: {
    score: number
    good: number
    ok: number
    bad: number
    roll: number
    play: number
    fc: number
    dfc: number
    badge: number
    danIdx: number
  }
}

export interface ScoreDelta {
  timestamp: number
  /** Map of "songNo:difficulty" -> delta entry (only songs where play count changed) */
  changes: Record<string, DeltaEntry>
}

const MAX_DELTAS = 20

export class ScoreDeltaStorage {
  private deltas: ScoreDelta[] = []
  private readonly storageKey: string

  constructor(donderId: string = '') {
    this.storageKey = `scoreDeltaHistory-${donderId}`
  }

  async loadFromChromeStorage(): Promise<void> {
    const result = await chrome.storage.local.get([this.storageKey])
    if (result[this.storageKey] !== undefined) {
      this.deltas = result[this.storageKey] as ScoreDelta[]
    }
  }

  private async saveToStorage(): Promise<void> {
    await chrome.storage.local.set({ [this.storageKey]: this.deltas })
  }

  takeSnapshot(storage: RecentScoreStorage): ScoreSnapshot {
    const snapshot: ScoreSnapshot = {}
    for (const [songNo, scoreData] of Object.entries(storage.getMap())) {
      for (const [diff, diffData] of Object.entries(scoreData.difficulty)) {
        if (!diffData) continue
        if (diff !== 'oni' && diff !== 'ura') continue
        const key = `${songNo}:${diff}`
        const danResult = getDanRank(diffData.good, diffData.ok, diffData.bad)
        const danIdx = danResult
          ? DAN_THRESHOLDS.findIndex(t => t.rank === danResult.rank)
          : -1
        snapshot[key] = {
          title: scoreData.title,
          songNo,
          difficulty: diff as Difficulty,
          score: diffData.score,
          good: diffData.good,
          ok: diffData.ok,
          bad: diffData.bad,
          roll: diffData.roll,
          play: diffData.count.play,
          fc: diffData.count.fullcombo,
          dfc: diffData.count.donderfullcombo,
          badge: badgeToNumber(diffData.badge),
          danIdx,
        }
      }
    }
    return snapshot
  }

  getTotalPlayCount(snapshot: ScoreSnapshot): number {
    return Object.values(snapshot).reduce((acc, e) => acc + e.play, 0)
  }

  /**
   * Computes a delta between two snapshots and persists it if play count increased.
   * Returns true if a delta was recorded.
   */
  async recordDelta(before: ScoreSnapshot, after: ScoreSnapshot): Promise<boolean> {
    const beforeTotal = this.getTotalPlayCount(before)
    const afterTotal = this.getTotalPlayCount(after)
    if (afterTotal <= beforeTotal) return false

    const changes: Record<string, DeltaEntry> = {}
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])

    for (const key of allKeys) {
      const b = before[key]
      const a = after[key]
      if (!a) continue

      const playDiff = a.play - (b?.play ?? 0)
      if (playDiff === 0) continue // skip songs not played

      changes[key] = {
        title: a.title,
        songNo: a.songNo,
        difficulty: a.difficulty,
        after: {
          score: a.score,
          good: a.good,
          ok: a.ok,
          bad: a.bad,
          roll: a.roll,
          play: a.play,
          fc: a.fc,
          dfc: a.dfc,
          badge: a.badge,
          danIdx: a.danIdx,
        },
        diff: {
          score: a.score - (b?.score ?? 0),
          good: a.good - (b?.good ?? 0),
          ok: a.ok - (b?.ok ?? 0),
          bad: a.bad - (b?.bad ?? 0),
          roll: a.roll - (b?.roll ?? 0),
          play: playDiff,
          fc: a.fc - (b?.fc ?? 0),
          dfc: a.dfc - (b?.dfc ?? 0),
          badge: a.badge - (b?.badge ?? 0),
          danIdx: a.danIdx - (b?.danIdx ?? -1),
        },
      }
    }

    const delta: ScoreDelta = {
      timestamp: Date.now(),
      changes,
    }

    this.deltas.push(delta)
    if (this.deltas.length > MAX_DELTAS) {
      this.deltas = this.deltas.slice(this.deltas.length - MAX_DELTAS)
    }

    await this.saveToStorage()
    return true
  }

  getDeltas(): ScoreDelta[] {
    return this.deltas
  }
}
