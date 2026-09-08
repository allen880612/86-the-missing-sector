# 86 戰線：壁外作戰

桌面優先的機甲戰鬥遊戲原型，目前版本 **v32**。

[立即試玩](https://86-the-missing-sector.pages.dev/) · [戰線突破](https://86-the-missing-sector.pages.dev/?gameMode=frontline) · [四向無限](https://86-the-missing-sector.pages.dev/?gameMode=endless)

## 執行

```sh
python3 -m http.server 8765
```

開啟 http://127.0.0.1:8765/ ，首頁可選兩種模式。沒有安裝套件或打包步驟。

- **戰線突破**：左右移動、自動射擊、走位選補給；重型命中優先損失一架僚機，無僚機時改為可由裝甲吸收的45傷害。
- **四向無限**：WASD／方向鍵移動、滑鼠瞄準、主砲自動開火，僚機自主迎擊附近敵人。左鍵火控超頻；右鍵0.22秒推進，100單位／冷卻3秒，全程碰撞；Space在游標位置呼叫支援或放置誘餌。P暫停。
- 四向場景有四個可破壞掩體，直射可被遮蔽，曲射跨越掩體。初始裝甲25，九類補給靠近直接回收，滿狀態也可拾取；沒有停留讀條或二選一卡。
- 兩種模式共用機甲素材、開始／結算／重試流程與集中音訊／動態設定。3D僅保留可行性研究，尚非可玩模式。

## 驗證

```sh
node --test game-core.test.cjs game-arena-core.test.cjs game-audio.test.cjs
```

v32：修正四向 Boss 砲口火光誤跟隨迫擊砲落地、重戰車散熱條卡滿與散熱倒數比例；沿用現有爆炸／白煙素材，散熱局部視覺於120ms展開，傷害窗口仍立即生效。176項遊戲／部署測試通過；無限結算不顯示戰線下一場，整備預覽與實際Boss一致。Chrome真鍵鼠驗證暫停、結算、重試、回整備與切換模式後戰線下一場。v30既有驗證：實際Chrome驗證主機自動射擊、僚機獨立目標、護甲吸收、滿狀態補給、推進中段位置、敵人／掩體碰撞、Boss出生與模式切換。受控驗證不等於真人趣味或長局平衡評分。密集場景保留效能改善空間，沒有宣稱所有硬體穩定60FPS。

## 開發與範圍

需求與修正以GitHub Issue追蹤，分支使用codex/，PR說明玩家感受上的改變、驗證與限制，Review後合併。這是補入既有本機成果的v30基準，沒有虛構歷史Sprint PR。

目前無限模式使用固定地形與單一Boss同場，尚未加入有限彈藥庫存或多Boss同場。素材出處見assets內credits與manifest。《86》機型／角色屬原作參考，本作遊戲數值與互動為改編，並非官方作品；第三方素材依各自授權標示，未統一宣稱全部素材開源。


## 自動部署（Cloudflare Pages 免費靜態方案）

2026-09-08 已接通正式站，production branch 為 `main`；[首次成功部署](https://github.com/allen880612/86-the-missing-sector/actions/runs/34210658834)後，Chrome從公開HTTPS啟動兩模式均無JavaScript錯誤或資源404。

GitHub PR 執行遊戲測試與發布打包；合併 `main` 檢查通過後才部署。Actions 也支援手動重跑。部署只包含已追蹤的執行檔／素材，排除測試、私人研究及 QA。

首次設定：在 Cloudflare 建立 Direct Upload Pages 專案 `86-the-missing-sector`，production branch 設為 `main`；在此 GitHub repo 的 Actions Secrets 設定 `CLOUDFLARE_ACCOUNT_ID` 與僅具有 Pages Write 權限的 `CLOUDFLARE_API_TOKEN`。不要提交 Token、OAuth refresh token 或 `.env`。目前部署Token到期日為2026-12-08。授權到期時重新建立相同Pages Write範圍的Token、更新GitHub Secret，再於Actions重跑失敗的deploy工作；缺少憑證會明確停止部署。

僅部署 `dist/` 靜態檔案，不使用 Functions、Workers、R2、D1 或付費升級。建置拒絕 Functions／Worker 入口、符號連結、單檔達25MiB或總數達20,000的輸出。PR 不建立預覽部署；main 併發部署會取消過時工作。Cloudflare 免費方案每月500次建置，限制到達時停止發布，不升級方案；帳戶內其他專案也可能使用額度。靜態資源請求免費且不限次數。

本機打包：`node scripts/build-pages.cjs`。使用 Git checkout 執行，新增執行素材須先納入 Git 追蹤。流程檢查通過只代表可部署；正式上線仍需確認 Actions deploy 成功及 HTTPS 兩模式可啟動。

資料來源：[Pages 免費方案限制](https://developers.cloudflare.com/pages/platform/limits/)、[靜態請求定價](https://developers.cloudflare.com/pages/functions/pricing/)、[CI 部署文件](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)。
