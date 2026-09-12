extends "encounter.gd"

var particles: Array = []
var flashes: Array = []
var events: Array = []
var smoke_texture: Texture2D
var explosion_frames: Array = []

func beam(from: Vector3, to: Vector3, radius: float, color: Color) -> MeshInstance3D:
    var node := MeshInstance3D.new()
    var cylinder := CylinderMesh.new()
    cylinder.top_radius = radius
    cylinder.bottom_radius = radius
    cylinder.height = from.distance_to(to)
    cylinder.radial_segments = 8
    node.mesh = cylinder
    var mat := StandardMaterial3D.new()
    mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
    mat.albedo_color = color
    mat.emission_enabled = true
    mat.emission = color
    mat.emission_energy_multiplier = 2.0
    node.material_override = mat
    world.add_child(node)
    node.position = (from+to)*0.5
    node.quaternion = Quaternion(Vector3.UP,(to-from).normalized())
    return node

func dust(at: Vector3, size: float, stamp: float):
    var node := GPUParticles3D.new()
    node.amount = 10
    node.one_shot = true
    node.explosiveness = 1.0
    node.lifetime = 2.8
    node.fixed_fps = 24
    node.use_fixed_seed = true
    node.seed = 86+int(stamp*24)
    node.visibility_aabb = AABB(Vector3(-12,-2,-12),Vector3(24,16,24))
    var process := ParticleProcessMaterial.new()
    process.direction = Vector3.UP
    process.spread = 65
    process.initial_velocity_min = size*0.4
    process.initial_velocity_max = size*1.2
    process.gravity = Vector3(0,0.1,0)
    process.damping_min = 0.8
    process.damping_max = 1.5
    process.scale_min = size*0.25
    process.scale_max = size*0.5
    var ramp := Gradient.new()
    ramp.set_color(0,Color(0.85,0.85,0.85,0.48))
    ramp.set_color(1,Color(0.85,0.85,0.85,0))
    var texture := GradientTexture1D.new()
    texture.gradient = ramp
    process.color_ramp = texture
    node.process_material = process
    var quad := QuadMesh.new()
    quad.size = Vector2.ONE*2
    var mat := StandardMaterial3D.new()
    mat.albedo_texture = smoke_texture
    mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
    mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
    mat.vertex_color_use_as_albedo = true
    mat.roughness = 1
    quad.material = mat
    node.draw_pass_1 = quad
    world.add_child(node)
    node.position = at
    node.speed_scale = 0.0
    node.restart()
    particles.append({"node":node,"born":stamp,"lifetime":2.8})

func impact(at: Vector3, size: float, stamp: float, is_muzzle: bool = false):
    var sprite := Sprite3D.new()
    sprite.texture = explosion_frames[0]
    sprite.pixel_size = size/239.0
    sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
    sprite.shaded = false
    var mat := StandardMaterial3D.new()
    mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
    mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
    mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
    mat.albedo_texture = explosion_frames[0]
    mat.no_depth_test = false
    sprite.material_override = mat
    world.add_child(sprite)
    sprite.position = at+Vector3.UP*size*0.3
    var light := OmniLight3D.new()
    light.light_color = Color(1,0.51,0.17)
    light.omni_range = size*2.0
    world.add_child(light)
    light.position = at+Vector3.UP
    flashes.append({"sprite":sprite,"light":light,"born":stamp,"size":size,"lifetime":0.12 if is_muzzle else 0.28})
    if not is_muzzle:
        dust(at,size*0.65,stamp)
        sparks(at,size,stamp)

func sparks(at: Vector3, size: float, stamp: float):
    var node := GPUParticles3D.new()
    node.amount = 20 if size>3 else 9
    node.one_shot = true
    node.explosiveness = 1
    node.lifetime = 0.7
    node.fixed_fps = 24
    node.use_fixed_seed = true
    node.seed = 580+int(stamp*24)
    var process := ParticleProcessMaterial.new()
    process.direction = Vector3.UP
    process.spread = 78
    process.initial_velocity_min = size*1.5
    process.initial_velocity_max = size*3
    process.gravity = Vector3(0,-12,0)
    node.process_material = process
    var mesh := BoxMesh.new()
    mesh.size = Vector3(0.025,0.11,0.025)
    var mat := StandardMaterial3D.new()
    mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
    mat.albedo_color = Color(1,0.74,0.36)
    mat.emission_enabled = true
    mat.emission = mat.albedo_color
    mat.emission_energy_multiplier = 4
    mesh.material = mat
    node.draw_pass_1 = mesh
    world.add_child(node)
    node.position = at
    node.speed_scale = 0
    node.restart()
    particles.append({"node":node,"born":stamp,"lifetime":0.7})

func capture_scene(boss: Node3D):
    root.size = Vector2i(1280,720)
    smoke_texture = image_texture(INPUT+"vfx/kenney-smoke/blackSmoke05.png")
    var manifest = JSON.parse_string(FileAccess.get_file_as_string(INPUT+"vfx/lava-blast/manifest.json"))
    for name in manifest.files:
        explosion_frames.append(image_texture(INPUT+"vfx/lava-blast/"+name))
    if not "--collapse" in OS.get_cmdline_user_args():
        assert(FileAccess.file_exists(PROBE+"s58-collapse-band.glb"),"Collapse asset must be verified before capture")
        world.add_child(read_gltf(PROBE+"s58-collapse-band.glb"))
    var units := get_nodes_in_group("encounter_units")
    var player: Node3D = units[-1]
    var boss_mount: Node3D = boss.get_parent()
    boss_mount.rotation_degrees.y = -28
    camera.position = Vector3(4,11,32)
    camera.look_at(Vector3(0,1,-19))
    var original_camera := camera.position
    var original_player := player.position
    for i in range(24):
        var flank := -1.0 if i%2==0 else 1.0
        var rank := int(i/6)
        var column := int(i/2)%3
        units[i+1].position = Vector3(flank*(7.0+column*5.2),0,1-rank*8.0-column*1.5)
        units[i+1].rotation.y = atan2(-4-units[i+1].position.x,11-units[i+1].position.z)
    if "--environment-review" in OS.get_cmdline_user_args():
        await review_environment(units)
        return
    var animations := boss.find_children("*","AnimationPlayer",true,false)
    var clips := []
    for anim in animations:
        for clip in anim.get_animation_list():
            if "move forward" in clip:
                clips.append({"player":anim,"clip":clip})
    var gun_skeleton: Skeleton3D
    var gun_bone := -1
    for candidate in boss.find_children("*","Skeleton3D",true,false):
        var index: int = candidate.find_bone("railgun_turret")
        if index>=0:
            gun_skeleton = candidate
            gun_bone = index
            break
    assert(gun_skeleton != null,"Measured railgun skeleton must exist")
    var socket := Vector3(0,999.88922,0.032805)
    var target_ground := Vector3(3,0.1,10)
    var shots := []
    for i in range(8):
        var target: Node3D = units[1+i*2]
        shots.append({"time":1.2+float(i)*0.85,"from":Vector3(-4,1.7,7.8),"to":target.position+Vector3(0,1.2,0),"size":1.5,"hit":false,"beam":null,"fired":false})
    var boss_from: Vector3 = gun_skeleton.global_transform*gun_skeleton.get_bone_global_pose(gun_bone)*socket
    shots.append({"time":5.7,"from":boss_from,"to":Vector3(3,0.1,10),"size":3.8,"hit":false,"beam":null,"fired":false})
    var lock_line := beam(boss_from,Vector3(3,0.1,10),0.022,Color(0.5,0.19,0.07))
    lock_line.visible = false
    var charge := OmniLight3D.new()
    world.add_child(charge)
    charge.position = boss_from
    charge.omni_range = 9
    charge.light_color = Color(1,0.4,0.12)
    charge.light_energy = 0
    var folder := "/private/tmp/s58-combat-v3-frames/"
    DirAccess.make_dir_recursive_absolute(folder)
    for frame in range(288):
        var t := float(frame)/24.0
        for clip in clips:
            clip.player.play(clip.clip)
            clip.player.seek(fmod(t*0.5,3.5),true)
            clip.player.pause()
        boss_mount.position.z = -33+minf(t,5.5)*0.35
        var gun_pose: Transform3D = gun_skeleton.get_bone_global_pose(gun_bone)
        var gun_world: Transform3D = gun_skeleton.global_transform*gun_pose
        var forward: Vector3 = (gun_world.basis*Vector3.UP).normalized()
        var desired: Vector3 = (target_ground-gun_world.origin).normalized()
        var aim := Quaternion.IDENTITY.slerp(Quaternion(forward,desired),smoothstep(3.0,5.3,t))
        gun_world.basis = Basis(aim)*gun_world.basis
        gun_skeleton.set_bone_global_pose(gun_bone,gun_skeleton.global_transform.affine_inverse()*gun_world)
        var muzzle: Vector3 = gun_world*socket
        forward = (gun_world.basis*Vector3.UP).normalized()
        var hit_distance := (target_ground.y-muzzle.y)/minf(-0.001,forward.y)
        var aim_point := muzzle+forward*minf(100,hit_distance)
        lock_line.position = (muzzle+aim_point)*0.5
        lock_line.mesh.height = muzzle.distance_to(aim_point)
        lock_line.quaternion = Quaternion(Vector3.UP,forward)
        charge.position = muzzle
        lock_line.visible = t>=3.7 and t<5.7
        charge.light_energy = clampf((t-3.7)/2.0,0,1)*3 if t<5.7 else maxf(0,1-(t-5.7)*8)*7
        player.position = original_player
        var evasion := smoothstep(4.5,5.45,t)
        player.position.x -= evasion*2.4
        player.position.y = sin(clampf((t-4.5)/0.95,0,1)*PI)*1.2
        var recoil := 0.0
        for shot in shots:
            var age: float = t-shot.time
            if age<0:continue
            if not shot.fired:
                shot.fired = true
                if shot.size<3:
                    shot.from = player.position+Vector3(0,1.7,-3.2)
                else:
                    shot.from = muzzle
                    shot.to = aim_point
                    events.append({"event":"bone_socket","time":t,"world":str(muzzle),"forward":str(forward),"target_error_metres":aim_point.distance_to(target_ground)})
                impact(shot.from,0.5 if shot.size<3 else 1.4,t,true)
                events.append({"event":"fire","time":t,"from":str(shot.from),"to":str(shot.to)})
                shot.beam = beam(shot.from,shot.to,0.025 if shot.size<3 else 0.085,Color(1,0.65,0.24))
            shot.beam.visible = age<0.20
            if age<0.20:
                var head: Vector3 = shot.from.lerp(shot.to,clampf(age/0.20,0,1))
                var tail: Vector3 = shot.from.lerp(shot.to,clampf(age/0.20-0.14,0,1))
                shot.beam.position = (head+tail)*0.5
                shot.beam.mesh.height = maxf(0.01,head.distance_to(tail))
            if age>=0.20 and not shot.hit:
                impact(shot.to,shot.size,t)
                shot.hit = true
                events.append({"event":"impact","time":t,"at":str(shot.to)})
            if shot.size<3 and age<0.2:recoil=maxf(recoil,0.12*(1-age/0.2))
        player.position.z += recoil
        for i in range(flashes.size()-1,-1,-1):
            var fx = flashes[i]
            var age: float = t-fx.born
            if age>=fx.lifetime:
                fx.sprite.queue_free()
                fx.light.queue_free()
                flashes.remove_at(i)
            else:
                fx.sprite.material_override.albedo_texture = explosion_frames[mini(15,int(age/fx.lifetime*16))]
                fx.light.light_energy = maxf(0,1-age*9)*3.0
        for i in range(particles.size()-1,-1,-1):
            var puff = particles[i]
            if t-puff.born<puff.lifetime:
                puff.node.request_particles_process(1.0/24.0)
            else:
                puff.node.queue_free()
                particles.remove_at(i)
        camera.position = original_camera
        if t>5.82 and t<6.15:
            var amplitude := (6.15-t)*0.3
            camera.position += Vector3(sin(t*137)*amplitude,cos(t*91)*amplitude,0)
        await process_frame
        await RenderingServer.frame_post_draw
        var picture := root.get_texture().get_image()
        assert(picture.save_jpg(folder+"%04d.jpg"%frame,0.9)==OK)
        if frame in [0,108,142,153,228]:
            picture.save_png(PROBE+"s58-combat-v3-%04d.png"%frame)
        if frame==138:
            camera.position = muzzle+Vector3(6,4,7)
            camera.look_at(muzzle)
            await process_frame
            await RenderingServer.frame_post_draw
            root.get_texture().get_image().save_png(PROBE+"s58-morpho-muzzle-close.png")
            camera.position = original_camera
            camera.look_at(Vector3(0,1,-19))
        if frame%72==0:print("S58 FRAME ",frame)
    FileAccess.open(PROBE+"s58-combat-v3-run.json",FileAccess.WRITE).store_string(JSON.stringify({"revision":3,"active_fx_end":particles.size()+flashes.size(),"frames":288,"fps":24,"duration":12,"capture":"fixed-step offline rendering; not measured realtime FPS","events":events,"assets":asset_bounds,"limitations":["choreographed aiming and evasion; not interactive mission","scouts stationary; full multi-leg gait pending","Morpho original clip sampled continuously; foot contact unverified","no collision/LOS/damage simulation or audio verification","Morpho socket derived from rail geometry; turret aims after clip evaluation, separate joint limits and barrel recoil pending","player socket, recoil and evade are provisional root choreography","overall environment art rejected"]},"  "))
    world.queue_free()
    await process_frame
    quit()

func review_environment(units: Array):
    for unit in units:unit.visible = false
    await take_frame("s59-environment-only.png")
    for unit in units:unit.visible = true
    await take_frame("s59-encounter.png")
    var original_background := environment.background_mode
    environment.background_mode = Environment.BG_SKY
    await take_frame("s59-existing-hdri-background.png")
    environment.background_mode = original_background
    var material_copies := {}
    var original_overrides := []
    for unit in units:
        for mesh in all_meshes(unit):
            for surface in range(mesh.mesh.get_surface_count()):
                var material = mesh.get_active_material(surface)
                if not material is StandardMaterial3D:continue
                if not material_copies.has(material):
                    var albedo = material.duplicate()
                    albedo.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
                    albedo.emission_enabled = false
                    material_copies[material] = albedo
                original_overrides.append({"mesh":mesh,"surface":surface,"material":mesh.get_surface_override_material(surface)})
                mesh.set_surface_override_material(surface,material_copies[material])
    await take_frame("s59-units-albedo-only.png")
    for entry in original_overrides:entry.mesh.set_surface_override_material(entry.surface,entry.material)
    var samples := []
    for i in range(60):await process_frame
    var last := Time.get_ticks_usec()
    for i in range(300):
        await process_frame
        await RenderingServer.frame_post_draw
        var now := Time.get_ticks_usec()
        samples.append(float(now-last)/1000.0)
        last = now
    var chronological := samples.duplicate()
    samples.sort()
    var original_camera := camera.position
    camera.position = Vector3(0,66,4)
    camera.look_at(Vector3(0,0,-22))
    await take_frame("s59-route-overview.png")
    var report := {"stage":"environment silhouette and static render pacing; no gameplay acceptance","environment":asset_bounds,"camera":str(original_camera),"look_at":"(0,1,-19)","resolution":"1280x720","effects":false,"renderer":RenderingServer.get_current_rendering_method(),"driver":RenderingServer.get_current_rendering_driver_name(),"sample_frames":samples.size(),"frame_interval_ms":chronological,"median_ms":samples[150],"p95_ms":samples[284],"p99_ms":samples[296],"limitations":["static enemies, no AI or input; not combat FPS","capture includes viewport presentation; no separate GPU timing","route screenshot does not prove collision or navigation"]}
    FileAccess.open(PROBE+"s59-environment-run.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    world.queue_free()
    await process_frame
    quit()
