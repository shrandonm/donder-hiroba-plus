import { PlaylistsStore } from '../lib/playlist'
import PlaylistContextMenu from '../components/Common/PlaylistContextMenu.svelte'
import RecentScoreStorage from '../components/Rating/recentScoreStorage'
import type { Difficulty } from 'node-hiroba/types'

const PLAYLIST_OUTLINE_CLASS = 'hiroba-playlist-outline'
const PLAYLIST_OUTLINE_STYLE_ID = 'hiroba-playlist-outline-style'

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
