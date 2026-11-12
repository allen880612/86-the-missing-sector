# 補給模組 2×3 圖集

- 輸出：[supply-modules.png](supply-modules.png)
- 生成方式：內建 imagegen，單次生成
- 引用圖：`assets/units-86.png`、`assets/dinosauria-turret.png`
- 尺寸：1254×1254 PNG，RGB 純綠幕，非透明
- 格線：2 欄 × 3 列，六格完整留白，未跨格
- 實際核對順序：
  - 第一列：左 AP 銀色尖頭彈匣；右 HE 銅色鈍頭彈匣
  - 第二列：左青色微光戰術電源電容；右冷灰裝甲板組
  - 第三列：左工具箱與白色十字；右鏡頭／晶片火控感測模組
- 用途：實際路上補給與小卡插畫候選，不是概念主視覺；未修改 `game.js`。

## Prompt

Use case: stylized-concept. Asset type: six supply module illustrations for a military mecha game, arranged as one exact 2-column by 3-row atlas. Use a perfectly uniform pure chroma green #00FF00 background filling all empty pixels. Exactly one complete object per cell, each centered, occupying about 65–75% of its cell, with generous green gutters; no object crosses cell boundaries. Low 3/4 top-down view, cold steel blue military hard-surface material matching the supplied references, moderate highlights readable at 30–60px, limited tiny screws, no rainbow neon, no treasure chests, no coins, no UI frames, no labels, no text, no cast shadows crossing gutters.

Grid order must be exact: top-left AP silver pointed armor-piercing ammunition magazine; top-right HE copper blunt-nose grenade ammunition magazine. Middle-left tactical power capacitor module with restrained cyan indicator glow; middle-right cold-gray armor plate replacement module. Bottom-left repair toolbox with visible tools and one small white cross; bottom-right fire-control sensor module with a lens and a compact circuit-board housing. These are physical field-supply objects and small card illustrations, not a concept key visual. Keep every cell visually distinct and vertically aligned.

限制：RGB 綠幕供 runtime 去背；不得視為透明 PNG 或正式模型資產。
