extends CanvasLayer

const INK := Color("0b1725")
const PAPER := Color("eee9dc")
const CYAN := Color("72d7de")
const MUTED := Color("a5b4c4")
var _start: Callable
var _retry: Callable
var _title: Callable
var _root: Control
var _modal: ColorRect
var _card: PanelContainer
var _body: VBoxContainer
var _hud: Control
var _hp: Label
var _bar: ProgressBar
var _clock: Label
var _kills: Label
var _objective: Label
var _notice: Label
var _fade: Tween
var _notice_fade: Tween
var _mode := "prep"

func initialize(on_start: Callable, on_retry: Callable, on_title: Callable) -> void:
	_start = on_start
	_retry = on_retry
	_title = on_title
	if is_node_ready():
		show_prep()

func _ready() -> void:
	layer = 30
	_root = Control.new()
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_root)
	var theme := Theme.new()
	if FileAccess.file_exists("/System/Library/Fonts/STHeiti Light.ttc"):
		var font := FontFile.new()
		font.data = FileAccess.get_file_as_bytes("/System/Library/Fonts/STHeiti Light.ttc")
		theme.default_font = font
	else:
		var font := SystemFont.new()
		font.font_names = PackedStringArray(["PingFang TC", "Heiti TC"])
		theme.default_font = font
	theme.default_font_size = 20
	_root.theme = theme
	_root.size = Vector2(1280, 720)
	get_viewport().size_changed.connect(_resize)
	_resize()
	_build_hud()
	_modal = ColorRect.new()
	_modal.color = Color(0.025, 0.055, 0.09, 0.88)
	_modal.size = Vector2(1280, 720)
	_modal.mouse_filter = Control.MOUSE_FILTER_STOP
	_root.add_child(_modal)
	_card = PanelContainer.new()
	_card.position = Vector2(310, 70)
	_card.size = Vector2(660, 580)
	_card.add_theme_stylebox_override("panel", _style(INK, Color("365364"), 28))
	_modal.add_child(_card)
	_body = VBoxContainer.new()
	_body.add_theme_constant_override("separation", 16)
	_card.add_child(_body)
	show_prep()

func _resize() -> void:
	var viewport_size := get_viewport().get_visible_rect().size
	var ratio := minf(viewport_size.x / 1280.0, viewport_size.y / 720.0)
	_root.scale = Vector2.ONE * ratio
	_root.position = (viewport_size - Vector2(1280, 720) * ratio) * 0.5

func _style(color: Color, border: Color, padding: int = 12) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = color
	style.border_color = border
	style.set_border_width_all(1)
	style.set_content_margin_all(padding)
	style.set_corner_radius_all(3)
	return style

func _label(text: String, size_px: int = 20, color: Color = PAPER) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", size_px)
	label.add_theme_color_override("font_color", color)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return label

func _build_hud() -> void:
	_hud = Control.new()
	_hud.size = Vector2(1280, 720)
	_hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(_hud)
	var top := PanelContainer.new()
	top.position = Vector2(24, 20)
	top.size = Vector2(1232, 80)
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top.add_theme_stylebox_override("panel", _style(Color(0.035, 0.08, 0.13, 0.92), Color("365364"), 12))
	_hud.add_child(top)
	var row := HBoxContainer.new()
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_theme_constant_override("separation", 26)
	top.add_child(row)
	var health := VBoxContainer.new()
	health.mouse_filter = Control.MOUSE_FILTER_IGNORE
	health.custom_minimum_size.x = 210
	row.add_child(health)
	_hp = _label("XM2  裝甲  100 / 100", 18)
	health.add_child(_hp)
	_bar = ProgressBar.new()
	_bar.custom_minimum_size = Vector2(210, 8)
	_bar.show_percentage = false
	_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_bar.add_theme_stylebox_override("background", _style(Color("253445"), Color("253445"), 0))
	_bar.add_theme_stylebox_override("fill", _style(CYAN, CYAN, 0))
	health.add_child(_bar)
	_clock = _label("03:00", 30, CYAN)
	row.add_child(_clock)
	_objective = _label("存活至撤離開放", 20)
	_objective.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_objective.clip_text = true
	row.add_child(_objective)
	_kills = _label("擊破  0", 20)
	row.add_child(_kills)
	var controls := _label("WASD 移動    滑鼠瞄準・自動開火    右鍵跨越    Space 支援", 17)
	controls.position = Vector2(28, 676)
	controls.add_theme_color_override("font_shadow_color", Color.BLACK)
	controls.add_theme_constant_override("shadow_offset_x", 1)
	controls.add_theme_constant_override("shadow_offset_y", 2)
	_hud.add_child(controls)
	_notice = _label("", 23, CYAN)
	_notice.position = Vector2(180, 116)
	_notice.size = Vector2(920, 40)
	_notice.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_notice.add_theme_color_override("font_shadow_color", Color.BLACK)
	_notice.add_theme_constant_override("shadow_offset_y", 2)
	_hud.add_child(_notice)

func _clear_card() -> void:
	for child in _body.get_children():
		_body.remove_child(child)
		child.queue_free()
	_card.size = Vector2(660, 580)

func _copy(text: String, size_px: int = 20, color: Color = PAPER) -> void:
	var label := _label(text, size_px, color)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_body.add_child(label)

func _button(text: String, action: Callable, primary: bool = false) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size.y = 52
	button.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	button.add_theme_color_override("font_color", INK if primary else PAPER)
	button.add_theme_color_override("font_hover_color", INK)
	button.add_theme_color_override("font_pressed_color", INK)
	button.add_theme_stylebox_override("normal", _style(CYAN if primary else Color("192b3d"), CYAN if primary else Color("4c697a")))
	button.add_theme_stylebox_override("hover", _style(PAPER, PAPER))
	button.add_theme_stylebox_override("pressed", _style(Color("4dabb5"), CYAN))
	button.add_theme_stylebox_override("focus", _style(Color(0, 0, 0, 0), PAPER, 0))
	button.pressed.connect(func():
		button.disabled = true
		if action.is_valid():
			action.call()
	)
	_body.add_child(button)
	return button

func _reveal_modal() -> void:
	_hud.hide()
	_modal.show()
	if _fade and _fade.is_valid():
		_fade.kill()
	_modal.modulate.a = 0.0
	_fade = create_tween()
	_fade.tween_property(_modal, "modulate:a", 1.0, 0.22)

func show_prep() -> void:
	if not is_node_ready():
		return
	_mode = "prep"
	_clear_card()
	_copy("作戰簡報  /  01", 18, CYAN)
	_copy("鐵道防線", 42)
	_copy("撐過三分鐘，活著抵達撤離區。", 24)
	_copy("軍團正沿工業區逼近。駕駛 XM2 機動作戰，存活 180 秒後前往標示的撤離區。裝甲歸零即任務失敗。", 20, MUTED)
	_copy("WASD  移動     滑鼠  瞄準\n主砲自動開火     右鍵  跨越\nSpace  呼叫支援", 20)
	_copy("不必殲滅所有敵機；保持移動，留意撤離指示。", 18, CYAN)
	var start_button := _button("出擊", func():
		show_play()
		if _start.is_valid():
			_start.call()
	, true)
	_reveal_modal()
	start_button.grab_focus()

func show_play() -> void:
	if not is_node_ready():
		return
	_mode = "play"
	if _fade and _fade.is_valid():
		_fade.kill()
	_modal.hide()
	_hud.show()
	_notice.text = ""
	_hud.modulate.a = 0.0
	_fade = create_tween()
	_fade.tween_property(_hud, "modulate:a", 1.0, 0.2)

func update_hud(hp: float, max_hp: float, seconds_left: float, kills: int, objective: String) -> void:
	if not is_node_ready():
		return
	_hp.text = "XM2  裝甲  %d / %d" % [int(ceilf(maxf(hp, 0.0))), int(max_hp)]
	_bar.max_value = maxf(max_hp, 1.0)
	_bar.value = clampf(hp, 0.0, _bar.max_value)
	_hp.add_theme_color_override("font_color", Color("ffad91") if hp < max_hp * 0.3 else PAPER)
	var seconds := maxi(0, int(ceilf(seconds_left)))
	_clock.text = "%02d:%02d" % [seconds / 60, seconds % 60] if seconds > 0 else "撤離開放"
	_clock.add_theme_font_size_override("font_size", 30 if seconds > 0 else 23)
	_kills.text = "擊破  %d" % kills
	_objective.text = objective

func show_result(won: bool, kills: int, elapsed: float) -> void:
	if not is_node_ready():
		return
	_mode = "result"
	_clear_card()
	_copy("作戰紀錄  /  任務結束", 18, CYAN)
	_copy("撤離成功" if won else "任務失敗", 42, CYAN if won else Color("ffad91"))
	_copy("你已突破防線，抵達撤離區。" if won else "XM2 裝甲耗盡。重新整備，再次出擊。", 22)
	var seconds := maxi(0, int(elapsed))
	_copy("擊破軍團  %d\n作戰時間  %02d:%02d" % [kills, seconds / 60, seconds % 60], 24)
	_copy("保持移動，善用跨越與支援；倒數結束後直奔撤離區。", 19, MUTED)
	var retry_button := _button("再次出擊", func():
		show_play()
		if _retry.is_valid():
			_retry.call()
	, true)
	_button("返回整備", func():
		show_prep()
		if _title.is_valid():
			_title.call()
	)
	_reveal_modal()
	retry_button.grab_focus()

func announce(text: String) -> void:
	if not is_node_ready():
		return
	if _notice_fade and _notice_fade.is_valid():
		_notice_fade.kill()
	_notice.text = text
	_notice.modulate.a = 1.0
	_notice_fade = create_tween()
	_notice_fade.tween_interval(3.0)
	_notice_fade.tween_property(_notice, "modulate:a", 0.0, 0.5)

func _unhandled_input(_event: InputEvent) -> void:
	if _mode != "play":
		get_viewport().set_input_as_handled()
