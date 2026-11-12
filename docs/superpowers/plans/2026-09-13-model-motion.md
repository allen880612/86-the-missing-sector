# S52 真模型動作接入 Implementation Plan

> 使用 subagent-driven-development，動作美術與戰場整合分工，交付後另派獨立驗收。

**Goal:** 把已取得的 M1A4 真模型與承重步態、砲管後座、躍進收腿接進本地 3D 樣板，取代玩家程序外觀。
**Architecture:** 保留 Babylon 9.26 與現有 core/render 分離。真模型經 AssetContainer 載入並重用，依實際位移取樣動作；glTF 局部 +Z 與核心 -Z 以父節點轉換。程序敵機仍明示待替換。
**Tech Stack:** Blender 4.5.13 CLI / bpy、GLB、Babylon 9.26、Node、CUA。
**Spec:** 既有 3d-game-design.md 與 2026-09-12-3d-sortie.md；使用者要求先验多足模型及動作。

## 限制與決策
- **使用者 Review 否決（2026-09-13）**：S52 動作接入不能當產品交付。停止戰鬥擴充及發布，先處理模型／地景／材質／光照；UI 沿用成熟 2D 入口。S53 以真實戰場美術樣片為目標，重評製作工具，不預設網頁。
- Plan 週用量 21%；保留至少 30%，65% 停派工、68% 收尾。
- 2D game-core.js 不變。M1A4 使用試驗配置，不冒稱 XM2 或原作精確性能。
- Project-86 資產先本地研究；公版待權利及發布 gate。Sketchfab 使用者正在提供另一來源，不阻塞本輪。
- 不重啟既有服務。完整增量才同步 root 8767；研究半成品留 worktree。
- 不以載入成功當視覺驗收；看落地、朝向、砲口及重試結果。

## Task 1 動作美術（Astra）
- [ ] 檢查骨架，輸出 s52-juggernaut-motion.glb、同名 JSON 與重現脚本。
- [ ] idle / walk / recoil / vault；原地、Y up、+Z forward，記錄腳落地误差、距離、砲口及限制。

## Task 2 整合（PO）
- [ ] game-3d-models.js：載入、建立模型、位移驅動動作、砲塔瞄準、銷毀。
- [ ] game-3d.js / sortie-3d.html：等待模型完成後啟用出擊、M1A4 正確身分、載入失敗明示。
- [ ] 依模型砲口更新 3D 核心射線契約，僅有需要時增加 meaningful regression test。

## Task 3 驗收與回饋
- [ ] CUA 實際檢查靜止、移動、轉向、後座、躍進、重試；獨立 Agent 檢查交付限制。
- [ ] Node 核心測試及 2D hash；本地完整增量同步、Review / Retro，保留未完成清單。

## 參考
- https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/importers/assetContainers.md
- https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/animation/advanced_animations.md
- Context7 目前無可呼叫工具，採官方文件與本地固定版本程式核對。
