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
