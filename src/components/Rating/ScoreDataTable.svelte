<script lang="ts">
  import type { SortedScoreData } from './services/ScoreDataService'
  import { icons } from '../../assets'
  import { isGimmickSong } from '../../lib/gimmickSongs'
  import { isUnavailableSong } from '../../lib/unavailableSongs'
  import type { Difficulty } from './ratingTypes'
  import type { Playlist } from '../../types'
  import { MAX_PLAYLIST_SONGS } from '../../constants';
  import { TIER_ORDER, tierRank, DFC_TIER_ORDER, dfcTierRank } from '../../lib/diffchartTiers'
  import { getDanRank, DAN_THRESHOLDS } from './danRank'
  import { onDestroy, onMount } from 'svelte'
  import PlaylistContextMenu from '../Common/PlaylistContextMenu.svelte'
  import { PlaylistsStore } from '../../lib/playlist'
  import { Analyzer } from '../../lib/analyzer'
  import LevelPlayCount from './LevelPlayCount.svelte'
  import DistributionGraphs from './DistributionGraphs.svelte'
  import DanDistributionGraphs from './DanDistributionGraphs.svelte'
  import DanSummary from './DanSummary.svelte'
  import BadgeCrownSummary from './BadgeCrownSummary.svelte'
  import {
    type SortKey,
    badgeToNumber,
    getBadgeName,
    getTotalNotes,
    getGoodPercent,
    getDifficultyType,
    getSongTier,
    getSongDfcTier,
    formatLevel,
    formatHours,
    daysSince,
    normalizeFilterQuery,
    parseTierValue,
    parseDfcTierValue,
    songNoNum,
    cmp,
  } from './scoreTableUtils'
  import { downloadBlob } from '../../lib/utils'

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
  let hideGimmicks = false
  let showDoubles = false
  let showAdvanced = false
  let playlistMenu:
  | { songNo: string; title: string; difficulty: Difficulty; x: number; y: number }
  | null = null

  const closePlaylistMenu = () => (playlistMenu = null)

  async function clearSelectedPlaylist(): Promise<void> {
    if (!playlists) return
    if (selectedPlaylistId === 'all' || selectedPlaylistId === '') return
    const target = playlistItems.find(p => p.uuid === selectedPlaylistId)
    if (!target) return
    if (!confirm(`Clear all songs from "${target.title}"?`)) return
    if (target.songNoList.length === 0) return
    await playlists.set(
      playlistItems.map(p => p.uuid === target.uuid ? { ...p, songNoList: [] } : p)
    )
  }

  async function addTop30ToPlaylist(): Promise<void> {
    if (!playlists) return
    if (selectedPlaylistId === 'all' || selectedPlaylistId === '') return
    const target = playlistItems.find(p => p.uuid === selectedPlaylistId)
    if (!target) return

    const topSongNos = displayedScores
      .slice(0, MAX_PLAYLIST_SONGS)
      .map(s => s.songNo)

    const existing = new Set(target.songNoList)
    const toAdd = topSongNos.filter(no => !existing.has(no))
    if (toAdd.length === 0) return

    const remaining = MAX_PLAYLIST_SONGS - target.songNoList.length
    if (remaining <= 0) {
      alert(`Song list must be less than ${MAX_PLAYLIST_SONGS}`)
      return
    }

    const newList = [...target.songNoList, ...toAdd.slice(0, remaining)]
    await playlists.set(
      playlistItems.map(p => p.uuid === target.uuid ? { ...p, songNoList: newList } : p)
    )
  }

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

  function getSortValue(s: SortedScoreData, key: SortKey) {
    switch (key) {
      case 'name': return s.songName
      case 'diff': return s.difficulty === 'oni' ? 0 : 1 // oni first
      case 'level': return getLevelValue(s)
      case 'tier': {
        const rank = tierRank(getSongTier(s) ?? '')
        // not-on-chart songs sort last when ascending
        return rank < 0 ? TIER_ORDER.length : rank
      }
      case 'dfctier': {
        const rank = dfcTierRank(getSongDfcTier(s) ?? '')
        return rank < 0 ? DFC_TIER_ORDER.length : rank
      }
      case 'dan': {
        const result = getDanRank(s.score.good, s.score.ok, s.score.bad)
        if (!result) return -1
        const idx = DAN_THRESHOLDS.findIndex(t => t.rank === result.rank)
        // gold within same rank sorts higher
        return idx * 2 + (result.gold ? 1 : 0)
      }
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
      case 'lastplayed': return s.lastPlayed ?? 0
      case 'lastupscored': return s.lastUpscored ?? 0
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
      case 'lastplay':
      case 'lastplayed': {
        const ts = s.lastPlayed
        if (ts === null) return Number.MAX_SAFE_INTEGER
        return Math.floor((Date.now() - ts) / 86400000)
      }
      case 'lastpb':
      case 'lastupscored': {
        const ts = s.lastUpscored
        if (ts === null) return Number.MAX_SAFE_INTEGER
        return Math.floor((Date.now() - ts) / 86400000)
      }
      default: return 0
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
      const danResult = getDanRank(s.score.good, s.score.ok, s.score.bad)
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
        getBpmRangeText(s),
        daysSince(s.lastPlayed),
        daysSince(s.lastUpscored),
        danResult ? danResult.rank.toLowerCase() : '',
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

    if (field === 'dan') {
      const danResult = getDanRank(s.score.good, s.score.ok, s.score.bad)
      // dan:gold / dan=gold — gold tier only
      if (rawValue.toLowerCase() === 'gold') {
        return (op === ':' || op === '=') ? (danResult?.gold === true) : false
      }
      // dan:none — unranked songs
      if (rawValue.toLowerCase() === 'none') {
        return (op === ':' || op === '=') ? danResult === null : false
      }
      const desiredIdx = DAN_THRESHOLDS.findIndex(
        t => t.rank.toLowerCase() === rawValue.toLowerCase()
      )
      if (desiredIdx < 0) return false
      if (op === ':' || op === '=') {
        return danResult !== null
          && DAN_THRESHOLDS.findIndex(t => t.rank === danResult.rank) === desiredIdx
      }
      if (danResult === null) return false
      const actualIdx = DAN_THRESHOLDS.findIndex(t => t.rank === danResult.rank)
      // Higher index = higher rank: dan>7th dan means rank above 7th
      switch (op) {
        case '>':  return actualIdx > desiredIdx
        case '>=': return actualIdx >= desiredIdx
        case '<':  return actualIdx < desiredIdx
        case '<=': return actualIdx <= desiredIdx
        default:   return true
      }
    }

    if (field === 'tier') {
      const songTier = getSongTier(s)
      const desired = parseTierValue(rawValue)
      if (desired < 0) return false
      if (op === ':' || op === '=') {
        return songTier !== null && tierRank(songTier) === desired
      }
      if (songTier === null) return false
      const actual = tierRank(songTier)
      // Lower rank index = harder tier (SSS=0, F=9), so flip operators
      // tier>A means "harder than A", i.e. actual index < desired index
      switch (op) {
        case '>':  return actual < desired
        case '>=': return actual <= desired
        case '<':  return actual > desired
        case '<=': return actual >= desired
        default:   return true
      }
    }

    if (field === 'dfctier') {
      const songTier = getSongDfcTier(s)
      const desired = parseDfcTierValue(rawValue)
      if (desired < 0) return false
      if (op === ':' || op === '=') {
        return songTier !== null && dfcTierRank(songTier) === desired
      }
      if (songTier === null) return false
      const actual = dfcTierRank(songTier)
      switch (op) {
        case '>':  return actual < desired
        case '>=': return actual <= desired
        case '<':  return actual > desired
        case '<=': return actual >= desired
        default:   return true
      }
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
  
  // songNo is a string; normalize for comparisons/tie-breaks
  function getLevelValue(scoreData: SortedScoreData): number {
    if (!analyzer) return 0
    return analyzer.getLevelWidthSub(scoreData.songNo, getDifficultyType(scoreData.difficulty))
  }

  $: filteredScores = (scoreDataSorted ?? []).filter((s) => {
    const q = normalizeFilterQuery(filterQuery).trim()
    if (!showDoubles && s.songName.includes('【双打】')) return false
    if (hideGimmicks && isGimmickSong(s.songNo)) return false
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

  $: selectedPlaylist = selectedPlaylistId !== 'all' && selectedPlaylistId !== ''
    ? (playlistItems.find(p => p.uuid === selectedPlaylistId) ?? null)
    : null

  $: selectedPlaylistSize = selectedPlaylist?.songNoList.length ?? 0
  $: remainingPlaylistCapacity = MAX_PLAYLIST_SONGS - selectedPlaylistSize
  $: top30CandidateSongNos = displayedScores.slice(0, MAX_PLAYLIST_SONGS).map(s => s.songNo)
  $: top30AddableCount = selectedPlaylist
    ? Math.min(
      remainingPlaylistCapacity,
      top30CandidateSongNos.filter(no => !selectedPlaylistSongSet.has(no)).length
    )
    : 0

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? ' ▲' : ' ▼'
  }

  $: totalPlays = (filteredScores ?? []).reduce((acc, s) => acc + s.score.count.play, 0)
  $: totalClears = (filteredScores ?? []).reduce((acc, s) => acc + s.score.count.clear, 0)
  $: totalFC = (filteredScores ?? []).reduce((acc, s) => acc + s.score.count.fullcombo, 0)
  $: totalDFC = (filteredScores ?? []).reduce((acc, s) => acc + s.score.count.donderfullcombo, 0)
  $: totalPlayTimeSeconds = (filteredScores ?? []).reduce((acc, s) => {
    const duration = analyzer?.getSongDuration(s.songNo, getDifficultyType(s.difficulty)) ?? 0
    return acc + (duration * s.score.count.play)
  }, 0)

  async function exportCSV() {
    const headers = [
      'Song No', 'Name', 'Difficulty', 'Level', 'Tier', 'DFC Tier', 'Dan', 'Score', 'Badge',
      'Good %', 'Goods', 'Okays', 'Bads', 'Rolls',
      'Plays', 'Last Played', 'Last PB',
      'Clears', 'Full Combos', 'DFC',
      'Length (s)', 'BPM',
    ]

    const rows = displayedScores.map(s => {
      const danResult = getDanRank(s.score.good, s.score.ok, s.score.bad)
      const danText = danResult ? (danResult.gold ? `${danResult.rank} (Gold)` : danResult.rank) : ''
      const duration = analyzer?.getSongDuration(s.songNo, getDifficultyType(s.difficulty)) ?? 0
      return [
        s.songNo,
        s.songName,
        s.difficulty,
        formatLevel(getLevelValue(s)),
        getSongTier(s) ?? '',
        getSongDfcTier(s) ?? '',
        danText,
        s.score.score,
        getBadgeName(s.score.badge),
        (getGoodPercent(s) * 100).toFixed(2) + '%',
        s.score.good,
        s.score.ok,
        s.score.bad,
        s.score.roll,
        s.score.count.play,
        daysSince(s.lastPlayed),
        daysSince(s.lastUpscored),
        s.score.count.clear,
        s.score.count.fullcombo,
        s.score.count.donderfullcombo,
        duration,
        getBpmRangeText(s),
      ]
    })

    const csvContent = [headers, ...rows]
      .map(row => row.map(v => {
        const str = String(v)
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str
      }).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    await downloadBlob(blob, 'scores.csv')
  }

</script>

<div class="score-data-section">
  <div style="margin-top: 50px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
    <span>Last Score Updated: {lastUpdated}</span>

    <button on:click={onClearCache}>
      Clear Cache
    </button>

    <button on:click={exportCSV}>
      Export CSV
    </button>
  </div>

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

      <button
        class="playlist-add-top-btn"
        on:click={addTop30ToPlaylist}
        disabled={!playlistItems.length || selectedPlaylistId === 'all' || selectedPlaylistId === '' || top30AddableCount === 0}
        title="Add the top 30 visible songs to the selected playlist"
      >
        Add Top 30
      </button>
      <button
        class="playlist-clear-btn"
        on:click={clearSelectedPlaylist}
        disabled={!playlistItems.length || selectedPlaylistId === 'all' || selectedPlaylistId === '' || selectedPlaylistSongSet.size === 0}
      >
        Clear Playlist
      </button>
    </div>

    <div class="filter-row">
      <label for="score-filter-input">Filter:</label>
      <input
        id="score-filter-input"
        type="text"
        placeholder='name, level>=9, score>1000000, good%>=98, dan>=7th dan, dan=gold'
        bind:value={filterQuery}
      />
    </div>

    <div class="options-row">
      <label class="option-toggle"><input type="checkbox" bind:checked={filterToPlaylistOnly} disabled={!playlistItems.length} />Only show playlist songs</label>
      <label class="option-toggle"><input type="checkbox" bind:checked={hideGimmicks} />Hide gimmick songs</label>
      <label class="option-toggle"><input type="checkbox" bind:checked={showDoubles} />Show Doubles Charts</label>
      <label class="option-toggle"><input type="checkbox" bind:checked={showAdvanced} />Show advanced stats</label>
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

      <span class="total-item">
        <img class="icon" src={icons.hourglass} alt="Time Spent" title="Time Spent" />
        {formatHours(totalPlayTimeSeconds)}
      </span>
    </div>

    <LevelPlayCount {filteredScores} {analyzer} />

    <BadgeCrownSummary {filteredScores} />

    <DanSummary {filteredScores} />

    <DistributionGraphs {filteredScores} {analyzer} />

    <DanDistributionGraphs {filteredScores} {analyzer} />

    <div class="table-scroll-wrapper">
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

          <th class="th-sort th-icon" on:click={() => toggleSort('tier')}>
            Tier{sortIndicator('tier')}
          </th>

          <th class="th-sort th-icon" on:click={() => toggleSort('dfctier')}>
            DFC Tier{sortIndicator('dfctier')}
          </th>

          <th class="th-sort th-icon th-dan" on:click={() => toggleSort('dan')}>
            Dan{sortIndicator('dan')}
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
          {#if showAdvanced}
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
          {/if}
          <!-- End note stats -->
          
          <th class="th-sort th-icon" on:click={() => toggleSort('play')}>
            <img src={icons.crowns.played} alt="Played" title="Played" />
            {sortIndicator('play')}
          </th>

          <th class="th-sort th-icon" on:click={() => toggleSort('lastplayed')}>
            Last Played{sortIndicator('lastplayed')}
          </th>

          <th class="th-sort th-icon" on:click={() => toggleSort('lastupscored')}>
            Last PB{sortIndicator('lastupscored')}
          </th>

          {#if showAdvanced}
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
          {/if}
        </tr>
      </thead>

      <tbody>
        {#each displayedScores as score (score.songNo + ':' + score.difficulty)}
          {@const danResult = getDanRank(score.score.good, score.score.ok, score.score.bad)}
          <tr class:in-playlist={playlistSongSet.has(score.songNo)} class:is-gimmick={isGimmickSong(score.songNo)} class:is-unavailable={isUnavailableSong(score.songNo)}>
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
                {#if isGimmickSong(score.songNo)}<span class="gimmick-badge" title="Gimmick song">✦</span>{/if}{#if isUnavailableSong(score.songNo)}<span class="unavailable-badge" title="Unavailable">✕</span>{/if}({score.songNo}) {score.songName}
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
            <td class="td-tier" data-tier={getSongTier(score) ?? 'none'}>{getSongTier(score) ?? '-'}</td>
            <td class="td-tier" data-tier={getSongDfcTier(score) ?? 'none'}>{getSongDfcTier(score) ?? '-'}</td>
            <td class="td-dan" class:td-dan-gold={danResult?.gold === true} data-dan={danResult?.rank ?? 'none'} title={danResult?.goldTooltip ?? ''}>
              {#if danResult}
                {#if danResult.gold}<img class="dan-gold-crown" src={icons.crowns.gold} alt="Gold" title="Gold requirements met" />{/if}<span class:dan-gold-text={danResult.gold}>{danResult.rank}</span>
              {:else}-{/if}
            </td>
            <td>{score.score.score}</td>
            
            <td class="td-icon">
              <img src={icons.badges[badgeToNumber(score.score.badge)]} alt="Score" title="Score" />
            </td>
            
            <td>{(getGoodPercent(score) * 100).toFixed(2)}%</td>
            {#if showAdvanced}
            <td>{score.score.good}</td>
            <td>{score.score.ok}</td>
            <td>{score.score.bad}</td>
            <td>{score.score.roll}</td>
            {/if}

            <td>{score.score.count.play}</td>
            <td>{daysSince(score.lastPlayed)}</td>
            <td>{daysSince(score.lastUpscored)}</td>
            {#if showAdvanced}
            <td>{score.score.count.clear}</td>
            <td>{score.score.count.fullcombo}</td>
            <td>{score.score.count.donderfullcombo}</td>
            
            <td>{analyzer?.getSongDuration(score.songNo, getDifficultyType(score.difficulty)) ?? 0}</td>
            <td>{analyzer?.getSongMinBpm(score.songNo) ?? 0} - {analyzer?.getSongMaxBpm(score.songNo) ?? 0}</td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
    </div>
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

  .playlist-add-top-btn,
  .playlist-clear-btn {
    margin-left: 4px;
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

  .table-scroll-wrapper {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .play-count-table {
    width: max-content;
    margin: 0 auto;
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

  .play-count-table tbody tr.is-unavailable {
    background-color: #3b1010;
  }

  .play-count-table tbody tr.is-unavailable .song-name a {
    color: #f87171;
  }

  .unavailable-badge {
    color: #f87171;
    margin-right: 4px;
    font-size: 1.0em;
    font-weight: bold;
    vertical-align: middle;
    text-shadow: 0 0 6px #f87171, 0 0 12px #dc2626;
  }

  .gimmick-badge {
    color: #e879f9;
    margin-right: 4px;
    font-size: 1.1em;
    vertical-align: middle;
    text-shadow: 0 0 6px #e879f9, 0 0 12px #c026d3;
  }

  .options-row {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    justify-content: center;
    align-items: center;
  }

  .option-toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
    cursor: pointer;
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

  .td-tier {
    font-weight: bold;
    font-size: 0.85em;
    min-width: 3ch;
  }

  .td-tier[data-tier="SSS"] { color: #ff4444; }
  .td-tier[data-tier="SS"]  { color: #ff8c00; }
  .td-tier[data-tier="S+"]  { color: #ffd700; }
  .td-tier[data-tier="S"]   { color: #ffe066; }
  .td-tier[data-tier="A"]   { color: #aef; }
  .td-tier[data-tier="B"]   { color: #8cf; }
  .td-tier[data-tier="C"]   { color: #9df; }
  .td-tier[data-tier="D"]   { color: #aaa; }
  .td-tier[data-tier="E"]   { color: #888; }
  .td-tier[data-tier="F"]   { color: #666; }
  .td-tier[data-tier="X"]   { color: #999; font-style: italic; }

  .th-dan {
    min-width: 6ch;
  }

  .td-dan {
    font-weight: bold;
    font-size: 0.85em;
    min-width: 6ch;
  }

  .td-dan[data-dan="Shodan"]   { color: #aaa; }
  .td-dan[data-dan="2nd Dan"]  { color: #aaa; }
  .td-dan[data-dan="3rd Dan"]  { color: #aaa; }
  .td-dan[data-dan="4th Dan"]  { color: #aaa; }
  .td-dan[data-dan="5th Dan"]  { color: #8cf; }
  .td-dan[data-dan="6th Dan"]  { color: #8cf; }
  .td-dan[data-dan="7th Dan"]  { color: #8cf; }
  .td-dan[data-dan="8th Dan"]  { color: #aef; }
  .td-dan[data-dan="9th Dan"]  { color: #aef; }
  .td-dan[data-dan="10th Dan"] { color: #ffe066; }
  .td-dan[data-dan="Kuroto"]   { color: #ffd700; }
  .td-dan[data-dan="Meijin"]   { color: #ff8c00; }
  .td-dan[data-dan="Chojin"]   { color: #ff6060; }
  .td-dan[data-dan="Tatsujin"] { color: #ff4444; text-shadow: 0 0 6px #ff2222; }

  .td-dan.td-dan-gold {
    outline: 1px solid rgba(255, 215, 0, 0.4);
  }

  .dan-gold-crown {
    width: 14px;
    height: 14px;
    vertical-align: middle;
    margin-right: 3px;
    margin-bottom: 2px;
  }

  .dan-gold-text {
    text-decoration: underline;
    text-decoration-color: #ffd700;
    text-decoration-thickness: 2px;
    text-underline-offset: 2px;
  }

</style>
