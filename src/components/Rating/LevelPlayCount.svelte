<script lang="ts">
  import type { SortedScoreData } from './services/ScoreDataService'
  import type { Analyzer } from '../../lib/analyzer'
  import { badgeToNumber, getDifficultyType, formatHours, getLevelBucket, getSongTier } from './scoreTableUtils'

  export let filteredScores: SortedScoreData[]
  export let analyzer: Analyzer | null

  let open = false
  let hasOpened = false

  function getLevelValue(s: SortedScoreData): number {
    if (!analyzer) return 0
    return analyzer.getLevelWidthSub(s.songNo, getDifficultyType(s.difficulty))
  }

  $: levelPlayBuckets = (() => {
    if (!hasOpened) return []
    const _a = analyzer // track analyzer as reactive dependency
    const buckets = new Map<number, { plays: number; songs: number; timeSeconds: number; uniqueDFC: number; uniqueFC: number; uniquePurplePlus: number }>()
    for (const s of (filteredScores ?? [])) {
      const level = getLevelValue(s)
      if (!Number.isFinite(level) || level < 6) continue
      const min = Math.floor(level)
      const bucket = buckets.get(min) ?? { plays: 0, songs: 0, timeSeconds: 0, uniqueDFC: 0, uniqueFC: 0, uniquePurplePlus: 0 }
      const songSeconds = analyzer?.getSongDuration(s.songNo, getDifficultyType(s.difficulty)) ?? 0
      bucket.plays += s.score.count.play
      bucket.songs += 1
      bucket.timeSeconds += songSeconds * s.score.count.play
      if (s.score.count.donderfullcombo > 0) bucket.uniqueDFC += 1
      if (s.score.count.fullcombo > 0) bucket.uniqueFC += 1
      if (badgeToNumber(s.score.badge) >= 7) bucket.uniquePurplePlus += 1
      buckets.set(min, bucket)
    }
    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([min, v]) => ({
        min,
        max: min + 1,
        plays: v.plays,
        songs: v.songs,
        timeSeconds: v.timeSeconds,
        uniqueDFC: v.uniqueDFC,
        uniqueFC: v.uniqueFC,
        uniquePurplePlus: v.uniquePurplePlus
      }))
  })()

  $: level10Buckets = (() => {
    if (!hasOpened) return [null, null, null]
    const _a = analyzer // track analyzer as reactive dependency
    const acc = [
      { plays: 0, songs: 0, timeSeconds: 0, uniqueDFC: 0, uniqueFC: 0, uniquePurplePlus: 0 },
      { plays: 0, songs: 0, timeSeconds: 0, uniqueDFC: 0, uniqueFC: 0, uniquePurplePlus: 0 },
      { plays: 0, songs: 0, timeSeconds: 0, uniqueDFC: 0, uniqueFC: 0, uniquePurplePlus: 0 },
    ]
    for (const s of (filteredScores ?? [])) {
      const level = getLevelValue(s)
      if (!Number.isFinite(level) || level < 10) continue
      const bucket = getLevelBucket(level, getSongTier(s))
      if (bucket < 5 || bucket > 7) continue
      const b = acc[bucket - 5]
      const songSeconds = analyzer?.getSongDuration(s.songNo, getDifficultyType(s.difficulty)) ?? 0
      b.plays += s.score.count.play
      b.songs += 1
      b.timeSeconds += songSeconds * s.score.count.play
      if (s.score.count.donderfullcombo > 0) b.uniqueDFC += 1
      if (s.score.count.fullcombo > 0) b.uniqueFC += 1
      if (badgeToNumber(s.score.badge) >= 7) b.uniquePurplePlus += 1
    }
    return acc.map(b => b.songs > 0 ? b : null) as (typeof acc[0] | null)[]
  })()

  $: lowLevelBucket = (() => {
    if (!hasOpened) return null
    const _a = analyzer // track analyzer as reactive dependency
    const acc = { plays: 0, songs: 0, timeSeconds: 0, uniqueDFC: 0, uniqueFC: 0, uniquePurplePlus: 0 }
    for (const s of (filteredScores ?? [])) {
      const level = getLevelValue(s)
      if (!Number.isFinite(level) || level < 1 || level >= 6) continue
      const songSeconds = analyzer?.getSongDuration(s.songNo, getDifficultyType(s.difficulty)) ?? 0
      acc.plays += s.score.count.play
      acc.songs += 1
      acc.timeSeconds += songSeconds * s.score.count.play
      if (s.score.count.donderfullcombo > 0) acc.uniqueDFC += 1
      if (s.score.count.fullcombo > 0) acc.uniqueFC += 1
      if (badgeToNumber(s.score.badge) >= 7) acc.uniquePurplePlus += 1
    }
    return acc.songs > 0 ? acc : null
  })()

  $: levelPlayTotals = [...(lowLevelBucket ? [lowLevelBucket] : []), ...levelPlayBuckets].reduce(
    (acc, b) => ({
      songs: acc.songs + b.songs,
      plays: acc.plays + b.plays,
      timeSeconds: acc.timeSeconds + b.timeSeconds,
      uniqueDFC: acc.uniqueDFC + b.uniqueDFC,
      uniqueFC: acc.uniqueFC + b.uniqueFC,
      uniquePurplePlus: acc.uniquePurplePlus + b.uniquePurplePlus
    }),
    { songs: 0, plays: 0, timeSeconds: 0, uniqueDFC: 0, uniqueFC: 0, uniquePurplePlus: 0 }
  )
</script>

<button on:click={() => { open = !open; if (open) hasOpened = true }}>
  Level Play Counts (click to expand)
</button>

{#if open}
  <table class="level-play-table">
    <thead>
      <tr>
        <th>Level Range</th>
        <th>Song Count</th>
        <th>Total Plays</th>
        <th>Time Spent</th>
        <th>DFC</th>
        <th>FC</th>
        <th title="Songs with badge Purple or Rainbow">Purple+</th>
      </tr>
    </thead>
    <tbody>
      {#if levelPlayBuckets.length === 0}
        <tr>
          <td colspan="7">No filtered songs in level range [1, +inf)</td>
        </tr>
      {:else}
        {#if lowLevelBucket}
          <tr>
            <td>levels 1–5</td>
            <td>{lowLevelBucket.songs}</td>
            <td>{lowLevelBucket.plays}</td>
            <td>{formatHours(lowLevelBucket.timeSeconds)}</td>
            <td>{lowLevelBucket.uniqueDFC} ({lowLevelBucket.songs > 0 ? (lowLevelBucket.uniqueDFC / lowLevelBucket.songs * 100).toFixed(1) : 0}%)</td>
            <td>{lowLevelBucket.uniqueFC} ({lowLevelBucket.songs > 0 ? (lowLevelBucket.uniqueFC / lowLevelBucket.songs * 100).toFixed(1) : 0}%)</td>
            <td>{lowLevelBucket.uniquePurplePlus} ({lowLevelBucket.songs > 0 ? (lowLevelBucket.uniquePurplePlus / lowLevelBucket.songs * 100).toFixed(1) : 0}%)</td>
          </tr>
        {/if}
        {#each levelPlayBuckets as bucket (bucket.min)}
          <tr>
            <td>level {bucket.min}</td>
            <td>{bucket.songs}</td>
            <td>{bucket.plays}</td>
            <td>{formatHours(bucket.timeSeconds)}</td>
            <td>{bucket.uniqueDFC} ({bucket.songs > 0 ? (bucket.uniqueDFC / bucket.songs * 100).toFixed(1) : 0}%)</td>
            <td>{bucket.uniqueFC} ({bucket.songs > 0 ? (bucket.uniqueFC / bucket.songs * 100).toFixed(1) : 0}%)</td>
            <td>{bucket.uniquePurplePlus} ({bucket.songs > 0 ? (bucket.uniquePurplePlus / bucket.songs * 100).toFixed(1) : 0}%)</td>
          </tr>
        {/each}
        {#each level10Buckets as sub10, i (i)}
          {#if sub10}
            <tr class="level-10-sub-row">
              <td class="level-10-sub-label">↳ {['Low 10', 'Mid 10', 'High 10'][i]}</td>
              <td>{sub10.songs}</td>
              <td>{sub10.plays}</td>
              <td>{formatHours(sub10.timeSeconds)}</td>
              <td>{sub10.uniqueDFC} ({sub10.songs > 0 ? (sub10.uniqueDFC / sub10.songs * 100).toFixed(1) : 0}%)</td>
              <td>{sub10.uniqueFC} ({sub10.songs > 0 ? (sub10.uniqueFC / sub10.songs * 100).toFixed(1) : 0}%)</td>
              <td>{sub10.uniquePurplePlus} ({sub10.songs > 0 ? (sub10.uniquePurplePlus / sub10.songs * 100).toFixed(1) : 0}%)</td>
            </tr>
          {/if}
        {/each}
        <tr class="level-play-totals-row">
          <td><strong>Total</strong></td>
          <td><strong>{levelPlayTotals.songs}</strong></td>
          <td><strong>{levelPlayTotals.plays}</strong></td>
          <td><strong>{formatHours(levelPlayTotals.timeSeconds)}</strong></td>
          <td><strong>{levelPlayTotals.uniqueDFC} ({levelPlayTotals.songs > 0 ? (levelPlayTotals.uniqueDFC / levelPlayTotals.songs * 100).toFixed(1) : 0}%)</strong></td>
          <td><strong>{levelPlayTotals.uniqueFC} ({levelPlayTotals.songs > 0 ? (levelPlayTotals.uniqueFC / levelPlayTotals.songs * 100).toFixed(1) : 0}%)</strong></td>
          <td><strong>{levelPlayTotals.uniquePurplePlus} ({levelPlayTotals.songs > 0 ? (levelPlayTotals.uniquePurplePlus / levelPlayTotals.songs * 100).toFixed(1) : 0}%)</strong></td>
        </tr>
      {/if}
    </tbody>
  </table>
{/if}

<style>
  .level-play-table {
    width: 100%;
    max-width: 420px;
    border: 1px solid black;
    border-collapse: collapse;
    color: #f0f0f0;
  }

  .level-play-table th,
  .level-play-table td {
    border: 1px solid black;
    padding: 4px 8px;
    text-align: center;
    white-space: nowrap;
  }

  .level-play-totals-row {
    border-top: 2px solid #888;
    background-color: #2a2a2a;
  }

  .level-10-sub-row {
    font-size: 0.85em;
    color: #aaa;
    background-color: #1c1c1c;
  }

  .level-10-sub-label {
    text-align: left;
    padding-left: 16px;
    font-style: italic;
  }
</style>
