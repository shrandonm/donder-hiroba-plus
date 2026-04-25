import type { ScoreData } from './ratingTypes'

export interface PlayTimestamp {
  lastPlayed: number | null
  lastUpscored: number | null
}

class RecentScoreStorage {
  private scoreDataMap: Record<string, ScoreData> = {}
  private lastUpdated: string | null = null
  private readonly donderId: string = ''
  private recentScoresByUser: string
  private lastUpdatedByUser: string
  private playTimestampsMap: Record<string, PlayTimestamp> = {}

  constructor (donderId: string = '') {
    this.scoreDataMap = {}
    this.lastUpdated = null
    this.donderId = donderId
    this.playTimestampsMap = {}

    this.recentScoresByUser = `recentScores-${this.donderId}`
    this.lastUpdatedByUser = `lastUpdated-${this.donderId}`
  }

  async clear (): Promise<void> {
    this.scoreDataMap = {}
    this.lastUpdated = 'null'
    this.playTimestampsMap = {}
    await this.saveToStorage()
  }

  public async loadFromChromeStorage (): Promise<void> {
    let result = await chrome.storage.local.get([`recentScores-${this.donderId}`, `lastUpdated-${this.donderId}`])
    if (result.recentScores === undefined) {
      result = await chrome.storage.local.get(['recentScores', 'lastUpdated'])
      this.recentScoresByUser = 'recentScores'
      this.lastUpdatedByUser = 'lastUpdated'
    }

    if (result.recentScores !== undefined) {
      this.scoreDataMap = result.recentScores
    }
    if (result.lastUpdated !== undefined) {
      this.lastUpdated = result.lastUpdated
    }

    const tsKey = `playTimestamps-${this.donderId}`
    const tsResult = await chrome.storage.local.get([tsKey])
    if (tsResult[tsKey] !== undefined) {
      this.playTimestampsMap = tsResult[tsKey] as Record<string, PlayTimestamp>
    }
  }

  private formatDate (date: Date): string {
    const year = date.getFullYear().toString().slice(-2)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }

  private async saveToStorage (): Promise<void> {
    await chrome.storage.local.set({
      [this.recentScoresByUser]: this.scoreDataMap,
      [this.lastUpdatedByUser]: this.formatDate(new Date()),
      [`playTimestamps-${this.donderId}`]: this.playTimestampsMap
    })
  }

  async mergeMap (scoreDataMap: Record<string, ScoreData>): Promise<void> {
    for (const [songNo, scoreData] of Object.entries(scoreDataMap)) {
      delete scoreData.difficulty.hard
      delete scoreData.difficulty.normal
      delete scoreData.difficulty.easy
      await this.mergeSingle(songNo, scoreData)
    }
    await this.saveToStorage()
  }

  private async mergeSingle (songNo: string, scoreData: ScoreData): Promise<void> {
    const now = Date.now()
    const existingSong = this.scoreDataMap[songNo]

    // Update play timestamps by comparing new data against what's stored
    for (const [diff, newDiffData] of Object.entries(scoreData.difficulty)) {
      if (!newDiffData) continue
      const oldDiffData = existingSong?.difficulty[diff as keyof typeof existingSong.difficulty]
      if (oldDiffData === undefined) {
        // First time seeing this song/difficulty - record timestamp if it already has plays
        if (newDiffData.count.play > 0) {
          const key = `${songNo}:${diff}`
          if (this.playTimestampsMap[key] === undefined) {
            this.playTimestampsMap[key] = { lastPlayed: now, lastUpscored: null }
          }
        }
        continue
      }

      const key = `${songNo}:${diff}`
      const existing: PlayTimestamp = this.playTimestampsMap[key] ?? { lastPlayed: null, lastUpscored: null }
      if (newDiffData.count.play > oldDiffData.count.play) {
        existing.lastPlayed = now
      }
      if (newDiffData.score > oldDiffData.score) {
        existing.lastUpscored = now
      }
      this.playTimestampsMap[key] = existing
    }

    if (existingSong === undefined) {
      this.scoreDataMap[songNo] = scoreData
    } else {
      this.scoreDataMap[songNo] = {
        ...existingSong,
        difficulty: {
          ...existingSong.difficulty,
          ...scoreData.difficulty
        }
      }
    }
  }

  getMap (): Record<string, ScoreData> {
    return this.scoreDataMap
  }

  getCount (): number {
    return Object.keys(this.scoreDataMap).length
  }

  getSongScoreData (songNo: string): ScoreData | null {
    if (this.scoreDataMap[songNo] === undefined) {
      return null
    }
    return this.scoreDataMap[songNo]
  }

  getPlayTimestamp (songNo: string, difficulty: string): PlayTimestamp | null {
    const key = `${songNo}:${difficulty}`
    return this.playTimestampsMap[key] ?? null
  }

  getLastUpdated (): string | null {
    if (Object.keys(this.scoreDataMap).length === 0) {
      return null
    }
    return this.lastUpdated
  }
}

export default RecentScoreStorage
