extends "encounter.gd"

class Driver extends Node:
    var mission
    func _physics_process(dt: float):mission.tick(dt)
    func _unhandled_input(event: InputEvent):
        if event is InputEventMouseButton and event.button_index==MOUSE_BUTTON_RIGHT and event.pressed:
            mission.vault_requested=true
        if event is InputEventKey and event.physical_keycode==KEY_SPACE and event.pressed and not event.echo:
            mission.support_requested=true

var ui: CanvasLayer
var phase := "loading"
var pilot: CharacterBody3D
var rig: Node3D
var gait
var foes: Array = []
var effects: Array = []
var remaining := 180.0
var health := 120.0
var kills := 0
var fire_cd := 0.0
var support_cd := 0.0
var vault_cd := 0.0
var vault_time := 0.0
var vault_direction := Vector3.ZERO
var right_was := false
var space_was := false
var elapsed := 0.0
var heavy_timer := 12.0
var danger: Dictionary = {}
var aim := Vector3.ZERO
var exit_marker: MeshInstance3D
var ready_to_tick := false
var run_events: Array = []
var shots := 0
var state_clock := 0.0
var vaults := 0
var supports := 0
var movement_frames := 0
var vault_requested := false
var support_requested := false

func collider_box(size: Vector3, at: Vector3, layer: int = 1) -> StaticBody3D:
    var body := StaticBody3D.new()
    body.collision_layer = layer
    var collision := CollisionShape3D.new()
    var shape := BoxShape3D.new()
    shape.size = size
    collision.shape = shape
    body.add_child(collision)
    world.add_child(body)
    body.position = at
    return body

func body_for(model: Node3D, radius: float, layer: int) -> CharacterBody3D:
    var body := CharacterBody3D.new()
    body.collision_layer = layer
    body.collision_mask = 1|2|4
    body.motion_mode = CharacterBody3D.MOTION_MODE_FLOATING
    world.add_child(body)
    body.position = model.global_position
    model.reparent(body)
    var shape := CollisionShape3D.new()
    var capsule := CapsuleShape3D.new()
    capsule.radius = radius
    capsule.height = maxf(2.2,radius*2.0)
    shape.shape = capsule
    shape.position.y = capsule.height*0.5
    body.add_child(shape)
    return body

func ground_at(x: float,z: float) -> Dictionary:
    var q := PhysicsRayQueryParameters3D.create(Vector3(x,8,z),Vector3(x,-4,z),8)
    var hit := world.get_world_3d().direct_space_state.intersect_ray(q)
    return {"height":hit.position.y,"normal":hit.normal} if not hit.is_empty() else {"height":-0.04,"normal":Vector3.UP}

func capture_scene(boss: Node3D):
    root.size = Vector2i(1440,900)
    var units := get_nodes_in_group("encounter_units")
    rig = units[-1]
    pilot = body_for(rig,0.85,2)
    collider_box(Vector3(70,0.2,150),Vector3(0,-0.14,-20),8)
    for x in [-21,21]:collider_box(Vector3(1,8,100),Vector3(x,3,-16))
    for z in [-58,27]:collider_box(Vector3(44,8,1),Vector3(0,3,z))
    var cover_material := Color(0.24,0.27,0.28)
    for c in [{"at":Vector3(-8,1.4,-4),"size":Vector3(6,2.8,2)}, {"at":Vector3(8,0.4,2),"size":Vector3(5,0.8,1.6)}, {"at":Vector3(7,1.5,-23),"size":Vector3(3,3,6)}, {"at":Vector3(-10,0.5,-25),"size":Vector3(5,1,2)}]:
        box_mesh(c.size,c.at,cover_material)
        collider_box(c.size,c.at)
    for i in range(24):
        var model: Node3D = units[i+1]
        var body := body_for(model,0.65,4)
        foes.append({"body":body,"model":model,"hp":0.0,"active":false,"role":"hunter" if i%3==0 else "scout","cooldown":0.0,"respawn":float(i)*2.0,"tell":0.0,"dash":Vector3.ZERO,"heading":0.0})
        model.visible = false
        body.collision_layer = 0
        body.collision_mask = 0
    boss.get_parent().position = Vector3(0,0,-40)
    var materials = load(PROBE+"s60-legion-materials.gd")
    materials.apply(boss)
    var socket_data = JSON.parse_string(FileAccess.get_file_as_string(PROBE+"s60-xm2-foot-sockets.json"))
    gait = load(PROBE+"s61-xm2-gait.gd").new()
    var skeleton: Skeleton3D = rig.find_children("*","Skeleton3D",true,false)[0]
    pilot.position = Vector3(-4,-0.04,15)
    rig.position = Vector3.ZERO
    gait.initialize(rig,skeleton,socket_data)
    exit_marker = marker(Vector3(0,0.02,20),3.0,Color(0.2,0.8,0.72,0.45))
    exit_marker.visible = false
    ui = load(PROBE+"s61-mission-ui.gd").new()
    root.add_child(ui)
    ui.initialize(Callable(self,"begin_run"),Callable(self,"begin_run"),Callable(self,"return_to_prep"))
    ui.show_prep()
    camera.position = pilot.position+Vector3(0,24,21)
    camera.look_at(pilot.position+Vector3(0,0,-8))
    var driver := Driver.new()
    driver.mission = self
    world.add_child(driver)
    phase = "prep"
    ready_to_tick = true
    if "--qa" in OS.get_cmdline_user_args():call_deferred("qa_flow")

func begin_run():
    phase = "playing"
    health = 120
    kills = 0
    remaining = 180
    elapsed = 0
    fire_cd = 0
    support_cd = 0
    vault_cd = 0
    vault_time = 0
    shots = 0
    vaults = 0
    supports = 0
    movement_frames = 0
    right_was = false
    space_was = false
    vault_requested = false
    support_requested = false
    heavy_timer = 14
    if not danger.is_empty() and is_instance_valid(danger.node):danger.node.queue_free()
    danger.clear()
    for effect in effects:
        if is_instance_valid(effect.node):effect.node.queue_free()
    effects.clear()
    for i in range(foes.size()):
        var foe: Dictionary = foes[i]
        foe.active = false
        foe.respawn = float(i)*2.2
        foe.model.visible = false
        foe.body.collision_layer = 0
        foe.body.collision_mask = 0
    pilot.position = Vector3(-4,-0.04,15)
    pilot.velocity = Vector3.ZERO
    rig.position = Vector3.ZERO
    rig.rotation.y = PI
    pilot.collision_mask = 1|4
    var data = JSON.parse_string(FileAccess.get_file_as_string(PROBE+"s60-xm2-foot-sockets.json"))
    gait.initialize(rig,rig.find_children("*","Skeleton3D",true,false)[0],data)
    exit_marker.visible = false
    run_events.append({"event":"start","at_ms":Time.get_ticks_msec()})
    ui.show_play()
    ui.announce("辛：保持移動。高掩體能擋射線，低障礙可以躍過。")

func return_to_prep():
    phase = "prep"
    ui.show_prep()

func end_run(won: bool):
    if phase != "playing":return
    phase = "result"
    run_events.append({"event":"win" if won else "loss","elapsed":elapsed,"kills":kills})
    ui.show_result(won,kills,elapsed)

func marker(at: Vector3,radius: float,color: Color) -> MeshInstance3D:
    var mesh := CylinderMesh.new()
    mesh.top_radius = radius
    mesh.bottom_radius = radius
    mesh.height = 0.025
    mesh.radial_segments = 32
    var node := MeshInstance3D.new()
    node.mesh = mesh
    var mat := StandardMaterial3D.new()
    mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
    mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
    mat.albedo_color = color
    node.material_override = mat
    world.add_child(node)
    node.position = at
    return node

func streak(from: Vector3,to: Vector3,color: Color,lifetime: float=0.12):
    var mesh := CylinderMesh.new()
    mesh.top_radius = 0.035
    mesh.bottom_radius = 0.025
    mesh.height = maxf(0.02,from.distance_to(to))
    mesh.radial_segments = 6
    var node := MeshInstance3D.new()
    node.mesh = mesh
    var mat := StandardMaterial3D.new()
    mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
    mat.albedo_color = color
    node.material_override = mat
    world.add_child(node)
    node.position = (from+to)*0.5
    node.quaternion = Quaternion(Vector3.UP,(to-from).normalized())
    effects.append({"node":node,"life":lifetime})

func clear_line(from: Vector3,to: Vector3) -> bool:
    var q := PhysicsRayQueryParameters3D.create(from,to,1)
    return world.get_world_3d().direct_space_state.intersect_ray(q).is_empty()

func shoot():
    shots += 1
    var from := pilot.position+Vector3(0,1.6,0)
    var direction := aim-from
    direction.y = 0
    if direction.length()<0.1:return
    var to := from+direction.normalized()*65
    var q := PhysicsRayQueryParameters3D.create(from,to,1|4)
    var hit := world.get_world_3d().direct_space_state.intersect_ray(q)
    if not hit.is_empty():
        to = hit.position
        for foe in foes:
            if foe.active and foe.body == hit.collider:
                hurt_foe(foe,28)
                break
    streak(from,to,Color(1,0.79,0.4))

func hurt_foe(foe: Dictionary,damage: float):
    foe.hp -= damage
    if foe.hp<=0:
        foe.active = false
        kills += 1
        foe.model.visible = false
        foe.body.collision_layer = 0
        foe.body.collision_mask = 0
        foe.respawn = elapsed+10
        var burst := marker(foe.body.position+Vector3(0,0.1,0),1.6,Color(0.9,0.43,0.16,0.7))
        effects.append({"node":burst,"life":0.45})
        if kills%5==0:health=minf(120,health+8)

func hurt_player(amount: float):
    if vault_time>0:return
    health = maxf(0,health-amount)
    if health<=0:end_run(false)

func tick(dt: float):
    if not ready_to_tick:return
    state_clock+=dt
    if state_clock>=0.5:
        state_clock=0
        FileAccess.open(PROBE+"s61-mission-live-state.json",FileAccess.WRITE).store_string(JSON.stringify({"phase":phase,"hp":health,"seconds_left":remaining,"elapsed":elapsed,"kills":kills,"shots":shots,"vaults":vaults,"supports":supports,"movement_frames":movement_frames,"position":[pilot.position.x,pilot.position.y,pilot.position.z],"vault_remaining":vault_time,"support_cd":support_cd,"enemies_alive":foes.filter(func(e):return e.active).size(),"effects":effects.size(),"events":run_events},"  "))
    for i in range(effects.size()-1,-1,-1):
        effects[i].life -= dt
        if effects[i].life<=0:
            effects[i].node.queue_free()
            effects.remove_at(i)
    if phase != "playing":return
    elapsed += dt
    remaining = maxf(0,180-elapsed)
    fire_cd -= dt
    support_cd = maxf(0,support_cd-dt)
    vault_cd = maxf(0,vault_cd-dt)
    var axis := Vector3(float(Input.is_physical_key_pressed(KEY_D))-float(Input.is_physical_key_pressed(KEY_A)),0,float(Input.is_physical_key_pressed(KEY_S))-float(Input.is_physical_key_pressed(KEY_W)))
    if axis.length()>1:axis=axis.normalized()
    if axis.length()>0.1:movement_frames+=1
    var mouse := root.get_mouse_position()
    var origin := camera.project_ray_origin(mouse)
    var projected = Plane(Vector3.UP,0).intersects_ray(origin,camera.project_ray_normal(mouse))
    if projected != null:aim=projected
    var right := Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT)
    if (vault_requested or (right and not right_was)) and vault_cd<=0:
        vaults+=1
        vault_time = 0.65
        vault_cd = 3.5
        vault_direction = axis if axis.length()>0.1 else (aim-pilot.position).normalized()
        vault_direction.y = 0
        vault_direction = vault_direction.normalized()
        pilot.collision_mask = 1
        ui.announce("辛：躍進。")
    right_was = right
    vault_requested = false
    var space := Input.is_physical_key_pressed(KEY_SPACE)
    if (support_requested or (space and not space_was)) and support_cd<=0:
        supports+=1
        support_cd = 18
        for foe in foes:
            if foe.active and foe.body.position.distance_to(pilot.position)<12:hurt_foe(foe,90)
        var ring := marker(pilot.position+Vector3(0,0.06,0),12,Color(0.4,0.85,0.8,0.26))
        effects.append({"node":ring,"life":0.75})
        ui.announce("蕾娜：支援砲擊，清出撤離空間。")
    space_was = space
    support_requested = false
    var velocity := axis*1.5
    var old_yaw := rig.rotation.y
    if axis.length()>0.1:rig.rotation.y=rotate_toward(rig.rotation.y,atan2(axis.x,axis.z),dt*0.55)
    if vault_time>0:
        vault_time = maxf(0,vault_time-dt)
        velocity = vault_direction*7.0
        pilot.position.y = -0.04+sin((0.65-vault_time)/0.65*PI)*2.5
        if vault_time<=0:
            pilot.position.y=-0.04
            pilot.collision_mask=1|4
    pilot.velocity=velocity
    pilot.move_and_slide()
    pilot.position.x=clampf(pilot.position.x,-19,19)
    pilot.position.z=clampf(pilot.position.z,-55,24)
    if vault_time<=0:gait.step(dt,pilot.velocity,angle_difference(old_yaw,rig.rotation.y)/maxf(0.001,dt),Callable(self,"ground_at"))
    else:
        var skel: Skeleton3D = rig.find_children("*","Skeleton3D",true,false)[0]
        skel.reset_bone_poses()
    if fire_cd<=0:
        fire_cd=0.20
        shoot()
    var active_limit := mini(12,4+int(elapsed/22))
    for i in range(foes.size()):
        var foe: Dictionary = foes[i]
        if not foe.active:
            if i<active_limit and elapsed>=foe.respawn:
                foe.body.position=Vector3(-16 if i%2==0 else 16,-0.04,-22+float(i%5)*5)
                foe.model.position=Vector3.ZERO
                foe.model.visible=true
                foe.active=true
                foe.hp=110.0 if foe.role=="hunter" else 70.0
                foe.cooldown=2.0+float(i%3)
                foe.tell=0.0
                foe.body.collision_layer=4
                foe.body.collision_mask=1|2|4
            continue
        var toward: Vector3 = pilot.position-foe.body.position
        toward.y=0
        var distance:=toward.length()
        var direction:=toward.normalized()
        foe.model.rotation.y=atan2(direction.x,direction.z)
        foe.cooldown-=dt
        var speed:=0.95 if foe.role=="hunter" else 0.65
        if foe.role=="hunter":
            if foe.tell>0:
                foe.tell-=dt
                if foe.tell<=0:
                    streak(foe.body.position+Vector3.UP,pilot.position+Vector3.UP,Color(1,0.25,0.17),0.22)
                    if distance<5 and clear_line(foe.body.position+Vector3.UP,pilot.position+Vector3.UP):hurt_player(14)
            elif distance<5 and foe.cooldown<=0:
                foe.tell=0.9
                foe.cooldown=3.5
                var ring:=marker(foe.body.position+Vector3(0,0.03,0),5,Color(0.9,0.26,0.15,0.15))
                effects.append({"node":ring,"life":0.9})
        elif distance<18 and foe.cooldown<=0 and clear_line(foe.body.position+Vector3.UP,pilot.position+Vector3.UP):
            foe.cooldown=3.8
            streak(foe.body.position+Vector3.UP,pilot.position+Vector3.UP,Color(1,0.32,0.20),0.18)
            hurt_player(6)
        foe.body.velocity=direction*speed if distance>3 else Vector3.ZERO
        foe.body.move_and_slide()
    heavy_timer-=dt
    if heavy_timer<=0 and danger.is_empty():
        heavy_timer=15
        var at:=pilot.position;at.y=0.05
        var warning:=marker(at,4.3,Color(1,0.22,0.10,0.28))
        danger={"at":at,"node":warning,"remaining":2.8}
        ui.announce("辛：重砲標定，離開紅色落點。")
    if not danger.is_empty():
        danger.remaining-=dt
        if danger.remaining<=0:
            if pilot.position.distance_to(danger.at)<4.3:hurt_player(28)
            streak(Vector3(0,4,-35),danger.at,Color(1,0.6,0.22),0.35)
            effects.append({"node":danger.node,"life":0.35})
            danger.clear()
    if remaining<=0:
        exit_marker.visible=true
        if pilot.position.distance_to(Vector3(0,-0.04,20))<3:end_run(true)
    var objective: String = "前往後方青色撤離區" if remaining<=0 else "維持戰線 · 清除五台敵機補充 8 耐久"
    ui.update_hud(health,120,remaining,kills,objective+"  |  躍進 %.1fs · 支援 %.0fs"%[vault_cd,support_cd])
    camera.position=camera.position.lerp(pilot.position+Vector3(0,24,21),1-exp(-dt*6))
    camera.look_at(pilot.position+Vector3(0,0,-8))

func qa_flow():
    await process_frame
    begin_run()
    await create_timer(1.0).timeout
    var started := phase=="playing"
    var click := InputEventMouseButton.new()
    click.button_index=MOUSE_BUTTON_RIGHT
    click.pressed=true
    Input.parse_input_event(click)
    var release := InputEventMouseButton.new()
    release.button_index=MOUSE_BUTTON_RIGHT
    release.pressed=false
    Input.parse_input_event(release)
    await create_timer(0.15).timeout
    var vault_once := vaults==1
    await create_timer(0.7).timeout
    health=1
    hurt_player(2)
    await create_timer(0.5).timeout
    var lost := phase=="result"
    begin_run()
    await create_timer(0.5).timeout
    elapsed=181
    pilot.position=Vector3(0,-0.04,20)
    await create_timer(0.2).timeout
    var won: bool = phase=="result" and run_events[-1].event=="win"
    return_to_prep()
    FileAccess.open(PROBE+"s61-mission-flow-qa.json",FileAccess.WRITE).store_string(JSON.stringify({"start":started,"loss":lost,"retry":run_events.filter(func(e):return e.event=="start").size()==2,"win":won,"right_click_down_up_same_frame_once":vault_once,"return_to_prep":phase=="prep","events":run_events,"limits":["automated state transition test; time and HP injected","not manual gameplay, full180s survival or combat balance acceptance"]},"  "))
    await take_frame("s61-mission-prep.png")
    quit(0 if started and lost and won and vault_once else 1)
