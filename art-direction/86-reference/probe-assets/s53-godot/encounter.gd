extends "study.gd"

var asset_bounds: Dictionary = {}
var posed_bounds: Dictionary = {}

func bounds_of(node: Node3D) -> AABB:
    var box := AABB()
    var first := true
    for mesh in all_meshes(node):
        var posed = mesh.bake_mesh_from_current_skeleton_pose() if mesh.skin != null else mesh.mesh
        var current = mesh.global_transform * posed.get_aabb()
        box = current if first else box.merge(current)
        first = false
    return box

func put_model(model: Node3D, length: float, axis: int, at: Vector3, yaw: float, label: String) -> Node3D:
    var mount := Node3D.new()
    world.add_child(mount)
    mount.add_child(model)
    var key := label.get_slice("_",0)
    if not posed_bounds.has(key):
        for i in range(8):
            await process_frame
        posed_bounds[key] = bounds_of(model)
    var box: AABB = posed_bounds[key]
    var factor := length / box.size[axis]
    model.scale *= factor
    model.position = -Vector3(box.get_center().x, box.position.y, box.get_center().z) * factor
    mount.position = at
    mount.rotation_degrees.y = yaw
    asset_bounds[label] = {"source_size":str(box.size), "length_axis":axis, "length_target":length, "uniform_scale":factor, "scaled_height":box.size.y * factor}
    return mount

func box_mesh(size: Vector3, at: Vector3, color: Color, metal: float = 0.0) -> MeshInstance3D:
    var obj := MeshInstance3D.new()
    var mesh := BoxMesh.new()
    mesh.size = size
    obj.mesh = mesh
    var mat := StandardMaterial3D.new()
    mat.albedo_color = color
    mat.metallic = metal
    mat.roughness = 0.8
    obj.material_override = mat
    obj.position = at
    world.add_child(obj)
    return obj

func build():
    root.size = Vector2i(1600, 900)
    root.msaa_3d = Viewport.MSAA_4X
    world = Node3D.new()
    root.add_child(world)
    environment = Environment.new()
    environment.background_mode = Environment.BG_COLOR
    environment.background_color = Color(0.22,0.27,0.32)
    var sky := Sky.new()
    var panorama := PanoramaSkyMaterial.new()
    panorama.panorama = image_texture(PROBE + "industrial-sunset.hdr")
    sky.sky_material = panorama
    environment.sky = sky
    environment.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
    environment.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
    environment.ambient_light_energy = 0.55
    environment.tonemap_mode = Environment.TONE_MAPPER_AGX
    environment.ssao_enabled = true
    environment.ssao_radius = 1.1
    environment.ssao_intensity = 1.3
    environment.fog_enabled = true
    environment.fog_light_color = Color(0.30,0.36,0.42)
    environment.fog_density = 0.0028
    environment.fog_sky_affect = 0.5
    var env := WorldEnvironment.new()
    env.environment = environment
    world.add_child(env)
    var sun := DirectionalLight3D.new()
    sun.rotation_degrees = Vector3(-30,-48,0)
    sun.light_color = Color(1.0,0.81,0.61)
    sun.light_energy = 1.8
    sun.shadow_enabled = true
    sun.directional_shadow_max_distance = 140
    world.add_child(sun)
    var ground := MeshInstance3D.new()
    var plane := PlaneMesh.new()
    plane.size = Vector2(180,200)
    ground.mesh = plane
    var road := StandardMaterial3D.new()
    road.albedo_texture = image_texture(INPUT + "3d/asphalt_02_diff_1k.jpg")
    road.normal_enabled = true
    road.normal_texture = image_texture(INPUT + "3d/asphalt_02_nor_gl_1k.jpg")
    road.albedo_color = Color(0.45,0.47,0.49)
    road.roughness = 0.94
    road.uv1_scale = Vector3(45,50,1)
    ground.material_override = road
    ground.position.z = -40
    world.add_child(ground)
    # Railway geometry is a layout proxy, not an approved environment asset.
    for x in [-1.1,1.1]:
        box_mesh(Vector3(0.12,0.16,120),Vector3(x,0.14,-32),Color(0.16,0.19,0.22),0.65)
    for z in range(-85,24,2):
        box_mesh(Vector3(3.4,0.13,0.30),Vector3(0,0.05,z),Color(0.18,0.16,0.14))
    var factory := read_gltf(INPUT + "model/polyhaven/modular_factory_facade/modular_factory_facade_1k.gltf")
    for section in range(16):
        var x := float(section * 3 - 44)
        module(factory,"wall_window_centered_large_01",Vector3(x,0,-62))
        module(factory,"window_centered_large_01",Vector3(x,0,-62))
        module(factory,"wall_window_centered_large_01",Vector3(x,3,-62))
        module(factory,"window_centered_large_01",Vector3(x,3,-62))
        module(factory,"cornice01_standard_standard_01",Vector3(x,6,-62))
    for side in [-1,1]:
        for section in range(7):
            var at := Vector3(side*24,0,-5-section*5)
            box_mesh(Vector3(4,1.2,4.7),at+Vector3(0,0.6,0),Color(0.23,0.24,0.25))
            if section % 3 != 0:
                module(factory,"wall_window_centered_large_01",at+Vector3(0,1.2,0))
                module(factory,"window_centered_large_01",at+Vector3(0,1.2,0))
    factory.free()
    var boss := read_gltf(PROBE + "s55-morpho.glb")
    await put_model(boss,40.2,2,Vector3(5,0,-33),52,"Morpho")
    var scout := read_gltf(PROBE + "ameise-reuse-probe.glb")
    var rng := RandomNumberGenerator.new()
    rng.seed = 55086
    for i in range(24):
        var flank := -1.0 if i % 2 == 0 else 1.0
        var depth := float(i/2)
        var at := Vector3(flank*rng.randf_range(7,17),0,2-depth*2.3+rng.randf_range(-2,2))
        var unit := scout.duplicate()
        await put_model(unit,3.8,2,at,rad_to_deg(atan2(-4-at.x,11-at.z)),"Ameise_"+str(i))
    scout.free()
    var player_path := PROBE + "s55-reginleif-import.glb"
    if FileAccess.file_exists(player_path):
        await put_model(read_gltf(player_path),6.3,2,Vector3(-4,0,11),180,"XM2_forward_pending_visual_check")
    else:
        await put_model(read_gltf(PROBE+"s53-godot/juggernaut-normalized.glb"),5.4,0,Vector3(-4,0,11),90,"M1A4_temporary_stand_in")
    camera = Camera3D.new()
    world.add_child(camera)
    camera.position = Vector3(7,9,26)
    camera.fov = 54
    camera.look_at(Vector3(0,1,-19))
    camera.current = true
    await take_frame("s55-encounter-cinematic.png")
    var players := boss.find_children("*","AnimationPlayer",true,false)
    var animation_names: Array = []
    for player in players:
        animation_names.append_array(player.get_animation_list())
        for clip in player.get_animation_list():
            if "move forward" in clip:
                player.play(clip)
                player.seek(1.2,true)
                player.pause()
    await take_frame("s55-morpho-motion-1.png")
    for player in players:
        for clip in player.get_animation_list():
            if "move forward" in clip:
                player.play(clip)
                player.seek(2.4,true)
                player.pause()
    await take_frame("s55-morpho-motion-2.png")
    camera.position = Vector3(24,34,39)
    camera.fov = 54
    camera.look_at(Vector3(0,0,-20))
    await take_frame("s55-encounter-oblique.png")
    var report := {"stage":"composition diagnostic, no combat implemented", "boss_animation_names":animation_names,"scouts":24,"Ameise_length":"3.8m artistic placeholder; official dimensions unavailable","assets":asset_bounds,"renderer":RenderingServer.get_current_rendering_method(),"driver":RenderingServer.get_current_rendering_driver_name(),"meshes":all_meshes(world).size()}
    FileAccess.open(PROBE+"s55-encounter-run.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    world.queue_free()
    await process_frame
    quit()
