# 開發約定

使用繁體中文、以玩家可感知的體驗為優先。需求由GitHub Issue管理，PR交付；使用者已授權自主Review與合併。保留現有2D雙模式可玩入口，3D暫緩或僅做POC。原作與遊戲改編界線需標明。

## Agent skills

Issue tracker：GitHub，見 docs/agents/issue-tracker.md。
Domain docs：單一共識，見 docs/agents/domain.md 與 CONTEXT.md。

可用 Matt Pocock 的 setup-matt-pocock-skills、to-spec、to-tickets、research、prototype。依本專案授權與既有上下文執行，不反覆詢問已定案選項；流程不得取代玩家體驗驗收。

每次正式版本發布需同步更新 changelog.html 的最新紀錄、玩家改變、回饋→調整與各職能貢獻，並保留歷史條目。研究／POC不得寫成已發布功能；完整Sprint Review／Retro仍保留原始紀錄。PR需附實際驗證與未完成限制。

## 本地試玩與玩家回饋

在發布工作目錄開發時，每個可玩的增量完成後，立即同步根目錄8765的runtime，告知版本、入口與本次改動；不要等PR合併或正式部署才讓玩家試玩。保持8765服務運作，不同步Agent尚未完成的半成品。正式站仍經Issue、PR、驗收、merge與Pages部署；記錄玩家在本地的回饋並調整當輪工作。
