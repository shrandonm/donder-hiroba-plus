<script lang="ts">
  import type { SortedScoreData } from './services/ScoreDataService'
  import type { Analyzer } from '../../lib/analyzer'
  import { getDanRank, DAN_THRESHOLDS } from './danRank'
  import type { DanRank } from './danRank'
  import { getDifficultyType, getSongTier, DIST_LEVEL_LABELS, getLevelBucket } from './scoreTableUtils'

  export let filteredScores: SortedScoreData[]
  export let analyzer: Analyzer | null

  let open = false
  let hasOpened = false

  const NUM_LEVEL_BUCKETS = DIST_LEVEL_LABELS.length

  function getLevelValue(s: SortedScoreData): number {
    if (!analyzer) return 0
    return analyzer.getLevelWidthSub(s.songNo, getDifficultyType(s.difficulty))
  }

  function danRankColor(rank: DanRank): string {
    switch (rank) {
      case 'Shodan':
      case '2nd Dan':
      case '3rd Dan':
      case '4th Dan':   return '#aaa'
      case '5th Dan':
      case '6th Dan':
      case '7th Dan':   return '#8cf'
      case '8th Dan':
      case '9th Dan':   return '#aef'
      case '10th Dan':  return '#ffe066'
      case 'Kuroto':    return '#ffd700'
      case 'Meijin':    return '#ff8c00'
      case 'Chojin':    return '#ff6060'
      case 'Tatsujin':  return '#ff4444'
    }
  }

  $: graphData = (() => {
    if (!hasOpened) return []
    const _a = analyzer // track analyzer as reactive dependency

    const scores = filteredScores ?? []

    return DAN_THRESHOLDS.map(threshold => {
      const counts = Array.from({ length: NUM_LEVEL_BUCKETS }, () => 0)
      for (const s of scores) {
        const result = getDanRank(s.score.good, s.score.ok, s.score.bad)
        if (!result || result.rank !== threshold.rank) continue
        const bucket = getLevelBucket(getLevelValue(s), getSongTier(s))
        if (bucket < 0) continue
        counts[bucket]++
      }
      const maxCount = Math.max(...counts, 1)
      return { label: threshold.rank, color: danRankColor(threshold.rank), counts, maxCount }
    })
  })()
</script>

<button on:click={() => { open = !open; if (open) hasOpened = true }}>
  Dan Distribution Graphs (click to expand)
</button>

{#if open}
  <div class="dist-graphs-container">
    {#each graphData as graph}
      <div class="dist-graph">
        <div class="dist-graph-title" style="color: {graph.color};">{graph.label}</div>
        <div class="dist-chart">
          {#each graph.counts as count, i}
            {@const barHeightPct = Math.round(count / graph.maxCount * 100)}
            <div class="dist-bar-col">
              <span class="dist-count-label">{count}</span>
              <div class="dist-bar-track">
                <div class="dist-bar" style="height: {barHeightPct}%; background-color: {graph.color};"></div>
              </div>
              <span class="dist-x-label">
                {DIST_LEVEL_LABELS[i].top}{#if DIST_LEVEL_LABELS[i].bottom}<br>{DIST_LEVEL_LABELS[i].bottom}{/if}
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .dist-graphs-container {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    justify-content: center;
    width: 100%;
    max-width: 900px;
  }

  .dist-graph {
    background: #242424;
    border: 1px solid #444;
    border-radius: 6px;
    padding: 12px 8px 8px;
    flex: 1 1 200px;
    max-width: 280px;
    min-width: 180px;
  }

  .dist-graph-title {
    font-weight: bold;
    text-align: center;
    margin-bottom: 8px;
    font-size: 0.85em;
  }

  .dist-chart {
    display: flex;
    align-items: stretch;
    gap: 3px;
    height: 140px;
  }

  .dist-bar-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    min-width: 0;
  }

  .dist-count-label {
    font-size: 0.6em;
    color: #ccc;
    line-height: 1.2;
    text-align: center;
    flex-shrink: 0;
    height: 1.2em;
  }

  .dist-bar-track {
    flex: 1;
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }

  .dist-bar {
    width: 100%;
    min-height: 1px;
    border-radius: 2px 2px 0 0;
    transition: height 0.2s ease;
  }

  .dist-x-label {
    font-size: 0.55em;
    color: #aaa;
    text-align: center;
    margin-top: 3px;
    line-height: 1.3;
    flex-shrink: 0;
  }
</style>
