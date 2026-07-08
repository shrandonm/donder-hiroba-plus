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

  $: rows = currentDelta
    ? Object.values(currentDelta.changes).sort((a, b) => b.diff.play - a.diff.play)
    : []

  $: sessionPlayTimeSeconds = rows.reduce((acc, row) => {
    const duration = analyzer?.getSongDuration(row.songNo, getDifficultyType(row.difficulty)) ?? 0
    return acc + duration * row.diff.play
  }, 0)

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
        {rows.length} song{rows.length !== 1 ? 's' : ''} played this session
        {#if sessionPlayTimeSeconds > 0}
          · {formatHours(sessionPlayTimeSeconds)}
        {/if}
      </div>

      {#if rows.length === 0}
        <div class="delta-empty">No songs were played in this session.</div>
      {:else}
        <div class="table-scroll-wrapper">
          <table class="delta-table">
            <thead>
              <tr>
                <th>Song</th>
                <th>Diff</th>
                <th>Level</th>
                <th>Dan</th>
                <th>Badge</th>
                <th>Score</th>
                <th>Goods</th>
                <th>Okays</th>
                <th>Bads</th>
                <th>Rolls</th>
                <th>Plays</th>
                <th>FC</th>
                <th>DFC</th>
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
