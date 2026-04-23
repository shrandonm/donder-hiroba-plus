import { PlaylistsStore } from '../lib/playlist'
import PlaylistContextMenu from '../components/Common/PlaylistContextMenu.svelte'
import RecentScoreStorage from '../components/Rating/recentScoreStorage'
import type { Difficulty } from 'node-hiroba/types'
import { isGimmickSong } from '../lib/gimmickSongs'
import { isUnavailableSong } from '../lib/unavailableSongs'

const PLAYLIST_OUTLINE_CLASS = 'hiroba-playlist-outline'
const PLAYLIST_OUTLINE_STYLE_ID = 'hiroba-playlist-outline-style'
const GIMMICK_BADGE_CLASS = 'hiroba-gimmick-badge'
const GIMMICK_STYLE_ID = 'hiroba-gimmick-style'
const UNAVAILABLE_BADGE_CLASS = 'hiroba-unavailable-badge'
const UNAVAILABLE_STYLE_ID = 'hiroba-unavailable-style'

const isDiffchartPage = (): boolean => {
  return location.pathname.toLowerCase().includes('diffchart')
}

const getSongNoFromLink = (linkElem: HTMLAnchorElement): string | null => {
  try {
    const url = new URL(linkElem.href, location.origin)
    if (url.origin !== 'https://taiko.wiki' || !url.pathname.startsWith('/song/')) {
      return null
    }

    return url.pathname.match(/\/song\/(\d+)/)?.[1] ?? null
  } catch {
    return null
  }
}

const ensurePlaylistOutlineStyle = (): void => {
  if (document.getElementById(PLAYLIST_OUTLINE_STYLE_ID) !== null) return

  const style = document.createElement('style')
  style.id = PLAYLIST_OUTLINE_STYLE_ID
  style.textContent = `
    a.${PLAYLIST_OUTLINE_CLASS} {
      outline: 4px solid #22c55e !important;
      outline-offset: 2px;
      border-radius: 4px;
    }
  `
  document.head.appendChild(style)
}

const updatePlaylistOutlines = (playlistsStore: PlaylistsStore): void => {
  const links = document.querySelectorAll<HTMLAnchorElement>('a[href*="/song/"]')
  if (!isDiffchartPage()) {
    for (const link of links) {
      link.classList.remove(PLAYLIST_OUTLINE_CLASS)
    }
    return
  }

  ensurePlaylistOutlineStyle()
  const playlistSongSet = new Set(playlistsStore.get().flatMap(x => x.songNoList))
  for (const link of links) {
    const songNo = getSongNoFromLink(link)
    link.classList.toggle(PLAYLIST_OUTLINE_CLASS, songNo !== null && playlistSongSet.has(songNo))
  }
}

const ensureGimmickStyle = (): void => {
  if (document.getElementById(GIMMICK_STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = GIMMICK_STYLE_ID
  style.textContent = `
    .${GIMMICK_BADGE_CLASS} {
      color: #e879f9;
      font-size: 1.1em;
      font-weight: bold;
      margin-right: 4px;
      vertical-align: middle;
      pointer-events: none;
      text-shadow: 0 0 6px #e879f9, 0 0 12px #c026d3;
    }
  `
  document.head.appendChild(style)
}

const updateGimmickBadges = (): void => {
  if (!isDiffchartPage()) return
  ensureGimmickStyle()
  const links = document.querySelectorAll<HTMLAnchorElement>('a[href*="/song/"]')
  for (const link of links) {
    const songNo = getSongNoFromLink(link)
    if (songNo === null) continue
    const existing = link.querySelector(`.${GIMMICK_BADGE_CLASS}`)
    if (isGimmickSong(songNo)) {
      if (existing === null) {
        const badge = document.createElement('span')
        badge.className = GIMMICK_BADGE_CLASS
        badge.textContent = '\u2726'
        badge.title = 'Gimmick song'
        link.prepend(badge)
      }
    } else {
      existing?.remove()
    }
  }
}

const ensureUnavailableStyle = (): void => {
  if (document.getElementById(UNAVAILABLE_STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = UNAVAILABLE_STYLE_ID
  style.textContent = `
    a.${UNAVAILABLE_BADGE_CLASS}-link {
      color: #f87171 !important;
      text-decoration: line-through !important;
      opacity: 0.75;
    }
    .${UNAVAILABLE_BADGE_CLASS} {
      color: #f87171;
      font-size: 1.1em;
      font-weight: bold;
      margin-right: 4px;
      vertical-align: middle;
      pointer-events: none;
      text-decoration: none !important;
      text-shadow: 0 0 6px #f87171, 0 0 12px #dc2626;
    }
  `
  document.head.appendChild(style)
}

const updateUnavailableBadges = (): void => {
  if (!isDiffchartPage()) return
  ensureUnavailableStyle()
  const links = document.querySelectorAll<HTMLAnchorElement>('a[href*="/song/"]')
  for (const link of links) {
    const songNo = getSongNoFromLink(link)
    if (songNo === null) continue
    const existing = link.querySelector(`.${UNAVAILABLE_BADGE_CLASS}`)
    if (isUnavailableSong(songNo)) {
      link.classList.add(`${UNAVAILABLE_BADGE_CLASS}-link`)
      if (existing === null) {
        const badge = document.createElement('span')
        badge.className = UNAVAILABLE_BADGE_CLASS
        badge.textContent = '\u2715'
        badge.title = 'Unavailable'
        link.prepend(badge)
      }
    } else {
      link.classList.remove(`${UNAVAILABLE_BADGE_CLASS}-link`)
      existing?.remove()
    }
  }
}

const insertContextMenu = (playlistsStore: PlaylistsStore, recentScoreStorage: RecentScoreStorage): void => {
  let comp: PlaylistContextMenu

  const removeContextMenu = (): void => {
    comp?.$destroy()
  }

  const contextMenuClick = (ev: Event): void => {
    removeContextMenu()

    const target = ev.target as HTMLElement
    const linkElem = target.closest('a')
    if (linkElem === null) return

    const title = linkElem.querySelector('.title')?.textContent?.trim() || ''

    try {
      const url = new URL(linkElem.href, location.origin)
      if (url.origin !== 'https://taiko.wiki' || !url.pathname.startsWith('/song/')) return
      const songNo = getSongNoFromLink(linkElem)
      if (songNo === null) return

      const diffFromParam = url.searchParams.get('diff')
      let diff: Difficulty = 'oni'; // or another appropriate default value

      if (diffFromParam === 'ura' || diffFromParam === 'oni_ura') diff = 'ura'
      else if (diffFromParam === 'oni') diff = 'oni'
      else if (diffFromParam === 'hard') diff = 'hard'
      else if (diffFromParam === 'normal') diff = 'normal'
      else if (diffFromParam === 'easy') diff = 'easy'

      const mouseEvent = ev as MouseEvent
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      comp = new PlaylistContextMenu({
        target: document.body,
        props: {
          playlists: playlistsStore,
          title: title,
          recentScores: recentScoreStorage,
          difficulty: diff,
          songNo,
          x: mouseEvent.pageX,
          y: mouseEvent.pageY,
          wikiLink: linkElem.href
        }
      })

      ev.preventDefault()
    } catch (e) {
      // invalid url
    }
  }

  // attach context menu
  const links = document.querySelectorAll('a[href^="/song/"]')
  console.log(`Found ${links.length} song links to attach context menu.`)
  for (const link of links) {
    if (link.getAttribute('data-hiroba-extension') === '1') continue
    link.addEventListener('contextmenu', contextMenuClick)
    link.setAttribute('data-hiroba-extension', '1')
  }

  updatePlaylistOutlines(playlistsStore)
  updateGimmickBadges()
  updateUnavailableBadges()

  document.body.addEventListener('click', removeContextMenu)
}

export default async (): Promise<void> => {
  const playlistsStore = await PlaylistsStore.getInstance()
  const recentScoreStore = new RecentScoreStorage()
  await recentScoreStore.loadFromChromeStorage()
  playlistsStore.subscribe(() => {
    updatePlaylistOutlines(playlistsStore)
  })

  const runInterval = () => {
    let executionCount = 0
    const intervalId = setInterval(() => {
      insertContextMenu(playlistsStore, recentScoreStore)
      updateGimmickBadges()
      updateUnavailableBadges()
      executionCount++
      if (executionCount >= 5) {
        clearInterval(intervalId)
      }
    }, 1000)
  }

  runInterval()

  let lastUrl = location.href
  new MutationObserver(() => {
    const url = location.href
    if (url !== lastUrl) {
      lastUrl = url
      runInterval()
    }
  }).observe(document.body, {
    childList: true,
    subtree: true
  })
}
