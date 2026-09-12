# S54：交戰參考與可重用素材庫

2026-09-13。先收集與驗證整場交戰所需素材，再做場景。這是研究紀錄，沒有把正式 2D 或被否決的 3D 試驗場改成新版本。

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
|Reginleif／XM2 候選|`assets/model/project86-source/Reginleif_Model.fbx`|已下載14,005,052 B，LFS SHA-256吻合；尚未驗收匯入、材質、骨架。|
|Morpho 候選|`assets/model/project86-source/morpho walk forward anim.fbx`|已下載91,856,124 B，LFS SHA-256吻合；不能因檔名有walk就宣稱動畫可用。|
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
|巨砲没有尺度|匯入Morpho、依官方尺寸校正；鐵道／電桿／同地面敵群作比例參照；相機固定對照。|兩種鏡頭都能辨識我方、軍勢、巨砲，不靠名稱或血條說明。|
|敵人像複製玩具|近處少量完整步態，中景共享網格／材質並錯開步伐，遠景降細節；編成保留間隙。|18–30台同框的實際幀時間、輪廓及接地；不得宣稱骨架可直接MultiMesh批次播放。|
|特效只是一閃|一個攻擊拆成瞄準／蓄力、砲口與後座、飛行、落點火花與碎片、餘煙；既有atlas配3D粒子。|同一發砲從來源到落點可追蹤，煙不遮掉逃生區。|
|場景扁平|既有工業套件作兩翼，中央保留鐵道與射界；近景碎石、中景敵群、遠景煙塵及地平線分層。|灰階縮圖仍看得出主角、威脅與路線。|
|材質像塑料|先核原貼圖接法、正常曝光與環境光，再針對塗裝／裸露金屬區分粗糙度；不全物件拉高metallic。|同鏡頭原材質／修正材質對照，不用全面霧化掩蓋錯誤。|

The Ascent 團隊公開說明使用可重用環境組件、主材質與材質實例，並混合烘焙／動態光，部分特效使用 Niagara。值得借鑑的是建立可重用資產組合，不是為了模仿而再架一整套 Houdini 管線。[開發者訪談](https://www.unrealengine.com/developer-interviews/11-person-studio-neon-giant-delivering-next-gen-passion-project-the-ascent)

Godot 現有 GPU 粒子可使用網格繪製通道，適合先把現有煙塵／爆炸素材做成有限的3D特效。[官方粒子文件](https://docs.godotengine.org/en/stable/tutorials/3d/particles/creating_a_3d_particle_system.html) 體積霧需 Forward+，短促閃光要處理時間重投影的殘影；網頁／Compatibility 不可假定有同一效果。[官方霧文件](https://docs.godotengine.org/en/stable/tutorials/3d/volumetric_fog.html) MultiMesh 應分區，因為個別實例沒有獨立視錐剔除；不能只因能批次畫就無限堆軍團。[官方最佳化文件](https://docs.godotengine.org/en/stable/tutorials/performance/using_multimesh.html)

這些功能支持先做單場交戰驗證，尚不足以決定全面從網頁遷移。Context7 工具本輪不可用，因此核對上述官方文件；API實作時還須對照實際引擎版本。

## 下一輪直接接續，不重查

1. 先讀本頁與兩份manifest；來源檔已存在且雜湊吻合就不重新下載。
2. 驗收Reginleif／Morpho的實際網格、材質依賴、骨架和動作；缺貼圖才精準補檔。
3. 使用已有Ameise和環境素材做完整交戰構圖。先交整場，再交同場10–15秒的交火節奏試驗。
4. 只補尚缺的鐵道／大型Boss依賴／合適煙塵序列；取得來源和作者授權資料一起入庫。

不重查已核對的機型尺寸、不重新下載Kenney煙塵、不把漂亮影片當作已取得可用模型。影片與參考遊戲美術只作觀察，不從播放器擷取幾何或打包為遊戲素材。
