extends SceneTree
func _initialize():
    var doc = GLTFDocument.new()
    var state = GLTFState.new()
    var err = doc.append_from_file("/Users/wei/Documents/ChatGPT/遊戲練習/.worktrees/s45-3d-sortie/art-direction/86-reference/probe-assets/s53-godot/juggernaut-normalized.glb", state)
    assert(err == OK)
    var scene = doc.generate_scene(state)
    root.add_child(scene)
    var records = []
    for node in scene.find_children("*", "MeshInstance3D", true, false):
        for surface in range(node.mesh.get_surface_count()):
            var material = node.mesh.surface_get_material(surface)
            var record = {"mesh":node.name,"material":material.resource_name,"albedo":str(material.albedo_color),"metallic":material.metallic,"roughness":material.roughness,"roughness_channel":material.roughness_texture_channel,"metallic_channel":material.metallic_texture_channel}
            for pair in [["albedo",BaseMaterial3D.TEXTURE_ALBEDO],["roughness",BaseMaterial3D.TEXTURE_ROUGHNESS],["metallic",BaseMaterial3D.TEXTURE_METALLIC]]:
                var texture = material.get_texture(pair[1])
                if texture == null:
                    record[pair[0]+"_texture"] = "missing"
                    continue
                var image = texture.get_image()
                var mean = Vector3.ZERO
                for y in range(0,image.get_height(),16):
                    for x in range(0,image.get_width(),16):
                        var pixel = image.get_pixel(x,y)
                        mean += Vector3(pixel.r,pixel.g,pixel.b)
                mean /= ceil(image.get_width()/16.0)*ceil(image.get_height()/16.0)
                record[pair[0]+"_texture"] = {"size":str(image.get_size()),"sample_mean_rgb":str(mean)}
            records.append(record)
    var f=FileAccess.open("/Users/wei/Documents/ChatGPT/遊戲練習/.worktrees/s45-3d-sortie/art-direction/86-reference/probe-assets/s54-material-inspection.json",FileAccess.WRITE)
    f.store_string(JSON.stringify(records,"  "))
    print(JSON.stringify(records))
    scene.free()
    quit()
