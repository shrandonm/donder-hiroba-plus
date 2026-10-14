<script lang="ts">
  import type { SortedScoreData } from './services/ScoreDataService'
  import type { Analyzer } from '../../lib/analyzer'
  import { getDanRank, DAN_THRESHOLDS } from './danRank'
  import type { DanRank } from './danRank'
  import { badgeToNumber, getDifficultyType, getLevelBucket, getSongTier, getSongDfcTier, getDfcLevelBucket } from './scoreTableUtils'

  export let filteredScores: SortedScoreData[]
  export let analyzer: Analyzer | null

  const badges = [
    { label: 'No badge', background: '#666666' },
    { label: 'White', background: '#f5f5f5' },
    { label: 'Bronze', background: '#cd7f32' },
    { label: 'Silver', background: '#c0c0c0' },
    { label: 'Gold', background: '#ffd700' },
    { label: 'Pink', background: '#ffb7c5' },
    { label: 'Purple', background: '#b980ff' },
    { label: 'Kiwami', background: '#ff6b6b' }
  ]

  const crowns = [
    { label: 'No clear', background: '#666666' },
    { label: 'Clear', background: '#c0c0c0' },
    { label: 'FC', background: '#ffd700' },
    { label: 'DFC', background: '#00cfff' }
  ]

  const danRanks: Array<{ label: string, color: string, rank: DanRank | null }> = [
    { label: 'No Dan', color: '#555', rank: null },
    ...DAN_THRESHOLDS.map(threshold => ({
      label: threshold.rank,
      color: danRankColor(threshold.rank),
      rank: threshold.rank
    }))
  ]

  const levelLabels = ['levels 1–5', 'level 6', 'level 7', 'level 8', 'level 9', 'Low 10', 'Mid 10', 'High 10']

  let open = false
  let hasOpened = false
  let useDfcTier = false

  function getLevelValue (s: SortedScoreData): number {
    if (analyzer === null) return 0
    return analyzer.getLevelWidthSub(s.songNo, getDifficultyType(s.difficulty))
  }

  function danRankColor (rank: DanRank): string {
    switch (rank) {
      case 'Shodan': return '#9ca3af'
      case '2nd Dan': return '#60a5fa'
      case '3rd Dan': return '#818cf8'
      case '4th Dan': return '#a78bfa'
      case '5th Dan': return '#22d3ee'
      case '6th Dan': return '#2dd4bf'
      case '7th Dan': return '#34d399'
      case '8th Dan': return '#a3e635'
      case '9th Dan': return '#facc15'
      case '10th Dan': return '#fb923c'
      case 'Kuroto': return '#f97316'
      case 'Meijin': return '#ef4444'
      case 'Chojin': return '#ec4899'
      case 'Tatsujin': return '#f43f5e'
    }
  }

  $: levelBuckets = (() => {
    if (!hasOpened || analyzer === null) return []
    const badgeCounts = Array.from({ length: 8 }, () => Array.from({ length: badges.length }, () => 0))
    const crownCounts = Array.from({ length: 8 }, () => Array.from({ length: crowns.length }, () => 0))
    const danCounts = Array.from({ length: 8 }, () => Array.from({ length: danRanks.length }, () => 0))

    for (const score of (filteredScores ?? [])) {
      const level = getLevelValue(score)
      const completionBucket = getLevelBucket(level, getSongTier(score))
      if (completionBucket >= 0) {
        badgeCounts[completionBucket][badgeToNumber(score.score.badge) - 1] += 1

        const crown = score.score.crown
        const crownIndex = crown === 'donderfull' ? 3 : crown === 'gold' ? 2 : crown === 'silver' ? 1 : 0
        crownCounts[completionBucket][crownIndex] += 1
      }

      const danBucket = useDfcTier
        ? getDfcLevelBucket(level, getSongDfcTier(score))
        : completionBucket
      if (danBucket < 0) continue

      const danResult = getDanRank(score.score.good, score.score.ok, score.score.bad)
      const rankIndex = danResult === null
        ? 0
        : DAN_THRESHOLDS.findIndex(threshold => threshold.rank === danResult.rank) + 1
      danCounts[danBucket][rankIndex] += 1
    }

    return badgeCounts.map((counts, bucket) => ({
      label: levelLabels[bucket],
      badgeCounts: counts,
      crownCounts: crownCounts[bucket],
      danCounts: danCounts[bucket],
      total: counts.reduce((total, count) => total + count, 0),
      danTotal: danCounts[bucket].reduce((total, count) => total + count, 0)
    }))
  })()
</script>

<button on:click={() => { open = !open; if (open) hasOpened = true }}>
  Level Completion Distribution (click to expand)
</button>

{#if open}
  <div class="level-distribution">
    <h4>Badges</h4>
    <div class="distribution-legend" aria-label="Badge colors">
      {#each badges as badge}
        <span class="distribution-legend-item">
          <span class="distribution-legend-swatch" style="background: {badge.background};"></span>
          {badge.label}
        </span>
      {/each}
    </div>

    {#if levelBuckets.every(bucket => bucket.total === 0)}
      <p>No filtered songs in level range [1, +inf)</p>
    {:else}
      <div class="level-distribution-rows">
        {#each levelBuckets as bucket (bucket.label)}
          {#if bucket.total > 0}
            <div class="level-distribution-row">
              <span class="level-distribution-label">{bucket.label}</span>
              <div class="distribution-bar" aria-label={`${bucket.label}: ${bucket.total} songs`}>
                {#each bucket.badgeCounts as count, i}
                  {#if count > 0}
                    <span
                      class="distribution-bar-segment"
                      style={`width: ${count / bucket.total * 100}%; background: ${badges[i].background};`}
                      title={`${badges[i].label}: ${count} (${(count / bucket.total * 100).toFixed(1)}%)`}
                    ></span>
                  {/if}
                {/each}
              </div>
              <span class="level-distribution-total">{bucket.total}</span>
            </div>
          {/if}
        {/each}
      </div>

      <h4>Crowns</h4>
      <div class="distribution-legend" aria-label="Crown colors">
        {#each crowns as crown}
          <span class="distribution-legend-item">
            <span class="distribution-legend-swatch" style="background: {crown.background};"></span>
            {crown.label}
          </span>
        {/each}
      </div>

      <div class="level-distribution-rows">
        {#each levelBuckets as bucket (bucket.label)}
          {#if bucket.total > 0}
            <div class="level-distribution-row">
              <span class="level-distribution-label">{bucket.label}</span>
              <div class="distribution-bar" aria-label={`${bucket.label}: ${bucket.total} songs`}>
                {#each bucket.crownCounts as count, i}
                  {#if count > 0}
                    <span
                      class="distribution-bar-segment"
                      style={`width: ${count / bucket.total * 100}%; background: ${crowns[i].background};`}
                      title={`${crowns[i].label}: ${count} (${(count / bucket.total * 100).toFixed(1)}%)`}
                    ></span>
                  {/if}
                {/each}
              </div>
              <span class="level-distribution-total">{bucket.total}</span>
            </div>
          {/if}
        {/each}
      </div>

      <h4>Dan</h4>
      <label class="tier-basis-toggle">
        <input type="checkbox" bind:checked={useDfcTier} />
        Use DFC tier bucketing
      </label>
      <div class="distribution-legend" aria-label="Dan rank colors">
        {#each danRanks as danRank}
          <span class="distribution-legend-item">
            <span class="distribution-legend-swatch" style="background-color: {danRank.color};"></span>
            {danRank.label}
          </span>
        {/each}
      </div>

      <div class="level-distribution-rows">
        {#each levelBuckets as bucket (bucket.label)}
          {#if bucket.danTotal > 0}
            <div class="level-distribution-row">
              <span class="level-distribution-label">{bucket.label}</span>
              <div class="distribution-bar" aria-label={`${bucket.label}: ${bucket.danTotal} songs`}>
                {#each bucket.danCounts as count, i}
                  {#if count > 0}
                    <span
                      class="distribution-bar-segment"
                      style={`width: ${count / bucket.danTotal * 100}%; background-color: ${danRanks[i].color};`}
                      title={`${danRanks[i].label}: ${count} (${(count / bucket.danTotal * 100).toFixed(1)}%)`}
                    ></span>
                  {/if}
                {/each}
              </div>
              <span class="level-distribution-total">{bucket.danTotal}</span>
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .level-distribution {
    width: 100%;
    max-width: 620px;
    margin-top: 8px;
  }

  h4 {
    margin: 12px 0 6px;
  }

  .tier-basis-toggle {
    display: block;
    margin-bottom: 8px;
    font-size: 0.8em;
    color: #ccc;
  }

  .distribution-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    margin-bottom: 8px;
    font-size: 0.8em;
    color: #ccc;
  }

  .distribution-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .distribution-legend-swatch {
    width: 10px;
    height: 10px;
    border: 1px solid #555;
  }

  .level-distribution-rows {
    display: grid;
    gap: 5px;
  }

  .level-distribution-row {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr) 36px;
    align-items: center;
    gap: 8px;
  }

  .level-distribution-label,
  .level-distribution-total {
    font-size: 0.85em;
    color: #ddd;
  }

  .level-distribution-label {
    text-align: right;
  }

  .distribution-bar {
    display: flex;
    height: 18px;
    overflow: hidden;
    border: 1px solid #555;
    background-color: #1c1c1c;
  }

  .distribution-bar-segment {
    min-width: 1px;
  }
</style>
