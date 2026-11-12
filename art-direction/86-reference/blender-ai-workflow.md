# GPT-6 Astra × Blender：低成本流程判定

## 結論

**成熟的是 Blender 的 Python／批次／glTF 底座；Astra 能有效驅動它，但「全自主產出可上線資產」仍不是已證實的標準流程。** OpenAI 的[建築案例](https://developers.openai.com/blog/architectural-visualization-with-astra)確實用 `bpy`、`--background --python`、既有 Poly Haven 素材、solid／preview render 檢查，再匯入 Unreal；它本身就是分階段製作，而非一鍵生成。OpenAI 的[遊戲案例](https://developers.openai.com/blog/how-to-build-games-with-astra)也顯示可產出 193 個可編輯 mesh、14,968 triangles、8 個 opaque material batches 的飛船，但單一案例不能證明各類角色、rig、UV 與動畫都同樣可靠。

Blender 官方 [CLI 參數](https://docs.blender.org/manual/en/5.1/advanced/command_line/arguments.html)支援 `--background`、`--python`、`--python-exit-code`；[命令列渲染](https://docs.blender.org/manual/en/5.1/advanced/command_line/render.html)可無 UI 輸出單幀／動畫，且參數依順序執行，`-f`／`-a` 應放最後。[glTF 2.0 文件](https://docs.blender.org/manual/en/4.2/addons/import_export/scene_gltf2.html)則說明遊戲動畫可匯出 object transform、pose bone、shape key；材質、燈光、物理動畫不會原樣匯出。這些是可鎖版本、可重跑、可驗證的成熟基礎。

## 成本與成熟度

|路線|判定|
|---|---|
|Astra 寫／修一支 `bpy`，CLI 執行、批次 render、匯出 GLB|首選。每輪只需腳本差異與少量固定視角圖，狀態可存檔，失敗可重跑|
|[blender-mcp](https://github.com/ahujasid/blender-mcp) 逐步查場景、操作、截圖|活躍且實用的第三方橋接：本輪頁面顯示 199 commits、28.3k stars；Python ≥3.10，直接依賴 `mcp`、`httpx`，另需 `uv` 與 Blender add-on。README 自承 timeout 要拆步、部分資產行為不穩，且可執行任意 Python；適合局部互動，不足以只憑人氣稱 production-grade|
|純 GUI computer use|座標與畫面狀態脆弱、截圖往返多，只留給腳本難定位的局部視覺修正|

MCP 的固定上下文成本不可忽略：[issue #347](https://github.com/ahujasid/blender-mcp/issues/347) 的第三方可重現量測報告 28 tools 約 6,928 tokens；但它也明說 Codex 可延後載入 definition，所以這不是本專案每輪必付的精確值。[Blender-Bench](https://blenderbench.realityreprojector.com/) 雖有同 prompt、盲選與實際 Blender 結果，Astra 暫居前列，但現有題目只測空場景的視覺作品；retopology、UV、rigging、walk cycle 的 production suite 與原始碼仍標示 coming soon，應視為 demo 證據。

## 本專案 KISS 流程

1. **先改現成模型。** 先驗 `3d-asset-survey.md` 的 Juggernaut 候選之授權、分件、UV、pivot、rig；只有實檔證明拓撲／關節不可救才從零做。從零多足機還要連續解 topology、UV、硬表面接縫、權重與動作，Token 與人工驗收都更高。
2. 腳本只分「匯入清理 → 輪廓／分件 → 材質 → rig → GLB」五段；每段保存 `.blend` checkpoint，渲染前／側／遊戲斜俯三張低解析圖。
3. Astra 每輪只看失敗區域與同角度參考；通過才進下一段。GLB 最後回匯 Blender並進 Babylon 驗節點、clip、比例、材質與砲口。
4. 只有腳本難修的局部拓撲才短暫用 MCP／GUI，完成後把操作固化回 `bpy`。

Simon Willison 的[可重現案例](https://github.com/simonw/til/blob/main/llms/blender-coding-agents-macos.md)公開 Medium 執行時間、`.py`、`.blend`、Codex transcript 與可重用 Blender skill，支持上述「CLI＋腳本＋技能」路線；但題材是程序式鵜鶘場景，不能外推為遊戲級多足機建模。現有本機 skill 目錄未找到 Blender／`bpy` 專用 skill；可先借鑑其短 skill 結構，待一次本專案切片實跑後再固化，無須先安裝大型 MCP。

尚未驗證：候選模型實檔、Astra 在本機 Blender 版本的成功率、每段實際 Token、Cycles／Eevee 時間、glTF validator 與 Babylon 實載結果。因此不能稱 GPT-6 Astra＋Blender 已是社群主流或 production-ready。

## 2026-09-12：Apple Silicon LTS 批次轉檔基線

本機 `uname` 實測為 `Darwin`／`arm64`。為降低新主版變動，本次實檔檢查鎖 [Blender 4.5.13 LTS](https://www.blender.org/releases/4-5/)（官方支援至 2027 年 7 月），不用 daily build。macOS 官方發布物只有 DMG，沒有另列 zip「可攜版」；DMG 內的 `Blender.app` 可放在獨立目錄。若要連設定也可攜，官方[目錄配置](https://docs.blender.org/manual/en/4.5/advanced/blender_directory_layout.html)要求在 `Blender.app/Contents/Resources` 內建立 `portable` 資料夾。

- Apple Silicon DMG：<https://download.blender.org/release/Blender4.5/blender-4.5.13-macos-arm64.dmg>
- 官方目錄大小：`311,910,354` bytes（約 `297.46 MiB`；下載頁顯示 297 MB）
- 官方 SHA 清單：<https://download.blender.org/release/Blender4.5/blender-4.5.13.sha256>
- SHA-256：`663ce944257c61ff1d6aa09e15c8f57bbd8d59023adb2fa7edde33a9ed960b53`
- 下載後核對：`shasum -a 256 blender-4.5.13-macos-arm64.dmg`

以 `BLENDER_BIN=/絕對路徑/Blender.app/Contents/MacOS/Blender` 代稱執行檔。先用 `$BLENDER_BIN --version` 確認確為 4.5.13，再執行：

```sh
$BLENDER_BIN --background --factory-startup --python-exit-code 1 \
  --python /絕對路徑/fbx_to_glb.py -- /絕對路徑/input.fbx /絕對路徑/output.glb
```

`fbx_to_glb.py` 的最小核心如下；`--` 後參數由 `sys.argv` 讀取。Blender 4.5 官方 API 記錄 [FBX import](https://docs.blender.org/api/4.5/bpy.ops.import_scene.html) 與 [glTF export](https://docs.blender.org/api/4.5/bpy.ops.export_scene.html)。不要開 `bake_space_transform`，官方註明它對 armature／animation 有已知問題。

```python
import sys
from pathlib import Path
import bpy

src, dst = map(lambda p: str(Path(p).resolve()), sys.argv[sys.argv.index("--") + 1:])
bpy.ops.import_scene.fbx(filepath=src, use_anim=True, bake_space_transform=False)
bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format="GLB",
    export_animations=True,
    export_skins=True,
    export_morph=True,
)
```

此命令只做 FBX 匯入與 GLB 匯出；材質貼圖是否找到、骨架／Action 是否保留、座標與比例是否正確，仍須以轉檔 log、GLB 回匯及 Babylon 實載判定。

## S51 本機實跑補充

已用上述官方 4.5.13 LTS（SHA 相符）唯讀掛載 DMG，背景匯入兩個 FBX、重建材質、縮 2K、保存 blend 並匯出 GLB。沒有安裝 MCP、沒有 Unity。兩台模型都能在 Babylon 真實畫面顯示，並通過前足診斷姿態切換；原檔均無步行 Action，不能稱動畫流程已完整完成。首次根節點座標錯誤需要一輪檢查修正，證明仍需視覺驗收。GLB 資料與作者來源見素材盤點及 probe-assets/CREDITS.md。

本輪大量額外往返花在瀏覽器登入／個人資料與視窗控制，不應把這些成本都算在 Blender 建模，也不能據此次試驗預測精準 Token 成本。下輪以已取得的檔案、小段腳本與固定姿態比較推進，降低對 GUI 往返的依賴。

## 2026-09-13：macOS 已開 GUI 的控制路線

目前應先區分「執行 Blender 腳本」與「接管使用者已開的場景」。兩者都用 `bpy`，但連線方式不同：

|路線|能否直接改目前已開 GUI 的場景|前置與限制|適合本專案的用途|
|---|---|---|---|
|Blender CLI：`Blender --background --python script.py`|否。從 shell 呼叫 Blender 可執行檔會啟動另一個 Blender process；`--background` 令該 process 無 UI。它可以明確載入某個 `.blend`，但不會自動附加到另一個已在執行的 GUI process。這是由官方 CLI 的「啟動 Blender 並依序處理參數」語意作出的直接推論，不是官方提供的 remote-attach 功能。|需以檔案作交接；同一 `.blend` 不宜讓 GUI 與背景 process 同時各自覆寫。優點是可重跑、可用 `--python-exit-code` 判失敗。官方見[命令列參數](https://docs.blender.org/manual/en/4.5/advanced/command_line/arguments.html)與[命令列渲染](https://docs.blender.org/manual/en/4.5/advanced/command_line/render.html)。|批次匯入、清理、動作、render、GLB 匯出。這條路已在本機 4.5.13 實跑成功，仍是預設。|
|已開 GUI 的 Python Console／Text Editor|可以，因為程式碼就在該 Blender process 內執行，作用於當前 `bpy.context`／資料。官方 [Python API quickstart](https://docs.blender.org/api/current/info_quickstart.html)把兩者列為常見執行方式：Console 適合短片段，Text Editor 可開啟或貼入 `.py` 後 Run Script。|Blender 原生沒有在這兩個 editor 上另附 agent 遠端通道；若 agent 只靠畫面操作代貼程式，仍受焦點、區域、剪貼與 UI 狀態影響。長腳本宜存成檔案，由使用者在 Text Editor 開啟執行，並先存 `.blend`。|已開場景的一次性診斷或小幅互動修改；目前不需安裝任何東西，但也不能宣稱 agent 已建立穩定雙向控制。|
|`ahujasid/blender-mcp`|可以附加「已開的 GUI」，但前提是先在該 GUI 安裝並啟用 add-on，再於 3D View 的側欄啟動 server；不是因 Blender 已開就會自動連上。[README](https://github.com/ahujasid/blender-mcp/blob/main/README.md#quickstart)描述 add-on 在 Blender 內開 socket、外部 MCP server 再連入；[add-on 原始碼](https://github.com/ahujasid/blender-mcp/blob/main/addon.py)預設綁 `localhost:9876`，把命令排入 Blender main thread 執行。|macOS 前置是 Blender 3.0+、Python 3.10+、`uv`；專案建議 `brew install uv`，GUI 啟動的 Codex 若找不到 `uvx`，需填 `which uvx` 得到的絕對路徑並重啟 Codex。另需 `uvx blender-mcp install-addon`、在 Blender 啟用 add-on、按下連線，Codex 端註冊 MCP 後也要重啟才出現工具。README 明列複雜操作應拆小、可能 timeout；預設允許任意 Python，並預設同意匿名 telemetry，可另行關閉。它是第三方整合，不是 Blender 官方功能。[安裝與限制](https://github.com/ahujasid/blender-mcp/blob/main/README.md#installation)|需要 agent 反覆讀取當前場景、截 viewport、做多輪局部修正時才有明顯價值。|
|Blender／`bpy` skill|不會。skill 是給 agent 的流程、命令與驗證指示；除非它同時要求並配置 CLI、computer-use 或 MCP 工具，單獨放一份 `SKILL.md` 不會在 Blender process 內開 socket，也不會取得目前場景。OpenAI 的[模型指引](https://developers.openai.com/api/docs/guides/latest-model)也把 skill／`AGENTS.md`描述為會影響模型行為的 instructions。|可固化版本、腳本模板、checkpoint 與驗收規則，但不能取代 transport。|在本專案流程已穩定後再寫，避免把尚未驗證的操作包成規範。|

**建議：現在不要為了「Blender 已經打開」就先裝 MCP 或新 skill。** 既有 CLI＋`bpy` 已通過匯入、動作與 GLB 實跑，批次工作繼續走它；若此刻只需對已開場景做一兩次檢查，使用 GUI 的 Scripting workspace 執行短而可審查的腳本即可。只有接下來確定需要多輪「讀場景 → 改物件 → 截 viewport → 再修」且 GUI 交互成本成為瓶頸，再評估 `blender-mcp`。屆時它能連到現有 GUI 的理由是 add-on server 已在那個 process 裡運行，不是 MCP client 能自行附加 Blender。

沒有 primary source 證明上述任何 agent 控制路線是 Blender 社群的「主流」；GitHub stars、影片或個別案例只能證明關注與可用性，不能代表使用占比或 production 標準。
