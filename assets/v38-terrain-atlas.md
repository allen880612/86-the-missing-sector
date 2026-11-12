# v38 地形材質

由內建 imagegen 生成，用於 Canvas 材質裁切；不是原作精確還原或遊戲畫面截圖。

固定四象限：左上磨損瀝青、右上混凝土屋頂、左下軍需金屬屋頂、右下鐵路道床。使用 naturalWidth / 2 決定分格，不依固定來源解析度。屋頂填入 core 的真矩形 footprint，視覺高度 12 px，地面快取 1536 × 1536、僅保留目前地圖 9 MiB。

生成提示：Production-ready square 2D top-down texture atlas, four equal quadrants, orthographic straight overhead, worn cold charcoal asphalt / reinforced concrete roof with flush grilles and service hatches / military depot standing-seam metal roof / railway crushed stone ballast. Muted cold gray-blue, crisp understated microstructure, no perspective, no text, no UI, no external building outlines, no trees, no mechs.

生成模式：全新生成，未使用外部圖片輸入。原始檔保留在 Codex generated_images；專案使用本目錄 PNG。
