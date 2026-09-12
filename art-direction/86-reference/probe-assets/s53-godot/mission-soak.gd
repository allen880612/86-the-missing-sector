extends "mission.gd"

var samples: Array = []
var next_sample := 10.0
var waypoint := 0
var started_at := 0
var finished := false
var held: Dictionary = {}
var frame_times: Array = []

func capture_scene(boss: Node3D):
    super.capture_scene(boss)
    call_deferred("start_soak")

func start_soak():
    await process_frame
    started_at=Time.get_ticks_msec()
    begin_run()

func key(code: int, down: bool):
    if held.get(code,false)==down:return
    held[code]=down
    var event:=InputEventKey.new()
    event.physical_keycode=code
    event.pressed=down
    Input.parse_input_event(event)

func tick(dt: float):
    if phase=="playing" and not finished:
        frame_times.append(dt)
        var points := [Vector3(12,0,14),Vector3(12,0,-8),Vector3(-12,0,-8),Vector3(-12,0,14)]
        var destination: Vector3=Vector3(0,0,20) if remaining<=0 else points[waypoint]
        var delta:=destination-pilot.position
        delta.y=0
        if delta.length()<1.5 and remaining>0:waypoint=(waypoint+1)%points.size()
        key(KEY_D,delta.x>0.5)
        key(KEY_A,delta.x< -0.5)
        key(KEY_S,delta.z>0.5)
        key(KEY_W,delta.z< -0.5)
        var target: Vector3=pilot.position+Vector3(0,0,-10)
        var best:=INF
        var nearby:=0
        for foe in foes:
            if not foe.active:continue
            var distance: float=foe.body.position.distance_to(pilot.position)
            if distance<12:nearby+=1
            var screen: Vector2=camera.unproject_position(foe.body.position)
            if camera.is_position_behind(foe.body.position) or not Rect2(Vector2.ZERO,Vector2(root.size)).has_point(screen):continue
            if distance<best and clear_line(pilot.position+Vector3(0,1.6,0),foe.body.position+Vector3(0,1.6,0)):
                best=distance
                target=foe.body.position
        root.warp_mouse(camera.unproject_position(target))
        key(KEY_SPACE,nearby>=2 and support_cd<=0)
        if not danger.is_empty() and danger.remaining<1.7 and vault_cd<=0:
            var click:=InputEventMouseButton.new()
            click.button_index=MOUSE_BUTTON_RIGHT
            click.pressed=true
            Input.parse_input_event(click)
            click=InputEventMouseButton.new()
            click.button_index=MOUSE_BUTTON_RIGHT
            click.pressed=false
            Input.parse_input_event(click)
    super.tick(dt)
    if started_at==0 or finished:return
    if elapsed>=next_sample:
        samples.append({"elapsed":elapsed,"hp":health,"kills":kills,"alive":foes.filter(func(e):return e.active).size(),"effects":effects.size(),"position":str(pilot.position)})
        print("SOAK_SAMPLE ",JSON.stringify(samples[-1]))
        next_sample+=10
        if samples.size() in [3,9,18]:call_deferred("save_frame",samples.size())
    if phase=="result" or elapsed>240:
        finished=true
        for code in [KEY_W,KEY_A,KEY_S,KEY_D,KEY_SPACE]:key(code,false)
        call_deferred("finish_soak")

func save_frame(index: int):
    await process_frame
    root.get_texture().get_image().save_png(PROBE+"s61-mission-soak-%02d.png"%index)

func finish_soak():
    await create_timer(0.4).timeout
    var won: bool=not run_events.is_empty() and run_events[-1].event=="win"
    var report: Dictionary={"won":won,"phase":phase,"elapsed_simulation_seconds":elapsed,"wall_seconds":(Time.get_ticks_msec()-started_at)/1000.0,"hp":health,"kills":kills,"shots":shots,"vaults":vaults,"supports":supports,"movement_frames":movement_frames,"samples":samples,"events":run_events,"limits":["scripted keyboard and pointer input, not independent human or OS UI acceptance","no HP, damage, clock, spawn or cooldown overrides","aim selects visible unobstructed enemies using engine state; more accurate than a human","physics dt is fixed, not a measured render frame-time benchmark"]}
    FileAccess.open(PROBE+"s61-mission-soak.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    root.get_texture().get_image().save_png(PROBE+"s61-mission-soak-result.png")
    print("SOAK_COMPLETE ",JSON.stringify(report))
    quit(0 if won else 1)
