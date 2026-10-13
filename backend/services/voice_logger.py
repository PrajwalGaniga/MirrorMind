import os
import time
from datetime import datetime

LOG_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "logs"))
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOG_DIR, "voice_live.log")

class VoiceLogger:
    def __init__(self):
        self.log_file = LOG_FILE
        self._ensure_log_file()

    def _ensure_log_file(self):
        if not os.path.exists(self.log_file):
            with open(self.log_file, "w", encoding="utf-8") as f:
                f.write(f"# MirrorMind Live Voice WebSocket Timing Logs\n# Created: {datetime.utcnow().isoformat()}\n\n")

    def log(self, category: str, message: str, elapsed_ms: float = None, metadata: dict = None):
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        elapsed_str = f" [+{elapsed_ms:.1f}ms]" if elapsed_ms is not None else ""
        meta_str = f" | {metadata}" if metadata else ""
        log_line = f"[{now_str}] [{category.upper()}]{elapsed_str} {message}{meta_str}\n"

        print(log_line, end="")
        try:
            with open(self.log_file, "a", encoding="utf-8") as f:
                f.write(log_line)
        except Exception as e:
            print(f"[VOICE_LOGGER_ERROR] Failed to write log: {e}")

voice_logger = VoiceLogger()
