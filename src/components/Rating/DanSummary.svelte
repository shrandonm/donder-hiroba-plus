<script lang="ts">
  import type { SortedScoreData } from './services/ScoreDataService'
  import { getDanRank } from './danRank'
  import type { DanRank } from './danRank'

  export let filteredScores: SortedScoreData[]

  // Rows ordered top→bottom so the 5-col grid reads bottom-up left-to-right visually.
  // None is bottom-left, Tatsujin is top-right.
  const DISPLAY_ROWS: Array<{ rank: DanRank | null; color: string; label: string; glow?: boolean }[]> = [
    // top row
    [
      { rank: '10th Dan', color: '#ffe066', label: '10th Dan' },
      { rank: 'Kuroto',   color: '#ffd700', label: 'Kuroto'   },
      { rank: 'Meijin',   color: '#ff8c00', label: 'Meijin'   },
      { rank: 'Chojin',   color: '#ff6060', label: 'Chojin'   },
      { rank: 'Tatsujin', color: '#ff4444', label: 'Tatsujin', glow: true },
    ],
    // middle row
    [
      { rank: '5th Dan',  color: '#8cf',    label: '5th Dan'  },
      { rank: '6th Dan',  color: '#8cf',    label: '6th Dan'  },
      { rank: '7th Dan',  color: '#8cf',    label: '7th Dan'  },
      { rank: '8th Dan',  color: '#aef',    label: '8th Dan'  },
      { rank: '9th Dan',  color: '#aef',    label: '9th Dan'  },
    ],
    // bottom row
    [
      { rank: null,       color: '#555',    label: 'None'     },
      { rank: 'Shodan',   color: '#aaa',    label: 'Shodan'   },
      { rank: '2nd Dan',  color: '#aaa',    label: '2nd Dan'  },
      { rank: '3rd Dan',  color: '#aaa',    label: '3rd Dan'  },
      { rank: '4th Dan',  color: '#aaa',    label: '4th Dan'  },
    ],
  ]

  $: counts = buildCounts(filteredScores)

  function buildCounts(scores: SortedScoreData[]) {
    const byRank: Partial<Record<DanRank, number>> = {}
    let none = 0
    for (const s of (scores ?? [])) {
      const r = getDanRank(s.score.good, s.score.ok, s.score.bad)
      if (!r) { none++; continue }
      byRank[r.rank] = (byRank[r.rank] ?? 0) + 1
    }
    return { byRank, none }
  }
</script>

<table class="dan-summary">
  <tbody>
    {#each DISPLAY_ROWS as row}
      <tr>
        {#each row as item}
          <td
            class="dan-label"
            class:glow={item.glow}
            style="color: {item.color};"
          >{item.label}</td>
          <td
            class="dan-count"
          >{item.rank !== null ? (counts.byRank[item.rank] ?? 0) : counts.none}</td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>

<style>
  .dan-summary {
    border-collapse: collapse;
    font-size: 0.85em;
    font-weight: bold;
  }

  tr {
    background: transparent;
  }

  td {
    padding: 4px 6px;
    white-space: nowrap;
  }

  .dan-label {
    text-align: right;
    background: #1e1e1e;
  }

  .dan-count {
    text-align: right;
    padding-right: 14px;
    background: #282828;
    font-weight: normal;
    color: white !important;
  }

  .dan-count:last-child {
    padding-right: 6px;
  }

  .glow {
    text-shadow: 0 0 6px #ff2222;
  }
</style>
