<script lang="ts">
  import type { SortedScoreData } from './services/ScoreDataService'
  import TotalScorePanel from '../Common/TotalScorePanel.svelte'
  import { badgeToNumber } from './scoreTableUtils'

  export let filteredScores: SortedScoreData[]

  $: counts = computeCounts(filteredScores)

  function computeCounts(scores: SortedScoreData[]) {
    const badge: Partial<Record<number, number>> = {}
    const crown = { silver: 0, gold: 0, donderfull: 0 }

    for (const s of (scores ?? [])) {
      const n = badgeToNumber(s.score.badge)
      badge[n] = (badge[n] ?? 0) + 1

      if (s.score.crown === 'donderfull') crown.donderfull++
      else if (s.score.crown === 'gold') crown.gold++
      else if (s.score.crown === 'silver') crown.silver++
    }

    return { badge, crown }
  }
</script>

<TotalScorePanel badgeCounts={counts.badge} crownCounts={counts.crown} />

