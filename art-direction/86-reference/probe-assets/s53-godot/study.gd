extends SceneTree

const INPUT = "/Users/wei/Documents/ChatGPT/遊戲練習/assets/"
const PROBE = "/Users/wei/Documents/ChatGPT/遊戲練習/.worktrees/s45-3d-sortie/art-direction/86-reference/probe-assets/"
var world: Node3D
var camera: Camera3D
var environment: Environment
var measurements: Dictionary = {}

func _initialize():
    call_deferred("build")

func read_gltf(path: String) -> Node3D:
    var doc = GLTFDocument.new()
    var state = GLTFState.new()
    var err = doc.append_from_file(path, state)
    assert(err == OK, "glTF failed: " + path)
    var scene = doc.generate_scene(state)
    var processed = {}
    for mesh in all_meshes(scene):
        for surface in range(mesh.mesh.get_surface_count()):
            var material = mesh.mesh.surface_get_material(surface)
            if not material is StandardMaterial3D or processed.has(material):
                continue
            processed[material] = true
            for slot in [BaseMaterial3D.TEXTURE_ALBEDO, BaseMaterial3D.TEXTURE_NORMAL, BaseMaterial3D.TEXTURE_ROUGHNESS, BaseMaterial3D.TEXTURE_METALLIC, BaseMaterial3D.TEXTURE_AMBIENT_OCCLUSION]:
                var texture = material.get_texture(slot)
                if texture == null:
                    continue
                var image = texture.get_image()
                if image == null:
                    continue
                image.generate_mipmaps()
                material.set_texture(slot, ImageTexture.create_from_image(image))
    return scene

func image_texture(path: String) -> ImageTexture:
    var image = Image.load_from_file(path)
    assert(image != null, "Texture missing: " + path)
    image.generate_mipmaps()
    return ImageTexture.create_from_image(image)

func module(library: Node3D, label: String, at: Vector3):
    var source = library.get_node_or_null(NodePath(label))
    assert(source != null, "Module missing: " + label)
    var node = source.duplicate()
    node.position = at
    world.add_child(node)

func all_meshes(node: Node) -> Array:
    var result: Array = []
    if node is MeshInstance3D:
        result.append(node)
    for child in node.get_children():
        result.append_array(all_meshes(child))
    return result

func build():
    root.size = Vector2i(1280, 720)
    world = Node3D.new()
    root.add_child(world)
    environment = Environment.new()
    environment.background_mode = Environment.BG_COLOR
    environment.background_color = Color("252d34")
    var sky = Sky.new()
    var panorama = PanoramaSkyMaterial.new()
    panorama.panorama = image_texture(PROBE + "industrial-sunset.hdr")
    sky.sky_material = panorama
    environment.sky = sky
    environment.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
    environment.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
    environment.ambient_light_energy = 0.6
    environment.tonemap_mode = Environment.TONE_MAPPER_AGX
    environment.ssao_enabled = true
    environment.ssao_radius = 1.0
    environment.ssao_intensity = 1.2
    environment.glow_enabled = false
    var env_node = WorldEnvironment.new()
    env_node.environment = environment
    world.add_child(env_node)
    var sun = DirectionalLight3D.new()
    sun.rotation_degrees = Vector3(-48, -35, 0)
    sun.light_color = Color(1.0, 0.88, 0.73)
    sun.light_energy = 1.35
    sun.shadow_enabled = true
    world.add_child(sun)
    var ground = MeshInstance3D.new()
    var plane = PlaneMesh.new()
    plane.size = Vector2(30, 32)
    ground.mesh = plane
    var road = StandardMaterial3D.new()
    road.albedo_texture = image_texture(INPUT + "3d/asphalt_02_diff_1k.jpg")
    road.normal_enabled = true
    road.normal_texture = image_texture(INPUT + "3d/asphalt_02_nor_gl_1k.jpg")
    road.roughness = 0.92
    road.albedo_color = Color(0.46, 0.48, 0.50)
    road.uv1_scale = Vector3(7.5, 8, 1)
    ground.material_override = road
    world.add_child(ground)
    var factory = read_gltf(INPUT + "model/polyhaven/modular_factory_facade/modular_factory_facade_1k.gltf")
    module(factory, "wall_door_garage_door_01", Vector3(-2,0,-4))
    module(factory, "door_garage_door_01", Vector3(-2,0,-4))
    for x in [-5,-2]:
        module(factory, "wall_window_centered_large_01", Vector3(x,3,-4))
        module(factory, "window_centered_large_01", Vector3(x,3,-4))
        module(factory, "cornice01_standard_standard_01", Vector3(x,6,-4))
    module(factory, "wall_standard_corner_large_01", Vector3(-8,0,-4))
    module(factory, "wall_standard_corner_large_01", Vector3(-8,3,-4))
    factory.free()
    var mech = read_gltf(PROBE + "s53-godot/juggernaut-normalized.glb")
    var mount = Node3D.new()
    world.add_child(mount)
    mount.add_child(mech)
    var initial = true
    var bounds = AABB()
    for mesh in all_meshes(mech):
        var box = mesh.global_transform * mesh.get_aabb()
        bounds = box if initial else bounds.merge(box)
        initial = false
    var scale_factor = 5.4 / bounds.size.x
    mech.scale *= scale_factor
    mech.position = Vector3(-bounds.get_center().x * scale_factor, -bounds.position.y * scale_factor, -bounds.get_center().z * scale_factor + 2)
    mount.rotation.y = PI
    measurements["mesh_bounds"] = []
    for mesh in all_meshes(mech):
        measurements["mesh_bounds"].append({"name":mesh.name,"world_aabb":str(mesh.global_transform * mesh.get_aabb())})
    measurements["original_mech_bounds"] = [bounds.position, bounds.size]
    measurements["mech_scale"] = scale_factor
    measurements["length_axis"] = "source world X, aligned with cannon; Z is foot spread"
    measurements["renderer"] = RenderingServer.get_current_rendering_method()
    measurements["driver"] = RenderingServer.get_current_rendering_driver_name()
    camera = Camera3D.new()
    world.add_child(camera)
    camera.position = Vector3(7, 10, 12)
    camera.fov = 35
    camera.look_at(Vector3(-1, 0.8, -2))
    camera.current = true
    root.msaa_3d = Viewport.MSAA_4X
    if "--material-study" in OS.get_cmdline_user_args():
        camera.position = Vector3(6, 5, 5)
        camera.look_at(Vector3(0, 0.8, -2))
        await take_frame("s54-material-original.png")
        var tuning = {
            "BODY": [Color(0.45, 0.57, 0.61), 1.0],
            "GUN2": [Color(0.28, 0.34, 0.38), 0.9],
            "material": [Color(0.42, 0.50, 0.54), 0.85]
        }
        for mesh in all_meshes(mech):
            for surface in range(mesh.mesh.get_surface_count()):
                var material = mesh.mesh.surface_get_material(surface)
                if tuning.has(material.resource_name):
                    var values = tuning[material.resource_name]
                    material.albedo_color = values[0]
                    material.roughness *= values[1]
        measurements["material_tuning"] = tuning
        await take_frame("s54-material-separated.png")
        camera.position = Vector3(7,10,12)
        camera.look_at(Vector3(-1,0.8,-2))
        await take_frame("s54-material-wide.png")
        if "--ruin" in OS.get_cmdline_user_args():
            var structure = read_gltf(PROBE + "s54-maintenance-bay.glb")
            world.add_child(structure)
            structure.position = Vector3(-5,0,-6)
            camera.position = Vector3(11,16,19)
            camera.look_at(Vector3(-2,1,-3))
            await take_frame("s54-structure-wide.png")
        var result_file = FileAccess.open(PROBE + "s54-material-run.json", FileAccess.WRITE)
        result_file.store_string(JSON.stringify(measurements, "  "))
        world.queue_free()
        await process_frame
        quit()
        return
    await take_frame("s53-godot-material-baseline.png")
    environment.ssao_enabled = false
    await take_frame("s53-godot-material-no-ao.png")
    environment.ssao_enabled = true
    camera.position = Vector3(6, 5, 5)
    camera.look_at(Vector3(0, 0.8, -2))
    await take_frame("s53-godot-material-close.png")
    measurements["visible_meshes"] = all_meshes(world).size()
    var log = FileAccess.open(PROBE + "s53-godot-run.json", FileAccess.WRITE)
    log.store_string(JSON.stringify(measurements, "  "))
    world.queue_free()
    await process_frame
    quit()

func take_frame(filename: String):
    for i in range(24):
        await process_frame
    await RenderingServer.frame_post_draw
    var image = root.get_texture().get_image()
    assert(image != null and not image.is_empty())
    var result = image.save_png(PROBE + filename)
    print("CAPTURE ", filename, " result=", result, " size=", image.get_size())
