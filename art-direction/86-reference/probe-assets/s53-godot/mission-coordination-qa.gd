extends "mission.gd"

func capture_scene(boss: Node3D):
    super.capture_scene(boss)
    driver_node.set_physics_process(false)
    call_deferred("check_coordination")

func setup_case():
    begin_run()
    fire_cd=999
    heavy_timer=999
    for foe in foes:foe.respawn=99999

func activate(index: int, at: Vector3) -> Dictionary:
    var foe: Dictionary=foes[index]
    foe.active=true
    foe.hp=70 if foe.role=="scout" else 110
    foe.body.position=at
    foe.body.collision_layer=4
    foe.body.collision_mask=1|2|4
    foe.model.visible=true
    foe.cooldown=0
    foe.tell=0
    foe.charge=0
    foe.charge_hit=false
    return foe

func check_coordination():
    setup_case()
    designation_cd=0
    var scout:=activate(1,Vector3(0,-0.04,-2))
    pilot.position=Vector3(0,-0.04,8)
    await physics_frame
    await physics_frame
    update_designation(0.016)
    var acquired: bool=not designation.is_empty()
    scout.body.position=Vector3(-8,-0.04,-6)
    pilot.position=Vector3(-8,-0.04,-1)
    await physics_frame
    await physics_frame
    update_designation(0.016)
    var cover_cancels: bool=designation.is_empty() and marked_time==0

    scout.body.position=Vector3(0,-0.04,-2)
    pilot.position=Vector3(0,-0.04,8)
    designation_cd=0
    await physics_frame
    await physics_frame
    update_designation(0.016)
    hurt_foe(scout,70)
    update_designation(0.016)
    var kill_cancels: bool=designation.is_empty() and marked_time==0

    scout=activate(1,Vector3(0,-0.04,-2))
    designation_cd=0
    await physics_frame
    await physics_frame
    for i in range(115):
        await physics_frame
        update_designation(1.0/60.0)
    var lock_position:=marked_position
    var confirmed: bool=marked_time>0 and heavy_timer<=0.8
    pilot.position=Vector3(6,-0.04,8)
    scout.active=false
    scout.body.collision_layer=0
    for i in range(55):
        await physics_frame
        tick(1.0/60.0)
    var heavy_uses_lock: bool=not danger.is_empty() and Vector2(danger.at.x,danger.at.z).distance_to(Vector2(lock_position.x,lock_position.z))<0.01
    var warned: bool=heavy_uses_lock and danger.remaining>2.5

    setup_case()
    designation_cd=999
    var hunter:=activate(0,Vector3(0,-0.04,0))
    pilot.position=Vector3(0,-0.04,6)
    await physics_frame
    await physics_frame
    tick(1.0/60.0)
    var hunter_tell: bool=hunter.tell>0.9 and hunter.charge==0 and health==120
    var locked: Vector3=hunter.dash
    pilot.position=Vector3(6,-0.04,6)
    for i in range(110):
        await physics_frame
        tick(1.0/60.0)
    var dodge_works: bool=health==120 and hunter.dash==locked and absf(hunter.body.position.x)<0.2 and hunter.body.position.z>3

    setup_case()
    designation_cd=999
    hunter=activate(0,Vector3(-8,-0.04,-6))
    pilot.position=Vector3(-8,-0.04,-1)
    await physics_frame
    await physics_frame
    for i in range(60):
        await physics_frame
        tick(1.0/60.0)
    var cover_stops_hunter: bool=hunter.tell==0 and hunter.charge==0 and health==120
    hunter.body.position=Vector3(0,-0.04,0)
    hunter.dash=Vector3(0,-0.04,6)
    hunter.tell=1
    hunter.hp=110
    hurt_foe(hunter,28,Vector3(0,1.6,6))
    var frontal_guard: bool=is_equal_approx(hunter.hp,98.8)
    hurt_foe(hunter,28,Vector3(6,1.6,0))
    var side_bypasses: bool=is_equal_approx(hunter.hp,70.8)
    hurt_foe(hunter,28)
    var support_bypasses: bool=is_equal_approx(hunter.hp,42.8)
    begin_run()
    var retry_clean: bool=designation.is_empty() and marked_time==0 and danger.is_empty()
    var report: Dictionary={"scout_acquires":acquired,"high_cover_cancels_designation":cover_cancels,"kill_cancels_designation":kill_cancels,"scout_confirms_after_visible_lock":confirmed,"heavy_uses_old_locked_position":heavy_uses_lock,"heavy_keeps_warning_time":warned,"hunter_warns_before_charge":hunter_tell,"sidestep_avoids_locked_charge":dodge_works,"high_cover_stops_hunter":cover_stops_hunter,"retry_clears_coordination":retry_clean,"limits":["controlled positions and cooldowns with actual Godot physics; not manual balance or visual acceptance","does not prove enemy animation, three distinct models, or heavy unit destructibility"]}
    report.frontal_guard=frontal_guard
    report.side_shot_bypasses_guard=side_bypasses
    report.support_bypasses_guard=support_bypasses
    FileAccess.open(PROBE+"s61-mission-coordination-qa.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print("COORDINATION_QA ",JSON.stringify(report))
    var passed:=true
    for name in report:
        if report[name] is bool and not report[name]:passed=false
    quit(0 if passed else 1)
