extends RefCounted

const SOURCES := {
    "geometry_and_original_materials": "s55-morpho.glb; s55-morpho-materials.json; Project-86 Morpho Materials, unchanged",
    "new_surface_design": "S60 project-authored material overrides and deterministic native microdetail; not recovered source textures",
    "noise_api": "https://docs.godotengine.org/en/stable/classes/class_noisetexture2d.html",
    "noise_generator_api": "https://docs.godotengine.org/en/stable/classes/class_fastnoiselite.html",
    "material_api": "https://docs.godotengine.org/en/stable/classes/class_basematerial3d.html"
}

static var _materials: Dictionary = {}
static var _textures: Dictionary = {}

static func _detail(seed_value: int, low: float, high: float, normal_map: bool = false) -> NoiseTexture2D:
    var noise := FastNoiseLite.new()
    noise.seed = seed_value
    noise.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
    noise.fractal_type = FastNoiseLite.FRACTAL_NONE
    noise.frequency = 0.24
    var texture := NoiseTexture2D.new()
    texture.width = 256
    texture.height = 256
    texture.seamless = true
    texture.generate_mipmaps = true
    texture.as_normal_map = normal_map
    texture.bump_strength = 0.16
    if not normal_map:
        var ramp := Gradient.new()
        ramp.colors = PackedColorArray([Color(low, low, low), Color(high, high, high)])
        texture.color_ramp = ramp
    texture.noise = noise
    return texture

static func _role(mesh_name: String, source_name: String) -> String:
    var part := mesh_name.to_lower()
    if source_name == "composite sensor morpho":
        return ""
    if source_name == "morpho black":
        return "seals_and_recesses"
    if part == "railgun rails":
        return "bare_rail_faces" if source_name == "morpho armor - silver" else "rail_supports"
    if source_name == "morpho railgun cannon color":
        return "bore_metal"
    if "heat fins" in part or part == "twisted railgun grills":
        return "heat_fins"
    for token in ["connector", "inner big leg", "inner leg", "support", "grills", "underside", "underbody", "cylinder", "elevation", "reinforcement", "autogun strcuture"]:
        if token in part:
            return "mechanical_light" if source_name in ["morpho armor - silver", "morpho grey"] else "mechanical_dark"
    if "rock" in part or "stone piece" in part or part == "center oval":
        return "ceramic_dark" if source_name == "morpho armor - dark stone silver" else "ceramic_shell"
    match source_name:
        "morpho armor - silver": return "painted_armor"
        "morpho armor - dark silver": return "painted_secondary"
        "morpho armor - stone silver": return "ceramic_shell"
        "morpho armor - dark stone silver": return "mechanical_dark"
        "morpho grey": return "mechanical_light"
    return ""

static func _surface(role: String) -> StandardMaterial3D:
    if _materials.has(role):
        return _materials[role]
    if _textures.is_empty():
        _textures["paint_roughness"] = _detail(60086, 0.68, 0.77)
        _textures["metal_roughness"] = _detail(60186, 0.90, 1.0)
        _textures["paint_micro_normal"] = _detail(60286, 0.0, 1.0, true)
    var material := StandardMaterial3D.new()
    material.resource_name = "S60/" + role
    material.cull_mode = BaseMaterial3D.CULL_DISABLED
    material.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
    material.roughness_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_RED
    match role:
        "painted_armor":
            material.albedo_color = Color(0.70, 0.72, 0.70)
            material.metallic = 0.0
            material.roughness = 1.0
        "painted_secondary":
            material.albedo_color = Color(0.40, 0.43, 0.43)
            material.metallic = 0.0
            material.roughness = 1.0
        "ceramic_shell", "ceramic_dark":
            material.albedo_color = Color(0.45, 0.50, 0.51) if role == "ceramic_shell" else Color(0.29, 0.33, 0.34)
            material.metallic = 0.0
            material.roughness = 0.84
        "mechanical_light":
            material.albedo_color = Color(0.44, 0.46, 0.48)
            material.metallic = 0.86
            material.roughness = 0.47
        "mechanical_dark", "rail_supports":
            material.albedo_color = Color(0.25, 0.28, 0.30)
            material.metallic = 0.82
            material.roughness = 0.56
        "bare_rail_faces":
            material.albedo_color = Color(0.51, 0.54, 0.56)
            material.metallic = 0.96
            material.roughness = 0.31
        "bore_metal":
            material.albedo_color = Color(0.32, 0.35, 0.39)
            material.metallic = 0.95
            material.roughness = 0.28
        "heat_fins":
            material.albedo_color = Color(0.23, 0.25, 0.27)
            material.metallic = 0.72
            material.roughness = 0.67
        "seals_and_recesses":
            material.albedo_color = Color(0.13, 0.15, 0.16)
            material.metallic = 0.0
            material.roughness = 0.86
    if role.begins_with("painted_"):
        material.roughness_texture = _textures["paint_roughness"]
        material.normal_enabled = true
        material.normal_texture = _textures["paint_micro_normal"]
        material.normal_scale = 0.22
    elif material.metallic > 0.7:
        material.roughness_texture = _textures["metal_roughness"]
    _materials[role] = material
    return material

static func apply(root: Node3D) -> Dictionary:
    var report := {"scope": "Morpho source material names only", "meshes": 0, "surfaces": 0, "roles": {}, "mapping": [], "preserved_surfaces": 0, "skipped_global_overrides": 0, "sources": SOURCES}
    var candidates: Array[Node] = [root]
    candidates.append_array(root.find_children("*", "MeshInstance3D", true, false))
    for node in candidates:
        if not node is MeshInstance3D:
            continue
        var instance := node as MeshInstance3D
        if instance.mesh == null:
            continue
        if instance.material_override != null:
            report.skipped_global_overrides += 1
            continue
        var changed := false
        for surface in range(instance.mesh.get_surface_count()):
            var original := instance.mesh.surface_get_material(surface)
            if not original is StandardMaterial3D or not (original.resource_name.begins_with("morpho ") or original.resource_name == "composite sensor morpho"):
                continue
            var role := _role(instance.name, original.resource_name)
            if role.is_empty():
                report.preserved_surfaces += 1
                continue
            instance.set_surface_override_material(surface, _surface(role))
            report.surfaces += 1
            report.roles[role] = report.roles.get(role, 0) + 1
            report.mapping.append({"mesh": str(instance.name), "surface": surface, "source": original.resource_name, "role": role})
            changed = true
        if changed:
            report.meshes += 1
    report["shared_material_count"] = _materials.size()
    report["shared_texture_count"] = _textures.size()
    report["textures"] = {"paint_roughness": "256x256 seamless scalar, 0.68..0.77", "metal_roughness": "256x256 seamless multiplier, 0.90..1.0", "paint_micro_normal": "256x256 seamless noise bump 0.16, normal_scale 0.22; no albedo noise"}
    report["textures_ready"] = true
    for texture in _textures.values():
        if texture.get_image() == null:
            report.textures_ready = false
    report["limitations"] = ["New art direction, not restored original textures.", "Microdetail follows existing UVs; no verified physical texel density or edge wear.", "NoiseTexture2D builds asynchronously; allow generation before fixed-camera A/B capture.", "Shared scalar/material hierarchy has not yet passed the root visual A/B."]
    return report
