extends RefCounted

const DUTY := 0.72
const PHASE_OFFSETS := [0.0, 0.5, 0.75, 0.25]
var _mount: Node3D
var _skeleton: Skeleton3D
var _legs: Array[Dictionary] = []
var _phase := 0.0
var _ready := false
var _grounded := false
var _stride := 1.1
var _clearance := 0.19
var _radius := 2.4

static func _vector(values: Array) -> Vector3:
    return Vector3(float(values[0]), float(values[1]), float(values[2]))

func initialize(mount: Node3D, skeleton: Skeleton3D, socket_data: Dictionary) -> Dictionary:
    _ready = false
    _grounded = false
    _phase = 0.0
    _legs.clear()
    _mount = mount
    _skeleton = skeleton
    if mount == null or skeleton == null or socket_data.get("legs", []).size() != 4:
        return {"ok": false, "error": "Expected mount, skeleton and four verified socket records."}
    var scale_axes := skeleton.global_basis.get_scale().abs()
    var scale_mean := (scale_axes.x + scale_axes.y + scale_axes.z) / 3.0
    if scale_mean <= 0.000001 or maxf(scale_axes.x, maxf(scale_axes.y, scale_axes.z)) - minf(scale_axes.x, minf(scale_axes.y, scale_axes.z)) > scale_mean * 0.001:
        return {"ok": false, "error": "Analytical rigid-link solver requires uniform positive skeleton world scale.", "scale_axes": scale_axes}
    skeleton.reset_bone_poses()
    skeleton.force_update_all_bone_transforms()
    var measurements: Array[Dictionary] = []
    var mean_reach := 0.0
    var maximum_radius := 0.0
    for index in range(4):
        var data: Dictionary = socket_data.legs[index]
        var inner := skeleton.find_bone(String(data.inner.name))
        var outer := skeleton.find_bone(String(data.outer.name))
        if inner < 0 or outer < 0 or skeleton.get_bone_parent(outer) != inner:
            _legs.clear()
            return {"ok": false, "error": "Measured names must resolve to a direct Inner -> Outer chain.", "inner": data.inner.name, "outer": data.outer.name}
        var inner_rest := skeleton.get_bone_global_rest(inner)
        var outer_rest := skeleton.get_bone_global_rest(outer)
        var socket := _vector(data.footSocketOuterBoneLocal)
        var rest_foot := outer_rest * socket
        var upper := outer_rest.origin - inner_rest.origin
        var lower := rest_foot - outer_rest.origin
        var rest_axis := (rest_foot - inner_rest.origin).normalized()
        var bend := (upper - rest_axis * upper.dot(rest_axis)).normalized()
        if upper.length() < 0.0001 or lower.length() < 0.0001 or bend.length_squared() < 0.5:
            return {"ok": false, "error": "Degenerate measured rest chain.", "outer": data.outer.name}
        var foot_world := skeleton.global_transform * rest_foot
        var reach := (upper.length() + lower.length()) * scale_mean
        mean_reach += reach / 4.0
        var radial := foot_world - mount.global_position
        radial.y = 0.0
        maximum_radius = maxf(maximum_radius, radial.length())
        _legs.append({"inner": inner, "outer": outer, "name": data.outer.name, "socket": socket, "inner_rest": inner_rest, "outer_rest": outer_rest, "bend": bend, "upper_source": upper.length(), "lower_source": lower.length(), "nominal_mount": mount.to_local(foot_world), "anchor": foot_world, "normal": Vector3.UP, "stance": true, "window_used": false, "swing_t": 0.0, "swing_duration": 0.35, "swing_start": foot_world, "swing_end": foot_world, "offset": PHASE_OFFSETS[index]})
        measurements.append({"outer": data.outer.name, "inner_index": inner, "outer_index": outer, "foot_world": foot_world, "upper_m": upper.length() * scale_mean, "lower_m": lower.length() * scale_mean, "upper_source_error": absf(upper.length() - float(data.restLengthsSourceUnits.innerHipToKnee)), "lower_source_error": absf(lower.length() - float(data.restLengthsSourceUnits.outerKneeToSocket))})
    _stride = mean_reach * 0.34
    _clearance = mean_reach * 0.06
    _radius = maximum_radius
    _ready = true
    return {"ok": true, "legs": measurements, "duty": DUTY, "phase_offsets": PHASE_OFFSETS, "stride_m": _stride, "clearance_m": _clearance, "scale_metres_per_skeleton_unit": scale_mean, "scale_source": "Actual skeleton.global_basis; no additional encounter scale factor applied.", "foot_orientation_applied": false, "limits": ["Contact sockets are measured distal render patches, not ankle joints.", "No joint limits, body balance, self-collision, or moving-platform tracking.", "Call after locomotion/animation evaluation; step resets all bone poses to rest."]}

func _ground(point: Vector3, query: Callable) -> Dictionary:
    if query.is_valid():
        var value: Variant = query.call(point.x, point.z)
        if value is Dictionary and value.has("height"):
            var height: float = value.height
            var normal: Vector3 = value.get("normal", Vector3.UP)
            if is_finite(height):
                point.y = height
                if not normal.is_finite() or normal.length_squared() < 0.001:
                    normal = Vector3.UP
                return {"point": point, "normal": normal.normalized(), "valid": true}
    return {"point": point, "normal": Vector3.UP, "valid": false}

func _solve(leg: Dictionary, requested: Vector3) -> Dictionary:
    var frame := _skeleton.global_transform
    var inner_world: Transform3D = frame * leg.inner_rest
    var outer_world: Transform3D = frame * leg.outer_rest
    var hip := inner_world.origin
    var rest_upper := outer_world.origin - hip
    var rest_lower: Vector3 = outer_world.basis * leg.socket
    var upper_length := rest_upper.length()
    var lower_length := rest_lower.length()
    var offset := requested - hip
    var requested_distance := offset.length()
    var direction := offset.normalized() if requested_distance > 0.000001 else (rest_upper + rest_lower).normalized()
    var margin := (upper_length + lower_length) * 0.00001
    var distance := clampf(requested_distance, absf(upper_length - lower_length) + margin, upper_length + lower_length - margin)
    var reachable_target := hip + direction * distance
    var preferred: Vector3 = (frame.basis * leg.bend).normalized()
    var bend := preferred - direction * preferred.dot(direction)
    if bend.length_squared() < 0.000001:
        var rest_normal := rest_upper.cross(rest_lower).normalized()
        bend = rest_normal.cross(direction)
    if bend.length_squared() < 0.000001:
        bend = direction.cross(Vector3.RIGHT if absf(direction.x) < 0.8 else Vector3.FORWARD)
    bend = bend.normalized()
    var along := (upper_length * upper_length - lower_length * lower_length + distance * distance) / (2.0 * distance)
    var knee := hip + direction * along + bend * sqrt(maxf(0.0, upper_length * upper_length - along * along))
    var upper_rotation := Basis(Quaternion(rest_upper.normalized(), (knee - hip).normalized()))
    var propagated_lower := upper_rotation * rest_lower
    var lower_rotation := Basis(Quaternion(propagated_lower.normalized(), (reachable_target - knee).normalized()))
    var inner_pose := Transform3D(upper_rotation * inner_world.basis, hip)
    var outer_pose := Transform3D(lower_rotation * upper_rotation * outer_world.basis, knee)
    var inverse := frame.affine_inverse()
    _skeleton.set_bone_global_pose(leg.inner, inverse * inner_pose)
    _skeleton.set_bone_global_pose(leg.outer, inverse * outer_pose)
    var actual: Vector3 = frame * _skeleton.get_bone_global_pose(leg.outer) * leg.socket
    return {"foot_world": actual, "target_world": requested, "reachable_target_world": reachable_target, "knee_world": knee, "hip_world": hip, "error_m": actual.distance_to(requested), "solver_error_m": actual.distance_to(reachable_target), "unreachable": absf(distance - requested_distance) > margin * 2.0, "reach_excess_m": absf(distance - requested_distance), "upper_m": upper_length, "lower_m": lower_length}

func step(dt: float, velocity: Vector3, yaw_rate: float, ground: Callable) -> Dictionary:
    if not _ready:
        return {"ok": false, "error": "initialize must succeed before step."}
    if not is_finite(dt) or dt < 0.0 or not velocity.is_finite() or not is_finite(yaw_rate):
        return {"ok": false, "error": "Nonfinite motion or negative dt."}
    var planar_velocity := Vector3(velocity.x, 0.0, velocity.z)
    var effective_speed := planar_velocity.length() + absf(yaw_rate) * _radius
    var moving := effective_speed > 0.02
    var frequency := clampf(effective_speed / _stride, 0.22, 1.8)
    if moving:
        _phase = fposmod(_phase + dt * frequency, 1.0)
    _skeleton.reset_bone_poses()
    _skeleton.force_update_all_bone_transforms()
    var output: Array[Dictionary] = []
    var unreachable := 0
    var max_error := 0.0
    var max_solver_error := 0.0
    var misses := 0
    var stance_count := 0
    for leg in _legs:
        if not _grounded:
            var first := _ground(leg.anchor, ground)
            leg.anchor = first.point
            leg.normal = first.normal
            if not first.valid:
                misses += 1
        var phase := fposmod(_phase + float(leg.offset), 1.0)
        if phase < DUTY:
            leg.window_used = false
        if moving and bool(leg.stance) and phase >= DUTY and not bool(leg.window_used):
            leg.stance = false
            leg.window_used = true
            leg.swing_t = 0.0
            leg.swing_duration = (1.0 - DUTY) / frequency
            leg.swing_start = leg.anchor
            var horizon: float = leg.swing_duration + DUTY * 0.5 / frequency
            var nominal: Vector3 = _mount.to_global(leg.nominal_mount)
            var radius := nominal - _mount.global_position
            var predicted := _mount.global_position + planar_velocity * horizon + Basis(Vector3.UP, yaw_rate * horizon) * radius
            var landing := _ground(predicted, ground)
            leg.swing_end = landing.point
            leg.normal = landing.normal
            if not landing.valid:
                misses += 1
        var target: Vector3 = leg.anchor
        if not bool(leg.stance):
            leg.swing_t = minf(1.0, float(leg.swing_t) + dt / float(leg.swing_duration))
            var t: float = leg.swing_t
            var blend := t * t * (3.0 - 2.0 * t)
            target = Vector3(leg.swing_start).lerp(leg.swing_end, blend)
            target.y += sin(t * PI) * _clearance
            var under := _ground(target, ground)
            if under.valid:
                target.y = maxf(target.y, float(under.point.y) + sin(t * PI) * _clearance)
            else:
                misses += 1
            if t >= 1.0:
                var touchdown := _ground(leg.swing_end, ground)
                leg.anchor = touchdown.point
                leg.normal = touchdown.normal
                leg.stance = true
                target = leg.anchor
                if not touchdown.valid:
                    misses += 1
        if bool(leg.stance):
            stance_count += 1
        var result := _solve(leg, target)
        result["bone"] = leg.name
        result["phase"] = phase
        result["stance"] = leg.stance
        result["anchor_world"] = leg.anchor
        result["ground_normal"] = leg.normal
        result["foot_orientation_applied"] = false
        result["swing_progress"] = leg.swing_t
        output.append(result)
        if result.unreachable:
            unreachable += 1
        max_error = maxf(max_error, result.error_m)
        max_solver_error = maxf(max_solver_error, result.solver_error_m)
    _grounded = true
    return {"ok": true, "moving": moving, "phase": _phase, "frequency_hz": frequency if moving else 0.0, "duty": DUTY, "stance_count": stance_count, "legs": output, "unreachable_count": unreachable, "maximum_error_m": max_error, "maximum_solver_error_m": max_solver_error, "ground_query_misses": misses, "body_balance_solved": false}
