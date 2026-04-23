/**
 * Manually maintained list of song numbers that are no longer available
 * (removed from the arcade, region-locked, etc.).
 *
 * Add or remove song numbers (as strings) here as needed.
 * Song numbers appear in donderhiroba URLs:
 *   https://donderhiroba.jp/score_detail.php?song_no=<songNo>
 *
 * Example:
 *   '1234', // Song Title — reason for unavailability
 */
const UNAVAILABLE_SONG_NOS: string[] = [
  // Add song numbers here, e.g.:
  '1196', // La MORENA KUMONAI
]

export const unavailableSongSet = new Set<string>(UNAVAILABLE_SONG_NOS)

export const isUnavailableSong = (songNo: string): boolean =>
  unavailableSongSet.has(songNo)
