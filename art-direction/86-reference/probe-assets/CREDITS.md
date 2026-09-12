# S49 素材可行性實測（非遊戲定版素材）

- Kenney City Kit Industrial 2.0，CC0：https://kenney.nl/assets/city-kit-industrial 。只取 building-a、shipping-container-a、water-tower 與外部 colormap；完整授權見 kenney-license.txt。GLB 並非全部貼圖內嵌。
- Poly Haven Industrial Sunset 02，1K HDR，CC0：https://polyhaven.com/a/industrial_sunset_02 。用於隔離的環境反射對照，不作原作場景。
- Babylon glTF2 loader 9.26.0，Apache-2.0，官方 npm babylonjs-loaders，同版既有 runtime。見 babylon-license.md。
- 原作機型圖沿用本研究庫 official-xm2.jpg 與 official-ameise.jpg，來源與用途見 allies.md／legion.md；不包含在下載的通用模型授權內。

## S51 86 機體本地研究集

來源：https://github.com/Taliayaya/Project-86 ，根授權 GPL-3.0；本地研究轉檔，未公開部署。本次目標資產的來源、作者與SHA見 ../project-86-reuse-audit.md。原始檔保存在 /private/tmp/s51-project86-ameise/ 與 /private/tmp/s51-project86-juggernaut/；自己的處理腳本在本目錄 s51-*.py，依該暫存路徑可重跑。執行環境為官方 Blender 4.5.13 LTS，只掛載到 /private/tmp/s51-blender-mount，未安裝到 Applications，未導入 MCP。

- Ameise：BricksA9，模型／色彩／法線來源見上列稽核。保留網格與蒙皮，縮至測試寬度 4.8，貼圖縮至 2K，重建暫定 metallic .48／roughness .42。測試寬度不是原作尺寸主張。
- Juggernaut：Project-86 release 歸屬 ExcalibursBlad 的模型／貼圖、Anto 的多邊形最佳化。保留剛性關節階層與網格，貼圖縮至 2K，重建同樣材質基準。
- 兩個 GLB 的 DIAGNOSTIC_front_leg_articulation 都由本次腳本新增，只是前足關節測試，非原作者步行動畫。兩檔實際缺少 walk／run／recoil clip。
- GLB 不依賴外部貼圖；解析結果見 s51-glb-audit.json。尚未做 LOD、批次渲染、足鎖、IK 或戰鬥植入。對外散布狀態與本地研究應分開管理。
