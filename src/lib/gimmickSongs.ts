/**
 * Manually maintained list of "gimmick" song numbers.
 *
 * A gimmick song is one whose chart contains unusual mechanics that make
 * raw score comparisons misleading (e.g. hidden notes, BPM tricks,
 * balloon-heavy charts, etc.).
 *
 * Add or remove song numbers (as strings) here as needed.
 * Song numbers appear in donderhiroba URLs:
 *   https://donderhiroba.jp/score_detail.php?song_no=<songNo>
 *
 * Example:
 *   '1234', // My Gimmick Song Title
 */
const GIMMICK_SONG_NOS: string[] = [
  // Add song numbers here, e.g.:
  '1134', // Aleph-0
  '1297', // SAVAGE DELIGHT
  '181', // 80ROCHI
]

export const gimmickSongSet = new Set<string>(GIMMICK_SONG_NOS)

export const isGimmickSong = (songNo: string): boolean =>
  gimmickSongSet.has(songNo)
