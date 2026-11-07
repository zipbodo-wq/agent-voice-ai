#!/usr/bin/env python3
"""
Maya 2 Native - Free Local Avengers Voice Cloning Server
Open-source (Apache-2.0) Zero-cost Voice Cloning for Hindi (hi) & Odia (or).
Runs on port 8766.
"""

import os
import sys
import json
import time
import base64
import wave
import io
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("MAYA_PORT", 8766))
WORKSPACE_DIR = os.path.dirname(os.path.abspath(__file__))
CLONE_STORAGE_DIR = os.path.join(WORKSPACE_DIR, "cloned_voices")
os.makedirs(CLONE_STORAGE_DIR, exist_ok=True)

# Global Maya Model Instance
MAYA_MODEL = None
MAYA_STATUS = "initializing"
CUDA_READY = False
ERROR_DETAILS = None

def check_and_load_maya():
    """Attempt loading Maya 2 Native model with CUDA acceleration."""
    global MAYA_MODEL, MAYA_STATUS, CUDA_READY, ERROR_DETAILS
    try:
        import torch
        CUDA_READY = torch.cuda.is_available()
        if not CUDA_READY:
            print("[MAYA-2 NOTICE] CUDA is not currently active on this device. Maya 2 Native requires NVIDIA GPU with 12GB+ VRAM.")

        try:
            from maya3 import Maya3TTS
            print("[MAYA-2] Loading Maya 2 Native model from 'maya-research/maya2-native'...")
            MAYA_MODEL = Maya3TTS.from_pretrained("maya-research/maya2-native", max_seats=1)
            MAYA_STATUS = "ready"
            print("[MAYA-2] ✓ Model loaded and initialized successfully!")
        except ImportError:
            MAYA_STATUS = "package_missing"
            ERROR_DETAILS = 'Run: pip install "maya3[server] @ git+https://github.com/MayaResearch/maya2-native" --extra-index-url https://download.pytorch.org/whl/cu128'
            print(f"[MAYA-2 NOTICE] Maya3 package not installed.\n{ERROR_DETAILS}")
    except Exception as ex:
        MAYA_STATUS = "init_failed"
        ERROR_DETAILS = str(ex)
        print(f"[MAYA-2 NOTICE] Initialization note: {ex}")

def generate_fallback_wav(sample_rate=24000, duration_sec=1.5, freq=440):
    """Generates standard PCM WAV audio for standby/testing verification."""
    import math
    import struct
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        total_samples = int(sample_rate * duration_sec)
        for i in range(total_samples):
            # Synthesize tone with fade-in/fade-out
            t = float(i) / sample_rate
            amplitude = 16000 * min(1.0, min(t * 10, (duration_sec - t) * 10))
            val = int(amplitude * math.sin(2.0 * math.pi * freq * t))
            wf.writeframesraw(struct.pack('<h', val))
    return buf.getvalue()

class MayaServerHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(200)

    def log_message(self, format, *args):
        sys.stdout.write(f"[MAYA SERVER {time.strftime('%H:%M:%S')}] {format % args}\n")
        sys.stdout.flush()

    def do_GET(self):
        path = self.path.split('?')[0]
        if path == "/" or path == "/health" or path == "/status":
            payload = {
                "success": True,
                "server": "Maya 2 Native Local Voice Cloning Server",
                "port": PORT,
                "model_status": MAYA_STATUS,
                "cuda_available": CUDA_READY,
                "instructions": ERROR_DETAILS or "Ready for Indian voice cloning (Hindi & Odia)"
            }
            self._set_headers(200)
            self.wfile.write(json.dumps(payload, indent=2).encode("utf-8"))
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode("utf-8"))

    def do_POST(self):
        path = self.path.split('?')[0]
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"

        try:
            data = json.loads(body)
        except Exception as e:
            self._set_headers(400)
            self.wfile.write(json.dumps({"success": False, "error": f"Invalid JSON: {str(e)}"}).encode("utf-8"))
            return

        if path == "/tts/clone":
            # Endpoint: /tts/clone
            # Body: {"text": "...", "lang": "hi" | "or", "ref_audio_path": "...", "ref_text": "..."}
            text = data.get("text", "").strip()
            lang = data.get("lang", data.get("language", "hi")).strip().lower()
            ref_audio_path = data.get("ref_audio_path", "")
            ref_text = data.get("ref_text", "")
            ref_audio_b64 = data.get("ref_audio_b64", "")

            if not text:
                self._set_headers(400)
                self.wfile.write(json.dumps({"success": False, "error": "Missing 'text' parameter."}).encode("utf-8"))
                return

            # Normalize lang code to 'hi' or 'or'
            if "od" in lang or "or" in lang:
                target_lang = "or"
            else:
                target_lang = "hi"

            # Handle base64 audio upload if passed from browser
            temp_ref_path = None
            if ref_audio_b64:
                try:
                    mime = "audio/wav"
                    if ";" in ref_audio_b64 and ":" in ref_audio_b64:
                        mime = ref_audio_b64.split(";")[0].split(":")[1].lower()
                    ext = "mp3" if ("mpeg" in mime or "mp3" in mime) else "wav"
                    temp_ref_path = os.path.join(CLONE_STORAGE_DIR, f"ref_{int(time.time()*1000)}.{ext}")
                    with open(temp_ref_path, "wb") as f:
                        f.write(base64.b64decode(ref_audio_b64.split(",")[-1]))
                    ref_audio_path = temp_ref_path
                except Exception as ex:
                    self.log_message(f"Ref audio decode error: {ex}")

            # If real Maya model is loaded, execute neural voice cloning
            if MAYA_MODEL is not None and hasattr(MAYA_MODEL, 'generate'):
                try:
                    start_t = time.time()
                    audio_out = MAYA_MODEL.generate(
                        text,
                        lang=target_lang,
                        ref_audio=ref_audio_path,
                        ref_text=ref_text,
                        ref_lang=target_lang
                    )
                    self.log_message(f"Cloned audio synthesized in {round(time.time() - start_t, 2)}s")
                    self._set_headers(200, content_type="audio/wav")
                    self.wfile.write(audio_out)
                    return
                except Exception as ex:
                    self.log_message(f"Maya synthesis error: {ex}")
                    self._set_headers(500)
                    self.wfile.write(json.dumps({
                        "success": False,
                        "error": "Maya synthesis failed",
                        "detail": str(ex)
                    }).encode("utf-8"))
                    return
            else:
                self._set_headers(501)
                self.wfile.write(json.dumps({
                    "success": False,
                    "error": "Maya 2 Native not loaded",
                    "detail": ERROR_DETAILS,
                    "note": "Install maya3 package and run on an NVIDIA GPU."
                }).encode("utf-8"))
                return

        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode("utf-8"))

def run_server():
    print("=" * 68)
    print(" 🎙️  MAYA 2 NATIVE LOCAL AVENGERS VOICE CLONING SERVER")
    print(f" Serving on http://127.0.0.1:{PORT}")
    print(" Supported Languages: Hindi (hi), Odia (or)")
    print("=" * 68)
    check_and_load_maya()
    allow_lan = os.environ.get("ALLOW_LAN", "0") == "1"
    bind_host = "0.0.0.0" if allow_lan else "127.0.0.1"
    server = HTTPServer((bind_host, PORT), MayaServerHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[MAYA SERVER] Stopping server...")
        server.server_close()

if __name__ == "__main__":
    run_server()

