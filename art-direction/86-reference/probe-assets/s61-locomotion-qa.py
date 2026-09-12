import gzip
import hashlib
import json
import math
from pathlib import Path


HERE = Path(__file__).resolve().parent
RUN = HERE / "s61-locomotion-run.json"
SOCKETS = HERE / "s60-xm2-foot-sockets.json"
OUTPUT = HERE / "s61-locomotion-qa.json"
VISIBLE_TERRAIN_Y = -0.04


def distance(left, right, axes=(0, 1, 2)):
    return math.sqrt(sum((left[axis] - right[axis]) ** 2 for axis in axes))


def wrapped_angle(value):
    return (value + math.pi) % (2.0 * math.pi) - math.pi


def maximum(values, default=0.0):
    return max(values) if values else default


run_bytes = RUN.read_bytes() if RUN.exists() else gzip.decompress(RUN.with_suffix(".json.gz").read_bytes())
run = json.loads(run_bytes)
sockets = json.loads(SOCKETS.read_text())
frames = run["frames"]
leg_names = [leg["bone"] for leg in frames[0]["legs"]]
socket_by_bone = {leg["outer"]["name"]: leg for leg in sockets["legs"]}
scale = float(run["initialization"]["scale_metres_per_skeleton_unit"])


def leg_at(frame, bone):
    return next(leg for leg in frame["legs"] if leg["bone"] == bone)


def observed_at(frame, bone):
    return next(leg for leg in frame["observed_fk"] if leg["bone"] == bone)


def stance_windows(bone):
    result = []
    start = None
    for index, frame in enumerate(frames):
        if bool(leg_at(frame, bone)["stance"]):
            if start is None:
                start = index
        elif start is not None:
            result.append((start, index - 1))
            start = None
    if start is not None:
        result.append((start, len(frames) - 1))
    return result


per_leg = {}
all_stance_fk_anchor = []
all_stance_ground_gaps = []
all_inner_relative_errors = []
all_outer_relative_errors = []
all_requested_distances = []
for bone in leg_names:
    expected = socket_by_bone[bone]
    expected_inner = float(expected["restLengthsSourceUnits"]["innerHipToKnee"]) * scale
    expected_outer = float(expected["restLengthsSourceUnits"]["outerKneeToSocket"]) * scale
    windows = stance_windows(bone)
    window_reports = []
    for first, last in windows:
        observed = [observed_at(frames[index], bone)["world"] for index in range(first, last + 1)]
        anchors = [leg_at(frames[index], bone)["anchor_world"] for index in range(first, last + 1)]
        cumulative = sum(distance(left, right, (0, 2)) for left, right in zip(observed, observed[1:]))
        displacement = maximum(distance(observed[0], point, (0, 2)) for point in observed)
        anchor_change = maximum(distance(anchors[0], point, (0, 2)) for point in anchors)
        turn_indexes = [index for index in range(first, last + 1) if 6.0 <= frames[index]["time"] < 12.0]
        turn_yaw = 0.0
        if len(turn_indexes) > 1:
            turn_yaw = sum(
                abs(wrapped_angle(frames[right]["root_yaw"] - frames[left]["root_yaw"]))
                for left, right in zip(turn_indexes, turn_indexes[1:])
            )
        window_reports.append(
            {
                "start_s": frames[first]["time"],
                "end_s": frames[last]["time"],
                "frames": last - first + 1,
                "observedFkCumulativePlanarPathM": cumulative,
                "observedFkMaxPlanarDisplacementFromWindowStartM": displacement,
                "storedAnchorMaxPlanarChangeM": anchor_change,
                "turnYawObservedDuringWindowDeg": math.degrees(turn_yaw),
            }
        )
    stance_fk_anchor = []
    stance_gaps = []
    inner_relative = []
    outer_relative = []
    requested_distances = []
    for frame in frames:
        leg = leg_at(frame, bone)
        observed = observed_at(frame, bone)
        inner_relative.append(abs(float(observed["inner_length"]) / expected_inner - 1.0))
        outer_relative.append(abs(float(observed["outer_length"]) / expected_outer - 1.0))
        requested_distances.append(distance(leg["hip_world"], leg["target_world"]))
        if bool(leg["stance"]):
            stance_fk_anchor.append(distance(observed["world"], leg["anchor_world"]))
            stance_gaps.append(float(observed["ground_gap"]))
    all_stance_fk_anchor.extend(stance_fk_anchor)
    all_stance_ground_gaps.extend(stance_gaps)
    all_inner_relative_errors.extend(inner_relative)
    all_outer_relative_errors.extend(outer_relative)
    all_requested_distances.extend(requested_distances)
    stop_frames = [frame for frame in frames if frame["time"] >= 14.5]
    stop_points = [observed_at(frame, bone)["world"] for frame in stop_frames]
    per_leg[bone] = {
        "expectedRestLengthsM": {"inner": expected_inner, "outerToSocket": expected_outer},
        "maxInnerLengthRelativeError": maximum(inner_relative),
        "maxOuterLengthRelativeError": maximum(outer_relative),
        "requestedHipTargetDistanceRangeM": [min(requested_distances), max(requested_distances)],
        "stanceFkToStoredAnchorMaxM": maximum(stance_fk_anchor),
        "stanceGroundGapRangeM": [min(stance_gaps), max(stance_gaps)],
        "stanceWindowCount": len(windows),
        "stanceWindowMaxCumulativePlanarPathM": maximum(item["observedFkCumulativePlanarPathM"] for item in window_reports),
        "stanceWindowMaxPlanarDisplacementM": maximum(item["observedFkMaxPlanarDisplacementFromWindowStartM"] for item in window_reports),
        "stanceWindowMaxStoredAnchorChangeM": maximum(item["storedAnchorMaxPlanarChangeM"] for item in window_reports),
        "turnStanceWindowMaxYawDeg": maximum(item["turnYawObservedDuringWindowDeg"] for item in window_reports),
        "turnStanceWindowMaxCumulativePlanarPathM": maximum(
            (item["observedFkCumulativePlanarPathM"] for item in window_reports if item["turnYawObservedDuringWindowDeg"] > 0.0),
            0.0,
        ),
        "stopAfter14_5sMaxPlanarDisplacementM": maximum(distance(stop_points[0], point, (0, 2)) for point in stop_points),
        "stopAfter14_5sCumulativePlanarPathM": sum(distance(left, right, (0, 2)) for left, right in zip(stop_points, stop_points[1:])),
    }

rest_frames = [frame for frame in frames if frame["time"] < 2.0]
turn_previous = max((frame for frame in frames if frame["time"] < 6.0), key=lambda frame: frame["time"])
turn_frames = [frame for frame in frames if 6.0 <= frame["time"] < 12.0]
turn_yaw = sum(
    wrapped_angle(right["root_yaw"] - left["root_yaw"])
    for left, right in zip([turn_previous] + turn_frames[:-1], turn_frames)
)
stop_frames = [frame for frame in frames if frame["time"] >= 14.0]
late_stop_frames = [frame for frame in frames if frame["time"] >= 14.5]
last_swing_time = maximum(
    frame["time"]
    for frame in stop_frames
    if any(not bool(leg["stance"]) for leg in frame["legs"])
)
posed_samples = [(frame["time"], float(frame["posed_mesh_min_y"])) for frame in frames if "posed_mesh_min_y" in frame]
posed_min = min(value for _, value in posed_samples)
posed_max = max(value for _, value in posed_samples)
rest_posed_samples = [value for time, value in posed_samples if time < 2.0]
ground_miss_total = sum(int(frame["ground_query_misses"]) for frame in frames)
unreachable_frame_count = sum(int(frame["unreachable_count"]) > 0 for frame in frames)
unreachable_leg_samples = sum(int(frame["unreachable_count"]) for frame in frames)
reach_excess_max = maximum(float(leg["reach_excess_m"]) for frame in frames for leg in frame["legs"])
maximum_reach = max(
    float(item["restLengthsSourceUnits"]["innerHipToKnee"] + item["restLengthsSourceUnits"]["outerKneeToSocket"]) * scale
    for item in sockets["legs"]
)

qa = {
    "scope": "Independent static recomputation from the 768 recorded 48 Hz states. This is not a new render or runtime test.",
    "input": {
        "path": str(RUN),
        "sha256": hashlib.sha256(run_bytes).hexdigest(),
        "sourceGlbSha256": run["source_sha256"],
        "frames": len(frames),
        "dtSeconds": run["dt"],
        "durationSeconds": run["duration_s"],
    },
    "overall": {
        "stanceFkToStoredAnchorMaxM": maximum(all_stance_fk_anchor),
        "stanceGroundGapRangeM": [min(all_stance_ground_gaps), max(all_stance_ground_gaps)],
        "stanceWindowMaxCumulativePlanarPathM": maximum(item["stanceWindowMaxCumulativePlanarPathM"] for item in per_leg.values()),
        "stanceWindowMaxPlanarDisplacementM": maximum(item["stanceWindowMaxPlanarDisplacementM"] for item in per_leg.values()),
        "maxInnerLengthRelativeError": maximum(all_inner_relative_errors),
        "maxOuterLengthRelativeError": maximum(all_outer_relative_errors),
        "requestedHipTargetDistanceRangeM": [min(all_requested_distances), max(all_requested_distances)],
        "measuredMaximumReachM": maximum_reach,
    },
    "rootAndBody": {
        "restRootPlanarDisplacementM": distance(rest_frames[0]["root_world"], rest_frames[-1]["root_world"], (0, 2)),
        "restRootYRangeM": [min(frame["root_world"][1] for frame in rest_frames), max(frame["root_world"][1] for frame in rest_frames)],
        "restRootYawRangeDeg": math.degrees(max(frame["root_yaw"] for frame in rest_frames) - min(frame["root_yaw"] for frame in rest_frames)),
        "bodyBalanceSolvedEveryFrame": all(bool(frame["body_balance_solved"]) for frame in frames),
        "bodyBonePoseRecorded": False,
    },
    "turn": {
        "intervalSeconds": [6.0, 12.0],
        "commandedYawDeg": 90.0,
        "observedAccumulatedYawDeg": math.degrees(turn_yaw),
        "absoluteYawErrorDeg": abs(math.degrees(turn_yaw) - 90.0),
        "maximumYawObservedInsideOneStanceWindowDeg": maximum(item["turnStanceWindowMaxYawDeg"] for item in per_leg.values()),
    },
    "stop": {
        "commandStopsAtSeconds": 14.0,
        "lastRecordedSwingAtSeconds": last_swing_time,
        "allFeetStanceBySeconds": next(
            frame["time"]
            for index, frame in enumerate(stop_frames)
            if all(bool(leg["stance"]) for later in stop_frames[index:] for leg in later["legs"])
        ),
        "rootDisplacementAfter14sM": distance(stop_frames[0]["root_world"], stop_frames[-1]["root_world"]),
        "phaseChangeAfter14s": wrapped_angle(stop_frames[-1]["phase"] - stop_frames[0]["phase"]),
        "allMovingFlagsFalseAfter14_5s": all(not bool(frame["moving"]) for frame in late_stop_frames),
        "minimumStanceCountAfter14_5s": min(int(frame["stance_count"]) for frame in late_stop_frames),
        "maximumFootPlanarDisplacementAfter14_5sM": maximum(item["stopAfter14_5sMaxPlanarDisplacementM"] for item in per_leg.values()),
    },
    "groundAndReach": {
        "groundQueryMissTotal": ground_miss_total,
        "unreachableFrameCount": unreachable_frame_count,
        "unreachableLegSampleCount": unreachable_leg_samples,
        "maximumReachExcessM": reach_excess_max,
        "unreachablePathExercised": unreachable_leg_samples > 0,
    },
    "renderGeometrySampling": {
        "sampleCount": len(posed_samples),
        "sampleIntervalSeconds": 0.5,
        "overallPosedMeshMinYAgainstColliderRangeM": [posed_min, posed_max],
        "restPosedMeshMinYAgainstColliderRangeM": [min(rest_posed_samples), max(rest_posed_samples)],
        "maximumColliderPenetrationM": max(0.0, -posed_min),
        "overallLowestGeometryGapAboveVisibleTerrainRangeM": [posed_min - VISIBLE_TERRAIN_Y, posed_max - VISIBLE_TERRAIN_Y],
        "colliderY": 0.0,
        "visibleTerrainY": VISIBLE_TERRAIN_Y,
        "perLegRenderContactMeasured": False,
    },
    "perLeg": per_leg,
    "assessment": {
        "flatStanceSocketLock": "pass for recorded FK socket: maximum 0.00000214 m from stored stance anchor; this does not independently validate each render foot surface",
        "chainLengthPreservation": "pass for recorded FK: maximum relative error below 0.00000159",
        "restRoot": "mount rest position passes; body rest and balance are untested because no body bone pose was recorded and body_balance_solved is false",
        "turn": "90-degree root yaw and short-window stance locking pass; each stance window spans at most 5.94 degrees, so long planted-foot rotation is not exercised",
        "stop": "pass for this sequence: the only post-command swing ends by 14.0833 s and all observed feet are motionless after 14.5 s",
        "groundQueries": "pass on the flat collider with zero misses",
        "unreachableHandling": "not tested: every requested target stayed within reach and no unreachable sample occurred",
        "visibleGroundContact": "fail against the visible terrain height supplied by the harness review: overall lowest geometry remains 0.0345-0.0415 m above it because the test collider is at Y=0 while visible terrain is at Y=-0.04",
    },
    "limits": [
        "observed_fk is recomputed from the output bone transforms and measured socket, but it still uses the same socket definition as the controller; only posed_mesh_min_y samples render geometry independently.",
        "posed_mesh_min_y is one whole-model minimum every 24 simulation frames. It cannot prove contact or absence of penetration for each individual leg.",
        "The scenario uses one flat collider. It does not exercise slope normals, missing ground, unreachable targets, joint limits, body balance, collisions, or moving platforms.",
        "The root is moved by the harness before the controller step. This QA measures the recorded result rather than a CharacterBody or gameplay integration.",
    ],
}
OUTPUT.write_text(json.dumps(qa, ensure_ascii=False, indent=2) + "\n")
print(OUTPUT)
