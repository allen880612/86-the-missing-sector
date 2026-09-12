# Project-86 素材重用稽核

查核日期：2026-09-12。範圍僅限 [Taliayaya/Project-86](https://github.com/Taliayaya/Project-86) 的公開 README、LICENSE、檔案樹、PR、release metadata 與小型文字檔；未 clone，只抓下文兩組最小 Git LFS 研究集，未下載遊戲、未安裝或開啟 Unity，也未稽核子模組內容。因此這是權利與庫存初篩，不是完整工程實測。

## 結論

**這個 repo 證明已有相當完整的 86 機甲、動畫與 Unity 地圖工程可研究，但目前證據不足以把其中模型／地形視為可放心移植的「免費開源素材包」。** 可以先研究其程式、結構與製作方法；根 GPL 可能涵蓋作者自行提供的素材，但第三方來源仍須釐清；不建議整包搬入正式版。S51 已對兩組來源較明確的機體完成本地實檔驗證，見素材盤點；不能把整庫未清楚的來源問題等同每個模型都無法研究。

此發現會提高「以 Unity 6.4 開一個唯讀相容性／資產盤點試驗」的價值，因 repo 本身是 Unity `6000.4.3f1` 工程；它不足以支持現在遷移引擎。若最後不能合法重用資產，Unity 相容性優勢會大幅縮小。

## Ameise 最小本地研究集（追加查核）

針對單一 Ameise 做較窄的查核後，結論可比上面的整庫保守判斷更積極：**僅在本機研究、轉檔與改造，不公開散布的用途，有合理依據使用這組檔案。** 根 [GPLv3](https://github.com/Taliayaya/Project-86/blob/main/LICENSE) 未把 `Assets/` 排除；README 又稱「all the game files」公開以便 coding、modeling contribution。GPL 明定可製作、執行與 propagation 而不 convey；私人修改本身不觸發提供 source 的散布義務。這不是對外發布的充分清權：86 原作造型屬衍生內容，repo 未出示原 IP 授權，提交者能否授予全部素材權利仍是待解問題。

歸屬證據也不是「無個別 license 所以不能用」：模型與兩張貼圖最初由 BricksA9 署名 commit [`547aabde`](https://github.com/Taliayaya/Project-86/commit/547aabde865affb65829d1b40297e84081b0e01f)，經 [PR #122](https://github.com/Taliayaya/Project-86/pull/122) 合入；模型 rig 又由同一作者在 commit [`19ae17dd`](https://github.com/Taliayaya/Project-86/commit/19ae17dd3b0541d1647e7be4206111ec14706758)／[PR #127](https://github.com/Taliayaya/Project-86/pull/127) 更新。PR 沒標第三方來源；repo 搜尋 `asurada` 只命中引用此模型的 prefab，未找到外部 attribution。這支持「貢獻者自製並放入 GPL repo」的合理推定，但不是權利保證。

已下載到 `/private/tmp/s51-project86-ameise/`，未下載 Unity、prefab、動畫或執行檔：

| 檔案 | main Git blob | LFS SHA-256 | LFS 大小 |
|---|---|---|---:|
| `Ameise asurada model.fbx` | `674ed5d9e29e905cae8464d38a217f58d17c5e01` | `38bc6be984b968fbb2f7b731455dbf148cd118d18d084d6808dfbee18f90b186` | 1,348,940 B |
| `ameise 4k color.png` | `ce6e7f6b60241664625069237783f9c6c8c72c68` | `2b8f3d3b6db0c74a7289cb065b4b24031d607a8e12a8c8d25a4743f839dbc18a` | 4,117,279 B |
| `ameise 4k normal.png` | `d8a61ee576719d95db9896f3a6129961d5f26224` | `d99b3652b4a49a9db127a252b627f6ef709b3cfdd33ff67ae38d8f46bd08a521` | 868,934 B |

下載後 SHA-256 與 LFS pointer 全數相符。必要貼圖只有 base color 與 normal：Unity `Ameise material.mat` 的 `_BaseMap`／`_MainTex` 與 `_BumpMap` 正好引用這兩個 GUID，metallic、occlusion、emission 等 map 為空。待解依賴為：S51 已開檔確認網格、蒙皮、骨架，但原檔無動畫 Action；Unity material 使用 URP shader，跨引擎需手動重建材質；prefab、碰撞、Animator、死亡動畫不在此最小集；公開發布前仍須釐清 BricksA9 的原始製作與 86 IP 授權鏈。

同一 tree 沒有 Ameise walk／run／idle 動畫 FBX；只找到 `Assets/PermResources/Animations/Ameise/ameise react to dash v1.fbx`（258,028 B）與 `ameise react to dash with mesh.fbx`（2,528,860 B）。兩者本次只讀 LFS pointer、未下載。另有 Unity `.anim`，但不屬 FBX 且不能推定跨引擎自足。

## Juggernaut／M1A4 最小本地研究集（追加查核）

選用 `Assets/PermResources/Models/NewTexturedJuggernaut.fbx`。它是目前較新的獨立著色版本；Unity meta 設為 Generic rig、`skeletonHasParents: 1`、匯入動畫但沒有 clip，且不依賴 prefab 或場景。它綁定 `Jugg_Texture.mat`；該材質的 base color 與 normal GUID 分別對應 `Robot_2_Base_Color.png`、`Robot_2_Normal_OpenGL.png`。三檔共 13,075,016 B（約 12.5 MiB），低於 50 MB 上限；本次只取這兩張視覺必要貼圖，未抓 metallic／roughness／height／AO，可用材質常數重建較簡化外觀。

來源證據支持本地研究，但公開發布仍需清權：[PR #129](https://github.com/Taliayaya/Project-86/pull/129) 由 Taliayaya 提交「new juggernaut model with textures」，資產 commit 是 [`cfad39ff`](https://github.com/Taliayaya/Project-86/commit/cfad39ff6b038512d821eaac46a4c82a6b32745f)，合併 commit 為 [`c1be5624`](https://github.com/Taliayaya/Project-86/commit/c1be562419f8b68313064d94a0f0216250c8dcaf)。兩張 `Robot_2` 貼圖的目前 path history 指向 [`eeb0b3e0`](https://github.com/Taliayaya/Project-86/commit/eeb0b3e0d281ef801bfa811e59f417eb505be7a3)；release 另感謝 ExcalibursBlad 的 Juggernaut model／texturing 與 Anto 的 poly optimization。未見 Asset Store 或第三方模型來源標記，但作者歸屬不只一人，公開再散布不能只靠 PR 提交者推定。根 GPL、README 與私人不 convey 的分析同 Ameise，因此本地研究／改造合理。

已下載至 `/private/tmp/s51-project86-juggernaut/`：

| 檔案 | main Git blob | LFS SHA-256 | LFS 大小 |
|---|---|---|---:|
| `NewTexturedJuggernaut.fbx` | `3a3ada1320e544287f694d2dc94818b42fdf5dc7` | `e405d5221c513a593f3763a90681bcf963c0906a47e705efa3384667061f88a1` | 4,381,500 B |
| `Robot_2_Base_Color.png` | `9c0ce5e1585621326067fbaee3c775c60f9df434` | `0ae4fbca0a77348142e0b1617052340ac4ec951be3cc642ea9424639ee892dd6` | 2,359,566 B |
| `Robot_2_Normal_OpenGL.png` | `5cf6dcee42c2668d7daf3a366a5e751544a8985c` | `e712a4bd003083608fe4b197b29c0fe5d7f14914d54c48ce786bfd6b5bf22d20` | 6,333,950 B |

下載後 SHA-256 與 LFS pointer 全數相符。待解依賴：S51 已匯入，確認 UV 與可驅動的剛性關節階層；不是蒙皮角色；FBX 的 `Jugg_Texture` 要跨引擎手動重建；metallic／roughness 未包含；沒有 locomotion actions、prefab、碰撞、武器邏輯或個人標記；86 原作 IP 與各貢獻者對外授權鏈仍待釐清。

## 三件不同的事

| 判斷 | 結論 | 證據 |
|---|---|---|
| 免費遊戲 | 是，可免費下載其 alpha build；但「免費玩」沒有授予抽取素材的權利。 | [README：Download／Disclaimer](https://github.com/Taliayaya/Project-86#download) 明稱 community fan game，且 Steam 仍需原 IP 授權。 |
| 開源程式 | 根目錄標示 GPL-3.0，C# 原始碼公開；重用／散布 GPL covered code 須履行 GPL。 | [LICENSE](https://github.com/Taliayaya/Project-86/blob/main/LICENSE) 是未加例外的 GPLv3 全文；[repo 首頁](https://github.com/Taliayaya/Project-86) 顯示 GPL-3.0。 |
| 可重用模型／地形 | **未證實。** 公開可見與位於 GPL repo，不等於每個素材的作者有權用 GPL 再授權；repo 沒有資產總表、逐項 license 或對 86 原作權利的授權。 | README 只列一般 contributions／fan-game disclaimer；模型 PR 只顯示提交者，沒有授權聲明。 |

## 實際可見的 86 內容

- `Assets/Resources/Models/`：Ameise 與 Grauwolf 的 FBX、材質及 2K/4K 貼圖。[Ameise PR #122](https://github.com/Taliayaya/Project-86/pull/122) 由 Taliayaya 帳號提出，但實際資產 commit author 是 BricksA9；[Grauwolf 由 BricksA9 加入](https://github.com/Taliayaya/Project-86/pull/142)。兩個 PR 均未附個別資產授權。
- `Assets/PermResources/Models/`：多版 Juggernaut、Reginleif、Dinosauria、Löwe、Ameise、Scavenger、FIDO、Morpho 動畫 FBX及大量貼圖／材質。最新版 Reginleif PR 只有 FBX與 4K 貼圖，提交者是 Taliayaya，未附授權；參見 [PR #165](https://github.com/Taliayaya/Project-86/pull/165)。Morpho 在主 repo 可確認材料、controller、Unity `.anim` 與 `morpho walk forward anim.fbx`，但找不到明確獨立命名的完整基礎模型檔，不能保證可單獨抽出。
- `Assets/PermResources/Animations/`：Juggernaut dash／recoil／death、Grauwolf attack／dash／launcher／death、Reginleif recoil、Morpho forward／tail／wing／stunned、Ameise、Löwe、Dinosauria等 Unity animation/controller 資料。技術上多與 Unity GUID、骨架和 prefab 綁定，跨引擎不能假定即插即用。
- 地圖可見 `Assets/Scenes/MorphoMission.unity`、`Small City`、`TestMap`、多塊 `TerrainData_*.asset`、NavMesh、lightmap；[v2.0.0-alpha.1 release](https://github.com/Taliayaya/Project-86/releases/tag/v2.0.0-alpha.1) 宣稱 6 km × 6 km 新地圖、Morpho、Reginleif 與 Unity 6.4。release 說明不是素材授權，也無法只靠 LFS 指標驗證尺寸、完整依賴或獨立可攜性。

## LFS、子模組與第三方依賴

[`.gitattributes`](https://github.com/Taliayaya/Project-86/blob/main/.gitattributes) 將 `*.fbx`、`*.unity`、`*.png`、`*.jpg`、`*.mp3`、`*.asset` 等交由 Git LFS。檔案樹中這些 blob 常只有約 128–133 bytes，表示 Git 儲存的是 pointer；必須另取 LFS 物件才是內容；本次只下載上列兩組模型與貼圖，完整工程／TerrainData 未驗。

`Assets/Additional Assets` 是 gitlink；[`.gitmodules`](https://github.com/Taliayaya/Project-86/blob/main/.gitmodules) 指向 `git@github.com:Project-86-Community/Project-86-Additional.git`。主 repo 因此不是自足封包，而且使用 SSH URL；本次依限定未跨 repo 稽核。v2.0 亦在同批變更加入此子模組，6 km 地圖可能有部分依賴在其中，但目前不能斷言。

[Packages/manifest.json](https://github.com/Taliayaya/Project-86/blob/main/Packages/manifest.json) 除 Unity URP、Terrain Tools、Animation Rigging、AI Navigation、VFX Graph、Netcode 等套件，還引用 Discord SDK、NuGetForUnity、UnityMeshSimplifier、HierarchyDecorator；Assets 內另有 FMOD、Steamworks.NET、BeamPackage、Gaia User Data、Day-Night Skyboxes、iPoly3D Server Room 等第三方內容。少數檔案有個別 license（FMOD、Steamworks、音樂、字型），但沒有一份涵蓋所有資產的 attribution/license manifest。Unity Asset Store 或其他第三方素材通常不能因被放進 GPL repo 就推定可再散布或改作。

## 建議決策門檻

1. 現階段把 repo 當「可執行參考與 Unity 製作證據」，不要當已核准素材庫。
2. 若要反轉 Unity 選型，先做小型、唯讀的 Unity 6.4 稽核：確認 LFS／子模組能完整還原、列出每個目標 mech 的 mesh／rig／animation／texture 依賴，並隔離第三方套件；仍不搬入正式專案。
3. 真要重用前，需由權利人明確回答：哪些自製 FBX／貼圖／動畫／TerrainData 受 GPLv3 或另一資產授權、哪些來自 Asset Store／原作衍生、允許哪些商業與再散布方式。不必預設每個 GPL 自製素材都要另外取得許可；先釐清目標素材是否屬授權範圍與第三方例外，未釐清者選用來源較明確的替代素材。
