import bpy,json
from pathlib import Path
from mathutils import Vector
base=Path('/private/tmp/s51-project86-juggernaut')
out=Path('/Users/wei/Documents/ChatGPT/遊戲練習/art-direction/86-reference/probe-assets')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(base/'NewTexturedJuggernaut.fbx'),use_anim=True,bake_space_transform=False)
for o in list(bpy.context.scene.objects):
    if o.type in {'LIGHT','CAMERA'}:bpy.data.objects.remove(o,do_unlink=True)
mat=bpy.data.materials['Jugg_Texture']; mat.use_nodes=True; mat.node_tree.nodes.clear()
n=mat.node_tree.nodes; l=mat.node_tree.links
p=n.new('ShaderNodeBsdfPrincipled');p.inputs['Metallic'].default_value=.48;p.inputs['Roughness'].default_value=.42
output=n.new('ShaderNodeOutputMaterial');l.new(p.outputs['BSDF'],output.inputs['Surface'])
for filename,socket,isnormal in [('Robot_2_Base_Color.png','Base Color',False),('Robot_2_Normal_OpenGL.png','Normal',True)]:
    im=bpy.data.images.load(str(base/filename),check_existing=False);im.scale(2048,2048)
    im.filepath_raw=str(base/('2k-'+filename));im.file_format='PNG';im.save()
    tex=n.new('ShaderNodeTexImage');tex.image=im
    if isnormal:
        im.colorspace_settings.name='Non-Color';normal=n.new('ShaderNodeNormalMap');l.new(tex.outputs['Color'],normal.inputs['Color']);l.new(normal.outputs['Normal'],p.inputs[socket])
    else:l.new(tex.outputs['Color'],p.inputs[socket])
sensor=bpy.data.materials.get('composite sensor')
if sensor:
    sensor.use_nodes=True
    ps=next(x for x in sensor.node_tree.nodes if x.type=='BSDF_PRINCIPLED');ps.inputs['Base Color'].default_value=(.15,.025,.012,1);ps.inputs['Emission Color'].default_value=(.7,.05,.015,1);ps.inputs['Emission Strength'].default_value=1.4
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get();points=[]
for o in meshes:
    ev=o.evaluated_get(deps);me=ev.to_mesh();points.extend(o.matrix_world@v.co for v in me.vertices);ev.to_mesh_clear()
lo=Vector([min(v[i] for v in points) for i in range(3)]);hi=Vector([max(v[i] for v in points) for i in range(3)])
roots=[o for o in bpy.context.scene.objects if o.parent is None]
root=bpy.data.objects.new('inspection-scale',None);bpy.context.collection.objects.link(root)
for child in roots:
    matrix=child.matrix_world.copy();child.parent=root;child.matrix_world=matrix
scale=4.8/(hi.x-lo.x);root.scale*=scale;root.location=root.location*scale+Vector((-(lo.x+hi.x)*.5*scale,-(lo.y+hi.y)*.5*scale,-lo.z*scale))
bpy.context.view_layer.update()
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
for bone_name in ['L.F.Leg','R.F.Leg']:
    pb=arm.pose.bones[bone_name];pb.rotation_mode='XYZ'
    for frame,angle in [(1,0),(16,.24),(31,0)]:
        pb.rotation_euler.x=angle;pb.keyframe_insert(data_path='rotation_euler',frame=frame)
arm.animation_data.action.name='DIAGNOSTIC_front_leg_articulation'
bpy.context.scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(base/'juggernaut-inspected.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'juggernaut-reuse-probe.glb'),export_format='GLB',export_animations=True,export_skins=True,export_morph=False)
print('EXPORTED',out/'juggernaut-reuse-probe.glb')
