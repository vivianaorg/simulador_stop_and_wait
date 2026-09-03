# gui.py
import math
import random
import time
import tkinter as tk
from tkinter import ttk, messagebox
from protocol import Packet, StopAndWaitProtocol

class ToastNotification:
    """Avisos flotantes estilizados sobre el Canvas."""
    def __init__(self, canvas, message, toast_type="INFO", duration=2800):
        self.canvas = canvas
        self.duration = duration
        
        colors = {
            "INFO": {"bg": "#1e3a8a", "border": "#3b82f6", "fg": "#ffffff", "icon": "ℹ️"},
            "SUCCESS": {"bg": "#064e3b", "border": "#10b981", "fg": "#ffffff", "icon": "✓"},
            "WARNING": {"bg": "#78350f", "border": "#f59e0b", "fg": "#ffffff", "icon": "⚠️"},
            "DANGER": {"bg": "#7f1d1d", "border": "#ef4444", "fg": "#ffffff", "icon": "💥"}
        }
        cfg = colors.get(toast_type, colors["INFO"])
        
        c_width = self.canvas.winfo_width() or int(canvas.cget("width") or 800)
        self.width = min(340, max(240, c_width - 80))
        self.height = 40
        self.x2 = c_width - 20
        self.x1 = self.x2 - self.width
        self.y1 = 15
        self.y2 = self.y1 + self.height
        
        # Sombra y caja
        self.shadow_id = canvas.create_rectangle(
            self.x1 + 3, self.y1 + 3, self.x2 + 3, self.y2 + 3,
            fill="#090d16", outline="", tags="toast"
        )
        self.bg_id = canvas.create_rectangle(
            self.x1, self.y1, self.x2, self.y2,
            fill=cfg["bg"], outline=cfg["border"], width=2, tags="toast"
        )
        
        display_text = f" {cfg['icon']}  {message}"
        self.text_id = canvas.create_text(
            self.x1 + 15, self.y1 + self.height // 2,
            text=display_text, fill=cfg["fg"], font=("Segoe UI", 9, "bold"),
            anchor="w", tags="toast"
        )
        
        self.canvas.after(self.duration, self.dismiss)

    def dismiss(self):
        try:
            self.canvas.delete(self.shadow_id)
            self.canvas.delete(self.bg_id)
            self.canvas.delete(self.text_id)
        except tk.TclError:
            pass


class ParticleSystem:
    """Efecto de chispas/explosión al destruir tramas o ACKs en el canal."""
    def __init__(self, canvas):
        self.canvas = canvas
        self.particles = []

    def explode(self, x, y, color="#ef4444"):
        for _ in range(18):
            angle = random.uniform(0, 2 * math.pi)
            speed = random.uniform(2.5, 8.0)
            dx = math.cos(angle) * speed
            dy = math.sin(angle) * speed
            radius = random.uniform(2, 5)
            particle_id = self.canvas.create_oval(
                x - radius, y - radius, x + radius, y + radius,
                fill=color, outline="", tags="particle"
            )
            self.particles.append({
                "id": particle_id,
                "x": x, "y": y,
                "dx": dx, "dy": dy,
                "life": 1.0,
                "decay": random.uniform(0.04, 0.08)
            })

    def update(self):
        alive_particles = []
        for p in self.particles:
            p["x"] += p["dx"]
            p["y"] += p["dy"]
            p["life"] -= p["decay"]
            
            if p["life"] > 0:
                self.canvas.coords(
                    p["id"],
                    p["x"] - 3, p["y"] - 3, p["x"] + 3, p["y"] + 3
                )
                alive_particles.append(p)
            else:
                self.canvas.delete(p["id"])
        self.particles = alive_particles


class SimulatorGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Simulador Avanzado del Protocolo Stop & Wait")
        self.root.geometry("1040x740")
        self.root.minsize(960, 680)
        self.root.configure(bg="#0f172a")

        self.protocol = StopAndWaitProtocol()
        self.timer_id = None
        self.particles = None
        self.toasts = []

        # Coordenadas dinámicas de nodos y canal
        self.canvas_width = 720
        self.canvas_height = 240
        self.tx_x1 = 40
        self.tx_x2 = 180
        self.tx_y1 = 35
        self.tx_y2 = 185
        self.rx_x1 = 540
        self.rx_x2 = 680
        self.rx_y1 = 35
        self.rx_y2 = 185
        self.line_y = 110

        self._configure_styles()
        self._build_ui()
        self.particles = ParticleSystem(self.canvas)

    def _configure_styles(self):
        style = ttk.Style()
        style.theme_use("clam")
        
        self.colors = {
            "bg": "#0f172a",
            "card_bg": "#1e293b",
            "card_border": "#334155",
            "accent_tx": "#38bdf8",
            "accent_rx": "#34d399",
            "text_main": "#f8fafc",
            "text_muted": "#94a3b8",
            "btn_start": "#059669",
            "btn_pause": "#d97706",
            "btn_reset": "#475569",
            "btn_danger": "#dc2626",
            "frame_pkt": "#f59e0b",
            "ack_pkt": "#10b981"
        }

        style.configure(".", background=self.colors["bg"], foreground=self.colors["text_main"], font=("Segoe UI", 9))
        style.configure("TLabelframe", background=self.colors["card_bg"], bordercolor=self.colors["card_border"], relief="solid", borderwidth=1)
        style.configure("TLabelframe.Label", background=self.colors["card_bg"], foreground=self.colors["accent_tx"], font=("Segoe UI", 10, "bold"))
        
        style.configure("Header.TFrame", background="#1e293b")
        style.configure("HeaderTitle.TLabel", background="#1e293b", foreground="#f8fafc", font=("Segoe UI", 16, "bold"))
        style.configure("HeaderSub.TLabel", background="#1e293b", foreground="#94a3b8", font=("Segoe UI", 9))
        
        style.configure("Start.TButton", background="#059669", foreground="#ffffff", font=("Segoe UI", 9, "bold"), padding=6)
        style.map("Start.TButton", background=[("disabled", "#334155"), ("active", "#10b981")])
        
        style.configure("Pause.TButton", background="#d97706", foreground="#ffffff", font=("Segoe UI", 9, "bold"), padding=6)
        style.map("Pause.TButton", background=[("disabled", "#334155"), ("active", "#f59e0b")])
        
        style.configure("Reset.TButton", background="#475569", foreground="#ffffff", font=("Segoe UI", 9, "bold"), padding=6)
        style.map("Reset.TButton", background=[("disabled", "#334155"), ("active", "#64748b")])
        
        style.configure("Danger.TButton", background="#991b1b", foreground="#ffffff", font=("Segoe UI", 9, "bold"), padding=6)
        style.map("Danger.TButton", background=[("disabled", "#334155"), ("active", "#ef4444")])

    def _build_ui(self):
        # --- HEADER PRINCIPAL ---
        header_frame = ttk.Frame(self.root, style="Header.TFrame", padding=(20, 12))
        header_frame.pack(fill="x")
        
        title_box = ttk.Frame(header_frame, style="Header.TFrame")
        title_box.pack(side="left")
        ttk.Label(title_box, text="📡 SIMULADOR PROTOCOLO STOP & WAIT", style="HeaderTitle.TLabel").pack(anchor="w")
        ttk.Label(title_box, text="Control de Flujo, Manejo de Pérdidas y Temporizador de Espera (Timeout)", style="HeaderSub.TLabel").pack(anchor="w")
        
        # Badge de Estado
        self.status_badge = tk.Label(
            header_frame, text="● IDLE", bg="#334155", fg="#f8fafc",
            font=("Segoe UI", 10, "bold"), padx=14, pady=5, relief="flat"
        )
        self.status_badge.pack(side="right", padx=10)

        # --- CONTENEDOR PRINCIPAL ---
        main_container = ttk.Frame(self.root, padding=15)
        main_container.pack(fill="both", expand=True)

        control_frame = ttk.LabelFrame(main_container, text=" ⚙️ Configuración y Controles de Simulación ", padding=12)
        control_frame.pack(fill="x", pady=(0, 10))

        ctrl_grid = ttk.Frame(control_frame)
        ctrl_grid.pack(fill="x")

        # Inputs con TEXTO EN NEGRO (#000000) y fondo blanco
        ttk.Label(ctrl_grid, text="Total Tramas:", font=("Segoe UI", 9, "bold")).grid(row=0, column=0, padx=(5, 3), sticky="w")
        self.frames_spin = tk.Spinbox(
            ctrl_grid, from_=1, to=50, width=6,
            font=("Segoe UI", 10, "bold"),
            bg="#ffffff", fg="#000000", insertbackground="#000000",
            selectbackground="#3b82f6", selectforeground="#ffffff",
            relief="solid", bd=1
        )
        self.frames_spin.delete(0, tk.END)
        self.frames_spin.insert(0, "5")
        self.frames_spin.grid(row=0, column=1, padx=(0, 16))

        ttk.Label(ctrl_grid, text="Timeout (seg):", font=("Segoe UI", 9, "bold")).grid(row=0, column=2, padx=(5, 3), sticky="w")
        self.timeout_spin = tk.Spinbox(
            ctrl_grid, from_=2, to=30, width=6,
            font=("Segoe UI", 10, "bold"),
            bg="#ffffff", fg="#000000", insertbackground="#000000",
            selectbackground="#3b82f6", selectforeground="#ffffff",
            relief="solid", bd=1
        )
        self.timeout_spin.delete(0, tk.END)
        self.timeout_spin.insert(0, "5")
        self.timeout_spin.grid(row=0, column=3, padx=(0, 16))

        ttk.Label(ctrl_grid, text="Velocidad:", font=("Segoe UI", 9, "bold")).grid(row=0, column=4, padx=(5, 3), sticky="w")
        self.speed_scale = ttk.Scale(ctrl_grid, from_=0.5, to=3.0, value=1.0, command=self._on_speed_change, length=90)
        self.speed_scale.grid(row=0, column=5, padx=(0, 5))
        self.speed_lbl = ttk.Label(ctrl_grid, text="1.0x", font=("Segoe UI", 8, "bold"), foreground=self.colors["accent_tx"])
        self.speed_lbl.grid(row=0, column=6, padx=(0, 20))

        # Botones de Acción
        self.btn_start = ttk.Button(ctrl_grid, text="▶ Iniciar", style="Start.TButton", command=self.start_simulation)
        self.btn_start.grid(row=0, column=7, padx=4)

        self.btn_pause = ttk.Button(ctrl_grid, text="⏸ Pausar", style="Pause.TButton", command=self.pause_simulation, state="disabled")
        self.btn_pause.grid(row=0, column=8, padx=4)

        self.btn_reset = ttk.Button(ctrl_grid, text="🔄 Reiniciar", style="Reset.TButton", command=self.reset_simulation)
        self.btn_reset.grid(row=0, column=9, padx=4)

        # --- SECCIÓN MEDIA: CANVAS (CANAL) + PANEL DE TELEMETRÍA ---
        mid_frame = ttk.Frame(main_container)
        mid_frame.pack(fill="both", expand=True, pady=(0, 10))

        # Canvas Izquierda
        canvas_card = ttk.LabelFrame(mid_frame, text=" 🌐 Canal de Transmisión en Tiempo Real ", padding=10)
        canvas_card.pack(side="left", fill="both", expand=True, padx=(0, 8))

        self.canvas = tk.Canvas(canvas_card, bg="#0b1120", height=240, highlightthickness=0)
        self.canvas.pack(fill="both", expand=True)
        # Escuchar evento de cambio de tamaño del Canvas directamente para ajuste exacto
        self.canvas.bind("<Configure>", self._on_canvas_configure)

        # Panel de Telemetría Derecha
        stats_card = ttk.LabelFrame(mid_frame, text=" 📊 Telemetría y Métricas ", padding=12, width=270)
        stats_card.pack(side="right", fill="y")
        stats_card.pack_propagate(False)

        self.stat_vars = {
            "sent": tk.StringVar(value="0"),
            "acks": tk.StringVar(value="0"),
            "lost": tk.StringVar(value="0"),
            "retrans": tk.StringVar(value="0"),
            "eff": tk.StringVar(value="100.0%"),
            "time": tk.StringVar(value="0.0s")
        }

        stats_def = [
            ("📤 Tramas Enviadas:", "sent", "#38bdf8"),
            ("📥 ACKs Recibidos:", "acks", "#34d399"),
            ("💥 Paquetes Perdidos:", "lost", "#ef4444"),
            ("🔄 Retransmisiones:", "retrans", "#f59e0b"),
            ("📈 Eficiencia Enlace:", "eff", "#38bdf8"),
            ("⏱️ Tiempo Transcurrido:", "time", "#94a3b8")
        ]

        for lbl, key, color in stats_def:
            row_frame = ttk.Frame(stats_card)
            row_frame.pack(fill="x", pady=4)
            ttk.Label(row_frame, text=lbl, font=("Segoe UI", 9)).pack(side="left")
            val_label = tk.Label(row_frame, textvariable=self.stat_vars[key], fg=color, bg=self.colors["card_bg"], font=("Consolas", 11, "bold"))
            val_label.pack(side="right")

        # --- SECCIÓN INFERIOR: ACCIONES DE RED + COLA DE TRAMAS & LOGS ---
        bottom_frame = ttk.Frame(main_container)
        bottom_frame.pack(fill="x", pady=(0, 5))

        # Inyección de Fallos
        interrupt_frame = ttk.LabelFrame(bottom_frame, text=" 💥 Acciones de Red (Inyección de Fallos para Activar Timeout) ", padding=8)
        interrupt_frame.pack(fill="x", pady=(0, 8))

        self.btn_kill_frame = ttk.Button(
            interrupt_frame, text="💥 Destruir Trama en Tránsito", style="Danger.TButton",
            command=self.kill_frame, state="disabled"
        )
        self.btn_kill_frame.pack(side="left", expand=True, fill="x", padx=6)

        self.btn_kill_ack = ttk.Button(
            interrupt_frame, text="💥 Destruir ACK en Tránsito", style="Danger.TButton",
            command=self.kill_ack, state="disabled"
        )
        self.btn_kill_ack.pack(side="left", expand=True, fill="x", padx=6)

        # Cola de Tramas
        pipe_frame = ttk.LabelFrame(bottom_frame, text=" 📦 Estado de Tramas (Cola de Envío) ", padding=8)
        pipe_frame.pack(fill="x", pady=(0, 8))

        self.pipe_container = ttk.Frame(pipe_frame)
        self.pipe_container.pack(fill="x")
        self.pipe_cards = []

        # Registro de Eventos
        log_frame = ttk.LabelFrame(bottom_frame, text=" 📜 Console Event Log ", padding=6)
        log_frame.pack(fill="x")

        self.log_text = tk.Text(log_frame, height=6, bg="#090d16", fg="#cbd5e1", font=("Consolas", 9), relief="flat", highlightthickness=0)
        self.log_text.pack(fill="both", expand=True)

        self.log_text.tag_config("INFO", foreground="#38bdf8")
        self.log_text.tag_config("TX", foreground="#f59e0b")
        self.log_text.tag_config("RX", foreground="#34d399")
        self.log_text.tag_config("FAIL", foreground="#ef4444")
        self.log_text.tag_config("TIMEOUT", foreground="#f97316")
        self.log_text.tag_config("SUCCESS", foreground="#10b981")

    def _on_canvas_configure(self, event):
        """Maneja el redimensionamiento del Canvas de forma precisa (incluido pantalla completa)."""
        if event.width <= 50 or event.height <= 50:
            return
        self.canvas_width = event.width
        self.canvas_height = event.height
        
        # Recalcular posiciones responsivas de Emisor, Receptor y Canal
        self.tx_x1 = 40
        self.tx_x2 = 180
        self.rx_x2 = max(360, self.canvas_width - 40)
        self.rx_x1 = self.rx_x2 - 140
        self.line_y = 110
        
        # Redibujar elementos estáticos según el nuevo ancho
        self._draw_canvas_static()

        # Si hay un paquete activo en tránsito, actualizar su destino y limitar posición
        pkt = self.protocol.active_packet
        if pkt:
            if pkt.type == "FRAME":
                pkt.target_x = self.rx_x1
                if pkt.x > self.rx_x1:
                    pkt.x = self.rx_x1
            elif pkt.type == "ACK":
                pkt.target_x = self.tx_x2
                if pkt.x < self.tx_x2:
                    pkt.x = self.tx_x2

            self.canvas.coords(pkt.rect_id, pkt.x-20, pkt.y-14, pkt.x+20, pkt.y+14)
            self.canvas.coords(pkt.text_id, pkt.x, pkt.y)
            if pkt.glow_id:
                self.canvas.coords(pkt.glow_id, pkt.x-24, pkt.y-18, pkt.x+24, pkt.y+18)

    def _draw_canvas_static(self):
        """Dibuja o redibuja los nodos estáticos y el canal sin borrar paquetes ni partículas."""
        self.canvas.delete("static")
        
        tx_mid_x = (self.tx_x1 + self.tx_x2) // 2
        rx_mid_x = (self.rx_x1 + self.rx_x2) // 2

        # Canal físico / Medio de enlace
        self.canvas.create_rectangle(
            self.tx_x2 + 5, self.line_y - 25, self.rx_x1 - 5, self.line_y + 25,
            fill="#0f172a", outline="#1e293b", width=1, tags="static"
        )
        self.canvas.create_line(
            self.tx_x2 + 10, self.line_y, self.rx_x1 - 10, self.line_y,
            fill="#334155", dash=(6, 4), width=2, tags="static"
        )

        # Nodo EMISOR (Tx)
        self.canvas.create_rectangle(self.tx_x1 + 3, self.tx_y1 + 3, self.tx_x2 + 3, self.tx_y2 + 3, fill="#050b14", outline="", tags="static")
        self.canvas.create_rectangle(self.tx_x1, self.tx_y1, self.tx_x2, self.tx_y2, fill="#1e293b", outline=self.colors["accent_tx"], width=2, tags="static")
        self.canvas.create_text(tx_mid_x, self.tx_y1 + 22, text="EMISOR (Tx)", fill=self.colors["accent_tx"], font=("Segoe UI", 11, "bold"), tags="static")

        p = self.protocol
        tx_state_str = "IDLE"
        if p.is_running:
            if p.is_waiting_timeout:
                tx_state_str = "ESPERANDO ACK"
            elif p.state == "TIMEOUT":
                tx_state_str = "TIMEOUT - REINTENTO"
            elif p.state == "TRANSMITTING":
                tx_state_str = "TRANSMITIENDO"

        self.tx_seq_text = self.canvas.create_text(tx_mid_x, self.tx_y1 + 52, text=f"Seq Num: {p.seq_num}", fill="#f8fafc", font=("Segoe UI", 9), tags="static")
        self.tx_state_text = self.canvas.create_text(tx_mid_x, self.tx_y1 + 75, text=f"Estado: {tx_state_str}", fill="#94a3b8", font=("Segoe UI", 8, "italic"), tags="static")
        
        timer_text = "⏱️ Timer: Off"
        timer_color = "#64748b"
        if p.is_waiting_timeout:
            timer_text = f"⏱️ Espera: {p.timer_counter}s"
            timer_color = "#f59e0b" if p.timer_counter > 2 else "#ef4444"
        elif p.is_running:
            timer_text = "⏱️ Timer: Standby"
            timer_color = "#38bdf8"

        self.timer_label = self.canvas.create_text(tx_mid_x, self.tx_y1 + 115, text=timer_text, fill=timer_color, font=("Consolas", 10, "bold"), tags="static")

        # Nodo RECEPTOR (Rx)
        self.canvas.create_rectangle(self.rx_x1 + 3, self.rx_y1 + 3, self.rx_x2 + 3, self.rx_y2 + 3, fill="#050b14", outline="", tags="static")
        self.canvas.create_rectangle(self.rx_x1, self.rx_y1, self.rx_x2, self.rx_y2, fill="#1e293b", outline=self.colors["accent_rx"], width=2, tags="static")
        self.canvas.create_text(rx_mid_x, self.rx_y1 + 22, text="RECEPTOR (Rx)", fill=self.colors["accent_rx"], font=("Segoe UI", 11, "bold"), tags="static")

        self.rx_seq_text = self.canvas.create_text(rx_mid_x, self.rx_y1 + 55, text=f"Espera Seq: {p.rx_expected_seq}", fill="#f8fafc", font=("Segoe UI", 9), tags="static")
        self.rx_count_text = self.canvas.create_text(rx_mid_x, self.rx_y1 + 85, text=f"Recibidas: {p.rx_received_count}", fill="#94a3b8", font=("Segoe UI", 9), tags="static")

    def _update_pipeline_ui(self):
        """Actualiza la visualización de la cola de tramas."""
        for widget in self.pipe_container.winfo_children():
            widget.destroy()

        self.pipe_cards = []
        p = self.protocol
        for i in range(p.total_frames):
            bg = "#1e293b"
            fg = "#94a3b8"
            status_symbol = "⏳"

            if i < p.current_frame_idx:
                bg = "#064e3b"
                fg = "#34d399"
                status_symbol = "✓"
            elif i == p.current_frame_idx and p.is_running:
                if p.is_waiting_timeout:
                    bg = "#78350f"
                    fg = "#f59e0b"
                    status_symbol = "⌛"
                elif p.state == "TIMEOUT":
                    bg = "#7f1d1d"
                    fg = "#ef4444"
                    status_symbol = "🔄"
                else:
                    bg = "#1e3a8a"
                    fg = "#60a5fa"
                    status_symbol = "✈️"

            card = tk.Frame(self.pipe_container, bg=bg, bd=1, relief="solid")
            card.pack(side="left", padx=3, pady=2, expand=True, fill="x")
            
            lbl = tk.Label(card, text=f"Trama #{i+1}\n{status_symbol}", bg=bg, fg=fg, font=("Segoe UI", 8, "bold"))
            lbl.pack(padx=6, pady=4)
            self.pipe_cards.append(card)

    def _toast(self, message, toast_type="INFO"):
        t = ToastNotification(self.canvas, message, toast_type=toast_type)
        self.toasts.append(t)

    def _on_speed_change(self, val):
        speed = float(val)
        self.speed_lbl.config(text=f"{speed:.1f}x")
        self.protocol.speed_multiplier = speed

    def log(self, message, tag="INFO"):
        timestamp = time.strftime("[%H:%M:%S] ")
        self.log_text.insert(tk.END, timestamp, "INFO")
        self.log_text.insert(tk.END, f"{message}\n", tag)
        self.log_text.see(tk.END)

    def update_badge(self, text, bg):
        self.status_badge.config(text=f"● {text}", bg=bg)

    def update_telemetry(self):
        p = self.protocol
        self.stat_vars["sent"].set(str(p.frames_sent))
        self.stat_vars["acks"].set(str(p.acks_received))
        self.stat_vars["lost"].set(str(p.total_lost))
        self.stat_vars["retrans"].set(str(p.retransmissions))
        self.stat_vars["eff"].set(f"{p.efficiency}%")
        self.stat_vars["time"].set(f"{p.elapsed_time}s")
        self._update_pipeline_ui()

    def start_simulation(self):
        p = self.protocol
        if not p.is_running:
            if p.active_packet is None and p.current_frame_idx == 0 and not p.is_waiting_timeout:
                try:
                    p.total_frames = int(self.frames_spin.get())
                    p.timeout_duration = int(self.timeout_spin.get())
                except ValueError:
                    messagebox.showerror("Error de Parámetro", "Ingresa números válidos para tramas y timeout.")
                    return
                
                p.reset_stats()
                p.total_frames = int(self.frames_spin.get())
                p.timeout_duration = int(self.timeout_spin.get())
                p.start_time = time.time()
                
                self.log(f"--- SIMULACIÓN INICIADA: {p.total_frames} Tramas a transmitir (Timeout por pérdida: {p.timeout_duration}s) ---", "INFO")
                self._toast(f"Simulación iniciada: {p.total_frames} tramas", "INFO")
                self.send_frame()

            p.is_running = True
            if p.is_waiting_timeout:
                self.update_badge("ESPERANDO ACK", "#f59e0b")
                self._resume_timeout_timer()
            else:
                p.state = "TRANSMITTING"
                self.update_badge("TRANSMITIENDO", "#059669")

            self.btn_start.config(state="disabled")
            self.frames_spin.config(state="disabled", disabledbackground="#e2e8f0", disabledforeground="#475569")
            self.timeout_spin.config(state="disabled", disabledbackground="#e2e8f0", disabledforeground="#475569")
            self.btn_pause.config(state="normal")
            self.update_action_buttons()
            self.animate()

    def pause_simulation(self):
        self.protocol.is_running = False
        if self.timer_id:
            self.root.after_cancel(self.timer_id)
            self.timer_id = None

        self.update_badge("PAUSADO", "#d97706")
        self.btn_start.config(state="normal")
        self.btn_pause.config(state="disabled")
        self.update_action_buttons()
        self.log("⏸ Simulación pausada por el usuario.", "INFO")
        self._toast("Simulación pausada", "WARNING")

    def reset_simulation(self):
        self.pause_simulation()
        if self.timer_id:
            self.root.after_cancel(self.timer_id)
            self.timer_id = None

        p = self.protocol
        if p.active_packet:
            self.canvas.delete(p.active_packet.rect_id)
            self.canvas.delete(p.active_packet.text_id)
            if p.active_packet.glow_id:
                self.canvas.delete(p.active_packet.glow_id)
            p.active_packet = None

        p.reset_stats()
        self.update_badge("IDLE", "#334155")
        self._draw_canvas_static()
        self.log_text.delete("1.0", tk.END)
        self.frames_spin.config(state="normal", bg="#ffffff", fg="#000000")
        self.timeout_spin.config(state="normal", bg="#ffffff", fg="#000000")
        self.update_action_buttons()
        self.update_telemetry()
        self.log("🔄 Simulación e indicadores reiniciados.", "INFO")
        self._toast("Simulación reiniciada", "INFO")

    def send_frame(self):
        p = self.protocol
        if p.current_frame_idx >= p.total_frames:
            p.end_time = time.time()
            p.state = "FINISHED"
            p.is_waiting_timeout = False
            self.update_badge("COMPLETADO", "#2563eb")
            self.log("🎉 ¡Transmisión exitosa de TODAS las tramas!", "SUCCESS")
            self._toast("¡Simulación completada con éxito!", "SUCCESS")
            self.pause_simulation()
            self.btn_start.config(state="disabled")
            return

        p.frames_sent += 1
        p.state = "TRANSMITTING"
        p.is_waiting_timeout = False

        x = self.tx_x2
        y = self.line_y
        target_x = self.rx_x1

        glow = self.canvas.create_rectangle(x-24, y-18, x+24, y+18, fill="#78350f", outline="#fbbf24", width=2, tags="packet")
        rect = self.canvas.create_rectangle(x-20, y-14, x+20, y+14, fill=self.colors["frame_pkt"], outline="#ffffff", tags="packet")
        text = self.canvas.create_text(x, y, text=f"F:{p.seq_num}", fill="#0f172a", font=("Segoe UI", 9, "bold"), tags="packet")

        pkt = Packet("FRAME", p.seq_num, x, y, target_x, frame_idx=p.current_frame_idx)
        pkt.rect_id = rect
        pkt.text_id = text
        pkt.glow_id = glow
        p.active_packet = pkt

        self.update_badge("TRANSMITIENDO", "#059669")
        self.canvas.itemconfig(self.tx_state_text, text="Estado: Enviando Trama", fill=self.colors["accent_tx"])
        self.canvas.itemconfig(self.tx_seq_text, text=f"Seq Num: {p.seq_num}")
        self.canvas.itemconfig(self.timer_label, text="⏱️ Timer: Standby", fill="#38bdf8")

        self.log(f"Emisor ➔ Enviando Trama #{p.current_frame_idx + 1} (Seq={p.seq_num})", "TX")
        self._toast(f"Trama #{p.current_frame_idx + 1} enviada (Seq={p.seq_num})", "INFO")
        self.update_action_buttons()
        self.update_telemetry()

    def send_ack(self):
        p = self.protocol
        x = self.rx_x1
        y = self.line_y
        target_x = self.tx_x2
        next_seq = p.next_seq()

        glow = self.canvas.create_rectangle(x-24, y-18, x+24, y+18, fill="#064e3b", outline="#34d399", width=2, tags="packet")
        rect = self.canvas.create_rectangle(x-20, y-14, x+20, y+14, fill=self.colors["ack_pkt"], outline="#ffffff", tags="packet")
        text = self.canvas.create_text(x, y, text=f"ACK:{next_seq}", fill="#0f172a", font=("Segoe UI", 9, "bold"), tags="packet")

        pkt = Packet("ACK", next_seq, x, y, target_x)
        pkt.rect_id = rect
        pkt.text_id = text
        pkt.glow_id = glow
        p.active_packet = pkt

        self.log(f"Receptor ➔ Trama aceptada. Enviando ACK (Espera Seq={next_seq})", "RX")
        self.update_action_buttons()
        self.update_telemetry()

    def kill_frame(self):
        """Inyección de pérdida de trama: Simula la pérdida en el canal y activa el timeout."""
        p = self.protocol
        if p.active_packet and p.active_packet.type == "FRAME":
            p.frames_lost += 1
            pkt = p.active_packet
            self.particles.explode(pkt.x, pkt.y, color="#ef4444")
            
            self.canvas.delete(pkt.rect_id)
            self.canvas.delete(pkt.text_id)
            if pkt.glow_id:
                self.canvas.delete(pkt.glow_id)
            p.active_packet = None
            
            self.log(f"💥 RED: ¡Trama #{pkt.frame_idx + 1} perdida en el canal! Emisor entra en espera...", "FAIL")
            self._toast(f"¡Trama #{pkt.frame_idx + 1} destruida! Emisor esperando ACK...", "DANGER")
            self.update_action_buttons()
            self.update_telemetry()

            # El protocolo entra en espera por pérdida: inicia la cuenta atrás del Timeout
            self._start_loss_timeout()

    def kill_ack(self):
        """Inyección de pérdida de ACK: Simula la pérdida en el canal y activa el timeout."""
        p = self.protocol
        if p.active_packet and p.active_packet.type == "ACK":
            p.acks_lost += 1
            pkt = p.active_packet
            self.particles.explode(pkt.x, pkt.y, color="#f97316")
            
            self.canvas.delete(pkt.rect_id)
            self.canvas.delete(pkt.text_id)
            if pkt.glow_id:
                self.canvas.delete(pkt.glow_id)
            p.active_packet = None

            self.log("💥 RED: ¡ACK destruido en el canal! Emisor entra en espera de respuesta...", "FAIL")
            self._toast("¡ACK destruido! Emisor esperando respuesta...", "DANGER")
            self.update_action_buttons()
            self.update_telemetry()

            # El protocolo entra en espera por pérdida: inicia la cuenta atrás del Timeout
            self._start_loss_timeout()

    def _start_loss_timeout(self):
        """Inicia el temporizador de espera tras la pérdida de una trama o ACK."""
        p = self.protocol
        p.is_waiting_timeout = True
        p.state = "WAITING_ACK"
        p.timer_counter = p.timeout_duration
        
        self.update_badge("ESPERANDO ACK", "#f59e0b")
        self.canvas.itemconfig(self.tx_state_text, text="Estado: Esperando ACK (Pérdida en canal)", fill="#f59e0b")
        self._timeout_tick()

    def _resume_timeout_timer(self):
        """Reanuda el temporizador de espera si estaba pausado."""
        self._timeout_tick()

    def _timeout_tick(self):
        """Cuenta regresiva del temporizador de espera que actúa tras la pérdida."""
        p = self.protocol
        if not p.is_running or not p.is_waiting_timeout:
            return

        if p.timer_counter > 0:
            color = "#f59e0b" if p.timer_counter > 2 else "#ef4444"
            self.canvas.itemconfig(self.timer_label, text=f"⏱️ Timeout en: {p.timer_counter}s", fill=color)
            p.timer_counter -= 1
            delay = int(1000 / p.speed_multiplier)
            self.timer_id = self.root.after(delay, self._timeout_tick)
        else:
            # TIEMPO AGOTADO: Se reintenta el envío según el protocolo Stop and Wait
            p.state = "TIMEOUT"
            p.retransmissions += 1
            p.is_waiting_timeout = False
            
            self.update_badge("TIMEOUT", "#ef4444")
            self.canvas.itemconfig(self.timer_label, text="⏱️ Timer: ¡EXPIRED!", fill="#ef4444")
            self.canvas.itemconfig(self.tx_state_text, text=f"Estado: Retransmitiendo Trama #{p.current_frame_idx + 1}", fill="#ef4444")
            
            self.log(f"⏰ TIMEOUT: Tiempo de espera agotado sin recibir ACK tras pérdida. Reintentando Trama #{p.current_frame_idx + 1} (Seq={p.seq_num})...", "TIMEOUT")
            self._toast(f"¡Timeout! Reintentando envío de Trama #{p.current_frame_idx + 1}", "WARNING")
            
            self.update_telemetry()
            self.send_frame()

    def update_action_buttons(self):
        p = self.protocol
        has_frame = p.is_running and p.active_packet and p.active_packet.type == "FRAME"
        has_ack = p.is_running and p.active_packet and p.active_packet.type == "ACK"

        self.btn_kill_frame.config(state="normal" if has_frame else "disabled")
        self.btn_kill_ack.config(state="normal" if has_ack else "disabled")

    def animate(self):
        p = self.protocol
        if self.particles:
            self.particles.update()

        if p.is_running:
            pkt = p.active_packet
            if pkt:
                base_speed = 5.5 * p.speed_multiplier
                speed = base_speed if pkt.type == "FRAME" else -base_speed
                pkt.x += speed
                
                self.canvas.coords(pkt.rect_id, pkt.x-20, pkt.y-14, pkt.x+20, pkt.y+14)
                self.canvas.coords(pkt.text_id, pkt.x, pkt.y)
                if pkt.glow_id:
                    self.canvas.coords(pkt.glow_id, pkt.x-24, pkt.y-18, pkt.x+24, pkt.y+18)

                # Llegada de la Trama al Receptor (compara contra el límite real del Receptor)
                if pkt.type == "FRAME" and pkt.x >= self.rx_x1:
                    self.canvas.delete(pkt.rect_id)
                    self.canvas.delete(pkt.text_id)
                    if pkt.glow_id:
                        self.canvas.delete(pkt.glow_id)
                    p.active_packet = None
                    
                    # Verificación de secuencia en el receptor (Stop & Wait)
                    if pkt.seq == p.rx_expected_seq:
                        p.rx_received_count += 1
                        p.rx_expected_seq = p.next_seq()
                        self.canvas.itemconfig(self.rx_count_text, text=f"Recibidas: {p.rx_received_count}")
                        self.canvas.itemconfig(self.rx_seq_text, text=f"Espera Seq: {p.rx_expected_seq}")
                    else:
                        # Trama duplicada (ej. por pérdida del ACK anterior)
                        self.log(f"Receptor ➔ Trama duplicada (Seq={pkt.seq}). Descartada y reenviando ACK...", "INFO")
                    
                    self.canvas.itemconfig(self.tx_state_text, text="Estado: Esperando ACK", fill=self.colors["accent_rx"])
                    self.send_ack()

                # Llegada del ACK al Emisor (compara contra el límite real del Emisor)
                elif pkt.type == "ACK" and pkt.x <= self.tx_x2:
                    self.canvas.delete(pkt.rect_id)
                    self.canvas.delete(pkt.text_id)
                    if pkt.glow_id:
                        self.canvas.delete(pkt.glow_id)
                    p.active_packet = None

                    if self.timer_id:
                        self.root.after_cancel(self.timer_id)
                        self.timer_id = None
                    
                    p.is_waiting_timeout = False
                    self.canvas.itemconfig(self.timer_label, text="⏱️ Timer: ACK OK", fill="#34d399")

                    p.acks_received += 1
                    self.log(f"Emisor ➔ ACK recibido con éxito. Trama #{p.current_frame_idx + 1} confirmada.", "SUCCESS")
                    self._toast(f"ACK recibido. Trama #{p.current_frame_idx + 1} confirmada", "SUCCESS")
                    
                    p.seq_num = p.next_seq()
                    p.current_frame_idx += 1
                    self.update_telemetry()
                    
                    delay = int(600 / p.speed_multiplier)
                    self.root.after(delay, self.send_frame)

        self.root.after(30, self.animate)