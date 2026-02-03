<script lang="ts">
  import type { SortedScoreData } from './services/ScoreDataService'
  import { icons } from '../../assets'
  import type { Badge, Difficulty } from './ratingTypes'
  import type { DifficultyType, Playlist } from '../../types'
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
  let playlistItems: Playlist[] = []
  let playlistSongSet: Set<string> = new Set()
  let selectedPlaylistSongSet: Set<string> = new Set()
  let selectedPlaylistId = 'all'
  let filterToPlaylistOnly = false
  let unsubscribePlaylists: (() => void) | null = null
  let filterQuery = ''
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
      unsubscribePlaylists = playlists.subscribe((items) => {
        playlistItems = items
      })
      analyzer = await Analyzer.getInstance()
    })()
    return () => {
      document.body.removeEventListener('click', handler)
      document.body.removeEventListener('contextmenu', handler)
    }
  })

  onDestroy(() => {
    unsubscribePlaylists?.()
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
    | 'songduration'
    | 'maxbpm'
    
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
      case 'songduration': return analyzer?.getSongDuration(s.songNo, getDifficultyType(s.difficulty)) ?? 0
      case 'maxbpm': return analyzer?.getSongMaxBpm(s.songNo) ?? 0
    }
  }

  function getNumericField(s: SortedScoreData, field: string): number {
    switch (field) {
      case 'level': return getLevelValue(s)
      case 'score': return s.score.score
      case 'good%':
      case 'goodpercent':
      case 'goodpct':
      case 'goodp':
        return getGoodPercent(s) * 100
      case 'good':
      case 'goods': return s.score.good
      case 'ok':
      case 'okays': return s.score.ok
      case 'bad':
      case 'bads': return s.score.bad
      case 'rolls':
      case 'drumroll':
      case 'drumrolls':
      case 'roll': return s.score.roll
      case 'plays':
      case 'play': return s.score.count.play
      case 'clears':
      case 'clear': return s.score.count.clear
      case 'fc':
      case 'fullcombo': return s.score.count.fullcombo
      case 'dfc':
      case 'donderfullcombo': return s.score.count.donderfullcombo
      case 'notes': return getTotalNotes(s)
      case 'songlength':
      case 'length':
      case 'duration':
      case 'songduration': return analyzer?.getSongDuration(s.songNo, getDifficultyType(s.difficulty)) ?? 0
      case 'minbpm': return analyzer?.getSongMinBpm(s.songNo) ?? 0
      case 'bpm':
      case 'maxbpm': return analyzer?.getSongMaxBpm(s.songNo) ?? 0
      default: return 0
    }
  }

  function getBadgeName(badge: Badge): string {
    switch (badge) {
      case 'rainbow': return 'rainbow'
      case 'purple': return 'purple'
      case 'pink': return 'pink'
      case 'gold': return 'gold'
      case 'silver': return 'silver'
      case 'bronze': return 'bronze'
      case 'white': return 'white'
      case null: return 'none'
    }
  }

  function getBpmRangeText(s: SortedScoreData): string {
    const min = analyzer?.getSongMinBpm(s.songNo) ?? 0
    const max = analyzer?.getSongMaxBpm(s.songNo) ?? 0
    return `${min} - ${max}`
  }

  function matchFilterToken(s: SortedScoreData, token: string): boolean {
    const m = token.match(/^([a-z%]+)\s*(>=|<=|=|>|<|:)\s*(.+)$/i)
    if (!m) {
      const val = token.toLowerCase()
      const fields = [
        s.songName,
        s.songNo,
        s.difficulty,
        formatLevel(getLevelValue(s)),
        String(s.score.score),
        getBadgeName(s.score.badge),
        `${(getGoodPercent(s) * 100).toFixed(2)}%`,
        String(s.score.good),
        String(s.score.ok),
        String(s.score.bad),
        String(s.score.roll),
        String(s.score.count.play),
        String(s.score.count.clear),
        String(s.score.count.fullcombo),
        String(s.score.count.donderfullcombo),
        String(analyzer?.getSongDuration(s.songNo, getDifficultyType(s.difficulty)) ?? 0),
        getBpmRangeText(s)
      ]
      return fields.some((f) => f.toLowerCase().includes(val))
    }

    const field = m[1].toLowerCase()
    const op = m[2]
    const rawValue = m[3]

    if (field === 'name') {
      const name = s.songName.toLowerCase()
      const val = rawValue.toLowerCase()
      return op === '=' ? name === val : name.includes(val)
    }

    if (field === 'diff' || field === 'difficulty') {
      const diff = s.difficulty.toLowerCase()
      const val = rawValue.toLowerCase()
      return op === '=' ? diff === val : diff.includes(val)
    }

    if (field === 'badge') {
      const val = rawValue.toLowerCase()
      const badgeMap: Record<string, number> = {
        rainbow: 8,
        purple: 7,
        pink: 6,
        gold: 5,
        silver: 4,
        bronze: 3,
        white: 2,
        none: 1,
        null: 1
      }
      const desired = Number.isFinite(Number.parseFloat(val))
        ? Number.parseFloat(val)
        : badgeMap[val]
      if (!Number.isFinite(desired)) return false
      const actual = badgeToNumber(s.score.badge)
      switch (op) {
        case '>': return actual > desired
        case '>=': return actual >= desired
        case '<': return actual < desired
        case '<=': return actual <= desired
        case '=': return actual === desired
        case ':': return actual === desired
        default: return true
      }
    }

    const numValue = Number.parseFloat(rawValue.replace('%', ''))
    if (!Number.isFinite(numValue)) return false
    const actual = getNumericField(s, field)

    switch (op) {
      case '>': return actual > numValue
      case '>=': return actual >= numValue
      case '<': return actual < numValue
      case '<=': return actual <= numValue
      case '=': return actual === numValue
      case ':': return actual === numValue
      default: return true
    }
  }
  
  function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n))
  }
  
  function getTotalNotes(scoreData: SortedScoreData): number
  {
    return scoreData.score.good + scoreData.score.ok + scoreData.score.bad
  }
  
  function getGoodPercent(scoreData: SortedScoreData): number
  {
    var totalNotes = getTotalNotes(scoreData)
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

  function normalizeFilterQuery(q: string): string {
    return q.replace(/([a-z%]+)\s*(>=|<=|=|>|<|:)\s*([^\s"]+)/gi, (_m, field, op, value) => {
      return `${field}${op}${value}`
    })
  }

  $: filteredScores = (scoreDataSorted ?? []).filter((s) => {
    const q = normalizeFilterQuery(filterQuery).trim()
    const shouldFilterToPlaylist = filterToPlaylistOnly
      && selectedPlaylistId !== 'all'
      && selectedPlaylistId !== ''
    if (shouldFilterToPlaylist && !selectedPlaylistSongSet.has(s.songNo)) return false
    if (!q) return true
    const tokens: string[] = q.match(/"[^"]+"|\S+/g) ?? []
    return tokens.every(t => matchFilterToken(s, t.replace(/^"|"$/g, '')))
  })

  $: displayedScores = [...filteredScores].sort((a, b) => {
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

  $: playlistSongSet = new Set(
    selectedPlaylistId === 'all'
      ? playlistItems.flatMap(p => p.songNoList)
      : (playlistItems.find(p => p.uuid === selectedPlaylistId)?.songNoList ?? [])
  )

  $: selectedPlaylistSongSet = new Set(
    selectedPlaylistId !== 'all' && selectedPlaylistId !== ''
      ? (playlistItems.find(p => p.uuid === selectedPlaylistId)?.songNoList ?? [])
      : []
  )

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
    <div class="playlist-highlight">
      <label for="playlist-highlight-select">Highlight playlist:</label>
      <select
        id="playlist-highlight-select"
        bind:value={selectedPlaylistId}
        disabled={!playlistItems.length}
      >
        <option value="all">(all playlists)</option>
        <option value="">(none)</option>
        {#each playlistItems as playlist (playlist.uuid)}
          <option value={playlist.uuid}>{playlist.title}</option>
        {/each}
      </select>
      <label class="playlist-filter-toggle">
        <input
          type="checkbox"
          bind:checked={filterToPlaylistOnly}
          disabled={!playlistItems.length}
        />
        Only show songs in playlist
      </label>
    </div>

    <div class="filter-row">
      <label for="score-filter-input">Filter:</label>
      <input
        id="score-filter-input"
        type="text"
        placeholder='name, level>=9, score>1000000, good%>=98'
        bind:value={filterQuery}
      />
    </div>

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
          <th class="th-sort th-icon" on:click={() => toggleSort('songduration')}>
            Length{sortIndicator('songduration')}
          </th>
          <th class="th-sort th-icon" on:click={() => toggleSort('maxbpm')}>
            BPM{sortIndicator('maxbpm')}
          </th>
          <!-- End song info -->
        </tr>
      </thead>

      <tbody>
        {#each displayedScores as score (score.songNo + ':' + score.difficulty)}
          <tr class:in-playlist={playlistSongSet.has(score.songNo)}>
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
            
            <td>{(getGoodPercent(score) * 100).toFixed(2)}%</td>
            <td>{score.score.good}</td>
            <td>{score.score.ok}</td>
            <td>{score.score.bad}</td>
            <td>{score.score.roll}</td>

            <td>{score.score.count.play}</td>
            <td>{score.score.count.clear}</td>
            <td>{score.score.count.fullcombo}</td>
            <td>{score.score.count.donderfullcombo}</td>
            
            <td>{analyzer?.getSongDuration(score.songNo, getDifficultyType(score.difficulty)) ?? 0}</td>
            <td>{analyzer?.getSongMinBpm(score.songNo) ?? 0} - {analyzer?.getSongMaxBpm(score.songNo) ?? 0}</td>
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

  .playlist-highlight {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .playlist-filter-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }

  .filter-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .filter-row input {
    min-width: 240px;
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

  .play-count-table tbody tr.in-playlist {
    background-color: #3a3420;
  }

  /* name column: take remaining width + ellipsis */
  .th-name {
    text-align: left;
  }

  .song-name {
    text-align: left;
    overflow: hidden;
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
