# S45 立體戰場獨立產品 QA

測試時間：2026-09-12 22:26–22:41（Asia/Taipei）
入口：`http://127.0.0.1:8767/.worktrees/s45-3d-sortie/sortie-3d.html`
Git HEAD：`9a3d959f3faf9f3073a14e289ffd912f204c6e69`（3D 檔案尚為工作樹新增檔，另記內容雜湊）

凍結候選內容雜湊：

- `game-3d-core.js` d6cb2fdae9874141596859d7b11949c44cd56d9a8673814a6e0a8ce9ddc04968
- `game-3d.js` 7c00e46a3026ca6c97817fa749b3ebd514f5e374a7e11d925731762f9b7cf272
- `game-3d-models.js` 3669981acef266bf4c885213e9f767e2ad5fc271fd4bb4bbecc1879dcc4b10f6
- `game-3d.css` b41c1086131299b1d869e3f3d3488311686fe016bdb0417a0c8e95138190af56
- `sortie-3d.html` 4361e482195df8f4361052742ef1d3697a676a575e34ac6c941836bbe1f11708

## 結論

最終有界回歸後沒有未解的 P0／P1／P2。初驗找到的 2 個 P1（高頻刃穿高牆、獵兵鎖定預警辨識度不足）與 1 個 P2（小地圖缺少可見圖例）均已修正並通過針對性回歸。其餘主要流程及資源回收通過。

回歸候選內容雜湊：

- `game-3d-core.js` 2bfdc5e5bdf6383bf50e9add34a9529aab864ed35dc386b732817413cbcd2f13
- `game-3d.js` 17cb99d581fe49af63141ab5cecf580ffbd819d11dd9df20ddc1a0a773444487
- `game-3d.css` 8468e338aa107d54e7404ef8342ada5f9e0c5cf4d28c34b897a74c77159762f2
- `sortie-3d.html` 7325d0d4b79dcdfcfaeeca3ec61813da5022c541c250c0715176c8e0611802a2

## 已修正並通過回歸的 P1

### P1-1 高頻刃穿過高牆（已解決）

固定 seed 核心重現：玩家置於 `(-20.2, 8)`，斥候置於 `(-15.8, 8)`，兩者之間是 `high-west`（中心 `x=-18,z=8`，`w=2.4,d=13,h=3.8`）。送入一次左鍵技能後，斥候 HP `55 → 21`，實受 34 傷，技能冷卻為 4.4 秒。同一步還產生 `wall-hit`，表示高牆確實存在且阻擋砲彈，近戰卻無視牆面。

修正回歸：使用完全相同的 `/private/tmp/s45-blade-los.cjs` 與座標重跑，斥候 HP 維持 `55 → 55`、傷害 0；同時仍出現 `blade` 與 `wall-hit`。針對測試「high walls block blade damage but do not block area support」1/1 通過，覆蓋無牆可傷與支援可越牆。

重現資料：`/private/tmp/s45-blade-los.cjs`

### P1-2 獵兵鎖定預警與玩家識別環混在一起（已解決）

真 Chrome 戰鬥中，公開狀態已出現 `hunter-warning`、`locked=true`、`radius=1.4`，但橘色預警環／線在灰色地面與白色玩家識別環上幾乎不可辨。玩家能看到敵機靠近，卻難以從畫面讀出「已鎖定、現在應閃避」的時機。

修正回歸：真實敵軍片段在任務時間 3.083 秒進入 `hunter-warning locked=true` 的同一幀截圖。新的亮色粗線與鎖定環清楚連接獵兵與玩家，能與白色玩家識別環分開。另以延長同一效果生命期的穩定 fixture 比對，外觀一致。

證據：[修正後真實 locked 預警](/private/tmp/s45-p1-warning-real.png)、[穩定預警 fixture](/private/tmp/s45-p1-warning-stable-fixture.png)

## 已修正並通過回歸的 P2

### P2-1 戰術地圖缺少可見圖例（已解決）

任務面板清楚寫「摧毀兩處觀測節點」，場上節點有金色圓盤，戰術地圖也確實繪製；但「金色方塊為觀測節點、青色為接應區」只存在 canvas 的 `aria-label`，畫面僅顯示「戰術地圖 N↑」。第一次玩的視覺玩家需要把 briefing、場景與小地圖自行對上。

修正回歸：畫面已顯示「◆ 觀測／＋ 修復／○ 接應」三項圖例；1280×720 下 bounding box 為 `x=1129,y=259.39,w=120,h=22.8`，完整位於畫面內。重型可傷時機則由 HUD 在「裝甲閉合」與「散熱窗口・反擊」切換，玩家知道哪個窗口打得動。

## 通過項目

- 真 Chrome（Google Chrome executable，Playwright 控制）1280×720，WebGL 成功，無 pageerror、無 4xx 資源回應。
- 真鍵鼠戰鬥：出擊、滑鼠瞄準、WASD、左鍵刃擊、右鍵躍進、Space 支援與 P 暫停皆有實際狀態效果。首輪約 10 秒戰鬥擊破 1 機、承受 36 傷；這是操作驗收，不宣稱真人勝率或完整通關。
- `D` 鍵使玩家畫面 X `670.00 → 698.68`，向右 28.67 px。
- 低牆 `low-south` 高 2.55；玩家步行停在牆前 `z=21.55`，右鍵躍進峰值 3.249，落在牆後 `z=13.88`。截圖仍看得到跨過的牆與退路。低牆遮住砲口視線，高牆更高，兩者高度可辨。
- 戰術地圖位於右上 `120×140`，canvas 有 1,850 個非透明像素，實際繪出玩家、牆與目標；無版面溢出。
- 暫停 fixture 前後 1.1 秒核心時間固定在 10.7667 秒，按 P 恢復後繼續。
- 勝利 fixture：先進入 `clear-threats`，UI 顯示「清除殘存戰鬥機體／敵機 2」；清除後返回接應區，結果為「接應完成」。
- 失敗 fixture：結果為「連線中斷」，重試回到 playing、HP 100、敵人 5、彈體／效果 0。
- 重複 3 次新局：scene meshes 都是 620；每次敵人 5、彈體 0、效果 0、HP 100，未見資源數量累增。
- 載入失敗 fixture：中斷 Babylon 檔後顯示「必要的戰場檔案尚未載入。請重新整理，或先返回 2D 戰線。」並提供返回 2D 戰線。
- 玩家是白色四足；scout、hunter 為不同尺寸／上裝的深色六足，heavy 為明顯更大的八足重型輪廓。低牆／高牆在斜俯視高度可辨。
- 音訊以真實首次手勢解鎖，按鈕變為「音訊：開」；BGM 與 SFX 的 ogg/wav/mp3 回應 200，音訊 API 存在。本項只驗資源與聲源流程，未把自動化環境當聽感測試。
- 測試裝置結果：穩定約 60 FPS，戰鬥樣本每幀 75 draw calls，scene meshes 628、active meshes 494。這不是普遍效能保證。
- 凍結版 `node --test game-3d-core.test.cjs`：22/22 通過。較早同一輪基線 2D／音訊／build：258/258 通過；整合者另回報完整 280 測試與 114 靜態檔 build 通過。

## Fixture 說明

勝利 fixture 把增援索引設為完成、清除敵人並把玩家移到接應區，之後由真實核心步進到 won；失敗 fixture 把狀態置於 settling/lost，驗證 UI 與重試。兩者只驗結算與 cleanup，不是玩家通關、真人勝率或 3–5 分鐘平衡證據。

## 證據

- [低牆跨越與退路](/private/tmp/s45-final-low-wall.png)
- [獵兵 locked 預警](/private/tmp/s45-final-warning.png)
- [勝利 fixture](/private/tmp/s45-final-win-fixture.png)
- [失敗 fixture](/private/tmp/s45-final-loss-fixture.png)
- [載入失敗 fixture](/private/tmp/s45-final-load-failure-fixture.png)
- JSON：`/private/tmp/s45-product-qa-final-results.json`
- 執行腳本：`/private/tmp/s45-product-qa-final.cjs`
- P1／P2 回歸 JSON：`/private/tmp/s45-p1-regression-results.json`
- P1／P2 回歸腳本：`/private/tmp/s45-p1-regression.cjs`


PO 補驗：完整自動鍵鼠路線（讀取全state但不更動生命/敵人/時間）41.93秒失敗，4擊破；策略會逼近重砲，不代表真人勝率。一般玩家3–5分鐘時長尚待玩家/更多操作驗證，不以fixtures勝利冒稱實際通關。2D core SHA256 c98c3d46f040daaa1c747b2f1f8fa27a957eeedacd96ebbf68c79d7e279451c3維持一致。
