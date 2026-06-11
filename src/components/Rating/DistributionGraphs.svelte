<script lang="ts">
  import type { SortedScoreData } from './services/ScoreDataService'
  import type { Analyzer } from '../../lib/analyzer'
  import { getDifficultyType, getSongTier } from './scoreTableUtils'

  export let filteredScores: SortedScoreData[]
  export let analyzer: Analyzer | null

  let open = false
  let hasOpened = false

  function getLevelValue(s: SortedScoreData): number {
    if (!analyzer) return 0
    return analyzer.getLevelWidthSub(s.songNo, getDifficultyType(s.difficulty))
  }

  const DIST_LEVEL_LABELS: { top: string; bottom?: string }[] = [
    { top: '1–5' },
    { top: '6' },
    { top: '7' },
    { top: '8' },
    { top: '9' },
    { top: 'Low 10' },
    { top: 'Mid 10' },
    { top: 'High 10' },
  ]

  $: graphData = (() => {
    if (!hasOpened) return []
    const _a = analyzer // track analyzer as reactive dependency

    function getLevelBucket(s: SortedScoreData): number {
      const level = getLevelValue(s)
      if (!Number.isFinite(level) || level < 1) return -1
      if (level < 6) return 0
      if (level < 7) return 1
      if (level < 8) return 2
      if (level < 9) return 3
      if (level < 10) return 4
      // level >= 10: sub-bucket by tier
      const tier = getSongTier(s)
      if (!tier || ['F', 'E', 'D', 'X' ].includes(tier)) return 5
      if (['C', 'B', 'A'].includes(tier)) return 6
      return 7
    }

    const criteria: Array<{ label: string; color: string; test: (s: SortedScoreData) => boolean }> = [
      { label: 'Silver', color: '#c0c0c0', test: s => s.score.badge === 'silver' },
      { label: 'Gold',   color: '#ffd700', test: s => s.score.badge === 'gold' },
      { label: 'Pink',   color: '#ffb7c5', test: s => s.score.badge === 'pink' },
      { label: 'Purple', color: '#b980ff', test: s => s.score.badge === 'purple' },
      { label: 'Kiwami', color: '#ff6b6b', test: s => s.score.badge === 'rainbow' },
      { label: 'DFC',          color: '#00cfff', test: s => s.score.count.donderfullcombo > 0 },
      { label: 'FC',           color: '#ffaa33', test: s => s.score.count.fullcombo > 0 },
    ]

    const NUM_BUCKETS = 8
    const scores = filteredScores ?? []

    return criteria.map(criterion => {
      const counts = Array.from({ length: NUM_BUCKETS }, () => 0)
      const totals = Array.from({ length: NUM_BUCKETS }, () => 0)
      for (const s of scores) {
        const bucket = getLevelBucket(s)
        if (bucket < 0) continue
        totals[bucket]++
        if (criterion.test(s)) counts[bucket]++
      }
      const maxCount = Math.max(...counts, 1)
      return { label: criterion.label, color: criterion.color, counts, totals, maxCount }
    })
  })()
</script>

<button on:click={() => { open = !open; if (open) hasOpened = true }}>
  Distribution Graphs (click to expand)
</button>

{#if open}
  <div class="dist-graphs-container">
    {#each graphData as graph}
      <div class="dist-graph">
        <div class="dist-graph-title">{graph.label}</div>
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
    color: #f0f0f0;
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
