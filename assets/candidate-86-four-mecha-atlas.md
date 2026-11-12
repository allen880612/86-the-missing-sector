# 86 四機型戰鬥視角候選圖集

- 檔案：[candidate-86-four-mecha-atlas.png](candidate-86-four-mecha-atlas.png)
- 生成方式：內建 imagegen；單次生成
- 輸出尺寸：1254×1254 PNG；工具檢測為 RGB，並非可直接使用的 alpha PNG。預覽呈現透明棋盤格，但仍須由主 Agent 驗證實際像素；若棋盤格已烘焙，需重新生成透明版本，不能直接進遊戲。
- 版面：2×2，四格留白，無文字、無特效；每個模型未越過格間。
- 引用圖：`assets/units-86.png`、`official-dinosauria.jpg`、`official-morpho.jpg`、`official-xm2.jpg`、`official-m4a3.jpg`
- 原始生成檔：`/Users/wei/.codex/generated_images/01a07d69-d2eb-72a1-8496-628bfcbeb715/exec-2d2ec7f4-2862-4ef3-bf09-ab1378e8044f.png`
- 修正版輸出：[mecha-86-production.png](mecha-86-production.png)；背景改為純綠幕、上下排方向已統一，但仍是 RGB 候選，須由主 Agent 以 chroma-key 實機檢查邊緣。

## 主 Agent 審核重點

- 左上 M4A3：厚重四足與長砲清楚，輪廓和既有軍用銀藍材質相容。
- 右上 XM2：四足、輕裝、刀臂輪廓清楚；刀臂呈前伸／下折姿態。
- 左下 Dinosauria：重型長砲與多足平台成立；請逐足確認是否確實為八足，再決定是否採用。
- 右下 Morpho：超長前向軌道砲與顯著散熱脊成立；支撐足數需再按官方設定核對。
- 四者都是新候選，不替換 `assets/units-86.png`，也未修改 `game.js`。

## 生成提示

使用既有 `units-86.png` 作為銀藍軍用寫實材質與 3/4 俯視朝上戰鬥語言參考，官方 Dinosauria、Morpho、XM2、M4A3 僅作輪廓與裝備關係參考；生成 2×2 透明背景圖集：左上厚重四足 M4A3，右上輕裝四足刀臂 XM2，左下八足重戰車 Dinosauria 長砲，右下極長軌道砲與散熱脊多足 Morpho。四格留白、單格不越界、無文字、無 UI、無特效、冷灰銀藍軍用金屬、四種輪廓必須明顯不同。
