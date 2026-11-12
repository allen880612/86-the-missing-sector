import bpy
from pathlib import Path
from mathutils import Vector
out=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(out/'s52-juggernaut-motion.blend'))
scene=bpy.context.scene;arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='TEXTURE';scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True
scene.world=bpy.data.worlds.new('S52 QA World');scene.display.shading.background_type='WORLD';scene.world.color=(.12,.12,.12)
scene.render.resolution_x=800;scene.render.resolution_y=650;scene.render.resolution_percentage=100
bpy.ops.object.camera_add(location=(7,-9,5));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,1))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=7.9;scene.camera=cam
for clip,frame in [('idle',1),('walk',14),('walk',41),('trot',7),('vault',31),('recoil',4)]:
 for p in arm.pose.bones:p.matrix_basis.identity()
 arm.animation_data.action=bpy.data.actions[clip];scene.frame_set(frame);bpy.context.view_layer.update()
 scene.render.filepath=str(out/f's52-{clip}-{frame:03}.png');bpy.ops.render.render(write_still=True)
print('QA renders complete')
