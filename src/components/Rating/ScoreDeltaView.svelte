<script lang="ts">
  import type { ScoreDelta } from './scoreDeltaStorage'
  import { icons } from '../../assets'
  import { Analyzer } from '../../lib/analyzer'
  import { getDifficultyType, formatLevel, formatHours } from './scoreTableUtils'
  import { DAN_THRESHOLDS } from './danRank'
  import { onMount } from 'svelte'

  export let deltas: ScoreDelta[] = []

  let open = false
  let currentIndex: number = -1
  let analyzer: Analyzer | null = null

  onMount(() => {
    void Analyzer.getInstance().then(a => { analyzer = a })
  })

  $: {
    if (deltas.length > 0 && currentIndex === -1) {
      currentIndex = deltas.length - 1
    }
    // clamp to valid range when deltas array changes
    if (currentIndex >= deltas.length) {
      currentIndex = deltas.length - 1
    }
  }

  $: currentDelta = currentIndex >= 0 && currentIndex < deltas.length
    ? deltas[currentIndex]
    : null

  type SortKey = 'title' | 'difficulty' | 'level' | 'danIdx' | 'badge' | 'score' | 'good' | 'ok' | 'bad' | 'roll' | 'play' | 'fc' | 'dfc'

  let sortKey: SortKey = 'play'
  let sortDir: 1 | -1 = -1

  function toggleSort(key: SortKey): void {
    if (sortKey === key) {
      sortDir = sortDir === 1 ? -1 : 1
    } else {
      sortKey = key
      sortDir = -1
    }
  }

  $: baseRows = currentDelta ? Object.values(currentDelta.changes) : []

  $: rows = baseRows.slice().sort((a, b) => {
    let av: number | string
    let bv: number | string
    switch (sortKey) {
      case 'title': av = a.title; bv = b.title; break
      case 'difficulty': av = a.difficulty; bv = b.difficulty; break
      case 'level':
        av = analyzer?.getLevelWidthSub(a.songNo, getDifficultyType(a.difficulty)) ?? 0
        bv = analyzer?.getLevelWidthSub(b.songNo, getDifficultyType(b.difficulty)) ?? 0
        break
      case 'danIdx': av = a.diff.danIdx; bv = b.diff.danIdx; break
      case 'badge': av = a.diff.badge; bv = b.diff.badge; break
      case 'score': av = a.diff.score; bv = b.diff.score; break
      case 'good': av = a.diff.good; bv = b.diff.good; break
      case 'ok': av = a.diff.ok; bv = b.diff.ok; break
      case 'bad': av = a.diff.bad; bv = b.diff.bad; break
      case 'roll': av = a.diff.roll; bv = b.diff.roll; break
      case 'play': av = a.diff.play; bv = b.diff.play; break
      case 'fc': av = a.diff.fc; bv = b.diff.fc; break
      case 'dfc': av = a.diff.dfc; bv = b.diff.dfc; break
      default: av = 0; bv = 0
    }
    if (typeof av === 'string' && typeof bv === 'string') {
      return sortDir * av.localeCompare(bv)
    }
    return sortDir * ((av as number) - (bv as number))
  })

  $: sessionPlayTimeSeconds = baseRows.reduce((acc, row) => {
    const duration = analyzer?.getSongDuration(row.songNo, getDifficultyType(row.difficulty)) ?? 0
    return acc + duration * row.diff.play
  }, 0)

  $: totalPlays = baseRows.reduce((acc, row) => acc + row.diff.play, 0)
  $: totalUpscores = baseRows.filter(row => row.diff.score > 0).length
  $: newBadges = baseRows.filter(row => row.diff.badge > 0).length
  $: newDojoBadges = baseRows.filter(row => row.diff.danIdx > 0).length
  $: newFCs = baseRows.filter(row => row.diff.fc > 0 && row.after.fc - row.diff.fc === 0).length
  $: newDFCs = baseRows.filter(row => row.diff.dfc > 0 && row.after.dfc - row.diff.dfc === 0).length

  function formatTimestamp(ts: number): string {
    const d = new Date(ts)
    const yy = d.getFullYear().toString().slice(-2)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${yy}-${mm}-${dd} ${hh}:${mi}`
  }

  function diffClass(value: number, higherIsBetter: boolean): string {
    if (value === 0) return ''
    if (higherIsBetter) return value > 0 ? 'improved' : 'regressed'
    return value < 0 ? 'improved' : 'regressed'
  }

  function fmtDiff(value: number): string {
    if (value === 0) return '0'
    return value > 0 ? `+${value}` : String(value)
  }

  const BADGE_NAMES: Record<number, string> = {
    1: 'none', 2: 'white', 3: 'bronze', 4: 'silver', 5: 'gold', 6: 'pink', 7: 'purple', 8: 'rainbow'
  }

  function getBadgeIcon(n: number): string {
    return icons.badges[n as keyof typeof icons.badges] ?? icons.badges[1]
  }

  function getDanName(idx: number): string {
    if (idx < 0) return '-'
    return DAN_THRESHOLDS[idx]?.rank ?? '-'
  }
</script>

<button class="delta-toggle" on:click={() => { open = !open }}>
  Session Summaries{deltas.length > 0 ? ` (${deltas.length})` : ''} {open ? '▲' : '▼'}
</button>

{#if open}
  {#if deltas.length === 0}
    <div class="delta-empty">No delta history yet. Upload scores to start tracking.</div>
  {:else}
    <div class="delta-nav">
      <button
        class="nav-btn"
        on:click={() => { currentIndex = Math.max(0, currentIndex - 1) }}
        disabled={currentIndex <= 0}
      >◀</button>

      <span class="delta-label">
        {currentIndex + 1} / {deltas.length}
        {#if currentDelta} — {formatTimestamp(currentDelta.timestamp)}{/if}
      </span>

      <button
        class="nav-btn"
        on:click={() => { currentIndex = Math.min(deltas.length - 1, currentIndex + 1) }}
        disabled={currentIndex >= deltas.length - 1}
      >▶</button>
    </div>

    {#if currentDelta}
      <div class="delta-summary">
        {totalPlays} play{totalPlays !== 1 ? 's' : ''} · {rows.length} song{rows.length !== 1 ? 's' : ''}
        {#if sessionPlayTimeSeconds > 0} · {formatHours(sessionPlayTimeSeconds)}{/if}
        {#if totalUpscores > 0}<span class="stat-good"> · Upscores: {totalUpscores}</span>{/if}
        {#if newBadges > 0}<span class="stat-good"> · New Badges: {newBadges}</span>{/if}
        {#if newDojoBadges > 0}<span class="stat-good"> · New Dojo Badges: {newDojoBadges}</span>{/if}
        {#if newFCs > 0}<span class="stat-good"> · New FCs: {newFCs}</span>{/if}
        {#if newDFCs > 0}<span class="stat-good"> · New DFCs: {newDFCs}</span>{/if}
      </div>

      {#if rows.length === 0}
        <div class="delta-empty">No songs were played in this session.</div>
      {:else}
        <div class="table-scroll-wrapper">
          <table class="delta-table">
            <thead>
              <tr>
                <th class="sortable" class:sorted={sortKey === 'title'} on:click={() => toggleSort('title')}>Song {sortKey === 'title' ? (sortDir === -1 ? '▼' : '▲') : ''}</th>
                <th class="sortable" class:sorted={sortKey === 'difficulty'} on:click={() => toggleSort('difficulty')}>Diff {sortKey === 'difficulty' ? (sortDir === -1 ? '▼' : '▲') : ''}</th>
                <th class="sortable" class:sorted={sortKey === 'level'} on:click={() => toggleSort('level')}>Level {sortKey === 'level' ? (sortDir === -1 ? '▼' : '▲') : ''}</th>
                <th class="sortable" class:sorted={sortKey === 'danIdx'} on:click={() => toggleSort('danIdx')}>Dan {sortKey === 'danIdx' ? (sortDir === -1 ? '▼' : '▲') : ''}</th>
                <th class="sortable" class:sorted={sortKey === 'badge'} on:click={() => toggleSort('badge')}>Badge {sortKey === 'badge' ? (sortDir === -1 ? '▼' : '▲') : ''}</th>
                <th class="sortable" class:sorted={sortKey === 'score'} on:click={() => toggleSort('score')}>Score {sortKey === 'score' ? (sortDir === -1 ? '▼' : '▲') : ''}</th>
                <th class="sortable" class:sorted={sortKey === 'good'} on:click={() => toggleSort('good')}>Goods {sortKey === 'good' ? (sortDir === -1 ? '▼' : '▲') : ''}</th>
                <th class="sortable" class:sorted={sortKey === 'ok'} on:click={() => toggleSort('ok')}>Okays {sortKey === 'ok' ? (sortDir === -1 ? '▼' : '▲') : ''}</th>
                <th class="sortable" class:sorted={sortKey === 'bad'} on:click={() => toggleSort('bad')}>Bads {sortKey === 'bad' ? (sortDir === -1 ? '▼' : '▲') : ''}</th>
                <th class="sortable" class:sorted={sortKey === 'roll'} on:click={() => toggleSort('roll')}>Rolls {sortKey === 'roll' ? (sortDir === -1 ? '▼' : '▲') : ''}</th>
                <th class="sortable" class:sorted={sortKey === 'play'} on:click={() => toggleSort('play')}>Plays {sortKey === 'play' ? (sortDir === -1 ? '▼' : '▲') : ''}</th>
                <th class="sortable" class:sorted={sortKey === 'fc'} on:click={() => toggleSort('fc')}>FC {sortKey === 'fc' ? (sortDir === -1 ? '▼' : '▲') : ''}</th>
                <th class="sortable" class:sorted={sortKey === 'dfc'} on:click={() => toggleSort('dfc')}>DFC {sortKey === 'dfc' ? (sortDir === -1 ? '▼' : '▲') : ''}</th>
              </tr>
            </thead>
            <tbody>
              {#each rows as row (row.songNo + ':' + row.difficulty)}
                <tr>
                  <td class="td-name">
                    <a
                      href={`https://donderhiroba.jp/score_detail.php?song_no=${row.songNo}&level=${row.difficulty === 'oni' ? 4 : 5}`}
                      target="_blank"
                      rel="noreferrer"
                    >({row.songNo}) {row.title}</a>
                  </td>
                  <td>{row.difficulty}</td>
                  <td>{formatLevel(analyzer?.getLevelWidthSub(row.songNo, getDifficultyType(row.difficulty)) ?? 0)}</td>
                  <td class="td-dan">
                    <span>{getDanName(row.after.danIdx)}</span>
                    {#if row.diff.danIdx !== 0}
                      <span class={diffClass(row.diff.danIdx, true)}>
                        {row.diff.danIdx > 0 ? '▲' : '▼'}
                      </span>
                    {/if}
                  </td>
                  <td class="td-badge">
                    <img
                      class="badge-icon"
                      src={getBadgeIcon(row.after.badge)}
                      alt={BADGE_NAMES[row.after.badge] ?? ''}
                      title={BADGE_NAMES[row.after.badge] ?? ''}
                    />
                    {#if row.diff.badge !== 0}
                      <span class={diffClass(row.diff.badge, true)}>
                        {row.diff.badge > 0 ? '▲' : '▼'}
                      </span>
                    {/if}
                  </td>
                  <td>
                    <span class="abs">{row.after.score}</span>
                    <span class={diffClass(row.diff.score, true)}>{fmtDiff(row.diff.score)}</span>
                  </td>
                  <td>
                    <span class="abs">{row.after.good}</span>
                    <span class={diffClass(row.diff.good, true)}>{fmtDiff(row.diff.good)}</span>
                  </td>
                  <td>
                    <span class="abs">{row.after.ok}</span>
                    <span class={diffClass(row.diff.ok, false)}>{fmtDiff(row.diff.ok)}</span>
                  </td>
                  <td>
                    <span class="abs">{row.after.bad}</span>
                    <span class={diffClass(row.diff.bad, false)}>{fmtDiff(row.diff.bad)}</span>
                  </td>
                  <td>
                    <span class="abs">{row.after.roll}</span>
                    <span class={diffClass(row.diff.roll, true)}>{fmtDiff(row.diff.roll)}</span>
                  </td>
                  <td>
                    <span class="abs">{row.after.play}</span>
                    <span class="neutral">{fmtDiff(row.diff.play)}</span>
                  </td>
                  <td>
                    <span class="abs">{row.after.fc}</span>
                    <span class={diffClass(row.diff.fc, true)}>{fmtDiff(row.diff.fc)}</span>
                  </td>
                  <td>
                    <span class="abs">{row.after.dfc}</span>
                    <span class={diffClass(row.diff.dfc, true)}>{fmtDiff(row.diff.dfc)}</span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    {/if}
  {/if}
{/if}

<style>
  .delta-toggle {
    margin-top: 10px;
  }

  .delta-nav {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 6px 0;
  }

  .nav-btn {
    min-width: 2rem;
    font-size: 1rem;
  }

  .nav-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .delta-label {
    font-size: 0.9rem;
    color: #ccc;
  }

  .delta-summary {
    font-size: 0.85rem;
    color: #aaa;
    margin-bottom: 4px;
  }

  .stat-good {
    color: #4ade80;
  }

  .delta-table thead th.sortable {
    cursor: pointer;
    user-select: none;
  }

  .delta-table thead th.sortable:hover {
    background: #2d2d2d;
  }

  .delta-table thead th.sorted {
    color: #9ec5ff;
  }

  .delta-empty {
    color: #888;
    font-size: 0.9rem;
    margin: 6px 0;
  }

  .table-scroll-wrapper {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .delta-table {
    width: max-content;
    margin: 0 auto;
    border: 1px solid black;
    border-collapse: collapse;
    color: #f0f0f0;
    font-size: 0.9rem;
  }

  .delta-table th,
  .delta-table td {
    border: 1px solid #444;
    padding: 4px 8px;
    text-align: center;
    white-space: nowrap;
  }

  .delta-table thead th {
    background: #1e1e1e;
    font-weight: bold;
  }

  .delta-table tbody tr:nth-child(odd) {
    background-color: #2b2b2b;
  }

  .delta-table tbody tr:nth-child(even) {
    background-color: #242424;
  }

  .td-name {
    text-align: left;
    max-width: 260px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .td-name a {
    color: #9ec5ff;
    text-decoration: none;
  }

  .td-name a:hover {
    text-decoration: underline;
  }

  .td-badge {
    white-space: nowrap;
  }

  .badge-icon {
    width: 20px;
    height: 20px;
    vertical-align: middle;
  }

  /* Each cell shows absolute value + diff on two lines */
  td span {
    display: block;
    line-height: 1.3;
  }

  .abs {
    color: #ccc;
    font-size: 0.78rem;
  }

  .improved {
    color: #4ade80;
    font-weight: bold;
  }

  .regressed {
    color: #f87171;
    font-weight: bold;
  }

  .neutral {
    color: #93c5fd;
    font-weight: bold;
  }
</style>
