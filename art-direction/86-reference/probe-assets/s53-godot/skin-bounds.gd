extends "study.gd"

func build():
    world = Node3D.new()
    root.add_child(world)
    var report = {}
    for filename in ["ameise-reuse-probe.glb", "s55-morpho.glb"]:
        var model = read_gltf(PROBE+filename)
        world.add_child(model)
        for i in range(8):
            await process_frame
        var rows = []
        for mesh in all_meshes(model):
            var baked = mesh.bake_mesh_from_current_skeleton_pose() if mesh.skin != null else mesh.mesh
            rows.append({"name":str(mesh.name),"mesh_bounds":str(mesh.mesh.get_aabb()),"global_transform":str(mesh.global_transform),"world_raw":str(mesh.global_transform*mesh.get_aabb()),"world_baked":str(mesh.global_transform*baked.get_aabb()),"skeleton":str(mesh.skeleton)})
        report[filename] = rows
        model.queue_free()
        await process_frame
    FileAccess.open(PROBE+"s55-skin-bounds.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    quit()
