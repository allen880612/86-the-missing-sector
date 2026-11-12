> **S53 使用者 Review（2026-09-13）**：當前可玩樣板的塑料感、地景、材質、光照與新 UI 不合格。停止以既有 JS 成本優先繼續擴充；下一步按真實美術樣片與素材／場景工作流重新評估，並回用成熟 2D 入口。以下 Godot／Babylon 順位是先前假設，尚未通過同素材實驗。

# 2026-09-12 平台與引擎重新評估（目前決策）

> 使用者要求：輕量、KISS、善用現成系統；不預設必須維持網頁，也不因主流而採用引擎。本節取代下方舊研究的長期選型推論。Babylon 已完成第一個執行樣板，尚未定為正式 3D 製作架構。

> S50 補充：找到 [Project-86](project-86-reuse-audit.md) 的 Unity 6.4 機型、動畫與地圖工程，提高 Unity 素材相容性調查的價值；但 LFS／第三方資產來源與完整性未驗，尚不足以反轉選型。先驗清楚標示 CC BY 的單機候選與 Blender → GLB 流程。

## PO 結論

將正式候選縮到 **Godot 與 Babylon.js**。桌面下載可接受時，優先驗證 Godot 的整合製作流程；開連結即可玩的交付需求優先時，Babylon 仍是有力候選。Unity 保留為具體現成素材／工具能節省大量工作的備選；Unreal 暫不進入實作比較。這是專案適配判斷，不是已測得的效能排名。

網頁是交付平台，遊戲引擎是製作工具，兩者並不互斥。Godot、Unity 都有 Web 匯出，但不能把桌面能力與網頁能力視為完全相同。也不能保證任何匯出包都符合 Pages 單檔 25 MiB，必須檢查真實產物。[Godot Web](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)、[Unity Web](https://docs.unity3d.com/6000.0/Documentation/Manual/webgl-technical-overview.html)、[Pages 限制](https://developers.cloudflare.com/pages/platform/limits/)

|候選|對本案的價值|採用前要驗證|目前順位|
|---|---|---|---|
|Godot|整合場景、碰撞、導航、動畫與音訊／粒子工具；可把更多製作工作放進編輯器|素材重新匯入、多足動畫、AI 修改與可視化編輯的協作、桌面包；Web 有渲染／語言限制|桌面優先候選|
|Babylon.js|瀏覽器原生交付、現有 JS／DOM 可沿用；已有物理、導航、動畫與粒子能力|採用既有系統後是否確實減少自製基礎工具；關卡編輯及美術迭代成本|網頁優先候選|
|Unity|整合工具與可採用的第三方內容；若找到契合機甲遊戲的資產與工具，可能縮短製作|資產是否真正契合、版本依賴、建置與授權成本；不因商店存在就假設能省工|素材驅動備選|
|Unreal|電影演出、Niagara、Control Rig 等工具可處理更高規格內容|本案是否真的需要；UE5 官方封裝清單未列 Web，不能視為靜態網頁方案|暫不採用|

官方依據：[Babylon 系統清單](https://www.babylonjs.com/specifications/)、[Godot 動畫狀態與混合](https://docs.godotengine.org/en/stable/tutorials/animation/animation_tree.html)、[Godot 導航](https://docs.godotengine.org/en/stable/tutorials/navigation/navigation_introduction_3d.html)、[UE 封裝目標](https://dev.epicgames.com/documentation/en-us/unreal-engine/packaging-your-project)。桌面工具與授權細節另存於[桌面引擎比較](engine-desktop-comparison.md)。

## 從實際樣板修正判斷

目前 game-3d-core.js 757 行，包含自製牆體／實體碰撞、分段移動、視線與敵人繞障；game-3d-models.js 376 行，主要為程序化幾何與足部動作；game-3d.js 351 行負責呈現與介面。尚未採用匯入的骨架動畫、物理插件或導航網格。這能驗證操作和場景，不能證明長期素材製作流程成熟。

之前實際遇到刃擊穿牆、砲口與牆高不一致、落牆卡住、重砲自擋等問題，顯示需要評估標準系統能省下多少維護。不能把目前未採用的能力，誤寫成 Babylon 缺少該能力；也不能把戰術、傷害規則和敵人特色等本來就需要自行設計的程式一律視為造輪子。

Babylon 也有[視覺編輯器](https://editor.babylonjs.com/documentation)，不是只能用程式編輯場景，但該編輯器預設專案帶入 Next.js 等工作流，需要一起評估。若堅持網頁又想要瀏覽器場景編輯，可參考 [PlayCanvas Editor](https://developer.playcanvas.com/user-manual/editor/)；其[靜態匯出](https://developer.playcanvas.com/user-manual/editor/projects/downloading/)可自行託管，但可執行匯出包不等於完整可編輯專案歷史，需另評估 Git 與編輯器的來源管理。本輪不因此增加第三個實作候選。

## 下一個 Sprint 的決策門

Story：作為製作者，我能用現成場景、碰撞與動畫工具快速修改一段機甲戰鬥，讓時間投入可見的玩法和美術。

用同一組可利用的 GLB／動畫素材、同一段低牆與高牆、同一敵人繞障和砲擊效果，比較 Godot 與 Babylon 的製作流程；不重建完整遊戲。記錄素材替換與重新匯入、修改牆體後碰撞同步、動畫與砲口事件、編輯到可玩的時間、Git 差異可讀性、可重複建置，以及實際包體／冷啟動與目標 PC 效能。選定後只維護一套正式 3D 路線。

KISS 的衡量是後續每新增一種敵人、一張地圖需要多少工作，不是檔案最少或依賴最少。所有引擎都不會自動提供《86》多足模型、可信步態或有趣的 Boss 行為，素材與美術管線仍是獨立風險。

本輪只完成研究與原碼盤點，未安裝／實測 Godot、Unity 或 Unreal，未遷移 runtime；不能承諾哪個包體最小或跑得最快。保留 2D 定版與 Babylon 樣板作比較基線。

---

> 2026-09-12先前研究：本節保留 POC 選型歷史，長期選型以頁首重新評估為準。下方20–30秒技術測試僅為內部資產門檻；對玩家的可玩樣板另依3d-game-design最新段落。PO已重核Godot stable官方文件。

# 《86》戰線 2.5D／3D 技術美術可行性（2026-09-12）

## 決策摘要

**第一個 POC 選 Babylon.js，維持 PC 瀏覽器、Cloudflare Pages Free、固定斜俯視與單機甲直接操作。** Babylon.js 與 Three.js 都能產出純靜態 HTML／JS／GLB 並部署 Pages；Babylon 的優勢不是畫質上限，而是把 glTF、動畫、PBR、陰影、粒子與場景生命週期放在同一套遊戲向 API，較適合以最少改動接上現有 JavaScript。Three.js 可行且渲染控制高，但本案還要自行組裝更多遊戲層。Godot 也能匯出 Web，但需將現有 JS／DOM／Canvas 架構移植到 Scene／Node 專案；網頁只支援 WebGL 2 Compatibility，預設單執行緒雖較相容但效能較低，因此不適合作為第一個風險驗證。

不應承諾「AAA 品質」。目前可證明的是有足夠的環境、材質、VFX 與替身機甲做灰盒；尚未證明任何《86》精準機型是可直接量產的 rigged GLB。真正排程風險依序是：機體拆件／拓撲、多足 rig 與動畫、LOD／貼圖預算、遮擋可讀性、同屏動畫與透明粒子效能、原作權利。

## 已確認

- 現行根目錄 `game.js` 使用 `canvas.getContext('2d')`；`game-arena-core.js（四向）／game-core.js（直線）` 的玩法真值、DOM HUD、輸入與音訊契約可保留，3D 場景只消費 snapshot／event，避免改動已認可平衡。
- 限定本專案資料夾，以 `.glb/.gltf/.fbx/.obj/.dae/.blend/.usd/.usdz/.vrm` 搜尋，**沒有找到本地 3D 模型**。現有 2D sprite、預覽圖與研究圖不能算可玩 3D 資產。
- Cloudflare Pages 可承載三種方案的靜態輸出；Free 限每站 20,000 檔、單一資產 25 MiB，靜態資產請求免費且不限次數。這表示模型與貼圖需壓縮／拆分，不能把大型高模原檔直接上線。[Pages limits](https://developers.cloudflare.com/pages/platform/limits/)；[Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/)
- Three.js 官方明示可用 npm＋build 產生可靜態託管的 `dist`，亦可直接 CDN；官方推薦 glTF／GLB，支援 mesh、PBR 材質、skin、skeleton 與 animation。[Installation](https://threejs.org/manual/en/installation.html)；[Loading 3D Models](https://threejs.org/manual/en/loading-3d-models.html)
- Babylon.js 提供 npm／ES modules，官方 CDN 僅建議學習或小型實驗，正式環境應固定版本並自行託管套件／解碼器；因此部署 Pages 可行，但 POC 也應測自託管完整性。[Babylon.js README](https://github.com/BabylonJS/Babylon.js/blob/master/readme.md)；[Babylon CDN guidance](https://github.com/BabylonJS/Documentation/blob/master/content/setup/frameworkPackages/CDN.md)
- Godot Web export 需要 WebAssembly 與 WebGL 2；Godot 4 Web 只支援 Compatibility renderer，不支援 Forward+／Mobile／WebGPU。4.3 起單執行緒為預設，免 COOP／COEP，但官方明示效能較低；多執行緒則要求完整跨來源隔離。C# 專案目前不能匯出 Web。[Godot Web export](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)

## 方案比較與最大瓶頸

|方案|Pages 靜態部署|保住既有成本|最大現實瓶頸|判定|
|---|---|---|---|---|
|Babylon.js|可；build 後 JS／WASM／GLB／貼圖皆為靜態檔|高：JS 規則、DOM UI、音訊、2D 通訊與操作意圖可漸進保留|仍需自行生產可信多足 rig／動畫與資產 LOD；陰影、透明粒子、骨架更新需實測|**第一 POC**|
|Three.js|可；官方明示 build 的 `dist` 可靜態託管|高|基礎 renderer 之外，動畫狀態、碰撞、資產生命週期、效能工具與後處理組合責任較多|第二選項；適合已決定高度客製 renderer 時|
|Godot 4 Web|可；匯出 HTML/WASM/PCK 靜態檔，但每檔仍受 25 MiB|低：需移植 JS／DOM／專案結構；同一 GLB 美術可重用|Web 只有 Compatibility renderer；單執行緒效能、WASM/PCK 初載與整體移植成本|先不選；若桌面原生／編輯器協作成核心需求再重測|

三者都不會替代模型製作，也不會自動解決四足／六足足鎖、砲塔獨立旋轉、武器 socket、部件破壞或前景遮擋。選引擎只能降低接線成本。

## 公開素材：能用與不能推論的界線

可用灰盒來源（2–3 組）：

1. [Quaternius Animated Mech Pack](https://quaternius.com/packs/animatedmech.html)：頁面標 CC0，提供 glTF／FBX／OBJ／Blend 並明示動畫；適合驗 loader、動畫 clip 與 LOD 管線。頁面沒有證明是《86》式多足 rig。
2. [Kenney City Kit Industrial](https://kenney.nl/assets/city-kit-industrial)／[Factory Kit](https://kenney.nl/assets/factory-kit)：CC0 工業環境灰盒；適合道路、廠房、掩體、遮擋測試，風格仍需軍事化與污損處理。
3. [Poly Haven Concrete](https://polyhaven.com/a/concrete)／[Derelict Highway Midday](https://polyhaven.com/a/derelict_highway_midday)：CC0 PBR 混凝土與 HDRI；Web POC 應選 1K／2K，不直接使用 8K 全套。

《86》精準機型方面，目前頁面候選包含 [Juggernaut](https://sketchfab.com/3d-models/juggernaut-86-eighty-six-1f4d04b7d1154b63ba27ab21702fcffe)、[Part 2 fan art](https://sketchfab.com/3d-models/86-eighty-six-part-2-fanart-a89630e14a544b1ca1b43883d536c8e0) 與 [XM2 Valkyrie](https://sketchfab.com/3d-models/8686-eighty-six-xm2-valkyrie-15e9ca4e17ae4af7af6ba12c9b28085e)。既有 survey 記錄其頁面為可下載、CC Attribution；但本輪未下載實檔，**格式、節點拆分、pivot、rig、動畫、UV/PBR 與衍生改造可行性仍待驗**。其中 XM2 頁面標 1.4M triangles，即使可下載也不是瀏覽器戰鬥用資產。圖片、旋轉預覽、販售 STL、打印模型或只有 OBJ 的網格，均不能視為 rigged GLB。上傳者的 CC 授權也不等於取得《86》原作設計的商業授權。

## 第一 POC：只買必要的未知

做 20–30 秒單一戰鬥切片，不做完整關卡。保留：`game-arena-core.js（四向）／game-core.js（直線）` 數值／傷害／事件與 deterministic 測試、DOM HUD／整備／結算、鍵鼠操作、既有 BGM/SFX、肖像與 2D 爆炸／煙霧 billboard。新增成本只放在一隻可驗收四足替身、一種敵機 LOD、100–150m 灰盒戰場、相機／遮擋與單一砲擊鏈。正式《86》模型若實檔尚未通過，不要先花時間精修材質。

驗收矩陣：

1. **四足動畫：**同一 rig 做 idle、前進、側移、煞停、原地轉向；錄足端相對地面的滑移，測平地與緩坡。DCC 的 IK／constraint 必須烘焙成 GLB bone transforms；不要把 Mixamo 當解法，它的自動 rig 目標是雙足人形。[Adobe Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html)
2. **砲塔獨立：**機身行走 clip 播放時，以獨立 turret node 追蹤目標；砲管 elevation、muzzle socket、後座 clip 不得改壞彈道起點。以 360° 方位、坡上／坡下和快速轉身測 transform 階層。
3. **遮擋：**場景刻意放一面高牆、橋架與坡地；測鏡頭至玩家射線的前景淡化／裁切、玩家至準星的砲線碰撞、敵人 outline／弱點、地面危險 decal 在高低差的可讀性。真 3D 會新增遮擋問題，不是自動提升資訊品質。
4. **敵群效能：**同一測試依序 1、4、8、12 個動畫敵人＋1 Boss；固定 1080p WebGL2，記平均與 1% low frame time、draw calls、triangles、可見骨骼、texture memory、透明粒子 overdraw、首次可操作時間。再分別關閉陰影、動畫更新、粒子，定位瓶頸；不要只看平均 FPS。
5. **部署：**每個 GLB／貼圖／WASM 都驗證小於 Pages 25 MiB，冷快取載入失敗有 fallback；至少 Chrome、Edge、Firefox 同機測試。WebGPU 僅作額外比較，不能當唯一通過條件。

POC 通過才進第二階段：四足動作可信、砲塔與 muzzle 階層穩定、遮擋不損失射界資訊、12 敵＋Boss 在目標 PC 可接受、下載與單檔限制合規，而且玩法結果不受 render FPS 改變。若失敗，先調陰影更新、粒子 overdraw、貼圖、LOD 與遠距骨架更新；不能用更多後製掩飾動畫或可讀性問題。

## 待驗清單

- 三個《86》Sketchfab 候選的實際下載格式、授權檔、貼圖、節點／pivot、rig、動畫、可改造性與最終權利審查。
- Quaternius 動畫是否含可直接利用的骨架與 clip 名稱，以及能否有效改造成四足剛性關節。
- Babylon POC 在現有目標 PC、三個瀏覽器的真實效能；本文所有 FPS／下載量應視為測試門檻，不是成果數據。
- Pages 發布產物的實際最大單檔、總下載量與首次可操作時間；目前只確認平台上限。
- 四足 authored animation 加 runtime raycast 修正能否達到可接受足鎖，以及場景淡化會否遮掉敵方弱點與危險標記。


---

# 2026-09-08歷史引擎研究

# 《86》PC 真 3D 引擎研究

## 結論

首選 **Babylon.js，以 PC 瀏覽器為第一目標**。它能保留現有 JavaScript、DOM UI、音訊與純玩法規則，並用同一套引擎 API 補上 glTF 骨架動畫、PBR、陰影、粒子、相機、音訊與碰撞。Three.js 適合自訂渲染或視覺展示，但本案還需要完整遊戲層，團隊將自行承擔碰撞、場景生命週期、資源管理與除錯工具的組裝成本。Godot 的桌面發行與編輯器工作流最好，但等於把目前瀏覽器遊戲移植成另一個專案；在尚未證明一隻多足機甲能達到目標品質前，重寫成本不合理。

這是先設計再實作的引擎決策，不代表已完成 3D 模型、動畫、效能或跨瀏覽器驗證。第一步只做一個隔離技術 spike；正式遊戲維持現況，通過門檻後才排遷移。

## 現有專案基線與可重用範圍

目前是單頁 JavaScript／DOM 加 Canvas2D：`game.js` 取得 `canvas.getContext('2d')`，在每幀更新狀態後用裁切 PNG、`drawImage`、Canvas 粒子與命中圖層繪製。`game-core.js` 的機型數值、生成、傷害、射界、Boss 部件、補給與勝敗規則是純玩法資料／邏輯，最值得保留；HTML/CSS 的標題、整備、HUD、戰況通訊、暫停與結算可以繼續作 3D canvas 上方的 DOM overlay。`game-audio.js` 的串流 BGM、SFX 事件名稱、mute／volume／unlock 契約也可重用，之後只把需要空間感的砲擊與爆炸接到 3D emitter。

可直接重用：

- 純玩法狀態、機型／遭遇數值、事件時序與 deterministic 測試。
- 2D UI、圖示、角色通訊肖像、整備／結算版面及鍵鼠操作意圖。
- 已授權音樂與短音素材、音訊優先序、ducking 與瀏覽器手勢解鎖規則。
- 美術研究圖、輪廓規格、材質方向與現有 sprite，作 concept／billboard／載入 fallback 參考。

不可直接當真 3D 資產：`units-86.png`、`mecha-86-production.png`、`legion-specialists.png`、砲塔與爆炸序列都只有單一或少量 2D 視角，沒有背面、厚度、拓撲、UV、PBR 貼圖、骨架或碰撞體。把 sprite 貼在平面上仍是 2.5D，不符合「真 3D」。正式製作至少需要原創 glTF／GLB 機體、地形與道具，以及 base color、normal、metallic-roughness、必要的 emissive／AO；官方《86》研究圖不能直接貼成可散布材質。

目前 `assets` 約 53MB，主要是 56 張 PNG、音訊與研究素材，沒有 glTF／GLB。這表示引擎接線不是主要瓶頸；角色與軍團機甲的建模、UV、材質、多足 rig、動作、LOD 與碰撞代理才是新生產線。

## 引擎比較

|面向|Babylon.js|Three.js|Godot 4（Web／desktop）|
|---|---|---|---|
|與現有 JS 專案銜接|原生 JavaScript／TypeScript，可在既有頁面替換主 canvas，DOM UI 與 `game-core.js` 可漸進保留。|同樣可漸進導入，核心較薄，自訂自由最高。|GDScript／C#、Node／Scene 架構與匯入專案；玩法與 UI 需要包裝或重寫，無法直接沿用瀏覽器模組結構。|
|glTF 與多足 rig|官方 loader 可載 glTF／GLB、skin、animation groups；多足機甲需在 DCC 建骨架與動畫，或在 runtime 對骨骼／IK 做有限程序控制。|官方 `GLTFLoader` 載模型與 clips，`AnimationMixer` 播放／混合；程序足部與狀態機需自行設計。|glTF 匯入為 node tree，官方 `GLTFDocument`／匯入流程支援 skeleton、animation 與 physics body；編輯器內調動畫最完整。|
|PBR／陰影／粒子|引擎內建 PBR material、燈光陰影、GPU／CPU 粒子與後處理，工具與遊戲場景 API 集中。|`MeshStandardMaterial`／`MeshPhysicalMaterial`、shadow map 與 WebGL／WebGPU 範例成熟；粒子、後處理與遊戲層通常以 addons 或自建系統組合。|StandardMaterial3D、燈光陰影、GPUParticles3D、WorldEnvironment 與編輯器視覺工作流完整，桌面效果最容易集中調整。|
|音訊|官方 Audio Engine v2 可用 codec fallback 與空間聲；可保留目前 BGM bus，逐步只遷移 positional SFX。|`AudioListener`／`PositionalAudio` 可接 Web Audio 或 media element；bus 優先序與資源生命週期仍由本案管理。|AudioStreamPlayer／3D 音訊與 bus 系統完整，但既有 Web Audio 實作需重接。Web 音訊仍受瀏覽器 autoplay 限制。|
|碰撞／物理|場景 picking、bounding／mesh collision 與官方 physics 整合在同一引擎範圍；第一版可用簡化 capsule／box／ray，不必讓每條腿做剛體。|raycasting 與幾何相交可用；完整物理不是核心的一站式遊戲系統，需選第三方 physics 並自行同步 transform／版本。|CharacterBody3D、Area3D、RayCast3D、PhysicsBody3D 與形狀編輯完整；桌面遊戲製作最直接。|
|PC 瀏覽器|WebGL 路徑成熟，可另做 WebGPU 能力偵測；第一版應以 WebGL2 為基線，不能把 WebGPU 當唯一入口。靜態網站部署與目前接近。|跨瀏覽器 WebGL 成熟，亦有 WebGPU renderer；低層控制好，但需要更多專案架構。|Web export 可行，但官方列出背景處理、mouse capture、clipboard、audio 等平台差異；啟用執行緒還需 COOP／COEP headers。|
|桌面 build|可先以瀏覽器／PWA 交付；若需原生再評估 Babylon Native 或網頁殼，這是第二階段工作。|同樣需網頁殼或自建 native 路徑，核心專案不直接產生桌面遊戲包。|原生 Windows／macOS／Linux export 是強項；若確定 Steam／離線安裝優先且接受重寫，Godot 的排序會上升。|
|維護成本|中：引擎較完整，最少破壞現有程式；需管理 Babylon 版本、loader／physics 模組與自製資產管線。|中高：依賴可小，但每個遊戲系統選型與 glue code 都由團隊負責。|前期高、後期中：移植與雙語言／雙專案成本大，完成後編輯器與桌面管線一致。|

Unity 只有在團隊已有 Unity 3D 美術／動畫／效能經驗、且原生 PC 發行的價值足以承擔整體重寫與授權治理時才值得重開評估；目前不列第一個 spike。

## 為什麼推薦 Babylon.js

本案的風險是「做不出可信的多足軍事機甲與戰場層次」，不是缺一個 renderer。Babylon.js 能用最小工程變動測試真正風險：保留 DOM 流程與 `game-core.js`，把一個遭遇的繪製換成 3D Scene；官方文件的 `SceneLoader`／glTF importer、animation、materials、lights、particles、physics、audio、GUI 與 input 都屬同一引擎文件結構。若 spike 失敗，可以丟棄隔離 3D scene 而不先重寫整個遊戲。

Three.js 的畫面上限不低，甚至更適合高度客製 renderer；問題是它刻意維持通用 3D library 定位。本案要同時完成機甲動畫狀態、戰術碰撞、粒子池、資源釋放、音訊 emitter、場景切換與除錯標記，選 Three.js 代表團隊要自己形成一個小型遊戲引擎。Godot 則相反，遊戲功能完整，但會先付出最大移植成本；它適合作為 Babylon spike 證明瀏覽器路徑不達 PC 品質／效能目標後的第二選項。

## 第一個技術 spike

只做一個 20–30 秒的「M1A4 對 Ameise／Dinosauria 單一火力切片」，不做完整關卡：

1. 匯入一個具有正確比例、PBR 貼圖、兩級 LOD 與簡化碰撞體的 GLB 測試機體；若正式機體尚未完成，用自製灰盒，不用 2D sprite 假裝成果。
2. 建一個四足或六足 rig，至少有 idle、前進、側移、後座、受擊、部件擊毀六個 clip；驗證 AnimationGroup 混合不滑腳，足端接地可先用 authored animation 加 raycast 修正，不在 spike 寫完整 procedural locomotion。
3. 建 100–150m 灰盒道路、霧、單一主方向光、接觸陰影／shadow map 與一組環境反射；用 metallic-roughness PBR 區分漆面、裸鋼與熱源，不靠全屏 bloom。
4. 接入一發主砲：砲口、瞬時彈道、碰撞、局部金屬命中、一次爆炸與 GPU 粒子煙；危險射界與目標弱點仍用清楚的 2D／3D UI overlay。
5. 保留既有 `game-core.js` 傷害與事件真值，Babylon scene 只消費 snapshot／events；確認渲染幀率不改變玩法結果。DOM 的整備、HUD、暫停、音量與結算保留。
6. 驗證相機、鍵鼠、視窗 resize、失焦暫停、音訊 gesture、資產載入失敗 fallback、scene dispose 後 GPU／音訊資源不殘留。
7. 在 Chrome、Edge、Firefox 的同一台目標 PC 跑 WebGL2；WebGPU 只作額外比較。記錄下載量、首次可操作時間、平均／1% low frame time、draw calls、triangles、texture memory、JS heap 與 GPU 警告。

### 預定效能門檻

以下是 spike 的設計目標，**不是已測數據**：1080p、主流近五年獨顯 PC，戰鬥 60fps，平均 frame time ≤16.7ms、1% low ≥45fps；同屏 12 個有動畫單位、1 個 Boss、可見粒子峰值 500–800；常態 draw calls ≤250、峰值 ≤400；首個 3D 切片壓縮下載 ≤35MB，首次可操作 ≤5 秒（一般寬頻、暖 CDN 除外需另記）；3D texture 預算 ≤256MB，JS heap 不因重試十次持續上升。另設一個 1080p 中階整合顯示 WebGL2 fallback：30fps 下限、關閉高成本後處理與降低陰影／粒子仍須保持射界和弱點可讀。

未達門檻時先降低陰影解析度／更新頻率、粒子 overdraw、貼圖尺寸、骨骼／動畫更新距離與 Boss 以外單位 LOD；不能先刪除警示、碰撞真值或把真 3D 改回 billboard 卻宣稱通過。

## 決策門

採 Babylon.js 進下一步的條件：GLB 多足動畫可信、PBR 與陰影在 WebGL2 達門檻、12 單位與 Boss 不影響規則 determinism、DOM UI／音訊可直接保留、重試無資源洩漏。若畫面達標但瀏覽器封裝與離線／Steam 發行成為主要需求，再比較 Babylon Native／桌面殼；若編輯器協作、原生桌面效能或大型關卡工具已證明是核心瓶頸，才以 spike 的同一份 GLB 與驗收場景重測 Godot，而不是憑偏好全面重寫。

## 官方文件來源

- Babylon.js：[glTF 匯入／SceneLoader](https://doc.babylonjs.com/features/featuresDeepDive/importers/)、[動畫](https://doc.babylonjs.com/features/featuresDeepDive/animation/)、[材質](https://doc.babylonjs.com/features/featuresDeepDive/materials/)、[物理](https://doc.babylonjs.com/features/featuresDeepDive/physics/)、[Audio Engine v2](https://doc.babylonjs.com/features/featuresDeepDive/audio/)
- Three.js：[GLTFLoader](https://threejs.org/docs/#examples/en/loaders/GLTFLoader)、[AnimationMixer](https://threejs.org/docs/#api/en/animation/AnimationMixer)、[MeshStandardMaterial](https://threejs.org/docs/#api/en/materials/MeshStandardMaterial)、[PositionalAudio](https://threejs.org/docs/#api/en/audio/PositionalAudio)、[WebGPURenderer](https://threejs.org/docs/#api/en/renderers/webgpu/WebGPURenderer)
- Godot：[匯入 3D 場景](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/)、[glTF runtime 載入](https://docs.godotengine.org/en/stable/tutorials/io/runtime_file_loading_and_saving.html)、[Web export 與限制](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)、[匯出專案](https://docs.godotengine.org/en/stable/tutorials/export/exporting_projects.html)

本文的 API 與平台判斷於 2026-09-08 透過 Context7 查閱上述官方 Babylon.js、Three.js 與 Godot stable 文件；實際導入時仍須固定版本並重跑 spike，不能把今日文件視為永久相容保證。

## 「會有點像《星海爭霸 II》？」的界線

會像的是斜俯視戰場的**畫面閱讀方式**，不等於改成 RTS。Blizzard 官方把《星海爭霸 II》明確定義為即時戰略，描述玩家指揮不同種族與「vast armies」；同一官方頁面也提供種族概覽及媒體圖庫。這支持把它當作大範圍戰況、單位輪廓、地表分區與技能警示的視覺參考，卻不能支持把本案推論成框選多單位、基地生產或資源經濟。[Blizzard《StarCraft II》官方頁](https://starcraft2.blizzard.com/)

更接近本案操作核心的是初代《HELLDIVERS》：開發商 Arrowhead 官方稱它為合作雙搖桿射擊，PlayStation 官方頁列出單人／最多四人合作、武器與載具操作、戰場支援；官方商店頁的宣傳片與 11 張螢幕擷圖則呈現固定斜俯視下的直接角色操作。本文只看過這些公開頁面與靜圖，沒有實際試玩，手感不能由截圖證明。[Arrowhead 遊戲列表](https://www.arrowheadgamestudios.com/aboutarrowhead/games/)、[PlayStation《HELLDIVERS》官方頁](https://www.playstation.com/en-us/games/helldivers/)、[官方發行商 Steam 商店圖庫](https://store.steampowered.com/app/394510/)

### 可以借用的三項

1. **斜俯視與輪廓優先：**相機固定方位、保留足夠地面可視面積，讓敵我機甲、Boss 部件與射界在一次掃視中可分辨。
2. **戰場資訊分層：**用地面 decal、色溫、陰影與高度差表達危險區、掩體和行進路徑；大量背景交戰可作氣氛層，玩家仍只直接控制一臺機甲。
3. **直接射擊的方向感：**採《HELLDIVERS》式「移動與瞄準可分離」作參考，保留目前主砲、閃避、特殊技與支援事件，不加入 RTS 選取框。

### 不適合引入的三項與成本

1. **多單位選取、編隊與 AI 尋路：**會新增選取狀態、群體避障、隊形、命令回饋與大量單位同步，並改寫目前單機甲操作和關卡節奏。
2. **基地建造、採集與科技樹：**會要求經濟平衡、建築資產、產兵 UI、地圖擴張與長局測試；這些不是使用者比喻所授權的需求。
3. **照搬 RTS 的高空全知相機：**機甲縮得太小會犧牲多足動畫、後座與部件破壞；若為展示模型而壓低相機，建築與坡地又會遮住敵人、射線和落點，需要透明淡化、遮蔽物裁切、相機邊界及瞄準射線與地形相交測試。

### 推薦結論

維持「固定斜俯視、單機甲直接控制」：視覺可讓人聯想到《星海爭霸 II》的戰場尺度與資訊密度，操作更接近俯視動作射擊。真 3D 不會自動消除遮蔽；第一個 Babylon spike 應加入一面高牆、一段坡地與跨高度彈道，驗證遮蔽物淡化、鏡頭前景裁切、砲口到準星的碰撞修正，以及地面危險標記在不同高度仍可讀。若這四項未過，不應用更多單位或更高粒子量掩蓋問題。

來源使用界線：玩法分類與功能敘述來自上述官方文字；視角判斷來自 Blizzard 官方媒體區與 PlayStation 發行商商店公開靜圖，是本文對畫面的觀察，不是官方對攝影機系統的技術規格，也不是試玩結論。
