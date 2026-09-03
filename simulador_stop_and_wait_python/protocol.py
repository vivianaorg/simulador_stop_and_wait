# protocol.py
import time

class Packet:
    def __init__(self, packet_type, seq_num, x, y, target_x, frame_idx=0):
        self.type = packet_type  # "FRAME" o "ACK"
        self.seq = seq_num        # 0 o 1
        self.x = x
        self.y = y
        self.target_x = target_x
        self.frame_idx = frame_idx
        self.rect_id = None
        self.text_id = None
        self.glow_id = None

class StopAndWaitProtocol:
    def __init__(self, total_frames=5, timeout_duration=5):
        self.total_frames = total_frames
        self.timeout_duration = timeout_duration  # seconds
        self.current_frame_idx = 0
        self.seq_num = 0
        self.rx_expected_seq = 0
        self.rx_received_count = 0
        self.is_running = False
        self.is_waiting_timeout = False
        self.active_packet = None
        self.timer_counter = 0
        self.state = "IDLE"  # IDLE, TRANSMITTING, WAITING_ACK, TIMEOUT, PAUSED, FINISHED
        self.speed_multiplier = 1.0

        # Telemetry Stats
        self.frames_sent = 0
        self.acks_received = 0
        self.frames_lost = 0
        self.acks_lost = 0
        self.retransmissions = 0
        self.start_time = None
        self.end_time = None

    def next_seq(self):
        return (self.seq_num + 1) % 2

    def reset_stats(self):
        self.current_frame_idx = 0
        self.seq_num = 0
        self.rx_expected_seq = 0
        self.rx_received_count = 0
        self.is_running = False
        self.is_waiting_timeout = False
        self.active_packet = None
        self.timer_counter = 0
        self.state = "IDLE"
        self.frames_sent = 0
        self.acks_received = 0
        self.frames_lost = 0
        self.acks_lost = 0
        self.retransmissions = 0
        self.start_time = None
        self.end_time = None

    @property
    def total_lost(self):
        return self.frames_lost + self.acks_lost

    @property
    def efficiency(self):
        if self.frames_sent == 0:
            return 100.0
        # Efficiency = successful delivered frames / total transmissions
        return round((self.current_frame_idx / self.frames_sent) * 100, 1)

    @property
    def elapsed_time(self):
        if self.start_time is None:
            return 0.0
        end = self.end_time if self.end_time else time.time()
        return round(end - self.start_time, 1)