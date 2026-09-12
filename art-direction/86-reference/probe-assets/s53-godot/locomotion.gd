extends "encounter.gd"

var contact_floor: StaticBody3D

func sample_ground(x: float,z: float) -> Dictionary:
    var query := PhysicsRayQueryParameters3D.create(Vector3(x,8,z),Vector3(x,-4,z),8)
    var hit := world.get_world_3d().direct_space_state.intersect_ray(query)
    assert(not hit.is_empty(),"Locomotion ground query must hit the physical test floor")
    return {"height":hit.position.y,"normal":hit.normal}

func capture_scene(_boss: Node3D):
    root.size = Vector2i(1280,720)
    var units := get_nodes_in_group("encounter_units")
    var player: Node3D = units[-1]
    for unit in units:unit.visible = unit == player
    player.position = Vector3(-10,0,12)
    player.rotation.y = PI
    contact_floor = StaticBody3D.new()
    contact_floor.collision_layer = 8
    contact_floor.collision_mask = 0
    var shape := CollisionShape3D.new()
    var box := BoxShape3D.new()
    box.size = Vector3(70,0.2,150)
    shape.shape = box
    contact_floor.add_child(shape)
    contact_floor.position = Vector3(0,-0.1,-20)
    world.add_child(contact_floor)
    await physics_frame
    await physics_frame
    var skeleton: Skeleton3D = player.find_children("*","Skeleton3D",true,false)[0]
    var source = JSON.parse_string(FileAccess.get_file_as_string(PROBE+"s60-xm2-foot-sockets.json"))
    var controller = load(PROBE+"s61-xm2-gait.gd").new()
    var initialization = controller.initialize(player,skeleton,source)
    var frames := []
    var output := "/private/tmp/s61-locomotion-frames/"
    DirAccess.make_dir_recursive_absolute(output)
    for frame in range(768):
        var time := frame/48.0
        var yaw_rate := PI/12.0 if time>=6.0 and time<12.0 else 0.0
        var moving := time>=2.0 and time<14.0
        var velocity := player.basis.z*1.1 if moving else Vector3.ZERO
        await physics_frame
        player.position += velocity/48.0
        player.rotation.y += yaw_rate/48.0
        var result: Dictionary = controller.step(1.0/48.0,velocity,yaw_rate,Callable(self,"sample_ground"))
        await process_frame
        result["time"] = time
        result["root_world"] = [player.position.x,player.position.y,player.position.z]
        result["root_yaw"] = player.rotation.y
        result["phase_name"] = "rest" if time<2 else ("straight" if time<6 else ("turn" if time<12 else ("straight_exit" if time<14 else "stop")))
        var observed := []
        for leg in source.legs:
            var inner := skeleton.find_bone(leg.inner.name)
            var outer := skeleton.find_bone(leg.outer.name)
            var vector = leg.footSocketOuterBoneLocal
            var hip: Vector3 = skeleton.global_transform*skeleton.get_bone_global_pose(inner).origin
            var knee: Vector3 = skeleton.global_transform*skeleton.get_bone_global_pose(outer).origin
            var foot: Vector3 = skeleton.global_transform*skeleton.get_bone_global_pose(outer)*Vector3(vector[0],vector[1],vector[2])
            observed.append({"bone":leg.outer.name,"world":[foot.x,foot.y,foot.z],"inner_length":hip.distance_to(knee),"outer_length":knee.distance_to(foot),"ground_gap":foot.y})
        result["observed_fk"] = observed
        if frame%24==0:
            var bound := bounds_of(player)
            result["posed_mesh_min_y"] = bound.position.y
        for leg_result in result.legs:
            for key in leg_result:
                if leg_result[key] is Vector3:
                    var v: Vector3 = leg_result[key]
                    leg_result[key] = [v.x,v.y,v.z]
        frames.append(result)
        camera.position = player.position+Vector3(6,4.0,7)
        camera.look_at(player.position+Vector3(0,0.8,0))
        if frame%2==0:
            await RenderingServer.frame_post_draw
            var picture := root.get_texture().get_image()
            picture.save_jpg(output+"%04d.jpg"%int(frame/2),0.90)
            if frame in [0,192,384,576,744]:picture.save_png(PROBE+"s61-locomotion-%04d.png"%frame)
    FileAccess.open(PROBE+"s61-locomotion-run.json",FileAccess.WRITE).store_string(JSON.stringify({"initialization":initialization,"frames":frames,"dt":1.0/48.0,"duration_s":16,"capture_fps":24,"source_sha256":source.sourceSha256,"ground":"physical flat test collider Y=0 in central flat corridor, not full environment collision","limits":["offline evaluation, not measured realtime FPS","flat walk turn stop only; slopes vault gun and gameplay pending","joint hard limits and armor link articulation not accepted","not complete mission or UI"]},"  "))
    world.queue_free()
    await process_frame
    quit()
