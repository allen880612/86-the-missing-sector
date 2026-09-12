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
    mount.add_to_group("encounter_units")
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

func batch_static_environment(model: Node3D):
    var groups := {}
    var originals := all_meshes(model)
    for node in originals:
        var cell := Vector2i(floori(node.global_position.x/35.0),floori(node.global_position.z/35.0))
        var key := str(node.mesh.get_instance_id())+"/"+str(cell)
        if not groups.has(key):
            groups[key] = []
        groups[key].append(node)
    var batched := 0
    var batches := 0
    for nodes in groups.values():
        if nodes.size() < 3:
            continue
        var multi := MultiMesh.new()
        multi.transform_format = MultiMesh.TRANSFORM_3D
        multi.mesh = nodes[0].mesh
        multi.instance_count = nodes.size()
        var instance := MultiMeshInstance3D.new()
        instance.multimesh = multi
        world.add_child(instance)
        for i in range(nodes.size()):
            multi.set_instance_transform(i,nodes[i].global_transform)
            nodes[i].visible = false
        batched += nodes.size()
        batches += 1
    asset_bounds["environment_batches"] = {"original_mesh_nodes":originals.size(),"batched_instances":batched,"multimesh_groups":batches,"partition_metres":35,"note":"static shared meshes only; does not batch rigged enemies or prove FPS"}

func terrain_height(x: float, z: float, noise: FastNoiseLite) -> float:
    var side := smoothstep(35.0,90.0,absf(x))
    var rear := smoothstep(100.0,175.0,-z)
    return maxf(side*(14.0+noise.get_noise_2d(x,z)*10.0),rear*(24.0+noise.get_noise_2d(x+100,z)*12.0))

func surface_material(asset: String, repeat_scale: float) -> StandardMaterial3D:
    var folder := INPUT+"model/polyhaven/"+asset+"/"
    var manifest = JSON.parse_string(FileAccess.get_file_as_string(folder+"intake-manifest.json"))
    var maps = {}
    for item in manifest.files:
        maps[item.kind] = folder+item.file
    var mat := StandardMaterial3D.new()
    mat.albedo_texture = image_texture(maps.diff)
    mat.normal_enabled = true
    mat.normal_texture = image_texture(maps.nor_gl)
    mat.roughness_texture = image_texture(maps.arm)
    mat.roughness_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_GREEN
    mat.ao_enabled = true
    mat.ao_texture = mat.roughness_texture
    mat.ao_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_RED
    mat.uv1_scale = Vector3(repeat_scale,repeat_scale,1)
    return mat

func build_ground():
    var noise := FastNoiseLite.new()
    noise.seed = 56086
    noise.frequency = 0.026
    noise.fractal_octaves = 3
    var st := SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    var nx := 100
    var nz := 120
    for row in range(nz+1):
        for col in range(nx+1):
            var x := -200.0+float(col)*4.0
            var z := -350.0+float(row)*4.0
            var tint := 0.73+noise.get_noise_2d(x*2,z*2)*0.17
            st.set_color(Color(tint,tint,tint,1))
            st.set_uv(Vector2(x/3.0,z/3.0))
            st.add_vertex(Vector3(x,terrain_height(x,z,noise)-0.04,z))
    for row in range(nz):
        for col in range(nx):
            var a := row*(nx+1)+col
            for index in [a,a+1,a+nx+1,a+1,a+nx+2,a+nx+1]:
                st.add_index(index)
    st.generate_normals()
    st.generate_tangents()
    var mesh := st.commit()
    var ground := MeshInstance3D.new()
    ground.mesh = mesh
    var mat := surface_material("rocks_ground_08",1.0)
    mat.vertex_color_use_as_albedo = true
    ground.material_override = mat
    world.add_child(ground)
    var ballast := MeshInstance3D.new()
    var bed := PlaneMesh.new()
    bed.size = Vector2(4.0,145)
    ballast.mesh = bed
    ballast.position = Vector3(0,0.015,-38)
    var bed_mat := surface_material("rubble",1.0)
    bed_mat.uv1_scale = Vector3(2.0,72.5,1)
    bed_mat.albedo_color = Color(0.64,0.65,0.67)
    ballast.material_override = bed_mat
    world.add_child(ballast)
    for x in [-0.7175,0.7175]:
        box_mesh(Vector3(0.10,0.16,145),Vector3(x,0.19,-38),Color(0.13,0.15,0.16),0.7)
    for index in range(180):
        var z := 31.0-float(index)*0.8
        box_mesh(Vector3(2.6,0.13,0.24),Vector3(0,0.085,z),Color(0.14,0.12,0.10))
    asset_bounds["environment_ground"] = {"size":"400 x 480m", "terrain_triangles":nx*nz*2,"first_normal":str(mesh.surface_get_arrays(0)[Mesh.ARRAY_NORMAL][0]),"corridor":"level inside |X| <=35, Z >= -100", "materials":"CC0 rocks_ground_08 + rubble; authored terrain grade"}

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
    build_ground()
    var factory := read_gltf(PROBE+"s56-rail-environment.glb")
    world.add_child(factory)
    batch_static_environment(factory)
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
    for unit in get_nodes_in_group("encounter_units"):
        unit.visible = false
    await take_frame("s56-environment-only.png")
    for unit in get_nodes_in_group("encounter_units"):
        unit.visible = true
    await take_frame("s56-encounter-cinematic.png")
    var players := boss.find_children("*","AnimationPlayer",true,false)
    var animation_names: Array = []
    for player in players:
        animation_names.append_array(player.get_animation_list())
        for clip in player.get_animation_list():
            if "move forward" in clip:
                player.play(clip)
                player.seek(1.2,true)
                player.pause()
    await take_frame("s56-morpho-motion-1.png")
    for player in players:
        for clip in player.get_animation_list():
            if "move forward" in clip:
                player.play(clip)
                player.seek(2.4,true)
                player.pause()
    await take_frame("s56-morpho-motion-2.png")
    camera.position = Vector3(24,34,39)
    camera.fov = 54
    camera.look_at(Vector3(0,0,-20))
    await take_frame("s56-encounter-oblique.png")
    var report := {"stage":"composition diagnostic, no combat implemented", "boss_animation_names":animation_names,"scouts":24,"Ameise_length":"3.8m artistic placeholder; official dimensions unavailable","assets":asset_bounds,"renderer":RenderingServer.get_current_rendering_method(),"driver":RenderingServer.get_current_rendering_driver_name(),"meshes":all_meshes(world).size()}
    FileAccess.open(PROBE+"s56-encounter-run.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    world.queue_free()
    await process_frame
    quit()
