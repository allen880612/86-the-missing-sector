# S54：交戰參考與可重用素材庫

2026-09-13。先收集與驗證整場交戰所需素材，再做場景。這是研究紀錄，沒有把正式 2D 或被否決的 3D 試驗場改成新版本。

## 素材庫快速取用（本地稽核更新）

團隊先讀此頁，再取用[素材清單與校驗資料](s54-asset-archive.json)及[影片時間碼索引](s54-reference-index.json)。原始檔存專案根目錄，衍生物路徑明列工作目錄；沒有必要再搜尋同一批素材。

|我要找什麼|直接取用|檢查結果|
|---|---|---|
|我方與軍團模型|`assets/model/project86-source/`、`assets/model/juggernaut_86_eighty-six.glb`|原檔與匯入報告已保存；動畫缺項、比例及再散布限制見下方。|
|戰損建築與碎片|`assets/model/oga-destroyed-city/`|CC0 原 FBX、貼圖與來源清單；已通過局部用途判斷。|
|地表與工業材質|`assets/model/polyhaven/`|原始貼圖、來源 API 回應及校驗資料；按已有 manifest 取用。|
|煙、火球、爆炸圖集|`assets/vfx/`|本次補齊 41 張 PNG 的實際路徑、大小與 SHA-256；授權依各組既存 CREDITS。|
|交戰畫面參考|[官方影片與採樣筆記](s54-reference-index.json)|AC6、The Ascent、Helldivers 2 已定位；保存觀察範圍，沒有把靜態採樣寫成完整看片。|
|曾查過但未取得的場景|[環境候選與排除理由](s53-environment-pipeline.md)|保留登入、負載、授權與場景適配限制；條件未變就不重試。|

發現一項保存缺口：舊 VFX 說明列的兩個暫存 ZIP 現已不存在；PNG 素材本體仍在，已重新校驗。本輪沒有為此重下載，也不把「原始 ZIP 已歸檔」列為完成。往後新取得的原始包應放持久素材目錄，暫存只用於處理。

狀態分開記錄：已收藏連結 → 已下載 → 引擎可讀 → 用途驗收 → 遊戲驗收。素材可讀不代表完成度合格；目前 3D 場景與交火仍在試驗，不影響已認可的 2D 版本。

## S59：連續坍塌區通過局部用途驗收

本輪從同一份環境製作腳本延伸，使用已收藏的 Fleurman 破板／斷柱，替換左廠房一段結構，保留右側廠房作尺度對照，後景中央開出鐵道路徑。第二次修訂降低懸板，增加 27 塊來源碎片形成廠內→月台→地面的集中瓦礫；沒有向全場撒碎片。

![S59 最終空景，未開戰鬥特效](images/s59-environment-only.png)

![S59 我方、軍團與巨砲同框](images/s59-encounter.png)

Astra 獨立靜圖 Review：**本輪結構目標可收下；整體美術仍不通過**。左側已不再是孤立斷樓，坍塌與月台建立連結；不再追加第三輪碎片微調。中央遠景路徑可見，但這不是導航／碰撞驗收，也未證明遠方整段鐵軌可通行。

最終 GLB 66.33MB、約203.26萬場景三角面、18張內嵌圖。主 Agent 再驗 SHA-256 與內嵌圖片，不把大型研究檔載入正式遊戲。Apple M3／Godot Metal Forward+、1280×720靜態軍團同框：300個連續幀間隔的中位 14.15ms、P95 14.78ms、P99 15.02ms。測量包含呈現等待，沒有AI、輸入、交火負載；**不是戰鬥FPS保證**。方法使用 [Godot單調時間](https://docs.godotengine.org/en/stable/classes/class_time.html)，原始300筆資料存於 `probe-assets/s59-environment-run.json`。

### 材質問題已追到原檔，不再猜漏貼圖

Sol 技術美術稽核、PO 複查實際 GLB：Ameise 的2K色彩／法線與封存原圖逐位元相符；metallic／roughness引用的原依賴缺失，匯入使用固定0.48／0.42。Morpho原Unity材質沒有貼圖欄位實檔，GLB亦為0 images／8個常數材質；不是Godot把貼圖弄丟。這是需要補製表面內容的缺口。

![同鏡頭只顯示機體原色：軍團仍淡白且缺表面層次](images/s59-units-albedo-only.png)

原色對照仍呈現淡白低對比軍團；不能單靠加霧或壓暗解決。另試過把既存照明HDRI直接作可見背景，模糊樹線與地形接不上，故不採用，保留對照避免往後重試同一假設。

![既有 HDRI 作可見背景的退件對照](images/s59-existing-hdri-background.png)

### Review 形成下一步

1. Morpho材質先行：以既有幾何建立裝甲、裸露機械、砲軌表面差異，近景與全場固定光照比較；不是只把整機染深。Ameise保留已驗色彩／法線，再補缺失材質參數。
2. 完整步態／接敵動作：XM2、Ameise前進、轉向、落足、射擊需連續驗證，不能再以姿勢截圖代表已完成。
3. 材質基準成立後才統一全場光照及遠景。不增加更多廠房細節、VFX種類或新章節來迴避上述缺口。

保留完整3D任務、三種協同敵軍、高低掩體射線、整備與勝敗撤離等原Goal；這次結構驗收不取代它們。2D穩定核心未修改，研究頁同步本地供回饋。

## S58：同場交火試驗，完整美術仍未通過

先驗一發砲的前後過程。[開啟 12 秒交火診斷影片](s58-combat-v3.mp4)：Godot 實際輸出 1280×720、288 幀、24 fps 編碼，**是離線編排，不是即時效能或可玩任務證明**；沒有音訊驗收。

![S58 修訂後同場構圖](images/s58-combat-v2-0000.png)

第一版將黑底 RGB 火球大幅放大並維持 0.85 秒加色顯示，形成透明大泡；白煙貼圖的深色邊緣也變成黑圈。修訂保留既有來源，火球縮至短峰，換用既有黑煙並加少量粒子火花；彈道由瞬時整線改成移動的短曳光。依 [Godot Sprite3D 文件](https://docs.godotengine.org/en/stable/classes/class_sprite3d.html) 使用實際貼圖序列，沒有從參考影片抽取素材。

![第一版的光泡與帶黑圈煙塵，留作退件對照](images/s58-combat-0153.png)

![修訂後彈著短峰](images/s58-combat-v3-0142.png)

![修訂後餘煙與火花](images/s58-combat-v3-0153.png)

記錄為 9 次發射與 9 次命中事件，結束時煙塵／閃光暫態節點已清除。這只驗證試驗腳本事件與生命週期，不是遊戲傷害、命中判定或長時間記憶體測試。Morpho 原始前進 clip 有求值；Ameise 仍靜止，主角僅根節點躍進／後座，我方砲口仍是臨時偏移；不冒稱完整步態、砲架與後座完成。

獨立美術 Review 已退回第一版：Morpho 正面透視縮短失去尺度、主角裁切、煙球搶走視線、完好廠房及孤立斷樓仍像展示。第二版修正主角裁切及敵群重疊，但整體廢墟、材質與威脅關係仍未通過。既有 2D runtime 與公開站不變。

Morpho 的實測補正：模型角色從導軌網格、骨骼與原 GLB TRS 反算砲口，位於 `railgun_turret` 的局部 `(0, 999.88922, 0.032805)`，前方為局部 +Y。這是來源單位，完整骨骼世界變換已含模型縮放。既有動作有常數砲架 tracks，會覆寫自訂姿勢；第三版因此在 clip 求值後施加瞄準，再從同一骨骼變換發射。依 [Godot Skeleton3D 文件](https://docs.godotengine.org/en/stable/classes/class_skeleton3d.html)，骨骼 global pose 仍相對 Skeleton，不能誤當世界座標。

![Morpho 實測砲口與發射方向近景](images/s58-morpho-muzzle-close.png)

第三版腳本記錄射線與指定地面點約 0.0497m 偏差；獨立近景 QA 支持火光在雙軌前端、曳光方向相符，**不代表動畫全程通過**。砲架目前是受控姿勢試驗，尚缺機械關節限制、獨立砲管後座與遊戲射線碰撞。量測保存於 `probe-assets/s58-morpho-muzzle.json`，原始 GLB 雜湊未變。

Review 改變下一輪排序：先用已有戰損資產替換左側廠房中後段，形成連到月台的連續坍塌區；保留前端立面及右側完整廠房作尺度對照，移除孤立突出斷樓。固定鏡頭、不開特效也能讀出結構關係才過關。全場仍退件，暫不細修更多 VFX。

## S57：已取得有體積的戰損素材

Fleurman的CC0 Destroyed City Assets已下載、解壓、Blender匯入及渲染：61網格／15,857三角面／6張內嵌色彩圖。匯入需重接材質色彩圖，原始單位與FBX多餘layer警告尚有保真限制。美術總監同意作側後景廢墟與局部坍落掩體，**不適合直接替換整個工業場景**。

![已入庫的戰損模型，非遊戲最終畫面](images/s57-destroyed-city-intake.png)

原始檔：`assets/model/oga-destroyed-city/`；衍生GLB與檢查報告：工作目錄 `art-direction/86-reference/probe-assets/s57-destroyed-city-*`。新素材來源、限制及其他候選見 [環境管線S57實檔紀錄](s53-environment-pipeline.md)。下一步用已取得斷片建立局部坍落帶，接回同場移動與砲火，不再繼續排完好牆片。

## 收藏入口與使用規則（S56 更新）

先查這份索引，再搜尋。原始模型／貼圖已留在 `assets/model/`，匯入與場景衍生物在 `.worktrees/s45-3d-sortie/art-direction/86-reference/probe-assets/`。影片保存官方連結、時間碼與實看筆記，未下載影片，也不把影片當成可使用的遊戲素材。

- **素材總索引**：`s54-asset-archive.json`，含原檔、衍生檔位置、來源、授權範圍、大小、SHA-256、驗收階段。S56 重驗36個原始／依賴檔，以及4個衍生GLB的雜湊。
- **畫面參考索引**：`s54-reference-index.json`，已看過的AC6、The Ascent、Helldivers 2片段直接定位；不重複搜尋同一段。
- **匯入／製作證據**：`probe-assets/s55-*.json`、`s56-rail-environment.json`、`s56-encounter-run.json`；下載成功、引擎可讀、美術通過和即時可用是不同階段。
- **缺項才補收集**：檔案存在且校驗符合就直接重用；需要新動作、破壞場景或缺失貼圖時，只補該項並更新索引。原檔不覆寫，衍生物保留處理腳本。

|收藏類別|已有資源|使用判定|
|---|---|---|
|我方機甲|使用者提供M1A4；Project-86 XM2與早期M1A4|模型已入庫；XM2無內建動作，Project-86個別素材對外再散布仍未釐清。|
|軍團|Ameise、Morpho及其材質／貼圖／骨架|已有引擎驗證；Morpho有前進clip，但全場動畫、比例與效能未通過。|
|工業環境|Poly Haven廠房門窗牆面；粗混凝土、鏽金屬；S56完整廠房組合|CC0來源可重用，組合仍屬美術候選，不等於完成廢墟。|
|地表|rocks_ground_08、rubble，兩套1K色彩／法線／ARM／位移，共約9.08MB|原始8檔大小與SHA-256吻合。地表貼圖已用於本地試驗；位移圖尚未用。|
|爆炸與煙|Sinestesia爆炸atlas、Kenney煙塵、lava-blast序列|沿用既有素材；各自授權見VFX CREDITS，尚未通過3D交火驗收。|
|對照畫面|AC6工業交火與巨型機械、The Ascent環境分層、HD2機械軍團|只作畫面參考；已觀察範圍詳列下方，未宣稱完整影片或音訊驗收。|

## S56：素材組合的實際環境檢查

新下載只補地面缺項，來源為 [Poly Haven rocks_ground_08](https://polyhaven.com/a/rocks_ground_08) 與 [rubble](https://polyhaven.com/a/rubble)；沿用其 [CC0授權](https://polyhaven.com/license)。原始API回應、下載網址及校驗資料保存在各自目錄。

![S56 移除機甲後的環境實測](images/s56-environment-only.png)

![S56 全場同框實測，非完成版遊戲](images/s56-encounter-cinematic.png)

本輪以既有廠房套件組成五座有屋頂、側背牆及基座的廠房，加入雨棚、月台與水塔。原始衍生GLB為51.38MB、約181.9萬場景三角面；仍過重。Godot依35m區塊，將363個靜態重複實例放入10個MultiMesh群組；這不是軍團骨架合批，也不是FPS通過證明。

地形試驗為400×480m，中央維持平整，遠側提高地勢。首輪實測發現三角形面朝下，使地面被剔除；修正索引順序後，法線Y由負轉正，地表與接地陰影已在重出畫面確認。沒有以雙面材質或濃霧掩飾問題。最終圖由Godot／M3 Metal Forward+實際輸出。

結構改善不代表戰場美術完成：目前仍有整齊廠房、反覆地表與缺乏破壞／交火事件的問題。Astra獨立Review：整體美術不通過。下一個素材缺口是有體積戰損的工業／鐵道遺址套件，需破頂、斷裂月台、結構瓦礫及合理軌道出口；不再重複排完好牆片。詳細見 [獨立QA](s54-encounter-reference.md) 與 [Sprint紀錄](sprint-journal.md)。本頁圖片保留作後續比較，2D遊戲不受影響。

## S55：實際匯入與整場診斷，尚未通過美術驗收

2026-09-13。兩個新模型已經在 Blender 匯入並轉成內嵌貼圖／材質的 GLB，再於 Godot 4.7.2、Apple M3 Metal Forward+ 實際渲染。下面是引擎截圖，不是生成概念圖，也不是新遊戲版本。

![S55 全場診斷：XM2、24台Ameise與Morpho；環境仍未驗收](images/s55-encounter-cinematic.png)

|資產|實檔結果|尚未通過的項目|
|---|---|---|
|XM2／Reginleif|445,798三角面、59網格、54骨、0內建動作；1K PBR內嵌|即時負擔過高、需LOD／動作；法線G方向未獲作者資料確認。|
|Morpho|126,688三角面、774骨；GLB含前進與兩個單幀動作|40.2m長度校正後，目前姿勢高度約5.44m，與官網11.4m未對齊；不拉伸模型假裝符合。|
|軍團群|24台既有Ameise共用模型／材質資源入鏡|這不是24台完成步態、AI與效能的遊戲驗收。3.8m長度是構圖假設，非官方尺寸。|

匯入修正證據：Godot的未蒙皮mesh AABB會重複套根位移／縮放。Ameise一開始被錯量成約0.598m長，變形後實際界線約3.603m；改用骨架初始化後的姿勢烘焙界線，修正誤放大與接地基準。原始模型未修改。[Godot官方方法說明](https://docs.godotengine.org/en/stable/classes/class_meshinstance3d.html#class-meshinstance3d-method-bake-mesh-from-current-skeleton-pose)

已在引擎對Morpho前進clip取1.2與2.4秒姿勢；圖像不同且可見足部姿勢改變。這能證明clip可求值，不能替代連續步態、腳滑、射擊協同或3–5分鐘效能驗收。

![Morpho 原始動作1.2秒採樣](images/s55-morpho-motion-1.png)

![Morpho 原始動作2.4秒採樣](images/s55-morpho-motion-2.png)

美術總監第二次審查：**整體不通過**。XM2和兩翼群體已有對峙關係，但重複牆片、無起伏鋪面、空白天空仍像展示走道；Morpho像側向停放，尚無施壓事件。主Agent同意，不發布為可玩增量。

下一個最高優先項：沿用此機體與固定鏡頭，收斂到一套能組成完整鐵道廢墟的場景資產。驗收時先隱藏機甲，仍須看懂前景位置、兩翼進入路線與Boss後方深度；不能有裸露地面邊界、孤立立面，也不靠濃霧掩飾缺件。之後才做10–15秒完整交火節奏，接回遊戲。

技術證據保存在 `probe-assets/s55-reginleif-import.json`、`s55-morpho-inspection.json`、`s55-glb-verification.json`、`s55-skin-bounds.json`、`s55-encounter-run.json`；可重現腳本與衍生GLB同目錄。此頁僅同步研究，不改已認可2D平衡。

## 先看這三組參考

影片保留官方來源、精確採樣位置與觀察筆記；未下載影片。以下是實際播放器畫面採樣，沒有完整連續看片或音訊驗收。畫面觀察與我們的實作建議分開，不能從截圖推定原遊戲底層技術。

|參考／直接定位|實際看見什麼|我們要解決什麼|
|---|---|---|
|[AC6 官方 Gameplay Preview：3:45 起](https://www.youtube.com/watch?v=DcDjyestr4Y&t=225s)|工業構架、混凝土與岩壁限定交火空間；機甲推進、暖色砲口與偏冷背景形成區別。採樣約3:50–4:00，未量測完整動作。|地形要參與交火，不能只做平面背景；機體後座、推進與落足要同步。|
|[AC6：STRIDER 接近段 7:09 起](https://www.youtube.com/watch?v=DcDjyestr4Y&t=429s)|7:09 開闊接近、遠景霧與電桿；7:54 近身時巨型機械足／軀體超出畫面，玩家仍有可辨尺寸。兩個採樣，不是完整連續驗收。|巨大感來自同地面參照物、輪廓及接近過程。Morpho 要保持原作長高，不直接抄 STRIDER 的高腳造型。|
|[The Ascent 官方 Xbox Deep Dive：6:24](https://www.youtube.com/watch?v=Xf6iELuLqM4&t=384s)|斜俯視工業步道的上下層、欄杆、管線、反光與霧光；此採樣未見射擊，作環境參考。|把可走路線、背景設施、遠方深度分層；參考空間組織，不照搬霓虹配色。|
|[Helldivers 2 官方機械軍團預告：0:30](https://www.youtube.com/watch?v=B9VdtdWRcZs&t=30s)|工業陣地中不同大小機械敵人、橫越畫面的射線、左側爆炸、灰色煙塵與暖色火光同框。已確認30秒附近交火畫面，未驗證音訊。|軍勢、砲火、陣地共同構成威脅；不要所有敵人同時發白光、每次命中都變大火球。|

## 最大差距與第一個完整畫面

目前瓶頸是戰場沒有形成事件：單機、平地、牆面各自存在，沒有我方與軍勢及巨砲同框的關係。加細一塊材質不能解決這個缺口。

第一個候選畫面：前景 XM2，中景 18–30 台 Ameise 分三股推進，後方鐵道上的 Morpho。數量是構圖提案，不是原作編制。官方 Morpho 長40.2 m／高11.4 m；XM2 長6.3 m／高2.7 m，長度約6.38倍。高度的量測條件不同，不能直接把整個網格縮放4.22倍。[官方軍團](https://anime-86.com/mechanic/enemy/)／[官方我方機型](https://anime-86.com/mechanic/second-half/)

低角度展示鏡頭與正常斜俯視遊玩鏡頭分別驗證。前者確認魄力，後者確認腳邊退路和射線；不能只交漂亮的不可玩鏡頭。第一步驗收整個構圖，再處理材質、動畫及特效。

## 素材實際保存位置

路徑均相對專案根目錄。原始檔保留，衍生檔另存；不把大型研究原檔加入遊戲載入或 Pages 發布。

|用途|本地位置|目前狀態|
|---|---|---|
|玩家提供的 M1A4|`assets/model/juggernaut_86_eighty-six.glb`|既有1K實檔；已驗95,482三角面、無內建骨架動畫；不是XM2。|
|Reginleif／XM2 候選|`assets/model/project86-source/Reginleif_Model.fbx`|已下載14,005,052 B，LFS SHA-256吻合；S55已匯入，59網格／54骨／無內建動作；美術與即時預算未通過。|
|Morpho 候選|`assets/model/project86-source/morpho walk forward anim.fbx`|已下載91,856,124 B，LFS SHA-256吻合；S55已匯入，前進clip姿勢可求值；連續動作、官方高度與即時預算仍待驗收。|
|Ameise 原始模型／貼圖|`assets/model/project86-source/ameise/`|從S51暫存歸檔，含原FBX、原貼圖、2K衍生貼圖與先前匯入檢查。|
|早期 Juggernaut 原始模型／貼圖|`assets/model/project86-source/juggernaut/`|同上，避免暫存被清掉後重新取得。|
|工業牆、門窗與PBR|`assets/model/polyhaven/modular_factory_facade/`|既有17檔、約17.6MB、CC0；有 intake-manifest；不是完整廢墟或鐵道場景。|
|爆炸序列|`assets/vfx/sinestesia-explosion-2-*.png`|既有CC0 atlas；先用於3D平面粒子試驗，尚未做3D視覺驗收。|
|煙塵|`assets/vfx/kenney-smoke/`|既有4張CC0煙塵PNG；不要重找同組。|
|火球序列|`assets/vfx/lava-blast/`|既有32幀、CC-BY3.0；黑底RGB，適合發光混合，不適合做遮蔽黑煙。|

新檔的來源URL、Git LFS指標、位元組與SHA-256存於 `assets/model/project86-source/intake-manifest.json`；舊檔歸檔雜湊存於同目錄 `s51-archive-manifest.json`。Project-86 根GPL不等於各項第三方素材對外再散布已釐清，目前作本地研究候選。詳細來源沿用 [既有授權／重用稽核](project-86-reuse-audit.md)，不要每次重新判讀。

本輪歸檔合計28個資料檔、166,167,319 B（約166 MB），逐檔重新核對manifest中的大小與SHA-256。另保留LFS指標與說明文件。Reginleif三張必要貼圖、Morpho八個材質描述及兩個FBX meta亦已保存；這不等於完成跨引擎匯入。

## 怎麼做：以既有資產和引擎功能組合

以下是我們的候選作法，尚未實裝，也不是宣稱參考遊戲採用相同技術。

|畫面問題|最小實作路徑|驗收證據|
|---|---|---|
|巨砲沒有尺度|匯入Morpho、依官方尺寸校正；鐵道／電桿／同地面敵群作比例參照；相機固定對照。|兩種鏡頭都能辨識我方、軍勢、巨砲，不靠名稱或血條說明。|
|敵人像複製玩具|近處少量完整步態，中景共享網格／材質並錯開步伐，遠景降細節；編成保留間隙。|18–30台同框的實際幀時間、輪廓及接地；不得宣稱骨架可直接MultiMesh批次播放。|
|特效只是一閃|一個攻擊拆成瞄準／蓄力、砲口與後座、飛行、落點火花與碎片、餘煙；既有atlas配3D粒子。|同一發砲從來源到落點可追蹤，煙不遮掉逃生區。|
|場景扁平|既有工業套件作兩翼，中央保留鐵道與射界；近景碎石、中景敵群、遠景煙塵及地平線分層。|灰階縮圖仍看得出主角、威脅與路線。|
|材質像塑料|先核原貼圖接法、正常曝光與環境光，再針對塗裝／裸露金屬區分粗糙度；不全物件拉高metallic。|同鏡頭原材質／修正材質對照，不用全面霧化掩蓋錯誤。|

The Ascent 團隊公開說明使用可重用環境組件、主材質與材質實例，並混合烘焙／動態光，部分特效使用 Niagara。值得借鑑的是建立可重用資產組合，不是為了模仿而再架一整套 Houdini 管線。[開發者訪談](https://www.unrealengine.com/developer-interviews/11-person-studio-neon-giant-delivering-next-gen-passion-project-the-ascent)

Godot 現有 GPU 粒子可使用網格繪製通道，適合先把現有煙塵／爆炸素材做成有限的3D特效。[官方粒子文件](https://docs.godotengine.org/en/stable/tutorials/3d/particles/creating_a_3d_particle_system.html) 體積霧需 Forward+，短促閃光要處理時間重投影的殘影；網頁／Compatibility 不可假定有同一效果。[官方霧文件](https://docs.godotengine.org/en/stable/tutorials/3d/volumetric_fog.html) MultiMesh 應分區，因為個別實例沒有獨立視錐剔除；不能只因能批次畫就無限堆軍團。[官方最佳化文件](https://docs.godotengine.org/en/stable/tutorials/performance/using_multimesh.html)

這些功能支持先做單場交戰驗證，尚不足以決定全面從網頁遷移。Context7 工具本輪不可用，因此核對上述官方文件；API實作時還須對照實際引擎版本。

## 下一輪直接接續，不重查

1. 先讀本頁與兩份manifest；來源檔已存在且雜湊吻合就不重新下載。
2. Reginleif／Morpho匯入已完成，直接讀S55結果；下一步是缺少的完整動作與即時成本，不重做下載／格式辨識。
3. 使用已有Ameise和環境素材做完整交戰構圖。先交整場，再交同場10–15秒的交火節奏試驗。
4. 只補尚缺的鐵道／大型Boss依賴／合適煙塵序列；取得來源和作者授權資料一起入庫。

不重查已核對的機型尺寸、不重新下載Kenney煙塵、不把漂亮影片當作已取得可用模型。影片與參考遊戲美術只作觀察，不從播放器擷取幾何或打包為遊戲素材。
