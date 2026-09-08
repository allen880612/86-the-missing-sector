# 領域文件

單一專案。先讀 CONTEXT.md 與相關 docs/adr 決策（存在時），再讀該Issue。2D戰線、2D無限戰線與立體戰場各自保持明確入口與狀態，未可玩的概念稿不能列為可玩模式。原作機型設定和遊戲改編機制分開標記。

## 聯機最小架構研究（未實作，2026-09-08）

結論：在「Cloudflare免費、朋友直接加入、有人存活就繼續」的限制下，優先POC兩人，擴充上限四人。維持Pages提供遊戲素材，新增一個Worker入口與每房一個SQLite Durable Object，透過WebSocket由伺服器統一推進戰局。這是研究方向，本輪不建立服務、不變更目前純靜態部署。現有core與繪製分離有利移植，但單一s.x／s.hp及敵機索敵目前都假設一名主機，不能只加連線就變多人。

各客戶端送移動／瞄準／技能輸入，房間約20Hz模擬、10Hz狀態快照，畫面自行插值。伺服器決定命中、補給歸屬、死亡與復活；不是讓每名玩家自行宣稱擊中。第一版房號邀請、全滅結算；倒地機體可由隊友靠近救援，至少一人存活就續戰。房主角色死亡或關頁不會轉移模擬責任；斷線寬限、房間空置清理與重連快照仍需實作驗證。

Pages靜態免費但不能執行權威房間；Functions仍計Workers額度。Workers Free可使用SQLite DO，DO免費每日100,000 requests／13,000 GB-s；超限是該類操作失敗，不能當不限量可用，也不會自動套用Paid超額費率。持續20Hz計時器不符合休眠條件，整局須計duration。[Pages](https://developers.cloudflare.com/pages/functions/pricing/)；[Workers](https://developers.cloudflare.com/workers/platform/pricing/)；[DO費用](https://developers.cloudflare.com/durable-objects/platform/pricing/)；[DO生命週期](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/)

額度算例而非容量承諾：4人×20分鐘×10Hz輸入＝48,000入站WebSocket訊息，官方20:1折算約2,400 requests，另計連線與其他請求；128MB按官方十進位範例×1,200秒約153.6 GB-s。純算術約41房／日受request額度限制，實際還要扣其他專案、重連、儲存與安全餘裕；不能作壓測結果。POC先限制同時房數、空房關閉、過期清理，且確認帳戶維持Free後才部署。單人模式獨立運作，額度耗盡時仍能玩。

比較：房主權威WebRTC只需信令後端，雲端運算較少；但必須交換SDP／ICE，STUN直連失敗可能要TURN。免費Pages／Workers不保證提供TURN，房主離線另需遷移協商，對朋友順暢加入的端到端工程未必更小，故不列第一選項。[W3C](https://www.w3.org/TR/webrtc/)；[WebRTC指南](https://webrtc.org/getting-started/peer-connections)
