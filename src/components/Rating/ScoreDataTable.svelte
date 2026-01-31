<script lang="ts">
  import type { SortedScoreData } from './services/ScoreDataService'
  import { icons } from '../../assets'
  import type { Badge, Difficulty } from './ratingTypes'
  import type { DifficultyType } from '../../types'
  import { BADGES } from '../../constants';
  import { onDestroy, onMount } from 'svelte'
  import PlaylistContextMenu from '../Common/PlaylistContextMenu.svelte'
  import { PlaylistsStore } from '../../lib/playlist'
  import { Analyzer } from '../../lib/analyzer'

  export let scoreDataSorted: SortedScoreData[]
  export let lastUpdated: string | null
  export let onClearCache: () => Promise<void>

  let openPlayCount = true
  let playlists: PlaylistsStore | null = null
  let analyzer: Analyzer | null = null
  let playlistMenu:
  | { songNo: string; title: string; difficulty: Difficulty; x: number; y: number }
  | null = null

  const closePlaylistMenu = () => (playlistMenu = null)
  
  function onClickPlaylist(e: MouseEvent, songNo: string, title: string, difficulty: Difficulty) {
    e.stopPropagation()
    const target = e.currentTarget as HTMLElement | null
    const rect = target?.getBoundingClientRect()
    const x = rect ? rect.right + window.scrollX : e.clientX + window.scrollX
    const y = rect ? rect.bottom + window.scrollY : e.clientY + window.scrollY
    playlistMenu = { songNo, title, difficulty, x, y }
  }
  
  onMount(() => {
    const handler = () => closePlaylistMenu()
    document.body.addEventListener('click', handler)
    document.body.addEventListener('contextmenu', handler)
    void (async () => {
      playlists = await PlaylistsStore.getInstance()
      analyzer = await Analyzer.getInstance()
    })()
    return () => {
      document.body.removeEventListener('click', handler)
      document.body.removeEventListener('contextmenu', handler)
    }
  })

  type SortKey = 'name'
    | 'diff'
    | 'level'
    | 'play'
    | 'score'
    | 'badge'
    | 'goodpercent'
    | 'goods'
    | 'okays'
    | 'bads'
    | 'roll'
    | 'clear'
    | 'fullcombo'
    | 'donderfullcombo'
    | 'notes'
    | 'rolltime'
    | 'balloontime'
    
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
      case 'level': return getLevelValue(s)
      case 'play': return s.score.count.play
      case 'score': return s.score.score
      case 'badge': return badgeToNumber(s.score.badge)
      case 'goodpercent': return getGoodPercent(s)
      case 'goods': return s.score.good
      case 'okays': return s.score.ok
      case 'bads': return s.score.bad
      case 'roll': return s.score.roll
      case 'clear': return s.score.count.clear
      case 'fullcombo': return s.score.count.fullcombo
      case 'donderfullcombo': return s.score.count.donderfullcombo
      case 'notes': return analyzer?.getTotalNotes(s.songNo, getDifficultyType(s.difficulty)) ?? 0
      case 'rolltime': return analyzer?.getTotalRollTime(s.songNo, getDifficultyType(s.difficulty)) ?? 0
      case 'balloontime': return analyzer?.getTotalBalloonTime(s.songNo, getDifficultyType(s.difficulty)) ?? 0
    }
  }
  
  function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n))
  }
  
  function getGoodPercent(scoreData: SortedScoreData): number
  {
    if (!analyzer)
        return 0
    var totalNotes = analyzer.getTotalNotes(scoreData.songNo, getDifficultyType(scoreData.difficulty));
    return totalNotes > 0 ? scoreData.score.good / totalNotes : 0
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

  function getDifficultyType(diff: Difficulty): DifficultyType 
  {
    return diff === 'ura' ? 'oni_ura' : 'oni'
  }
  
  function getLevelValue(scoreData: SortedScoreData): number {
    if (!analyzer) return 0
    
    return analyzer.getLevelWidthSub(scoreData.songNo, getDifficultyType(scoreData.difficulty))
  }
  
  
  function formatLevel(level: number): string {
    if (level <= 0) return '-'
    const trimmed = Math.round(level * 10) / 10
    return trimmed % 1 === 0 ? String(Math.trunc(trimmed)) : trimmed.toFixed(1)
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
          <th class="th-sort th-icon">
          </th>
          
          <th class="th-sort th-name" on:click={() => toggleSort('name')}>
            Name{sortIndicator('name')}
          </th>

          <th class="th-sort th-icon" on:click={() => toggleSort('diff')}>
            Diff{sortIndicator('diff')}
          </th>

          <th class="th-sort th-icon" on:click={() => toggleSort('level')}>
            Level{sortIndicator('level')}
          </th>

          <th class="th-sort th-icon" on:click={() => toggleSort('score')}>
            Score{sortIndicator('score')}
          </th>

          <th class="th-sort th-icon" on:click={() => toggleSort('badge')}>
            <img src={icons.badges[8]} alt="Badge" title="Badge" />
            {sortIndicator('badge')}
          </th>

          <!-- Note stats -->
          <th class="th-sort th-icon" on:click={() => toggleSort('goodpercent')}>
            Good %{sortIndicator('goodpercent')}
          </th>
          <th class="th-sort th-icon" on:click={() => toggleSort('goods')}>
            Goods{sortIndicator('goods')}
          </th>
          <th class="th-sort th-icon" on:click={() => toggleSort('okays')}>
            Okays{sortIndicator('okays')}
          </th>
          <th class="th-sort th-icon" on:click={() => toggleSort('bads')}>
            Bads{sortIndicator('bads')}
          </th>
          <th class="th-sort th-icon" on:click={() => toggleSort('roll')}>
            Rolls{sortIndicator('roll')}
          </th>
          <!-- End note stats -->
          
          <th class="th-sort th-icon" on:click={() => toggleSort('play')}>
            <img src={icons.crowns.played} alt="Played" title="Played" />
            {sortIndicator('play')}
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
          
          <!-- Song info -->
          <th class="th-sort th-icon" on:click={() => toggleSort('notes')}>
            Notes{sortIndicator('notes')}
          </th>
          <th class="th-sort th-icon" on:click={() => toggleSort('rolltime')}>
            Roll Time{sortIndicator('rolltime')}
          </th>
          <th class="th-sort th-icon" on:click={() => toggleSort('balloontime')}>
            Balloon Hits{sortIndicator('balloontime')}
          </th>
          <!-- End song info -->
        </tr>
      </thead>

      <tbody>
        {#each displayedScores as score (score.songNo + ':' + score.difficulty)}
          <tr>
            <td class="td-icon">
              {#if playlists}
                <button class="playlist-btn" on:click={(e) => onClickPlaylist(e, score.songNo, score.songName, score.difficulty)}>
                <img class="playlist-icon" src={icons.list} alt="Add to playlist" title="Add to playlist" />
                </button>
              {:else}
                -
              {/if}
            </td>
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
            <td>{formatLevel(getLevelValue(score))}</td>
            <td>{score.score.score}</td>
            
            <td class="td-icon">
              <img src={icons.badges[badgeToNumber(score.score.badge)]} alt="Score" title="Score" />
            </td>
            
            <td>{getGoodPercent(score)}</td>
            <td>{score.score.good}</td>
            <td>{score.score.ok}</td>
            <td>{score.score.bad}</td>
            <td>{score.score.roll}</td>

            <td>{score.score.count.play}</td>
            <td>{score.score.count.clear}</td>
            <td>{score.score.count.fullcombo}</td>
            <td>{score.score.count.donderfullcombo}</td>
            
            <td>{analyzer?.getTotalNotes(score.songNo, getDifficultyType(score.difficulty)) ?? 0}</td>
            <td>{analyzer?.getTotalRollTime(score.songNo, getDifficultyType(score.difficulty)) ?? 0}</td>
            <td>{analyzer?.getTotalBalloonTime(score.songNo, getDifficultyType(score.difficulty)) ?? 0}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
  {#if playlistMenu && playlists}
    <PlaylistContextMenu
      songNo={playlistMenu.songNo}
      title={playlistMenu.title}
      difficulty={playlistMenu.difficulty}
      {playlists}
      wikiLink={null}
      recentScores={undefined}
      x={playlistMenu.x}
      y={playlistMenu.y}
    />
  {/if}
</div>

<style>
  .playlist-btn {
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .playlist-icon {
    width: 20px;
    height: 20px;
    vertical-align: middle;
  }

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
    color: #f0f0f0;
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

  .play-count-table tbody tr:nth-child(odd) {
    background-color: #2b2b2b;
  }

  .play-count-table tbody tr:nth-child(even) {
    background-color: #242424;
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
    color: inherit;
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
