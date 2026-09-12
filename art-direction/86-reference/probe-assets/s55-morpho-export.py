import bpy,json,re
from pathlib import Path
base=Path('/Users/wei/Documents/ChatGPT/遊戲練習')
probe=base/'.worktrees/s45-3d-sortie/art-direction/86-reference/probe-assets'
bpy.ops.wm.open_mainfile(filepath=str(probe/'s55-morpho-inspected.blend'))
report=[]
for m in bpy.data.materials:
 p=base/'assets/model/project86-source/Morpho Materials'/(m.name+'.mat')
 if not p.exists():raise RuntimeError('Missing mapped material '+m.name)
 t=p.read_text();color=re.search(r'_BaseColor: \{r: ([^,]+), g: ([^,]+), b: ([^,]+), a: ([^}]+)',t)
 rgba=tuple(float(x) for x in color.groups());metal=float(re.search(r'- _Metallic: ([^\n]+)',t)[1]);smooth=float(re.search(r'- _Smoothness: ([^\n]+)',t)[1])
 m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=rgba;bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=1-smooth
 m.diffuse_color=rgba;m.metallic=metal;m.roughness=1-smooth
 report.append({'name':m.name,'source':str(p),'color':rgba,'metallic':metal,'roughness':1-smooth,'texture':'none in Unity material'})
bpy.context.scene.frame_set(1)
bpy.ops.export_scene.gltf(filepath=str(probe/'s55-morpho.glb'),export_format='GLB',export_animations=True)
(probe/'s55-morpho-materials.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('EXPORT',str(probe/'s55-morpho.glb'),(probe/'s55-morpho.glb').stat().st_size)
