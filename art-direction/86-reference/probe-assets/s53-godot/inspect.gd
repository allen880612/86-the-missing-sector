extends SceneTree
func _initialize():
    print("ENV_ENUM ", ClassDB.class_get_enum_constants("Environment", "ToneMapper"))
    print("REFLECTION_ENUM ", ClassDB.class_get_enum_constants("Environment", "ReflectionSource"))
    var doc = GLTFDocument.new()
    var state = GLTFState.new()
    var err = doc.append_from_file("/Users/wei/Documents/ChatGPT/遊戲練習/assets/model/polyhaven/modular_factory_facade/modular_factory_facade_1k.gltf", state)
    print("FACTORY_IMPORT ", err)
    var scene = doc.generate_scene(state)
    root.add_child(scene)
    print("ROOT ", scene.name, " children=", scene.get_child_count())
    for child in scene.get_children():
        print(child.name, " ", child.get_class())
    quit()
