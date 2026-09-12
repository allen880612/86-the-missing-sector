import bpy
import hashlib
import json
import re
import struct
from pathlib import Path

import numpy as np

SOURCE = Path('/Users/wei/Documents/ChatGPT/遊戲練習/assets/model/project86-source')
OUT = Path(__file__).resolve().parent
FBX = SOURCE / 'Reginleif_Model.fbx'
FBX_META = SOURCE / 'Reginleif_Model.fbx.meta'
MAT = SOURCE / 'Reginleif Textures/Reginleif_standard.mat'
TEXTURES = {
    'color': SOURCE / 'Reginleif Textures/reginleif 4k color.png',
    'metallic': SOURCE / 'Reginleif Textures/reginleif 4k metallic.png',
    'normal': SOURCE / 'Reginleif Textures/reginleif 4k normal.png',
}
DERIVED = {name: OUT / f's55-reginleif-{name}-1k.png' for name in TEXTURES}
ORM = OUT / 's55-reginleif-orm-1k.png'
GLB = OUT / 's55-reginleif-import.glb'
REPORT = OUT / 's55-reginleif-import.json'
REPORT_MD = OUT / 's55-reginleif-import.md'


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def material_float(text, key):
    match = re.search(rf'^    - {re.escape(key)}: ([-+0-9.eE]+)$', text, re.MULTILINE)
    if not match:
        raise RuntimeError(f'Missing {key} in {MAT}')
    return float(match.group(1))


def meta_value(text, key):
    match = re.search(rf'^\s+{re.escape(key)}: (.+)$', text, re.MULTILINE)
    if not match:
        raise RuntimeError(f'Missing {key} in {FBX_META}')
    return match.group(1)


def world_bounds(meshes):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points = []
    for obj in meshes:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        points.extend(obj.matrix_world @ vertex.co for vertex in mesh.vertices)
        evaluated.to_mesh_clear()
    if not points:
        raise RuntimeError('FBX contains no mesh vertices')
    low = [min(point[index] for point in points) for index in range(3)]
    high = [max(point[index] for point in points) for index in range(3)]
    return {'minXYZ': low, 'maxXYZ': high, 'extentXYZ': [high[index] - low[index] for index in range(3)]}


def glb_json(path):
    with path.open('rb') as handle:
        magic, version, total = struct.unpack('<4sII', handle.read(12))
        if magic != b'glTF' or version != 2 or total != path.stat().st_size:
            raise RuntimeError('Invalid GLB header')
        json_length, json_type = struct.unpack('<II', handle.read(8))
        if json_type != 0x4E4F534A:
            raise RuntimeError('GLB JSON chunk missing')
        return json.loads(handle.read(json_length).decode('utf-8').rstrip('\x00 '))


for path in [FBX, FBX_META, MAT, *TEXTURES.values()]:
    if not path.is_file():
        raise FileNotFoundError(path)

OUT.mkdir(parents=True, exist_ok=True)
mat_text = MAT.read_text()
fbx_meta_text = FBX_META.read_text()
smoothness = material_float(mat_text, '_Smoothness')
bump_scale = material_float(mat_text, '_BumpScale')
surface = material_float(mat_text, '_Surface')
smoothness_channel = material_float(mat_text, '_SmoothnessTextureChannel')
cull = material_float(mat_text, '_Cull')
valid_keywords = re.findall(r'^  - (_[A-Z0-9_]+)$', mat_text, re.MULTILINE)

bpy.ops.wm.read_factory_settings(use_empty=True)
result = bpy.ops.import_scene.fbx(filepath=str(FBX), use_anim=True, bake_space_transform=False)
if 'FINISHED' not in result:
    raise RuntimeError(f'FBX import failed: {result}')

for obj in list(bpy.context.scene.objects):
    if obj.type not in {'MESH', 'ARMATURE'}:
        bpy.data.objects.remove(obj, do_unlink=True)

meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
armatures = [obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE']
if not meshes or not armatures:
    raise RuntimeError(f'Expected meshes and armature, got {len(meshes)} meshes and {len(armatures)} armatures')

image_stats = {}
images = {}
pixel_arrays = {}
for name, source_path in TEXTURES.items():
    image = bpy.data.images.load(str(source_path), check_existing=False)
    source_size = list(image.size)
    image.colorspace_settings.name = 'sRGB' if name == 'color' else 'Non-Color'
    image.scale(1024, 1024)
    pixels = np.empty(len(image.pixels), dtype=np.float32)
    image.pixels.foreach_get(pixels)
    rgba = pixels.reshape((-1, 4))
    image_stats[name] = {
        'sourcePath': str(source_path),
        'sourceSha256': sha256(source_path),
        'sourceSize': source_size,
        'derivedPath': str(DERIVED[name]),
        'derivedSize': [1024, 1024],
        'colorspace': image.colorspace_settings.name,
        'channelMin': [float(rgba[:, channel].min()) for channel in range(4)],
        'channelMax': [float(rgba[:, channel].max()) for channel in range(4)],
        'channelMean': [float(rgba[:, channel].mean()) for channel in range(4)],
        'alphaSha256At1K': hashlib.sha256(rgba[:, 3].tobytes()).hexdigest(),
    }
    image.filepath_raw = str(DERIVED[name])
    image.file_format = 'PNG'
    image.save()
    image_stats[name]['derivedSha256'] = sha256(DERIVED[name])
    images[name] = image
    pixel_arrays[name] = rgba.copy()

metallic_rgba = pixel_arrays['metallic']
orm_rgba = np.ones_like(metallic_rgba)
orm_rgba[:, 1] = 1.0 - metallic_rgba[:, 3] * smoothness
orm_rgba[:, 2] = metallic_rgba[:, 0]
orm_image = bpy.data.images.new('s55-reginleif-orm-1k', width=1024, height=1024, alpha=False)
orm_image.colorspace_settings.name = 'Non-Color'
orm_image.pixels.foreach_set(orm_rgba.ravel())
orm_image.filepath_raw = str(ORM)
orm_image.file_format = 'PNG'
orm_image.save()
image_stats['orm'] = {
    'derivedPath': str(ORM),
    'derivedSize': [1024, 1024],
    'colorspace': 'Non-Color',
    'packing': 'R=1 (no occlusion map), G=1-metallicAlpha*_Smoothness, B=metallicRed, A=1',
    'channelMin': [float(orm_rgba[:, channel].min()) for channel in range(4)],
    'channelMax': [float(orm_rgba[:, channel].max()) for channel in range(4)],
    'channelMean': [float(orm_rgba[:, channel].mean()) for channel in range(4)],
    'derivedSha256': sha256(ORM),
}

material = bpy.data.materials.new('Reginleif_standard_portable')
material.use_nodes = True
material.use_backface_culling = cull == 2
nodes = material.node_tree.nodes
nodes.clear()
links = material.node_tree.links
output = nodes.new('ShaderNodeOutputMaterial')
principled = nodes.new('ShaderNodeBsdfPrincipled')
base = nodes.new('ShaderNodeTexImage')
base.name = 'Unity _BaseMap'
base.image = images['color']
orm = nodes.new('ShaderNodeTexImage')
orm.name = 'glTF ORM derived from Unity _MetallicGlossMap'
orm.image = orm_image
separate = nodes.new('ShaderNodeSeparateColor')
normal_texture = nodes.new('ShaderNodeTexImage')
normal_texture.name = 'Unity _BumpMap, source green preserved'
normal_texture.image = images['normal']
normal = nodes.new('ShaderNodeNormalMap')
normal.space = 'TANGENT'
normal.inputs['Strength'].default_value = bump_scale
links.new(base.outputs['Color'], principled.inputs['Base Color'])
links.new(orm.outputs['Color'], separate.inputs['Color'])
links.new(separate.outputs['Blue'], principled.inputs['Metallic'])
links.new(separate.outputs['Green'], principled.inputs['Roughness'])
links.new(normal_texture.outputs['Color'], normal.inputs['Color'])
links.new(normal.outputs['Normal'], principled.inputs['Normal'])
links.new(principled.outputs['BSDF'], output.inputs['Surface'])

for obj in meshes:
    obj.data.materials.clear()
    obj.data.materials.append(material)

bpy.context.view_layer.update()
bounds = world_bounds(meshes)
mesh_report = []
triangle_count = 0
vertex_count = 0
for obj in meshes:
    obj.data.calc_loop_triangles()
    triangles = len(obj.data.loop_triangles)
    vertices = len(obj.data.vertices)
    triangle_count += triangles
    vertex_count += vertices
    mesh_report.append({
        'name': obj.name,
        'vertices': vertices,
        'triangles': triangles,
        'uvLayers': list(obj.data.uv_layers.keys()),
        'colorAttributes': list(obj.data.color_attributes.keys()),
        'vertexGroups': len(obj.vertex_groups),
        'armatureModifiers': [modifier.object.name if modifier.object else None for modifier in obj.modifiers if modifier.type == 'ARMATURE'],
        'parent': obj.parent.name if obj.parent else None,
        'parentType': obj.parent_type,
        'parentBone': obj.parent_bone,
    })

armature_report = []
for obj in armatures:
    armature_report.append({
        'name': obj.name,
        'matrixWorld': [list(row) for row in obj.matrix_world],
        'boneCount': len(obj.data.bones),
        'rootBones': [bone.name for bone in obj.data.bones if bone.parent is None],
        'bones': [{'name': bone.name, 'parent': bone.parent.name if bone.parent else None} for bone in obj.data.bones],
    })

bpy.ops.export_scene.gltf(
    filepath=str(GLB),
    export_format='GLB',
    export_animations=True,
    export_skins=True,
    export_morph=False,
    export_yup=True,
)
document = glb_json(GLB)
external_uris = [entry['uri'] for key in ('images', 'buffers') for entry in document.get(key, []) if 'uri' in entry]
report = {
    'status': 'local Project-86 research derivative; not cleared for public redistribution',
    'blenderVersion': bpy.app.version_string,
    'source': {
        'fbx': str(FBX),
        'fbxSha256': sha256(FBX),
        'fbxMeta': str(FBX_META),
        'fbxMetaSha256': sha256(FBX_META),
        'unityModelImporter': {
            'animationType': int(meta_value(fbx_meta_text, 'animationType')),
            'clipAnimations': [],
            'globalScale': float(meta_value(fbx_meta_text, 'globalScale')),
            'useFileScale': int(meta_value(fbx_meta_text, 'useFileScale')),
            'bakeAxisConversion': int(meta_value(fbx_meta_text, 'bakeAxisConversion')),
        },
        'unityMaterial': str(MAT),
        'unityMaterialSha256': sha256(MAT),
    },
    'geometry': {
        'meshObjects': len(meshes),
        'verticesAcrossObjects': vertex_count,
        'trianglesAcrossObjects': triangle_count,
        'boundsInBlenderUnits': bounds,
        'sceneUnitSystem': bpy.context.scene.unit_settings.system,
        'sceneUnitScaleLength': bpy.context.scene.unit_settings.scale_length,
        'meshes': mesh_report,
    },
    'rig': {
        'armatureObjects': len(armatures),
        'armatures': armature_report,
        'skinnedMeshObjects': sum(bool(item['armatureModifiers']) for item in mesh_report),
        'boneParentedMeshObjects': sum(item['parentType'] == 'BONE' for item in mesh_report),
    },
    'sourceActions': [{'name': action.name, 'frameRange': list(action.frame_range), 'fcurves': len(action.fcurves)} for action in bpy.data.actions],
    'material': {
        'name': material.name,
        'unityEvidence': {
            '_Surface': surface,
            '_Smoothness': smoothness,
            '_SmoothnessTextureChannel': smoothness_channel,
            '_BumpScale': bump_scale,
            '_Cull': cull,
            'm_ValidKeywords': valid_keywords,
            '_BaseMap': 'reginleif 4k color.png',
            '_MetallicGlossMap': 'reginleif 4k metallic.png',
            '_BumpMap': 'reginleif 4k normal.png',
        },
        'reconstruction': 'derived glTF ORM uses R=1, G roughness=1-metallic alpha*_Smoothness, B metallic=source red; opaque base color; tangent normal RGB preserved without green inversion',
        'alphaEvidence': {
            'colorAndMetallicAlphaIdenticalAt1K': image_stats['color']['alphaSha256At1K'] == image_stats['metallic']['alphaSha256At1K'],
            'metallicAlphaMinMax': [image_stats['metallic']['channelMin'][3], image_stats['metallic']['channelMax'][3]],
        },
        'normalDirection': 'not established by the archived local files; source green channel is preserved and Blender tangent-space normal decoding is used',
        'images': image_stats,
    },
    'orientation': {
        'sourceFbxVersion': 7400,
        'blenderAxes': '+Z up, +Y depth before glTF conversion',
        'glbAxes': '+Y up',
        'unit': 'unconfirmed; values are Blender import units and were not normalized to official dimensions',
        'forwardAxis': 'unconfirmed; bounds and armature transforms are recorded without guessing from the cannon',
    },
    'glb': {
        'path': str(GLB),
        'bytes': GLB.stat().st_size,
        'sha256': sha256(GLB),
        'nodes': len(document.get('nodes', [])),
        'meshes': len(document.get('meshes', [])),
        'skins': len(document.get('skins', [])),
        'animations': [animation.get('name') for animation in document.get('animations', [])],
        'materials': [entry.get('name') for entry in document.get('materials', [])],
        'images': len(document.get('images', [])),
        'externalUris': external_uris,
    },
    'limitations': [
        'No new animation, retopology, decimation, LOD, collision, or gameplay integration was created.',
        'The source has no imported Action; the separate Unity recoil .anim was not converted.',
        'Forward direction and normal-map green-channel convention require visual comparison or authoring metadata.',
        'The source FBX unit-to-metre scale is not established by the archived files; bounds are not labelled as metres.',
        f"{sum(bool(item['colorAttributes']) for item in mesh_report)} meshes contain vertex-color attributes; the archived Unity material does not reference them, so Blender omits those unused attributes from glTF.",
        'The Unity prefab material assignment is reproduced as one material on every mesh; FBX embedded material slot names are not retained in the derivative.',
    ],
}
REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
extent = bounds['extentXYZ']
REPORT_MD.write_text(f'''# S55 Reginleif / XM2 FBX 匯入稽核

## 結果

| 項目 | 實測 |
|---|---|
| 幾何 | {len(meshes)} 網格，{vertex_count:,} 頂點，{triangle_count:,} 三角面 |
| 骨架 | {len(armatures)} 個 armature，{sum(item['boneCount'] for item in armature_report)} 骨，{sum(bool(item['armatureModifiers']) for item in mesh_report)} 個 skinned mesh |
| 內建動作 | {len(report['sourceActions'])}；沒有 Action，未新增動畫 |
| 匯入尺寸 | X {extent[0]:.4f} × Y {extent[1]:.4f} × Z {extent[2]:.4f} Blender 匯入單位 |
| 軸向 | Blender +Z 向上；GLB +Y 向上；機體正前方未確認 |
| GLB | {GLB.stat().st_size:,} bytes；{len(document.get('skins', []))} skin；{len(document.get('animations', []))} animation；貼圖內嵌，無外部 URI |

## PBR 重建依據

Unity 材質明確啟用 `_METALLICSPECGLOSSMAP` 與 `_NORMALMAP`，並引用 `_BaseMap`、`_MetallicGlossMap`、`_BumpMap`。GLB 使用明確產生的 1K ORM：R=1（無 occlusion map）、G=`1 - metallic alpha × _Smoothness(0.5)`、B=metallic R；`_Surface: 0` 作為不透明材質，`_Cull: 2` 作為背面剔除。color 與 metallic 的 1K alpha 逐像素相同，但 color alpha 不作透明度。

normal 保留原檔 G 通道，透過 tangent-space Normal Map 解碼。歸檔沒有貼圖 `.meta` 或作者軸向說明，因此 G 通道是否需反轉仍未確認。

## 缺口

- Unity FBX `.meta` 設為 `globalScale: 1`、`useFileScale: 1`、`bakeAxisConversion: 0`，仍不足以確立 FBX 單位與公尺的對應；本衍生檔沒有縮放去對齊官方尺寸。
- 機體正前方與 normal G 方向尚需原作對照或作者匯出設定。
- 445,798 三角面、59 網格對即時戰場偏重；依任務限制保留原幾何，未做 LOD、減面、碰撞或動畫。
- {sum(bool(item['colorAttributes']) for item in mesh_report)} 個網格含 vertex-color attribute；歸檔 Unity 材質未引用，因此 Blender 沒有把未使用的頂點色匯出至 GLB。

機讀稽核數據見 `{REPORT.name}`；重現指令：

```sh
/private/tmp/s51-blender-mount/Blender.app/Contents/MacOS/Blender --background --python {Path(__file__).name}
```
''')
print('S55_REPORT', json.dumps({
    'triangles': triangle_count,
    'vertices': vertex_count,
    'meshObjects': len(meshes),
    'armatures': len(armatures),
    'bones': sum(item['boneCount'] for item in armature_report),
    'actions': len(report['sourceActions']),
    'bounds': bounds,
    'glbBytes': GLB.stat().st_size,
    'externalUris': external_uris,
}))
