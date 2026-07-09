<script lang="ts">
  import { onMount } from 'svelte'
  import Button from '../components/Common/Button.svelte'
  import { images } from '../assets'
  import TotalScorePanel from '../components/Common/TotalScorePanel.svelte'
  import { getDanImageURL, getDonderAvatarURL, parseDonderInfo, updateDonderInfo } from '../lib/donder'
  import type { DifficultyType, DonderInfo } from '../types'
  import type { SettingsStorage } from '../lib/settings'

  export let settingsStorage: SettingsStorage

  let donderInfo: DonderInfo = {}
  let donderAvatarURL = images.mydonPlaceholderImage
  let danImageURL = ''

  const parseTopPage = async (): Promise<void> => {
    try {
      const url = 'https://donderhiroba.jp/mypage_top.php'
      const res = await fetch(url)
      const text = await res.text()
      const doc = new DOMParser().parseFromString(text, 'text/html')
      const donderInfo = parseDonderInfo(doc)
      await updateDonderInfo(donderInfo)
    } catch (e) {
      console.error(e)
    }
  }

  onMount(async () => {
    await parseTopPage()

    if (settingsStorage?.donderInfo === undefined) {
      return
    }
    donderInfo = settingsStorage.donderInfo

    const difficulties: DifficultyType[] = []
    difficulties.push(settingsStorage.preferringDifficulty)
    if (settingsStorage.preferringDifficulty === 'oni') {
      difficulties.push('oni_ura')
    }

    const img = new Image()
    img.onload = () => { donderAvatarURL = img.src }
    img.src = getDonderAvatarURL(donderInfo.id)
    danImageURL = getDanImageURL(donderInfo.id)
  })
</script>

<div class="wrapper">
  <div class="donder-info" style={`background-image: url(${images.titlePlate})`}>
    <div style="height: 20px;text-align: center;position:relative;z-index:1;font-weight: bold;text-shadow: 0 0 0px #000;">
      {donderInfo?.title ?? ''}
    </div>
    <div style="width:270px;height:23px;margin-left:10px;margin-right:10px;text-align:center;position:relative;z-index:1;display:flex;">
      <div style="width:135px;text-align:center;font-weight: bold;font-size: 12px;text-shadow: 0 0 0px #000;margin-top: 3px;">
        {donderInfo?.name ?? ''}
      </div>
      <div style="width:135px;text-align:center">
        <img src={danImageURL} style="height:21px;margin:1px 0;" alt="danlabel">
      </div>
    </div>
  </div>

  <img class="avatar-image" src={donderAvatarURL} alt="avatar" />

  <TotalScorePanel
    badgeCounts={donderInfo?.badgeCounts ?? {}}
    crownCounts={{
      silver:      donderInfo?.crownCounts?.silver      ?? 0,
      gold:        donderInfo?.crownCounts?.gold        ?? 0,
      donderfull:  donderInfo?.crownCounts?.donderfull  ?? 0,
    }}
  />

  <div class="hiroba-link-buttons">
    <a href="https://donderhiroba.jp/mypage_top.php" target="_blank">
      <Button>Home</Button>
    </a>
    <a href="https://donderhiroba.jp/history_mynews.php" target="_blank">
      <Button>History</Button>
    </a>
    <a href="https://donderhiroba.jp/score_list.php" target="_blank">
      <Button>Score</Button>
    </a>
    <a href="https://donderhiroba.jp/favorite_song_select.php?init=1" target="_blank">
      <Button>Favorite</Button>
    </a>
    <a href="https://donderhiroba.jp/mypage_other_setting.php" target="_blank">
      <Button>Settings</Button>
    </a>
  </div>
</div>

<style>
  .wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .donder-info {
    width: 290px;
    height: 46px;
    margin-top: 8px;
    background-size: contain;
    background-repeat: no-repeat;
    padding-top: 2px;
  }

  .avatar-image {
    width: 60%;
    height: auto;
    padding: 12px 0px;
  }

  .hiroba-link-buttons {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    width: 60%;
    justify-content: center;
  }
</style>
