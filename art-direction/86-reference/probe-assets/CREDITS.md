# S49 素材可行性實測（非遊戲定版素材）

- Kenney City Kit Industrial 2.0，CC0：https://kenney.nl/assets/city-kit-industrial 。只取 building-a、shipping-container-a、water-tower 與外部 colormap；完整授權見 kenney-license.txt。GLB 並非全部貼圖內嵌。
- Poly Haven Industrial Sunset 02，1K HDR，CC0：https://polyhaven.com/a/industrial_sunset_02 。用於隔離的環境反射對照，不作原作場景。
- Babylon glTF2 loader 9.26.0，Apache-2.0，官方 npm babylonjs-loaders，同版既有 runtime。見 babylon-license.md。
- 原作機型圖沿用本研究庫 official-xm2.jpg 與 official-ameise.jpg，來源與用途見 allies.md／legion.md；不包含在下載的通用模型授權內。

## S51 86 機體本地研究集

來源：https://github.com/Taliayaya/Project-86 ，根授權 GPL-3.0；本地研究轉檔，未公開部署。本次目標資產的來源、作者與SHA見 ../project-86-reuse-audit.md。原始檔已由暫存歸檔至專案根 assets/model/project86-source/ameise/ 與 juggernaut/；S51處理腳本尚記有歷史暫存路徑，重跑前須改用上述持久位置，不能依賴暫存仍存在。執行環境為官方 Blender 4.5.13 LTS，只掛載到 /private/tmp/s51-blender-mount，未安裝到 Applications，未導入 MCP。

- Ameise：BricksA9，模型／色彩／法線來源見上列稽核。保留網格與蒙皮，縮至測試寬度 4.8，貼圖縮至 2K，重建暫定 metallic .48／roughness .42。測試寬度不是原作尺寸主張。
- Juggernaut：Project-86 release 歸屬 ExcalibursBlad 的模型／貼圖、Anto 的多邊形最佳化。保留剛性關節階層與網格，貼圖縮至 2K，重建同樣材質基準。
- 兩個 GLB 的 DIAGNOSTIC_front_leg_articulation 都由本次腳本新增，只是前足關節測試，非原作者步行動畫。兩檔實際缺少 walk／run／recoil clip。
- GLB 不依賴外部貼圖；解析結果見 s51-glb-audit.json。尚未做 LOD、批次渲染、足鎖、IK 或戰鬥植入。對外散布狀態與本地研究應分開管理。


## S52 研究資產與限制

- `s52-juggernaut-motion.glb` / `.blend`：在既有 Project-86 M1A4 來源上新增自製 idle／walk／trot／recoil／vault，原作者／GPL 來源承前；僅本地研究，未公開發布。`s52-build-motion.py` 可重建，verification JSON 記錄匯出後量測；QA PNG為 Blender Workbench 姿態檢查，不是遊戲 PBR 畫質證明。
- 玩家提供 Sketchfab Juggernaut：leoxx300，CC BY 4.0；原始下載位於根 `assets/model/`，沒有複製成新授權的自有模型。來源 https://sketchfab.com/3d-models/juggernaut-86-eighty-six-1f4d04b7d1154b63ba27ab21702fcffe 。`s52-sketchfab-inspection.json`含來源、大小、SHA與無骨架結論。
- Babylon glTF 9.26 loader 另複製至 `assets/vendor/babylon-gltf-9.26.0.js`，沿用本庫既有 Apache-2.0 授權記錄。
- S52戰場版本已被使用者否決美術完成度；資料只保留為可動結構研究，不能作產品品質通過的證據。

## S56 持久素材與場景候選

- rocks_ground_08、rubble：Poly Haven CC0，原始圖與manifest位於根 `assets/model/polyhaven/` 對應子目錄；8檔共9,081,586B，逐檔大小／SHA驗證。
- `s56-rail-environment.glb`：沿用CC0 modular_factory_facade、rough_concrete、rusty_metal，另製屋頂、月台等封閉結構。不是官方86場景，也不是已驗收遊戲環境。
- S56構建腳本依賴**工作目錄根** `probe-assets/s54-build-maintenance-bay.py` 與 `probe-assets/s54-structure-textures/`；這與本CREDITS所在的研究子目錄不同，素材總索引有完整路徑。
- 新GLB檔不放進Pages部署；索引和實測圖可查驗，取得素材不代表即時效能合格。

## S57 戰損模型

Fleurman，Destroyed City Assets，CC0，https://opengameart.org/content/destroyed-city-assets 。原始ZIP／FBX保存在根 assets/model/oga-destroyed-city/；s57-destroyed-city-reuse.glb 為本地轉換，重接六張原始嵌入色彩圖，沒有補造normal／roughness；匯入layer警告與尺寸限制見inspection。
