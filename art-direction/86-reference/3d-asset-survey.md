# 《86》真 3D 資產可行性 Survey

## S51 實檔結果：兩個模型已能顯示並驅動關節

**已有可重用網格與關節結構，不必先從零重建兩台機甲。** Project-86 的 Ameise 與 M1A4 最小集已通過 LFS 雜湊、Blender 4.5.13 匯入、材質重建、GLB 匯出及本地瀏覽器顯示。Sketchfab 版本仍卡在目前可控制瀏覽器的登入狀態；不能混稱已下載。

|實際產物|Blender／GLB 資料|瀏覽器人工看圖驗收|下一個缺口|
|---|---|---|---|
|Ameise|18,622 三角面、有效蒙皮、29 匯出 joints、GLB 約 3.6 MiB、2K 內嵌色彩／法線|六足／雙槍／背甲可見，前足在靜止與診斷抬足有明確位移|步態足鎖、砲口、正常攻擊動畫、材質還原|
|M1A4|152,384 三角面、39 關節節點、剛性零件跟隨節點、GLB 約 14.3 MiB；沒有有效 skin 權重引用|四足／副臂／砲架可見，診斷抬足確實改變前足位置|網格與材質合批／LOD、步態、後座、貼圖仍較暗且細節密|

[打開本地實際模型檢查](art-review-s49.html#reuse)，可載入、旋轉、播放診斷或定格。這是素材技術驗證，不是完成的步行演出，不是新的遊戲版本。獨立 Sol Agent 只驗 GLB 資料結構；PO 以 CUA 實際截圖對照靜止／抬足，兩者證據分開記錄。瀏覽器 error log 為空。

首次畫面只有地面：原 FBX 根節點有負高度，縮放時根位置未同步縮放，導致整機埋地。改成以蒙皮後實際頂點求邊界，並同步轉換根位置後才看得到模型。此案例明確否定「import success 就算視覺驗收」；後續每個素材都先做完整輪廓與兩姿態實機對照。



## 2026-09-12 S50：現成 86 素材優先，Blender 作為整理工具

**已找到免費可下載的 86 模型候選；目前沒有驗證到一套兼具完整機型、可用動畫、地圖與清楚來源的即用素材包。** 先驗現成模型，再決定局部修模，取代先全量程序建模的安排。本節是最新狀態；下方保留早期盤點與限制。

|來源|本輪確認|仍缺什麼／採用順序|
|---|---|---|
|[leoxx300 的 Juggernaut](https://sketchfab.com/3d-models/juggernaut-86-eighty-six-1f4d04b7d1154b63ba27ab21702fcffe)|作者頁 403 後改查 [Sketchfab 公開 metadata](https://api.sketchfab.com/v3/models/1f4d04b7d1154b63ba27ab21702fcffe)：isDownloadable=true、CC BY 4.0、97,544 faces、48,522 vertices、animationCount=0；摘要已保存|第一個實檔驗收候選。零公開動畫不代表沒有骨架；分件、UV、pivot、下載格式均待驗，不假定可直接驅動多足|
|[ForevereQ 的 86 Part 2 FanArt](https://sketchfab.com/3d-models/86-eighty-six-part-2-fanart-a89630e14a544b1ca1b43883d536c8e0)|作者頁列免費下載、CC Attribution、19.7k triangles，風格化作品|較低面數的備選；精確機型、分件與動畫待實檔驗證|
|[Paper朱 的 XM2](https://sketchfab.com/3d-models/8686-eighty-six-xm2-valkyrie-15e9ca4e17ae4af7af6ba12c9b28085e)|作者頁列免費下載、CC Attribution，約 140 萬 triangles|不能直接量產進即時戰鬥；先評估降面、材質與分件，優先級低於前兩者|
|[Project-86](https://github.com/Taliayaya/Project-86)|公開 Unity 6.4／GPLv3 工程，樹中確有 Juggernaut、Reginleif、Ameise、Grauwolf 等模型與動畫、場景／TerrainData|大檔為 LFS，另有子模組及第三方內容。尚未確認目標資產來源與工程完整性；作研究候選，不整包搬入。詳見[逐項稽核](project-86-reuse-audit.md)|
|[Kenney 工業模組](https://kenney.nl/assets/city-kit-industrial)＋[Poly Haven](https://polyhaven.com/a/industrial_sunset_02)|CC0；已實際匯入 Kenney 建築、貨櫃、水塔三個 GLB，並以 1K HDR 做固定鏡頭對照|可重用的通用環境底座；不是原作 86 地圖，仍需按官方劇照編排、修破損與材質|

下載標示與面數屬 metadata／作者頁證據，前三個 86 模型尚未取得二進位實檔，不能宣稱已整合。CC BY 標示是作者提供的資產授權，不等於原作品牌的全面授權。沒有找到特定素材包不代表它不存在。

### Astra／Blender 的採用判斷

[OpenAI 遊戲案例](https://developers.openai.com/blog/how-to-build-games-with-astra)與[建築案例](https://developers.openai.com/blog/architectural-visualization-with-astra)確實採用 Blender／Python、既有素材與渲染檢查；[Simon Willison 的實作](https://github.com/simonw/til/blob/main/llms/blender-coding-agents-macos.md)還提供腳本、blend、執行紀錄與 skill。這支持一條可重跑的工作流，尚不足以稱精準 86 機甲全自動重建已成熟。細節與官方教學入口整理於[Blender 工作流](blender-ai-workflow.md)。

建議流程：現成模型 → 檢查輪廓／分件 → 小段 bpy 整理與材質 → 必要動作 → GLB → 遊戲內固定鏡頭驗收。Blender 是離線製作工具，玩家不需要安裝；先用 CLI，不把 MCP、Unity 或 Unreal 當前置條件。即時遊戲用 GLB；離線高畫質封面渲染是另一項工作，不混用其效能標準。

### 下一輪唯一優先 Story

玩家希望在目前斜俯鏡頭下，看到接近設定圖、有落足和後座的多足機，而非上色積木。先驗一個 M1A4 候選，記錄是否能保留網格、拆腿與砲架；通過後才追加 Ameise 與街角。每段保存可重跑腳本／blend；前、側、遊戲視角各一張低解析圖，最多三輪視覺修改後重新評估，避免無止境提示迴圈。Astra 處理造型判斷及難修部分，輕量 Agent 處理庫存、來源與匯出核對。這是成本控制方案，尚無本專案實測 Token 節省數字。

### S49 真實匯入與光照對照

[打開同鏡頭 A/B 與 GLB 匯入結果](art-review-s49.html)。同幾何加入環境反射後，陰影與塗裝略有差異，盒狀輪廓仍然存在：模型結構的優先度高於繼續堆光照。三個 Kenney GLB 共 3,416 triangles，引用外部 colormap；實載無 JavaScript／HTTP 錯誤，無 rig／動畫。這只證明匯入流程與基本尺寸，不是 86 成品美術驗收。來源、授權與量測位於 probe-assets；沒有修改遊戲 runtime。

## 2026-09-12 技術美術建議：先完成一個可動美術切片

**建議先把一隻主角的輪廓與可動結構做對，同時在固定街角建立材質／光照基準；不要先全量建模，也不要期待調亮度能修正盒狀機體。** 本節根據程式碼與四個可讀取的一手來源做製作判斷，並非本輪畫面或資產實檔驗收。

### 程式碼顯示的缺口

|面向|現有證據|可由材質／光影改善|需要網格、動作或編排工作|
|---|---|---|---|
|機甲|`game-3d-models.js` 的 `source()` 只有 box、wedge、8 邊 cylinder；`createMech()` 重複縮放組裝；裝甲已是 PBR，但只有純色與 metallic／roughness 常數|塗裝、裸鋼與橡膠的反射差異；磨損、板縫、污垢；裝甲轉折的可讀性|機身長寬、低伏姿態、足部比例、裝甲切面、砲管與關節分件；輪廓缺口不能靠 normal 貼圖補回|
|場景|`createEnvironment()` 只有道路使用 diffuse／normal；掩體與廠房主要為盒柱；`game-3d.js` 已有方向光、半球光、1024 PCF 陰影，未見環境反射貼圖設定|混凝土粗糙度、表面凹凸、接觸處層次、主光與背景明度分離|破牆缺口、窗框、屋頂厚度與高低落差；將一個街角編排成有前中後景與可讀通道的空間|
|動作與炮擊|`updateMech()` 已有落腳狀態、程序步態與後座；`muzzleFlash()` 是 0.07 秒拉長球體，`makeEffect()` 以少量方塊作爆炸火花；另有煙霧 billboard|閃光亮度、煙的色調與透明度|腿的 pivot／足鎖驗收；砲口與後座同步；閃光、衝擊、碎屑、煙塵的時間與尺度，不能只加 bloom|

### 唯一推薦的最小切片

本次切片正式美術目標鎖定 **M1A4＋Ameise＋共和國壁外前線的改編街角**。已回讀本庫 `world-and-style.md`、`allies.md`、`legion.md` 與 `assets.json`，並實際檢視下列本地圖。通用 Kenney／Quaternius 僅是尺度、匯入與材質流程的替身，不能當作《86》正式造型目標；同樣不能拿本庫 AI 生成圖反過來證明原作設定。

|原作圖／已看來源|可見特徵與原作依據|目前模型落差（程式碼）|下一步改造（本專案提案）|
|---|---|---|---|
|[M1A4 官方圖](images/official-m1a4.jpg)；[官網前半機體頁](https://anime-86.com/mechanic/first-half/)|象牙色尖殼包覆小型暗色機身；四條細長、外張、分節足，關節與細桿外露；官網文字確認四足與薄甲|`player` 有四足及象牙色，但共用楔體形成整塊寬厚機身；腿以均質楔件連接，未表達殼片與連桿的分離|沿用已收集圖作同角度輪廓對照，先修機身收窄、殼片曲折、細腿負空間與足端；小刮痕最後才補|
|同一 [M1A4 官方圖](images/official-m1a4.jpg) 與官網武裝說明|長砲架高於機身，後方砲架機構有獨立體積；圖中雙刃副臂向前伸。官網允許副臂刃或機槍，通常背負 57mm 滑膛砲|現有砲塔由小楔與圓柱底座組成，雙刃雖存在但機構簡化；砲口事件仍按座標／高度產生視覺|本切片固定雙刃版，重建背架與後座分件，綁砲口 socket；炮擊時序與數值屬遊戲提案，不宣稱還原原作射速|
|[Ameise 官方圖](images/official-ameise.jpg)；[官網敵機頁](https://anime-86.com/mechanic/enemy/)|六足、尖銳銀藍殼片、後上方高尖背鰭、前方成對小槍；官網確認偵察、目標指示、高感度感測器及雙 7.62mm 機槍|`scout` 已有六足與高背楔，但共用中央砲塔／砲管，另疊雙小槍，造成非此設定圖的中央主砲語言；殼與腿的切面仍粗略|保留六足配置，移除共用主砲造型，按圖拆前部感測殼、雙槍與尖背鰭；先停步觀測再移動是演出提案，標記 UI 不是原作可見光束|
|[第 9 話官方劇照 1](images/story/img_ep09-1.jpg)；[官方頁](https://anime-86.com/story/?id=09)；次參考 [第 10 話劇照 5](images/story/img_ep10-5.jpg)|第 9 話圖可見破裂鋪面、損壞矮磚牆／欄杆、電線杆、散落彈殼與樹林丘陵遠景；第 10 話圖可見草地丘陵與暖色天空，並非工業區|目前環境由完整盒狀建築、均勻低牆與平道路構成，缺少此類局部破損與道路邊界層次|先將一段低牆改成磚柱／欄杆與缺口，路面補局部破碎厚度與碎屑；回用既有 AI 廢墟圖的中央留空構圖，但工業街角仍標為改編，不能稱逐景復刻；兩張劇照不可推為同一地點或連續光照時序|

本庫 `01-m1a4-book-reference.png`、`04-ameise-cg-reference.png` 的清單記錄出版來源未明；本輪未用其細字補規格。`03-reginleif-kit-art.png` 是特定配備的模型盒繪，不能混成 M1A4 標準武裝。已收集的官方機體圖足以開始上述輪廓修模；追加採樣已取得原作地景參考：第 9 話第 1 張與第 10 話第 5 張，逐圖來源／可見內容／限制見 [SOURCES](images/story/SOURCES.md)。原先瀏覽工具讀第一話逾時，父任務其後以 curl 成功取得；不能再寫成整站無法取得。具體工業廠房仍缺直接原作圖，維持改編場景標示。

固定目前 PC 斜俯相機，製作**1 我機、1 敵機、1 街角、1 次完整炮擊**，驗收後才擴散到全圖。以下是製作目標，尚未實作：

1. **我機：**優先驗既有 Juggernaut 候選的實檔，保留可用網格，修比例、裝甲厚度與轉軸；交付一個 GLB，具機身、砲塔、後座與砲口節點，以及可驅動的四足分件或骨鏈。先驗 idle、前進、轉向、停步與開炮。若模型合併而無法合理拆腿，才針對該機重建；不要先建所有機型。
2. **敵機：**選一個與我機輪廓有明確差別的六足敵機，只完成一套相同品質的材質及必要步態。Quaternius 可作 GLB／動畫匯入的技術替身，不能因為免費又有動畫就當作《86》敵機成品。
3. **街角：**只取一棟工業建築、一段低牆、一路口與少量碎石；共用混凝土與道路材質。建築模組先校尺度、修可見破損輪廓，再加污損。以一組低解析預濾環境反射、現有主光及受控填光校材質；固定曝光與相機後才比較，避免每個素材各調一套亮度。
4. **炮擊：**重用本庫既有煙霧與爆炸 atlas 候選，完成砲口閃光 → 後座／煙 → 命中衝擊與碎屑 → 延遲消散煙塵；先把事件與砲口對齊，再調粒子密度。實際 atlas 通道、切幀與透明排序仍須試跑，不能把「檔案存在」寫成已整合。

切片驗收以同一台 PC、相同解析度和相機，保留前後截圖與短片：縮回遊戲尺度仍分得出敵我輪廓；五種基本動作沒有明顯滑足、穿插或砲口漂移；混凝土、塗裝、裸鋼可辨識；炮擊不遮住預警與目標；記錄 frame time、draw calls、貼圖記憶體與下載大小後再訂量產預算。這些是待執行的驗收門，不是本輪測試結果。

### 本輪一手來源與可用性邊界

- [Babylon 官方 PBR 文件原始庫](https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/materials/using/introToPBR.md)：明列 base color、metallic、roughness、打包貼圖與 environment texture；反射需要可反射的環境。據此建議先補完整材質與環境基準，而非僅把 metallic 調高。Context7 本輪未提供可呼叫工具，故直接讀官方文件；本節不給出未經版本驗證的 API 實作。
- [Quaternius Animated Mech Pack](https://quaternius.com/packs/animatedmech.html)：本輪重查頁面列 4 款、有動畫、CC0，格式欄列 FBX／OBJ／Blend／glTF，並有下載入口。**glTF 不等於已核實 GLB**；下載包是否含 GLB、rig 型式、clip、分件與 PBR 貼圖皆未解包驗證。舊正文格式描述未列 glTF，故尤其須以實檔為準。
- [Kenney City Kit (Industrial)](https://kenney.nl/assets/city-kit-industrial)：頁面確認 40 個檔案、CC0 與下載入口；未列格式、PBR 通道或破損變體。可作街角模組候選，不能宣稱已取得可直接進 runtime 的 GLB 或完成度足夠的廢墟。
- [Poly Haven Concrete](https://polyhaven.com/a/concrete)：頁面確認 CC0、1K 至 8K、diffuse／normal GL／AO-Rough-Metal 等通道，以及 JPG／PNG 等下載項。建議切片先用 1K／2K、核對貼圖尺度與通道；材質貼圖無法創造破牆外輪廓。下載包與實機觀感本輪未驗。

早期 Juggernaut 作者頁回傳 403；S50 已以官方公開 metadata 重新確認可下載與授權，最新狀態見上方，模型實檔仍待驗。初始調查只更新本文件；追加依使用者授權小量下載官方劇照並建立來源表，未下載模型資產、安裝引擎、修改 runtime 或重啟 8765。

## 結論

環境、材質、背景機械與特效已有明確 CC0 基底，可快速組出灰盒戰場；也已有可下載、CC Attribution 的《86》Juggernaut／Valkyrie 粉絲模型，可列為改造與實檔驗收候選。這會降低從白模開始的成本，但不代表已取得可直接上線的機體：rig、動畫、貼圖通道、節點拆分與實際下載格式仍未知，高面數候選也必須重拓撲或產生 LOD。只有實檔驗收失敗後，才能判定需從零建模。

本輪只閱讀作者／官方資產頁及 Babylon 官方文件，沒有下載、解包或試跑素材。因此表中的「動畫」只採頁面明示；頁面沒寫的格式、骨架、動畫名稱、面數與貼圖通道都標為未知，不能視為已驗收。

## 具體候選

|候選與原作者|頁面明示授權／格式|rig／動畫證據|用途判定|導入成本與缺口|
|---|---|---|---|---|
|[Juggernaut 86 Eighty-Six](https://sketchfab.com/3d-models/juggernaut-86-eighty-six-1f4d04b7d1154b63ba27ab21702fcffe)，leoxx300|CC Attribution；Download Free；97.5k triangles／48.5k vertices；實際下載格式未知|rig／動畫未知|**優先改造候選**：M1A4 輪廓與首模實檔檢查|中；需保留作者署名，核對下載包、貼圖、UV、關節分件、砲口節點與是否允許衍生改造；面數仍需依同屏預算評估|
|[86: Eighty Six Part 2 FanArt](https://sketchfab.com/3d-models/86-eighty-six-part-2-fanart-a89630e14a544b1ca1b43883d536c8e0)，ForevereQ|CC Attribution；Download Free；19.7k triangles／10.2k vertices；實際下載格式未知|rig／動畫未知|**低成本改造候選**：敵機／遠景機體與 LOD 基底|低至中；頁面只稱 fan art，必須實檔確認具體機型、材質、可動分件與比例|
|[XM2 Valkyrie](https://sketchfab.com/3d-models/8686-eighty-six-xm2-valkyrie-15e9ca4e17ae4af7af6ba12c9b28085e)，Paper朱|CC Attribution；Download Free；1.4M triangles／686.7k vertices；實際下載格式未知|rig／動畫未知|**高模改造參考**：XM2 比例與細節來源|高；1.4M triangles 不適合直接進瀏覽器戰鬥，需大幅減面、重建 LOD、核 UV／貼圖與關節拓撲|
|[Animated Mech Pack](https://quaternius.com/packs/animatedmech.html)，Quaternius|CC0；FBX、OBJ、Blend、glTF|頁面明示 4 款 mech 各有 animations；是否骨架動畫、clip 名稱未知|**改造基底**：先驗 glTF 動畫、後座與狀態切換|低至中；輪廓不符合《86》，多足數、關節軸、LOD、碰撞與 PBR 通道均待解包驗證|
|[Modular Sci-Fi Megakit](https://quaternius.com/packs/modularscifimegakit.html)，Quaternius|CC0；FBX、OBJ、Blend、glTF|非角色 rig；付費 source 版另明示最佳化碰撞，免費部分是否含碰撞未知|**改造基底**：軍事設施、平台、門、柱與掩體灰盒|低；偏科幻室內，需要重材質、降飽和並挑選不突兀的模組|
|[City Kit (Industrial)](https://kenney.nl/assets/city-kit-industrial)，Kenney|CC0；官方頁未列具體交換格式，40 個檔案|無動畫明示|**可直接灰盒**：工廠、倉庫與戰場遠景|低；低細節風格需重材質或只放中遠景，先核實實際檔案格式|
|[Factory Kit](https://kenney.nl/assets/factory-kit)，Kenney|CC0；官方頁未列具體交換格式，140 個檔案|頁面標示 Animation；是否 rig、動畫對象與 clip 未知|**可直接灰盒／改造基底**：機械設備、管線、貨箱與背景動件|低至中；不是破敗資產，需要損壞版網格、污損材質及碰撞代理|
|[City Kit (Roads)](https://kenney.nl/assets/city-kit-roads)，Kenney|CC0；官方頁未列具體交換格式，90 個檔案|無動畫明示|**可直接灰盒**：道路、路標、路口和行進邊界|低；視覺偏乾淨，需要裂損 decal、尺度校正與遮蔽測試|
|[Blaster Kit](https://kenney.nl/assets/blaster-kit)，Kenney|CC0；官方頁未列具體交換格式，40 個檔案|頁面標示 Animation，未說是否為骨架動畫|**僅改造基底**：砲口、投射物／武器節點與煙霧事件測試|中；不應直接替代《86》火砲，需核對動畫內容、尺寸與發射軸|
|[Smoke Particles](https://kenney.nl/assets/smoke-particles)，Kenney|CC0；2D VFX，70 個檔案；本庫已選入 4 張 PNG|非 rig|**本機優先重用**：`assets/vfx/kenney-smoke/` 的黑煙與白煙可直接試作 Babylon billboard|低；本機來源與授權已記於 `assets/vfx/CREDITS.md`，仍需核 alpha、色彩空間與 billboard 尺度|
|[2D Explosion Animations #2](https://opengameart.org/content/2d-explosion-animations-2-frame-by-frame)，Sinestesia|CC0；本庫已有 full／half 兩張原始 explosion atlas PNG|非 rig；現有 game.js 已用 32 幀切片播放|**本機優先重用**：爆炸 flipbook 與部件擊毀|低；使用 `assets/vfx/sinestesia-explosion-2-*.png`，沿用既有切幀規則，再驗 3D billboard 深度排序、padding／alpha 與播放率|
|[Concrete](https://polyhaven.com/a/concrete)，Rob Tuytel／Poly Haven|CC0；頁面提供 PNG／JPG／EXR 的 diffuse、normal GL/DX、roughness、AO、displacement 等|不適用|**可直接使用**：低牆、橋墩、掩體 PBR|低；Web 版選 1K/2K 並正確使用 OpenGL normal，8K 全套不適合直接上線|
|[Derelict Highway Midday](https://polyhaven.com/a/derelict_highway_midday)，Dimitrios Savva、Jarod Guest／Poly Haven|CC0；HDR／EXR，多解析度|不適用|**可直接作光照基底**：廢棄公路日照與反射環境|低；以 1K/2K 預濾環境圖試作，不能把 HDRI 背景誤當可碰撞地形|

## 《86》專屬模型與動作缺口

現已找到三個可下載且標示 CC Attribution 的《86》粉絲模型，故「沒有候選、必須從零建模」的原判斷不成立。它們應先進實檔驗收，再決定改造或重建。另找到 [Ameise (EF-1)](https://sketchfab.com/3d-models/ameise-ef-1-68b33afe9772456bb7cd30309758bca5) 的具體 Sketchfab 頁面，但本輪頁面回傳 cache miss，只能核實標題與網址，作者、下載狀態、授權、面數、格式及 rig 全部未知，因此暫列**僅參考／待查**，不能下載或納入製作。可旋轉 viewer 仍不能證明可改作或含骨架，也不應解包 viewer 取得資產。

CC Attribution 是上傳者對該模型檔的授權標示，不等於取得《86》原作角色與機體設計的商業授權；目前可用於內部技術 spike 與改造評估，對外發布前仍需另做權利審核。

Quaternius 的 Animated Mech 可當技術替身，但不能證明多足 rig 可用。Adobe 官方 Mixamo FAQ 明確限定自動 rig 與動畫庫為**雙足人形**，並指出額外肢體可能失敗；因此 Mixamo 不解決四足／六足機甲。[Adobe Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html)

## Babylon glTF 管線判定

Babylon 官方文件目前示範以 `ImportMeshAsync` 載入 GLB，匯入結果中的動畫可透過具名 `AnimationGroup` 播放；純 ES module 路徑需要明確註冊 glTF loader。官方亦有 `LoadSmartAssetAsync` 以穩定 key 載入 glTF 並回傳 `AssetContainer`。這表示候選資產應先統一轉成 GLB，保留具名節點與 animation groups，再由資產容器實例化；不能只確認 viewer 能顯示就視為 Babylon 可直接量產。[Babylon animated character](https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/animation/animatedCharacter.md)、[Babylon pure imports glTF](https://github.com/BabylonJS/Documentation/blob/master/content/setup/frameworkPackages/es6Support/treeShaking/usingPureImports.md)、[Babylon smart assets](https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/importers/smartAssets.md)

這些 API 概念於 2026-09-08 透過 Context7 查核官方 Babylon.js Documentation；實作 spike 時仍需固定套件版本，並以該版本的官方 import 路徑驗證。

## 第一隻機體的素材驗收門

1. **足鎖：**idle、前進、側移、轉向與停止時足端不得明顯滑地；坡面 raycast 修正不可讓膝關節翻轉。
2. **關節軸：**每條腿的髖／膝／踝 pivot、局部軸與旋轉限制一致；縮放已套用，鏡像骨不帶負縮放異常。
3. **砲口座標：**主砲、機槍與特效 socket 有穩定名稱、方向與 local transform；後座動畫不改壞彈道起點。
4. **受擊部位：**機身、腿、武器與 Boss 部件可分 mesh 或具清楚節點，能綁簡化 hit proxy、材質閃爍與部件破壞。
5. **GLB／UV／PBR：**GLB 可離線載入；UV 與材質對應正確；允許刻意鏡像重用，另行檢查烘焙接縫，base color、normal、metallic-roughness、AO／emissive 色彩空間正確，貼圖尺寸受預算控制。
6. **動畫與 LOD：**具名 animation groups 能循環／混合；至少兩級 LOD 保持砲口與碰撞代理一致，切換時輪廓、材質與骨架不跳動。

只有上述六項通過，候選才算合格的遊戲機體。近期最低成本路線是先下載並驗收 leoxx300 的 Juggernaut；若節點或拓撲不適合動畫，再用 Quaternius mech 驗管線。場景沿用 Kenney 道路／工業灰盒、Poly Haven 混凝土與低解析 HDRI，特效先重用本機 Kenney 四張煙霧 PNG 和 Sinestesia 兩張爆炸 atlas。實檔結果再決定修模、重拓撲或從零製作，不能先把後者當成既定成本。

## 多足動作改造方案

先驗收候選是否已按機身、髖、上腿、下腿、足與武器分件，並檢查每件 origin 是否位於真實轉軸。**分件模型**成本最低：建立一條腿的髖／膝／踝骨鏈後鏡像複製，將各剛性零件直接 parent 到對應骨，或以每件單一骨、100% 權重綁定；這能保住裝甲硬邊，避免自動權重把相鄰板件拉彎。Blender 官方也警告 Automatic Weights 在複雜、重疊物件上可能判錯，須人工修權重。[Armature Deform Parent](https://docs.blender.org/manual/en/4.3/animation/armatures/skinning/parenting.html)

**合併模型**必須先判定拓撲：若關節處已有獨立 UV 島與可分離面，可按連通件拆回零件、重設 pivot，再走上述剛性流程；若腿與機身焊成連續網格，則需切模、補內面、修法線／UV，或建立每關節互斥 vertex groups。後者最容易出現裝甲彎曲、穿插與貼圖接縫，成本可能接近重建，不能只靠「自動綁骨」估低。

每足配置 IK target 與 pole target，膝／髖再加旋轉限制；Blender 官方說 IK Solver 是骨骼專用約束，而 Limit constraints 用來限制關節自由度。[Bone Constraints](https://docs.blender.org/manual/en/latest/animation/armatures/posing/bone_constraints/introduction.html) 可先製作 idle、前進、煞停、原地轉向四個短循環；用相位錯開的四足／六足擺動曲線產生程序步態，適合平地與緩坡的低速行走，也適合作為未取得原作動作時的技術替身。它不等於足鎖：坡面貼合、落腳點預測、機身速度突變、跨障礙與高速側移仍需執行時地形查詢、足端固定與重新落腳狀態機；未做實機 spike 前不能承諾無滑步。

輸出以 GLB 為交付，動作命名為 `idle`、`walk`、`stop`、`turn`。Blender glTF 官方只列物件 transform、pose bones 與 shape keys 為支援動畫；IK、限制與 driver 應在匯出時取樣／烘焙成骨骼 transform。各 Action 必須設為 active 或存入 NLA track，否則可能不會輸出；輸出後還要回匯 Blender並在 Babylon 驗 clip、循環、骨階層、尺度、足端軌跡與砲口節點。[Blender glTF 2.0](https://docs.blender.org/manual/en/4.0/addons/import_export/scene_gltf2.html)
