<script lang="ts">
  import { images } from '../../assets'

  // badgeCounts keyed by badge number (2=white … 8=rainbow), matching donderInfo.badgeCounts
  export let badgeCounts: Partial<Record<number, number>>
  export let crownCounts: { silver: number; gold: number; donderfull: number }
</script>

<div class="total-score" style={`background-image: url(${images.totalScorePanelOniImage})`}>
  <span class="total-score-text"         style="transform: translate(220px, 18px);">{badgeCounts[8] ?? 0}</span>

  <span class="total-score-text"         style="transform: translate(56px,  52px);">{badgeCounts[5] ?? 0}</span>
  <span class="total-score-text"         style="transform: translate(138px, 52px);">{badgeCounts[6] ?? 0}</span>
  <span class="total-score-text"         style="transform: translate(220px, 52px);">{badgeCounts[7] ?? 0}</span>
  <span class="total-score-text"         style="transform: translate(56px,  84px);">{badgeCounts[2] ?? 0}</span>
  <span class="total-score-text"         style="transform: translate(138px, 84px);">{badgeCounts[3] ?? 0}</span>
  <span class="total-score-text"         style="transform: translate(220px, 84px);">{badgeCounts[4] ?? 0}</span>

  <span class="total-score-text crown"   style="transform: translate(56px,  122px);"> {crownCounts.silver}</span>
  <span class="total-score-text crown"   style="transform: translate(138px, 122px);"> {crownCounts.gold}</span>
  <span class="total-score-text crown"   style="transform: translate(220px, 122px);"> {crownCounts.donderfull}</span>
</div>

<style>
  .total-score {
    background-repeat: no-repeat;
    background-size: contain;
    height: 170px;
    width: 280px;
    text-align: left;
  }

  .total-score-text {
    position: absolute;
    font-weight: bold;
    color: white;
  }

  .total-score-text.crown {
    color: black;
  }
</style>
