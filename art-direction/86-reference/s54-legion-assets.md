# S54 軍團戰場資產盤點

結論：第一張完整交戰畫面可先用既有 XM2／Reginleif、已驗 Ameise 大群與遠後方 Morpho。敵群不必再做單機材質測試；最大缺口是 **Morpho 實檔驗收與降面**，不是「找不到模型」。動畫官網給定 Morpho 全長 40.2 m、全高 11.4 m；XM2 為 6.3 m／2.7 m，畫面應保留約 6.4 倍長度差。[官方軍團](https://anime-86.com/mechanic/enemy/)／[官方 XM2](https://anime-86.com/mechanic/second-half/)

|資產／來源|可取得性、格式、授權|動畫／實知面數|判定|
|---|---|---|---|
|既有 Ameise（Project-86／BricksA9）|FBX；公開 Git LFS、免登入；repo 根 GPL-3.0，但《86》IP 與素材再授權鏈未清，只限本地研究|已實匯：18,622 triangles、有效蒙皮、29 joints；原檔無動作|**已有**；同一 GLB 實例化成前中景軍團，另做低模遠群|
|[Reginleif_Model.fbx](https://github.com/Taliayaya/Project-86/blob/main/Assets/PermResources/Models/Reginleif_Model.fbx)（Project-86）|FBX 14.0 MB，公開免登入、免費；同上授權限制；4K 貼圖另檔|Unity meta 為 Generic rig、無內建 clip；另有 recoil `.anim`；面數未知，已下載並驗證LFS SHA-256；匯入待驗|**實檔已歸檔、匯入未驗**；下載優先於另找 XM2，先核 mesh／骨架／貼圖總量|
|[Löwe - 86](https://sketchfab.com/3d-models/lowe-86-96027bc691ed4894a1d21108e1a51d44)（76th）|頁面免費下載、CC BY 4.0；實際格式與登入要求未驗|15,910 faces、8,412 vertices、1 animation|**高價值增兵候選**；低面數優先於 Project-86 的 49.4 MB Löwe FBX|
|[Dinosauria_V2.fbx](https://github.com/Taliayaya/Project-86/blob/main/Assets/PermResources/Models/Dinosauria_V2.fbx)（Project-86）|FBX 71.4 MB，公開免登入、免費；同上授權限制|4 組 PBR 貼圖材質、另有 Unity death；面數未知，已下載並驗證LFS SHA-256；匯入待驗|**備選 Boss**，不是 Morpho 替身；本輪不下載|
|[Morpho FBX](https://github.com/Taliayaya/Project-86/blob/main/Assets/PermResources/Models/morpho%20walk%20forward%20anim.fbx)（Project-86／Taliayaya 提交）|FBX 91.9 MB，公開免登入、免費；同上授權限制|meta 明示 108 幀前進 take；另有 forward／tail／wings／stunned Unity clips；面數未知，已下載並驗證LFS SHA-256；匯入待驗|**本輪核實的唯一可下載 Morpho 候選**；已完成本地下載及雜湊核對；後續 Blender 匯入、三角面／材質／骨架／比例稽核|
|[Morpho 作者 WIP](https://www.reddit.com/r/EightySix/comments/1wa9pso/wip/)|Blender 視覺展示；作者只稱日後可能整批發布，現無下載、價格或授權|測試動畫；面數未知|**不可用**，只作視覺參考；不可擷取幾何|

## 第一畫面編成

近景 1 台 XM2、前中景 18–30 台既有 Ameise、其中 2–4 台以 Löwe 候選增加尺度層級；Morpho 依官方比例置於後方鐵道／地平線，仍需保持砲身與翼狀輪廓可讀。若 Morpho 實檔尚未驗收，畫面標為研究預視，不以放大 Dinosauria 或程序蜘蛛冒充。使用者要求收集後，主Agent已將兩個FBX保存到根目錄 assets/model/project86-source/，含來源與LFS雜湊；91.9 MB限制是前一個Agent子任務的下載限制，並非使用者限制。材質依賴另列如下。

## 兩個 FBX 的最小材質依賴

依 Project-86 的 Unity meta／prefab 核對；仍須待 FBX 實匯確認 Blender 材質槽與 UV，以下不把同資料夾檔案全算入。

|FBX|需保存的精確 repo path／GUID|已確認與未確認|
|---|---|---|
|`Assets/PermResources/Models/Reginleif_Model.fbx`|材質 `Assets/PermResources/Models/Reginleif Textures/Reginleif_standard.mat`（`db9b2bd2479318d4aba7d61e6568cff0`）；色彩 `.../reginleif 4k color.png`（`685e7b3c4b9105d4a974453739818bb0`，15,134,778 B，LFS SHA-256 `d0d02b961da6179e10ff012051c7a9c101d99e0d1ba200fae1e5f620d5940d2c`）；金屬 `.../reginleif 4k metallic.png`（`82e75aae8c830794b93d9b2ab9640007`，6,603,530 B，SHA `4dbdf409192c7420e28bd61a8786d8351b01f2d6ac4e61bb6db232676cdbbfad`）；法線 `.../reginleif 4k normal.png`（`a4a60b8479f469d4a80b881c59650641`，6,554,082 B，SHA `d69bcca5513f1924240f44a6b3f3ed2c3010f269eb54b99df4b64724979c96c2`）|正式 `Reginleif.prefab` 的該 FBX renderers 均綁此材質；材質分別以 `_BaseMap`、`_MetallicGlossMap`、`_BumpMap` 引用三圖。`reginleif 4k roughness.png` 存在但未被此材質引用，排除於最小集。FBX 內嵌材質槽名稱仍未確認。|
|`Assets/PermResources/Models/morpho walk forward anim.fbx`|目錄 `Assets/PermResources/Models/Morpho Materials/` 下八材質：`composite sensor morpho.mat`（`0f85e8672968711a6b867ff4bce05e8b`）、`morpho armor - dark silver.mat`（`84ebddebf59586b1ebe3f3c56eb39e3d`）、`morpho armor - dark stone silver.mat`（`a101597e5f43816cfb49c63298577aad`）、`morpho armor - silver.mat`（`65316bbf806f0549daa0ced095818b40`）、`morpho armor - stone silver.mat`（`5d2db77b8fc411dd2a963732856a87e2`）、`morpho black.mat`（`be01aa43339d692beacdd83c35bf710f`）、`morpho grey.mat`（`e7f032b3e7842058a96e5fc74693fb93`）、`morpho railgun cannon color.mat`（`beba8ca5f13f233719e3224ad607a4ef`）|FBX meta 明列這八個外部材質；逐檔核對所有 Unity `m_Texture` 均為 `fileID: 0`，所以**未發現影像貼圖依賴**，外觀靠 BaseColor／Metallic／Smoothness 常數。`morpho weakness.mat` 雖在目錄中，未列於此 FBX mapping，排除於最小集。FBX 是否另含未映射材質或貼圖仍待實檔確認。|
