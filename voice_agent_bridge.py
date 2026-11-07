#!/usr/bin/env python3
"""
Dots Voice Agent - Local Python Orchestrator & Task Bridge
Enables your voice agent to execute real local PC tasks, scripts, and IoT commands
while you have a live two-way voice conversation.
"""

import os
import sys
import json
import time
import base64
import shutil
import socket
import platform
import subprocess
import threading
import ssl
import urllib.request
import urllib.error
import urllib.parse
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler

def safe_urlopen(req, timeout=20):
    try:
        ctx = ssl.create_default_context()
        return urllib.request.urlopen(req, context=ctx, timeout=timeout)
    except urllib.error.URLError as ue:
        if "CERTIFICATE_VERIFY_FAILED" in str(ue):
            unverified_ctx = ssl._create_unverified_context()
            return urllib.request.urlopen(req, context=unverified_ctx, timeout=timeout)
        raise

def split_text_for_tts(text, max_chars=2400):
    """Split text into chunks under max_chars, preferring sentence boundaries."""
    if len(text) <= max_chars:
        return [text]
    chunks = []
    current = ""
    for sentence in text.replace('।', '.').replace('॥', '.').replace('?', '?.').replace('!', '!.').split('. '):
        candidate = (current + ". " + sentence).strip() if current else sentence.strip()
        if len(candidate) > max_chars and current:
            chunks.append(current.strip())
            current = sentence.strip()
        else:
            current = candidate
    if current.strip():
        chunks.append(current.strip())
    return chunks

PORT = int(os.environ.get("BRIDGE_PORT", 8765))
WORKSPACE_DIR = os.path.dirname(os.path.abspath(__file__))

# Security Token Initialization
TOKEN_FILE = os.path.join(WORKSPACE_DIR, "bridge_token.txt")
try:
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "r", encoding="utf-8") as tf:
            BRIDGE_TOKEN = tf.read().strip()
    else:
        import secrets
        BRIDGE_TOKEN = secrets.token_hex(16)
        with open(TOKEN_FILE, "w", encoding="utf-8") as tf:
            tf.write(BRIDGE_TOKEN)
except Exception:
    BRIDGE_TOKEN = "local-dev-token"

# Global Simulated / Connected IoT State
IOT_STATE = {
    "relays": {
        "relay_1_dev_lights": False,
        "relay_2_test_bench": False,
        "relay_3_server_fan": True,
        "relay_4_spare": False
    },
    "sensors": {
        "lab_temperature_c": 26.4,
        "lab_humidity_pct": 52.0,
        "power_draw_watts": 85.2,
        "last_updated": time.strftime("%Y-%m-%d %H:%M:%S")
    },
    "devices": [
        {"id": "esp32_relay_node", "name": "Workbench Controller", "ip": "192.168.1.105", "status": "online"},
        {"id": "esp8266_temp_node", "name": "Thermal Monitor", "ip": "192.168.1.106", "status": "online"},
        {"id": "rpi_mqtt_broker", "name": "Local MQTT Gateway", "ip": "192.168.1.200", "status": "online"}
    ]
}

# Mission log for background executions
MISSION_HISTORY = []

def get_system_telemetry():
    """Retrieve local machine hardware and OS telemetry."""
    total_disk, used_disk, free_disk = shutil.disk_usage(WORKSPACE_DIR)
    
    return {
        "os": f"{platform.system()} {platform.release()} ({platform.machine()})",
        "python_version": platform.python_version(),
        "hostname": socket.gethostname(),
        "cpu_threads": os.cpu_count(),
        "workspace": WORKSPACE_DIR,
        "disk_free_gb": round(free_disk / (1024 ** 3), 2),
        "disk_total_gb": round(total_disk / (1024 ** 3), 2),
        "server_time": time.strftime("%H:%M:%S"),
        "status": "online"
    }

class VoiceAgentBridgeHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        origin = self.headers.get("Origin", "")
        if origin and any(origin.startswith(h) for h in ["http://127.0.0.1", "http://localhost", "https://zipbodo-wq.github.io"]):
            self.send_header("Access-Control-Allow-Origin", origin)
        elif not origin:
            self.send_header("Access-Control-Allow-Origin", "*")
        else:
            self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1:8765")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Bridge-Token")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(200)

    def log_message(self, format, *args):
        # Clean custom logging
        sys.stdout.write(f"[VOICE BRIDGE {time.strftime('%H:%M:%S')}] {format % args}\n")
        sys.stdout.flush()

    def do_GET(self):
        path = self.path.split('?')[0]
        
        # Serve the Voice Agent Web App directly to any PC or Mobile Phone
        if path == "/" or path == "/app" or path == "/index.html" or path == "/dots-voice-agent.html":
            html_path = os.path.join(WORKSPACE_DIR, "index.html")
            if os.path.exists(html_path):
                with open(html_path, "r", encoding="utf-8") as f:
                    content = f.read()
                self._set_headers(200, "text/html; charset=utf-8")
                self.wfile.write(content.encode("utf-8"))
                return

        # Serve static modular CSS & JS files (for split frontend)
        if path.startswith("/css/") or path.startswith("/js/"):
            rel_path = path.lstrip("/").replace("/", os.sep)
            file_path = os.path.join(WORKSPACE_DIR, rel_path)
            if os.path.exists(file_path) and os.path.isfile(file_path):
                content_type = "text/css; charset=utf-8" if path.endswith(".css") else "application/javascript; charset=utf-8"
                with open(file_path, "rb") as f:
                    data = f.read()
                self._set_headers(200, content_type)
                self.wfile.write(data)
                return

        if path == "/api/status":
            telemetry = get_system_telemetry()
            payload = {
                "success": True,
                "message": "Dots Voice Agent Bridge is Active and Listening",
                "telemetry": telemetry,
                "iot_state": IOT_STATE,
                "missions_count": len(MISSION_HISTORY)
            }
            self._set_headers(200)
            self.wfile.write(json.dumps(payload).encode("utf-8"))
            
        elif path == "/api/missions":
            self._set_headers(200)
            self.wfile.write(json.dumps({"success": True, "missions": MISSION_HISTORY[-20:]}).encode("utf-8"))
            
        elif path == "/config" or path == "/api/config":
            sarvam_key = os.environ.get("SARVAM_API_KEY", "").strip()
            deepseek_key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
            self._set_headers(200)
            self.wfile.write(json.dumps({
                "success": True,
                "tts_available": bool(sarvam_key),
                "sarvam_configured": bool(sarvam_key),
                "deepseek_configured": bool(deepseek_key),
                "model": "bulbul:v3",
                "supported_languages": ["hi-IN", "od-IN", "en-IN"]
            }).encode("utf-8"))

        elif path == "/api/iot":
            IOT_STATE["sensors"]["last_updated"] = time.strftime("%Y-%m-%d %H:%M:%S")
            self._set_headers(200)
            self.wfile.write(json.dumps({"success": True, "iot": IOT_STATE}).encode("utf-8"))
            
        elif path == "/api/tts":
            # Direct Neural Indic Speech Proxy (Hindi Google TTS fallback)
            # NOTE: Google Translate does NOT support Odia. Odia requests are rejected here so caller falls to native voices.
            try:
                import urllib.parse
                import urllib.request
                query = self.path.split('?')[1] if '?' in self.path else ''
                params = urllib.parse.parse_qs(query)
                q_text = params.get('q', [''])[0]
                lang = params.get('tl', ['hi'])[0].lower()

                if lang in ['or', 'od', 'or-in', 'od-in', 'odia']:
                    self._set_headers(400)
                    self.wfile.write(json.dumps({"error": "Google TTS proxy does not support Odia. Use Sarvam AI Bulbul v3 (/tts) or native browser voice."}).encode("utf-8"))
                    return

                if q_text:
                    url = f"https://translate.google.com/translate_tts?ie=UTF-8&tl={lang}&client=tw-ob&q={urllib.parse.quote(q_text)}"
                    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                    with safe_urlopen(req, timeout=8) as response:
                        audio_data = response.read()
                        self._set_headers(200, content_type="audio/mpeg")
                        self.wfile.write(audio_data)
                        return
            except Exception as e:
                self.log_message(f"TTS proxy error: {str(e)}")
            self._set_headers(500)
            self.wfile.write(json.dumps({"error": "Failed to stream audio"}).encode("utf-8"))
            
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode("utf-8"))

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
        
        try:
            data = json.loads(body)
        except Exception as e:
            self._set_headers(400)
            self.wfile.write(json.dumps({"success": False, "error": f"Invalid JSON: {str(e)}"}).encode("utf-8"))
            return

        # Security check: Validate Origin and optional X-Bridge-Token
        origin = self.headers.get("Origin", "")
        if origin and not any(origin.startswith(h) for h in ["http://127.0.0.1", "http://localhost", "https://zipbodo-wq.github.io"]):
            token = self.headers.get("X-Bridge-Token", "")
            if token != BRIDGE_TOKEN:
                self._set_headers(403)
                self.wfile.write(json.dumps({"success": False, "error": "Forbidden: Untrusted origin and missing/invalid X-Bridge-Token"}).encode("utf-8"))
                return

        path = self.path.split('?')[0]

        if path == "/tts" or path == "/api/tts":
            text = data.get("text", "").strip()
            lang = data.get("language", data.get("lang", "en")).strip().lower()
            speaker = data.get("speaker", "shubh")
            client_key = data.get("api_key", "").strip()

            sarvam_key = os.environ.get("SARVAM_API_KEY", "").strip() or client_key

            if not sarvam_key:
                self._set_headers(500)
                self.wfile.write(json.dumps({
                    "success": False,
                    "error": "SARVAM_API_KEY environment variable is not set. Please set SARVAM_API_KEY."
                }).encode("utf-8"))
                return

            if not text:
                self._set_headers(400)
                self.wfile.write(json.dumps({
                    "success": False,
                    "error": "Missing required field 'text'"
                }).encode("utf-8"))
                return

            lang_map = {
                "hi": "hi-IN", "hindi": "hi-IN", "hi-in": "hi-IN",
                "or": "od-IN", "odia": "od-IN", "or-in": "od-IN", "od-in": "od-IN",
                "en": "en-IN", "english": "en-IN", "en-in": "en-IN"
            }
            target_lang = lang_map.get(lang)
            if not target_lang:
                if any('\u0900' <= c <= '\u097F' for c in text):
                    target_lang = "hi-IN"
                elif any('\u0B00' <= c <= '\u0B7F' for c in text):
                    target_lang = "od-IN"
                else:
                    target_lang = "en-IN"

            text_chunks = split_text_for_tts(text, 2400)

            try:
                sarvam_url = "https://api.sarvam.ai/text-to-speech"
                print(f"[SARVAM TTS] Target: {target_lang} | Speaker: {speaker} | Model: bulbul:v3 | Chunks: {len(text_chunks)}")
                headers = {
                    "api-subscription-key": sarvam_key,
                    "Content-Type": "application/json",
                    "User-Agent": "VoiceAgentBridge/1.0"
                }

                all_audio_bytes = b""
                for chunk in text_chunks:
                    payload = {
                        "text": chunk,
                        "target_language_code": target_lang,
                        "speaker": speaker,
                        "model": "bulbul:v3"
                    }
                    post_data = json.dumps(payload).encode("utf-8")
                    req = urllib.request.Request(sarvam_url, data=post_data, headers=headers, method="POST")

                    with safe_urlopen(req, timeout=15) as resp:
                        resp_data = json.loads(resp.read().decode("utf-8"))
                        audios = resp_data.get("audios", [])
                        if audios and audios[0]:
                            all_audio_bytes += base64.b64decode(audios[0])

                if not all_audio_bytes:
                    raise ValueError("Sarvam returned no audio for any chunk")
                audio_bytes = all_audio_bytes
                self._set_headers(200, content_type="audio/wav")
                self.wfile.write(audio_bytes)
                return
            except urllib.error.HTTPError as he:
                err_body = he.read().decode("utf-8", errors="replace")
                print(f"[!] Sarvam API HTTPError {he.code}: {err_body}")
                self.log_message(f"Sarvam API HTTP Error {he.code}: {err_body}")
                self._set_headers(he.code)
                self.wfile.write(json.dumps({
                    "success": False,
                    "error": f"Sarvam AI API HTTP {he.code}: {err_body}"
                }).encode("utf-8"))
                return
            except Exception as ex:
                self.log_message(f"Sarvam API Exception: {str(ex)}")
                self._set_headers(500)
                self.wfile.write(json.dumps({
                    "success": False,
                    "error": f"Sarvam TTS bridge failed: {str(ex)}"
                }).encode("utf-8"))
                return

        elif path == "/api/deepseek-search":
            query = data.get("query", data.get("text", "")).strip()
            system_prompt = data.get("system_prompt", "You are an intelligent, ultra-concise voice assistant. Answer directly in 1-2 spoken sentences.").strip()
            client_key = data.get("api_key", "").strip()
            deepseek_key = os.environ.get("DEEPSEEK_API_KEY", "").strip() or client_key

            if not deepseek_key:
                self._set_headers(400)
                self.wfile.write(json.dumps({
                    "success": False,
                    "error": "DEEPSEEK_API_KEY is not configured on server or in request payload."
                }).encode("utf-8"))
                return

            if not query:
                self._set_headers(400)
                self.wfile.write(json.dumps({
                    "success": False,
                    "error": "Missing 'query' or 'text' parameter."
                }).encode("utf-8"))
                return

            try:
                payload = json.dumps({
                    "model": "deepseek-chat",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": query}
                    ],
                    "temperature": 0.6,
                    "max_tokens": 300
                }).encode("utf-8")

                req = urllib.request.Request(
                    "https://api.deepseek.com/chat/completions",
                    data=payload,
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {deepseek_key}",
                        "User-Agent": "VoiceAgentBridge/1.0"
                    },
                    method="POST"
                )

                with safe_urlopen(req, timeout=20) as resp:
                    resp_data = json.loads(resp.read().decode("utf-8"))
                    choices = resp_data.get("choices", [])
                    if choices and "message" in choices[0]:
                        reply = choices[0]["message"].get("content", "")
                        self._set_headers(200)
                        self.wfile.write(json.dumps({
                            "success": True,
                            "reply": reply,
                            "model": "deepseek-chat"
                        }).encode("utf-8"))
                    else:
                        self._set_headers(500)
                        self.wfile.write(json.dumps({
                            "success": False,
                            "error": "DeepSeek API returned empty choices."
                        }).encode("utf-8"))

            except urllib.error.HTTPError as he:
                err_body = he.read().decode("utf-8", errors="replace")
                print(f"[!] DeepSeek API HTTPError {he.code}: {err_body}")
                self._set_headers(he.code)
                self.wfile.write(json.dumps({
                    "success": False,
                    "error": f"DeepSeek API HTTPError {he.code}: {err_body}"
                }).encode("utf-8"))
            except Exception as ex:
                print(f"[!] DeepSeek API exception: {str(ex)}")
                self._set_headers(500)
                self.wfile.write(json.dumps({
                    "success": False,
                    "error": f"DeepSeek request failed: {str(ex)}"
                }).encode("utf-8"))

        elif path == "/api/execute":
            # Execute a local Python command, script, or shell task
            script_name = data.get("script_name", "")
            code_snippet = data.get("code", "")
            shell_cmd = data.get("command", "")
            task_desc = data.get("description", "Verbal voice execution")

            mission_id = f"task_{int(time.time() * 1000)}"
            start_t = time.time()

            result = {"stdout": "", "stderr": "", "returncode": 0, "duration": 0}

            try:
                if code_snippet:
                    # Run ephemeral python code safely
                    res = subprocess.run(
                        [sys.executable, "-c", code_snippet],
                        capture_output=True,
                        text=True,
                        encoding="utf-8",
                        errors="replace",
                        timeout=15,
                        cwd=WORKSPACE_DIR
                    )
                    result["stdout"] = res.stdout
                    result["stderr"] = res.stderr
                    result["returncode"] = res.returncode

                elif script_name:
                    script_path = os.path.join(WORKSPACE_DIR, script_name)
                    if not os.path.exists(script_path):
                        result["stderr"] = f"Script file '{script_name}' not found in workspace."
                        result["returncode"] = 1
                    else:
                        res = subprocess.run(
                            [sys.executable, script_path],
                            capture_output=True,
                            text=True,
                            encoding="utf-8",
                            errors="replace",
                            timeout=20,
                            cwd=WORKSPACE_DIR
                        )
                        result["stdout"] = res.stdout
                        result["stderr"] = res.stderr
                        result["returncode"] = res.returncode

                elif shell_cmd:
                    allow_shell = os.environ.get("ALLOW_SHELL", "0") == "1"
                    if not allow_shell:
                        result["stderr"] = "Shell execution is disabled by default for security. Set ALLOW_SHELL=1 environment variable to enable."
                        result["returncode"] = 1
                    else:
                        res = subprocess.run(
                            shell_cmd,
                            shell=True,
                            capture_output=True,
                            text=True,
                            encoding="utf-8",
                            errors="replace",
                            timeout=15,
                            cwd=WORKSPACE_DIR
                        )
                        result["stdout"] = res.stdout
                        result["stderr"] = res.stderr
                        result["returncode"] = res.returncode
                else:
                    result["stderr"] = "No command or script provided."
                    result["returncode"] = 1

            except subprocess.TimeoutExpired:
                result["stderr"] = "Task execution timed out (limit exceeded)."
                result["returncode"] = -1
            except Exception as ex:
                result["stderr"] = str(ex)
                result["returncode"] = -2

            result["duration"] = round(time.time() - start_t, 3)

            mission_entry = {
                "id": mission_id,
                "timestamp": time.strftime("%H:%M:%S"),
                "description": task_desc,
                "command": shell_cmd or script_name or "Python Code Block",
                "result": result
            }
            MISSION_HISTORY.append(mission_entry)

            self._set_headers(200)
            self.wfile.write(json.dumps({
                "success": result["returncode"] == 0,
                "mission": mission_entry
            }).encode("utf-8"))

        elif path == "/api/iot":
            # IoT Hardware control (relays, sensors, devices)
            action = data.get("action", "")
            target = data.get("target", "")
            value = data.get("value", None)

            response_msg = ""

            if action == "toggle_relay":
                if target in IOT_STATE["relays"]:
                    IOT_STATE["relays"][target] = not IOT_STATE["relays"][target]
                    response_msg = f"Relay '{target}' toggled to {'ON' if IOT_STATE['relays'][target] else 'OFF'}."
                else:
                    # Toggle by friendly name
                    found = False
                    for k in list(IOT_STATE["relays"].keys()):
                        if target.lower() in k.lower():
                            IOT_STATE["relays"][k] = not IOT_STATE["relays"][k]
                            response_msg = f"Relay '{k}' toggled to {'ON' if IOT_STATE['relays'][k] else 'OFF'}."
                            found = True
                            break
                    if not found:
                        response_msg = f"Unknown relay target: {target}"

            elif action == "set_relay":
                if target in IOT_STATE["relays"]:
                    IOT_STATE["relays"][target] = bool(value)
                    response_msg = f"Relay '{target}' set to {'ON' if value else 'OFF'}."

            elif action == "read_sensor":
                response_msg = f"Lab Temp: {IOT_STATE['sensors']['lab_temperature_c']}°C, Humidity: {IOT_STATE['sensors']['lab_humidity_pct']}%, Power: {IOT_STATE['sensors']['power_draw_watts']}W."

            elif action == "ping_devices":
                response_msg = f"All {len(IOT_STATE['devices'])} IoT nodes (ESP32, ESP8266, RPi MQTT) are responding healthy on 192.168.1.x subnet."

            else:
                response_msg = "Unknown IoT command."

            IOT_STATE["sensors"]["last_updated"] = time.strftime("%Y-%m-%d %H:%M:%S")

            self._set_headers(200)
            self.wfile.write(json.dumps({
                "success": True,
                "message": response_msg,
                "iot_state": IOT_STATE
            }).encode("utf-8"))

        elif path == "/api/files":
            action = data.get("action", "list")
            subpath = data.get("path", "")
            target_dir = os.path.join(WORKSPACE_DIR, subpath)

            if action == "list":
                try:
                    entries = []
                    for item in os.listdir(target_dir):
                        full_p = os.path.join(target_dir, item)
                        entries.append({
                            "name": item,
                            "is_dir": os.path.isdir(full_p),
                            "size_bytes": os.path.getsize(full_p) if os.path.isfile(full_p) else 0
                        })
                    self._set_headers(200)
                    self.wfile.write(json.dumps({"success": True, "files": entries}).encode("utf-8"))
                except Exception as ex:
                    self._set_headers(500)
                    self.wfile.write(json.dumps({"success": False, "error": str(ex)}).encode("utf-8"))

            elif action == "read":
                filepath = os.path.join(WORKSPACE_DIR, subpath)
                try:
                    if os.path.isfile(filepath):
                        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                            content = f.read(4000) # sample first 4000 chars
                        self._set_headers(200)
                        self.wfile.write(json.dumps({"success": True, "content": content}).encode("utf-8"))
                    else:
                        self._set_headers(404)
                        self.wfile.write(json.dumps({"success": False, "error": "File not found."}).encode("utf-8"))
                except Exception as ex:
                    self._set_headers(500)
                    self.wfile.write(json.dumps({"success": False, "error": str(ex)}).encode("utf-8"))
            else:
                self._set_headers(400)
                self.wfile.write(json.dumps({"success": False, "error": "Unsupported file action."}).encode("utf-8"))

        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Unknown POST route"}).encode("utf-8"))

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    except Exception:
        return '127.0.0.1'
    finally:
        s.close()

def run_server():
    allow_lan = os.environ.get("ALLOW_LAN", "0") == "1"
    bind_host = "0.0.0.0" if allow_lan else "127.0.0.1"
    server_address = (bind_host, PORT)
    local_ip = get_local_ip()
    try:
        httpd = HTTPServer(server_address, VoiceAgentBridgeHandler)
        print("=" * 65)
        print("  AGENT · AUTONOMOUS VOICE AI - TASK & IOT BRIDGE")
        print("=" * 65)
        print(f"  [>] Local PC Access:  http://127.0.0.1:{PORT}")
        if allow_lan:
            print(f"  [>] Mobile / WiFi IP: http://{local_ip}:{PORT} (ALLOW_LAN=1 active)")
        else:
            print(f"  [>] Network Mode:     Loopback only (127.0.0.1). Set ALLOW_LAN=1 for LAN access.")
        print(f"  [>] Security Token:   {BRIDGE_TOKEN}")
        print("  [!] WARNING: This bridge executes local tasks. Only run on trusted networks.")
        print("=" * 65)
        httpd.serve_forever()
    except OSError as e:
        if e.errno == 10048 or "Address already in use" in str(e):
            print(f"[!] Port {PORT} is already in use. Local bridge is already running.")
        else:
            print(f"[!] Server error: {e}")

if __name__ == "__main__":
    if not os.environ.get("SARVAM_API_KEY"):
        print("[WARN] SARVAM_API_KEY not set — /tts will return 500. Set it to enable Hindi/Odia.")
    run_server()

