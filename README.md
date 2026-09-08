# 86 戰線：壁外作戰

桌面優先的機甲戰鬥遊戲原型，目前版本 **v40**。

[立即試玩](https://86-the-missing-sector.pages.dev/) · [戰線突破](https://86-the-missing-sector.pages.dev/?gameMode=frontline) · [四向無限](https://86-the-missing-sector.pages.dev/?gameMode=endless) · [版本沿革](https://86-the-missing-sector.pages.dev/changelog.html)

## 執行與操作

```sh
python3 -m http.server 8765
```

開啟 http://127.0.0.1:8765/ 。沒有安裝套件或打包步驟；已有服務時勿重啟。

- **戰線突破**：左右移動、自動射擊、走位取補給；有結尾的遭遇戰。重型命中優先損失一架僚機，無僚機時可由裝甲吸收45傷害。
- **四向無限**：WASD／方向鍵走位、滑鼠瞄準、自動主砲。左鍵使用機型技能，右鍵越過敵機與低掩體，高牆需繞行。Space呼叫區域支援，初始2次、30秒回充、間隔6秒；飛群干擾時暫時封鎖支援，不消耗次數。
- **地圖與武裝**：三張1600×1600戰場，固定高牆、可破壞低掩體、跟隨鏡頭。1／2／3或Q切換無限主砲、120發機砲、18發穿甲重砲；有限彈藥耗盡自動回主砲。P暫停。
- **軍團增援**：30秒一波，每三波威脅升階。第5／15／25波只增援菁英，第10／20／30波只增援Boss，既有敵軍保留。一般波有菁英增援；Boss同場上限於第4／7／13／19波提高至2／3／4／5。
- **反制與資源**：Phönix潛伏接近、顯形突進接鏈刃追斬，收刃1.8秒可反擊。飛群逐隻獨立生命，擊落來源或移出範圍恢復火力座標；主炮、機型技能與躍進仍可用。普通敵每12擊破給小補，菁英每隻一份高價補給，Boss固定火控加一份武裝資源。
- **僚機**：各60耐久、自主索敵，會承傷、被入侵、失能；維修同步修翼。全翼失能45秒後，下次18秒週期補給提供增援。滿狀態仍可收補給。

## 驗證與維護

```sh
node --test game-core.test.cjs game-arena-core.test.cjs game-audio.test.cjs scripts/build-pages.test.cjs
```

測試與受控Chrome情境用來核對行為及介面，不能證明長局真人平衡。高DPR密集繪製效能仍待改善。當前參數與限制見[專案共識](CONTEXT.md)，每輪玩家回饋、團隊分工與實際改動見更新檔案。

Issue→codex分支→產品QA→PR→自主Review合併→Pages。完整可玩增量先同步8765，不等待部署。3D與聯機未實作；素材與《86》機型／角色來源保留，數值與互動為遊戲改編，並非官方作品，未宣稱所有素材開源。

## 自動部署（Cloudflare Pages 免費靜態方案）

2026-09-08 已接通正式站，production branch 為 `main`；[首次成功部署](https://github.com/allen880612/86-the-missing-sector/actions/runs/34210658834)後，Chrome從公開HTTPS啟動兩模式均無JavaScript錯誤或資源404。

GitHub PR 執行遊戲測試與發布打包；合併 `main` 檢查通過後才部署。Actions 也支援手動重跑。部署只包含已追蹤的執行檔／素材，排除測試、私人研究及 QA。

首次設定：在 Cloudflare 建立 Direct Upload Pages 專案 `86-the-missing-sector`，production branch 設為 `main`；在此 GitHub repo 的 Actions Secrets 設定 `CLOUDFLARE_ACCOUNT_ID` 與僅具有 Pages Write 權限的 `CLOUDFLARE_API_TOKEN`。不要提交 Token、OAuth refresh token 或 `.env`。目前部署Token到期日為2026-12-08。授權到期時重新建立相同Pages Write範圍的Token、更新GitHub Secret，再於Actions重跑失敗的deploy工作；缺少憑證會明確停止部署。

僅部署 `dist/` 靜態檔案，不使用 Functions、Workers、R2、D1 或付費升級。建置拒絕 Functions／Worker 入口、符號連結、單檔達25MiB或總數達20,000的輸出。PR 不建立預覽部署；main 併發部署會取消過時工作。Cloudflare 免費方案每月500次建置，限制到達時停止發布，不升級方案；帳戶內其他專案也可能使用額度。靜態資源請求免費且不限次數。

本機打包：`node scripts/build-pages.cjs`。使用 Git checkout 執行，新增執行素材須先納入 Git 追蹤。流程檢查通過只代表可部署；正式上線仍需確認 Actions deploy 成功及 HTTPS 兩模式可啟動。

資料來源：[Pages 免費方案限制](https://developers.cloudflare.com/pages/platform/limits/)、[靜態請求定價](https://developers.cloudflare.com/pages/functions/pricing/)、[CI 部署文件](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)。
