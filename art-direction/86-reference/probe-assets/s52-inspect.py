import bpy,json
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath='/private/tmp/s51-project86-juggernaut/juggernaut-inspected.blend')
a=next(o for o in bpy.data.objects if o.type=='ARMATURE');a.animation_data_clear()
for p in a.pose.bones:p.matrix_basis.identity()
bpy.context.view_layer.update()
print('ARM',a.matrix_world[:]);print('ROOT',a.parent.matrix_world[:])
for o in bpy.data.objects:
 if o.type=='MESH' and (o.parent_bone or o.name=='Cannon'):
  v=[o.matrix_world@v.co for v in o.data.vertices]
  print('OBJ',o.name,o.parent_bone,'bounds',*[tuple(round(f,4) for f in x) for x in [Vector([min(p[i] for p in v) for i in range(3)]),Vector([max(p[i] for p in v) for i in range(3)])]])
for p in a.pose.bones:
 print('BONE',p.name,'h',tuple(round(f,4) for f in p.head),'t',tuple(round(f,4) for f in p.tail))
