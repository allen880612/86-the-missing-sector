# 軍團特殊機型三欄候選

- 輸出：`assets/legion-specialists.png`
- 生成方式：內建 imagegen，單次生成
- 引用圖：`.playwright-mcp/battle-filtered-1280.png`、`official-eintagsfliege.jpg`、`official-mine.jpg`、`images/02-legion-overview.png`
- 尺寸：1536×1024，RGB 純綠幕；三欄等寬，無透明 alpha
- 欄序：左 Skorpion 長距砲兵；中 Eintagsfliege 干擾機；右自走地雷人形機器人
- 實際檢視：三欄順序正確，三者皆朝畫面下方，未跨欄；Skorpion 炮管與背板清楚，Eintagsfliege 為單隻蝶狀機，自走地雷為兩足人形機器人。

## Prompt

Use case: stylized-concept. Asset type: 3-column specialist enemy sprite atlas for a serious military mecha battle game. Create exactly three equal-width vertical columns on one perfectly uniform pure chroma green #00FF00 background. Each column contains exactly one complete isolated machine with generous green margins; no overlap across columns, no text, no labels, no UI, no effects, no shadows outside objects. All three use restrained cold steel blue-gray military materials compatible with the supplied units-86 and battle references, with reduced tiny details and reduced bright rim highlights so silhouettes remain readable at 40–80px. All machines are viewed from near top-down with slight 3/4 perspective, oriented straight toward the bottom edge of the image, no diagonal 45-degree composition.

Left column: Skorpion long-range artillery specialist, multi-legged low vehicle, a very long cannon barrel pointing straight downward, one tall upright armored plate on its back, compact rear fire-control body; do not invent a precise official leg count because the reference is indirect. Middle column: one single Eintagsfliege metal butterfly-like electronic jammer, thin wing panels and central body, small flying machine silhouette, no swarm. Right column: one self-propelled mine humanoid robot, two legs, compact torso filled with mechanical components, simple arms, non-graphic and non-bloody, viewed as a solid machine from above with its forward direction toward the bottom. Make the three silhouettes unmistakably distinct: artillery, flying butterfly jammer, humanoid mine. Preserve vertical alignment and equal column spacing. This is a candidate game atlas and is not claimed to be an official model sheet.

限制：不得視為官方模型定稿；需由主程式以綠幕 key 使用，未修改程式。

主Agent整合：已按三欄key、切割並以13張sprites/rigs驗證；砲兵獨立長砲/足部，干擾機群使用實際蝶形sprite，地雷使用兩足步態。專用QA畫面保存specialist-fire-support.png與specialist-mines.png。地雷頭部外形與俯視程度仍有改編差異，不標為官方正確還原。
