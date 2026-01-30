<script lang="ts">
  import type { SortedScoreData } from './services/ScoreDataService'
  import { icons } from '../../assets'
  import type { Badge } from './ratingTypes'
    import { BADGES } from '../../constants';

  export let scoreDataSorted: SortedScoreData[]
  export let lastUpdated: string | null
  export let onClearCache: () => Promise<void>

  let openPlayCount = false

  type SortKey = 'name' | 'diff' | 'play' | 'score' | 'badge' | 'clear' | 'fullcombo' | 'donderfullcombo'
  let sortKey: SortKey = 'name'
  let sortDir: 'asc' | 'desc' = 'asc'

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc'
      return
    }

    sortKey = key
    // sensible defaults: name asc, numbers desc
    sortDir = key === 'name' ? 'asc' : 'desc'
  }

  function cmp(a: number | string, b: number | string) {
    if (typeof a === 'number' && typeof b === 'number') return a - b
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
  }

  function getSortValue(s: SortedScoreData, key: SortKey) {
    switch (key) {
      case 'name': return s.songName
      case 'diff': return s.difficulty === 'oni' ? 0 : 1 // oni first
      case 'play': return s.score.count.play
      case 'score': return s.score.score
      case 'badge': return badgeToNumber(s.score.badge)
      case 'clear': return s.score.count.clear
      case 'fullcombo': return s.score.count.fullcombo
      case 'donderfullcombo': return s.score.count.donderfullcombo
    }
  }
  
  function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n))
  }
  
  function badgeToNumber(badge: Badge): number
  {
    switch (badge)
    {
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
  
  // songNo is a string; normalize for comparisons/tie-breaks
  function songNoNum(songNo: string): number {
    const n = Number(songNo)
    return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY
  }

  $: displayedScores = [...(scoreDataSorted ?? [])].sort((a, b) => {
    const av = getSortValue(a, sortKey)
    const bv = getSortValue(b, sortKey)
    const primary = cmp(av, bv)

    // tie-breaker: songNo numeric if possible, else string compare
    let tie = primary
    if (tie === 0) {
      const an = songNoNum(a.songNo)
      const bn = songNoNum(b.songNo)
      tie = (an - bn)
      if (tie === 0) tie = cmp(a.songNo, b.songNo)
      if (tie === 0) tie = cmp(a.difficulty, b.difficulty)
    }

    return sortDir === 'asc' ? tie : -tie
  })

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? ' ▲' : ' ▼'
  }

  $: totalPlays = (scoreDataSorted ?? []).reduce((acc, s) => acc + s.score.count.play, 0)
  $: totalClears = (scoreDataSorted ?? []).reduce((acc, s) => acc + s.score.count.clear, 0)
  $: totalFC = (scoreDataSorted ?? []).reduce((acc, s) => acc + s.score.count.fullcombo, 0)
  $: totalDFC = (scoreDataSorted ?? []).reduce((acc, s) => acc + s.score.count.donderfullcombo, 0)
</script>

<div class="score-data-section">
  <div style="margin-top: 50px;">
    <span>Last Score Updated: <br> {lastUpdated}</span>
  </div>

  <button on:click={onClearCache}>
    Clear Cache
  </button>

  <button on:click={() => { openPlayCount = !openPlayCount }}>
    Play Count (click to expand)
  </button>

  {#if openPlayCount}
    <span>Total Song Count: {scoreDataSorted.length}</span>

    <div class="totals">
      <span class="total-item">
        <img class="icon" src={icons.crowns.played} alt="Played" title="Played" />
        {totalPlays}
      </span>

      <span class="total-item">
        <img class="icon" src={icons.crowns.silver} alt="Clear" title="Clear" />
        {totalClears}
      </span>

      <span class="total-item">
        <img class="icon" src={icons.crowns.gold} alt="Full Combo" title="Full Combo" />
        {totalFC}
      </span>

      <span class="total-item">
        <img class="icon" src={icons.crowns.donderfull} alt="Donder Full" title="Donder Full" />
        {totalDFC}
      </span>
    </div>

    <table class="play-count-table">
      <thead>
        <tr>
          <th class="th-sort th-name" on:click={() => toggleSort('name')}>
            Name{sortIndicator('name')}
          </th>

          <th class="th-sort th-icon" on:click={() => toggleSort('diff')}>
            Diff{sortIndicator('diff')}
          </th>

          <th class="th-sort th-icon" on:click={() => toggleSort('play')}>
            <img src={icons.crowns.played} alt="Played" title="Played" />
            {sortIndicator('play')}
          </th>

          <th class="th-sort th-icon" on:click={() => toggleSort('score')}>
            <img src={icons.badges[8]} alt="Score" title="Score" />
            {sortIndicator('score')}
          </th>

          <th class="th-sort th-icon" on:click={() => toggleSort('badge')}>
            <img src={icons.badges[8]} alt="Badge" title="Badge" />
            {sortIndicator('badge')}
          </th>

          <th class="th-sort th-icon" on:click={() => toggleSort('clear')}>
            <img src={icons.crowns.silver} alt="Clear" title="Clear" />
            {sortIndicator('clear')}
          </th>

          <th class="th-sort th-icon" on:click={() => toggleSort('fullcombo')}>
            <img src={icons.crowns.gold} alt="Full Combo" title="Full Combo" />
            {sortIndicator('fullcombo')}
          </th>

          <th class="th-sort th-icon" on:click={() => toggleSort('donderfullcombo')}>
            <img src={icons.crowns.donderfull} alt="Donder Full" title="Donder Full" />
            {sortIndicator('donderfullcombo')}
          </th>
        </tr>
      </thead>

      <tbody>
        {#each displayedScores as score (score.songNo + ':' + score.difficulty)}
          <tr>
            <td class="song-name">
              <a
                href={`https://donderhiroba.jp/score_detail.php?song_no=${score.songNo}&level=${score.difficulty === 'oni' ? 4 : 5}`}
                target="_blank"
                rel="noreferrer"
              >
                ({score.songNo}) {score.songName}
              </a>
            </td>

            <td class="td-icon">
              <img
                class="diff-icon"
                src={score.difficulty === 'oni' ? icons.oni : icons.ura}
                alt={score.difficulty}
                title={score.difficulty}
              />
            </td>

            <td>{score.score.count.play}</td>
            <td>{score.score.score}</td>
            
            <td class="td-icon">
              <img src={icons.badges[badgeToNumber(score.score.badge)]} alt="Score" title="Score" />
            </td>

            <td>{score.score.count.clear}</td>
            <td>{score.score.count.fullcombo}</td>
            <td>{score.score.count.donderfullcombo}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .score-data-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: 100%;
  }

  .totals {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;
    align-items: center;
    max-width: 600px;
  }

  .total-item {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    white-space: nowrap;
  }

  .play-count-table {
    width: 100%;
    max-width: 600px;
    border: 1px solid black;
    border-collapse: collapse;
    table-layout: auto; /* allow natural column sizing */
  }
  .play-count-table td img {
    width: 20px;
    height: 20px;
    vertical-align: middle;
  }
  .play-count-table th,
  .play-count-table td {
    border: 1px solid black;
    padding: 5px;
    text-align: center;
    white-space: nowrap; /* keeps number columns tight */
  }

  /* name column: take remaining width + ellipsis */
  .th-name {
    text-align: left;
  }

  .song-name {
    text-align: left;
    overflow: hidden;
    max-width: 0; /* important in tables so it can shrink */
  }

  .song-name a {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* icon columns shrink-to-content */
  .th-icon,
  .td-icon {
    width: 1%;
  }

  .th-sort {
    cursor: pointer;
    user-select: none;
  }

  .play-count-table th img {
    width: 20px;
    height: 20px;
    vertical-align: middle;
  }

  .icon {
    width: 30px;
    height: 30px;
    vertical-align: middle;
  }

  .diff-icon {
    width: 30px;
    height: 30px;
    vertical-align: middle;
  }
</style>
