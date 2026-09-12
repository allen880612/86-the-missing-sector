# S55 Reginleif / XM2 FBX 匯入稽核

## 結果

| 項目 | 實測 |
|---|---|
| 幾何 | 59 網格，225,735 頂點，445,798 三角面 |
| 骨架 | 1 個 armature，54 骨，59 個 skinned mesh |
| 內建動作 | 0；沒有 Action，未新增動畫 |
| 匯入尺寸 | X 42.8109 × Y 45.2283 × Z 17.6297 Blender 匯入單位 |
| 軸向 | Blender +Z 向上；GLB +Y 向上；機體正前方未確認 |
| GLB | 34,221,152 bytes；1 skin；0 animation；貼圖內嵌，無外部 URI |

## PBR 重建依據

Unity 材質明確啟用 `_METALLICSPECGLOSSMAP` 與 `_NORMALMAP`，並引用 `_BaseMap`、`_MetallicGlossMap`、`_BumpMap`。GLB 使用明確產生的 1K ORM：R=1（無 occlusion map）、G=`1 - metallic alpha × _Smoothness(0.5)`、B=metallic R；`_Surface: 0` 作為不透明材質，`_Cull: 2` 作為背面剔除。color 與 metallic 的 1K alpha 逐像素相同，但 color alpha 不作透明度。

normal 保留原檔 G 通道，透過 tangent-space Normal Map 解碼。歸檔沒有貼圖 `.meta` 或作者軸向說明，因此 G 通道是否需反轉仍未確認。

## 缺口

- Unity FBX `.meta` 設為 `globalScale: 1`、`useFileScale: 1`、`bakeAxisConversion: 0`，仍不足以確立 FBX 單位與公尺的對應；本衍生檔沒有縮放去對齊官方尺寸。
- 機體正前方與 normal G 方向尚需原作對照或作者匯出設定。
- 445,798 三角面、59 網格對即時戰場偏重；依任務限制保留原幾何，未做 LOD、減面、碰撞或動畫。
- 6 個網格含 vertex-color attribute；歸檔 Unity 材質未引用，因此 Blender 沒有把未使用的頂點色匯出至 GLB。

機讀稽核數據見 `s55-reginleif-import.json`；重現指令：

```sh
/private/tmp/s51-blender-mount/Blender.app/Contents/MacOS/Blender --background --python s55-reginleif-import.py
```
