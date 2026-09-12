import hashlib
import json
import math
import struct
from collections import Counter
from pathlib import Path


HERE = Path(__file__).resolve().parent
SOURCE = HERE / "s55-reginleif-import.glb"
OUTPUT = HERE / "s60-xm2-foot-sockets.json"
TARGET_LENGTH_METRES = 6.3
CONTACT_BAND_SOURCE_UNITS = 0.03

COMPONENTS = {
    5120: ("b", 1),
    5121: ("B", 1),
    5122: ("h", 2),
    5123: ("H", 2),
    5125: ("I", 4),
    5126: ("f", 4),
}
COUNTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def load_glb(path):
    payload = path.read_bytes()
    if payload[:4] != b"glTF" or struct.unpack_from("<I", payload, 4)[0] != 2:
        raise ValueError("Expected a glTF 2.0 GLB")
    document = None
    binary = None
    offset = 12
    while offset < len(payload):
        length, kind = struct.unpack_from("<I4s", payload, offset)
        offset += 8
        chunk = payload[offset : offset + length]
        offset += length
        if kind == b"JSON":
            document = json.loads(chunk)
        elif kind == b"BIN\0":
            binary = chunk
    if document is None or binary is None:
        raise ValueError("GLB is missing JSON or BIN chunk")
    return payload, document, binary


def accessor(document, binary, index):
    item = document["accessors"][index]
    if "sparse" in item:
        raise ValueError("Sparse accessors are not supported by this bounded audit")
    view = document["bufferViews"][item["bufferView"]]
    code, size = COMPONENTS[item["componentType"]]
    count = COUNTS[item["type"]]
    stride = view.get("byteStride", size * count)
    start = view.get("byteOffset", 0) + item.get("byteOffset", 0)
    values = [
        struct.unpack_from("<" + code * count, binary, start + row * stride)
        for row in range(item["count"])
    ]
    if item.get("normalized") and item["componentType"] != 5126:
        signed = item["componentType"] in (5120, 5122)
        bits = size * 8
        divisor = (2 ** (bits - 1) - 1) if signed else (2**bits - 1)
        values = [tuple(max(-1.0, value / divisor) for value in row) for row in values]
    return values


def identity():
    return [[1.0 if row == column else 0.0 for column in range(4)] for row in range(4)]


def multiply(left, right):
    return [
        [sum(left[row][axis] * right[axis][column] for axis in range(4)) for column in range(4)]
        for row in range(4)
    ]


def local_matrix(node):
    if "matrix" in node:
        values = node["matrix"]
        return [[values[column * 4 + row] for column in range(4)] for row in range(4)]
    x, y, z, w = node.get("rotation", [0.0, 0.0, 0.0, 1.0])
    matrix = [
        [1 - 2 * y * y - 2 * z * z, 2 * x * y - 2 * z * w, 2 * x * z + 2 * y * w, 0.0],
        [2 * x * y + 2 * z * w, 1 - 2 * x * x - 2 * z * z, 2 * y * z - 2 * x * w, 0.0],
        [2 * x * z - 2 * y * w, 2 * y * z + 2 * x * w, 1 - 2 * x * x - 2 * y * y, 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ]
    scale = node.get("scale", [1.0, 1.0, 1.0])
    translation = node.get("translation", [0.0, 0.0, 0.0])
    for column in range(3):
        for row in range(3):
            matrix[row][column] *= scale[column]
    for row in range(3):
        matrix[row][3] = translation[row]
    return matrix


def inverse(matrix):
    work = [row[:] + unit[:] for row, unit in zip(matrix, identity())]
    for column in range(4):
        pivot = max(range(column, 4), key=lambda row: abs(work[row][column]))
        if abs(work[pivot][column]) < 1e-12:
            raise ValueError("Singular node matrix")
        work[column], work[pivot] = work[pivot], work[column]
        factor = work[column][column]
        work[column] = [value / factor for value in work[column]]
        for row in range(4):
            if row == column:
                continue
            factor = work[row][column]
            work[row] = [value - factor * pivot_value for value, pivot_value in zip(work[row], work[column])]
    return [row[4:] for row in work]


def transform(matrix, point):
    vector = [point[0], point[1], point[2], 1.0]
    return [sum(matrix[row][axis] * vector[axis] for axis in range(4)) for row in range(3)]


def subtract(left, right):
    return [left[index] - right[index] for index in range(3)]


def dot(left, right):
    return sum(left[index] * right[index] for index in range(3))


def cross(left, right):
    return [
        left[1] * right[2] - left[2] * right[1],
        left[2] * right[0] - left[0] * right[2],
        left[0] * right[1] - left[1] * right[0],
    ]


def length(vector):
    return math.sqrt(dot(vector, vector))


def normalized(vector):
    magnitude = length(vector)
    return [value / magnitude for value in vector] if magnitude else [0.0, 0.0, 0.0]


def rounded(vector):
    return [round(value, 8) for value in vector]


payload, document, binary = load_glb(SOURCE)
parents = {child: parent for parent, node in enumerate(document["nodes"]) for child in node.get("children", [])}
world_cache = {}


def world_matrix(index):
    if index not in world_cache:
        local = local_matrix(document["nodes"][index])
        world_cache[index] = multiply(world_matrix(parents[index]), local) if index in parents else local
    return world_cache[index]


skin = document["skins"][0]
joint_nodes = skin["joints"]
joint_names = [document["nodes"][node].get("name", "") for node in joint_nodes]
joint_by_name = {name: index for index, name in enumerate(joint_names)}
node_by_name = {node.get("name", ""): index for index, node in enumerate(document["nodes"])}
inverse_bind_values = accessor(document, binary, skin["inverseBindMatrices"])
inverse_bind_matrices = [
    [[values[column * 4 + row] for column in range(4)] for row in range(4)]
    for values in inverse_bind_values
]
joint_bind_matrices = [
    multiply(world_matrix(node_index), inverse_bind_matrices[joint_index])
    for joint_index, node_index in enumerate(joint_nodes)
]

weighted_vertices = {name: [] for name in joint_names}
all_positions = []
non_rigid_selected_weights = 0
mesh_position_bind_error_max = 0.0
selected_mesh_position_bind_error_max = 0.0
vertex_count = 0
selected_vertex_count = 0
for node_index, node in enumerate(document["nodes"]):
    if "mesh" not in node or node.get("skin") != 0:
        continue
    node_world = world_matrix(node_index)
    for primitive in document["meshes"][node["mesh"]]["primitives"]:
        attributes = primitive["attributes"]
        positions = accessor(document, binary, attributes["POSITION"])
        joints = accessor(document, binary, attributes["JOINTS_0"])
        weights = accessor(document, binary, attributes["WEIGHTS_0"])
        for position, vertex_joints, vertex_weights in zip(positions, joints, weights):
            mesh_position = transform(node_world, position)
            model_position = [0.0, 0.0, 0.0]
            for vertex_joint, vertex_weight in zip(vertex_joints, vertex_weights):
                if vertex_weight == 0.0:
                    continue
                bound_position = transform(joint_bind_matrices[vertex_joint], position)
                for axis in range(3):
                    model_position[axis] += vertex_weight * bound_position[axis]
            all_positions.append(model_position)
            slot = max(range(len(vertex_weights)), key=lambda item: vertex_weights[item])
            bone = joint_names[vertex_joints[slot]]
            dominant_weight = float(vertex_weights[slot])
            weighted_vertices[bone].append((model_position, node.get("name", ""), dominant_weight))
            bind_error = length(subtract(mesh_position, model_position))
            mesh_position_bind_error_max = max(mesh_position_bind_error_max, bind_error)
            vertex_count += 1
            if bone.startswith(("Outer leg", "outer hyd pump", "outer armor", "pile driv")):
                selected_mesh_position_bind_error_max = max(selected_mesh_position_bind_error_max, bind_error)
                selected_vertex_count += 1
            if bone.startswith(("Outer leg", "outer hyd pump", "outer armor", "pile driv")) and abs(dominant_weight - 1.0) > 1e-6:
                non_rigid_selected_weights += 1

bounds_min = [min(point[axis] for point in all_positions) for axis in range(3)]
bounds_max = [max(point[axis] for point in all_positions) for axis in range(3)]
bounds_extent = [bounds_max[axis] - bounds_min[axis] for axis in range(3)]
encounter_scale = TARGET_LENGTH_METRES / bounds_extent[2]

legs = []
for suffix in ("", ".001", ".002", ".003"):
    inner_name = "Inner leg" + suffix
    outer_name = "Outer leg" + suffix
    branch_names = [outer_name, "outer hyd pump" + suffix, "outer armor" + suffix, "pile driv" + suffix]
    branch = [vertex for name in branch_names for vertex in weighted_vertices[name]]
    minimum_y = min(vertex[0][1] for vertex in branch)
    candidates = [vertex for vertex in branch if vertex[0][1] <= minimum_y + CONTACT_BAND_SOURCE_UNITS]
    socket_model = [
        sum(vertex[0][0] for vertex in candidates) / len(candidates),
        minimum_y,
        sum(vertex[0][2] for vertex in candidates) / len(candidates),
    ]
    inner_node = node_by_name[inner_name]
    outer_node = node_by_name[outer_name]
    hip = transform(world_matrix(inner_node), [0.0, 0.0, 0.0])
    knee = transform(world_matrix(outer_node), [0.0, 0.0, 0.0])
    hip_to_knee = subtract(knee, hip)
    knee_to_socket = subtract(socket_model, knee)
    hip_to_socket_axis = normalized(subtract(socket_model, hip))
    knee_from_axis = subtract(hip_to_knee, [dot(hip_to_knee, hip_to_socket_axis) * value for value in hip_to_socket_axis])
    bend_direction = normalized(knee_from_axis)
    bend_plane_normal = normalized(cross(hip_to_knee, knee_to_socket))
    legs.append(
        {
            "suffix": suffix or ".000",
            "restQuadrantByModelXZ": ("X-" if socket_model[0] < 0 else "X+") + "/" + ("Z-" if socket_model[2] < 0 else "Z+"),
            "inner": {"name": inner_name, "skinJointIndex": joint_by_name[inner_name], "nodeIndex": inner_node},
            "outer": {"name": outer_name, "skinJointIndex": joint_by_name[outer_name], "nodeIndex": outer_node},
            "hipModel": rounded(hip),
            "kneeModel": rounded(knee),
            "footSocketModel": rounded(socket_model),
            "footSocketOuterBoneLocal": rounded(transform(inverse(world_matrix(outer_node)), socket_model)),
            "restLengthsSourceUnits": {
                "innerHipToKnee": round(length(hip_to_knee), 8),
                "outerKneeToSocket": round(length(knee_to_socket), 8),
            },
            "restLengthsAt6_3mScaleMetres": {
                "innerHipToKnee": round(length(hip_to_knee) * encounter_scale, 8),
                "outerKneeToSocket": round(length(knee_to_socket) * encounter_scale, 8),
            },
            "bendPlaneNormalModel": rounded(bend_plane_normal),
            "preferredKneeBendDirectionModel": rounded(bend_direction),
            "contactEvidence": {
                "branchBones": branch_names,
                "weightedVertexCount": len(branch),
                "minimumModelY": round(minimum_y, 8),
                "bandSourceUnits": CONTACT_BAND_SOURCE_UNITS,
                "candidateVertexCount": len(candidates),
                "candidateMeshes": dict(sorted(Counter(vertex[1] for vertex in candidates).items())),
                "minimumDominantWeight": round(min(vertex[2] for vertex in candidates), 8),
            },
        }
    )

report = {
    "purpose": "Runtime IK input measurement only; no gait or ground contact has been tested.",
    "source": str(SOURCE),
    "sourceBytes": len(payload),
    "sourceSha256": hashlib.sha256(payload).hexdigest(),
    "coordinateSystem": "glTF model coordinates: +Y up. Forward sign is intentionally not inferred.",
    "method": [
        "Parse GLB JSON/BIN directly and compose joint rest-world transforms.",
        "Evaluate each render vertex in the skin bind pose as the weighted sum of jointWorld * inverseBindMatrix * POSITION. meshNodeWorld * POSITION was measured only as an audit comparator and is not used for sockets or bounds.",
        "Assign each skinned render vertex to its highest-weight skin joint; the selected distal branch vertices are rigid at weight 1.0.",
        "For each Outer-leg branch, find the minimum model-space Y and average X/Z across vertices within 0.03 source units of that minimum; project the socket Y to the exact minimum.",
        "Transform that render-geometry contact point into the corresponding Outer leg rest-bone local space. Rest lengths and bend vectors use hip, knee, and measured contact rather than a bone origin as the foot.",
    ],
    "skin": {
        "skinIndex": 0,
        "jointCount": len(joint_nodes),
        "restVertexCount": vertex_count,
        "selectedDistalVertexCount": selected_vertex_count,
        "selectedNonRigidDominantWeights": non_rigid_selected_weights,
        "meshNodePositionVsWeightedBindMaxErrorSourceUnits": round(mesh_position_bind_error_max, 8),
        "selectedMeshNodePositionVsWeightedBindMaxErrorSourceUnits": round(selected_mesh_position_bind_error_max, 8),
        "meshNodePositionVsWeightedBindMaxErrorAt6_3mScaleMetres": round(mesh_position_bind_error_max * encounter_scale, 8),
        "equivalent": mesh_position_bind_error_max <= 1e-5,
    },
    "restRenderBoundsModel": {"min": rounded(bounds_min), "max": rounded(bounds_max), "extent": rounded(bounds_extent)},
    "encounterNormalization": {
        "targetLengthMetres": TARGET_LENGTH_METRES,
        "lengthAxis": "model Z",
        "uniformScaleMetresPerSourceUnit": round(encounter_scale, 12),
    },
    "legs": legs,
    "qualityRisks": [
        "The source has no semantic foot bone or collider. Each socket is a reproducible lowest render-surface patch, not an authored sole pivot.",
        "meshNodeWorld * POSITION is not the bind-pose result in this file; using it would add about 4.49376 source units of vertical offset. The reported positions use weighted skin bind transforms.",
        "The 0.03-source-unit contact band samples a small bevel patch. Collision shape, desired stance orientation, or a different tolerance may justify moving the socket after visual ground-contact QA.",
        "Suffixes are identified only by their rest X/Z quadrants because the archived bone names do not label front/back/left/right and forward sign remains unverified.",
        "Godot Skeleton3D bone ordering should be resolved by name at runtime; glTF skinJointIndex is evidence, not a promise that Godot exposes the same integer index.",
        "Apply the encounter's uniform model scale exactly once when converting these model/local coordinates to world metres.",
        "No joint limits, slope reach, self-collision, foot locking, turning, or animated-pose deformation was tested by this measurement.",
    ],
}
OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
print(OUTPUT)
