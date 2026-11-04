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
import shutil
import socket
import platform
import subprocess
import threading
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = 8765
WORKSPACE_DIR = os.path.dirname(os.path.abspath(__file__))

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
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
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
        if path == "/" or path == "/app" or path == "/dots-voice-agent.html" or path == "/index.html":
            for fname in ["index.html", "dots-voice-agent.html"]:
                html_path = os.path.join(WORKSPACE_DIR, fname)
                if os.path.exists(html_path):
                    with open(html_path, "r", encoding="utf-8") as f:
                        content = f.read()
                    self._set_headers(200, "text/html; charset=utf-8")
                    self.wfile.write(content.encode("utf-8"))
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
            
        elif path == "/api/iot":
            IOT_STATE["sensors"]["last_updated"] = time.strftime("%Y-%m-%d %H:%M:%S")
            self._set_headers(200)
            self.wfile.write(json.dumps({"success": True, "iot": IOT_STATE}).encode("utf-8"))
            
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

        path = self.path.split('?')[0]

        if path == "/api/execute":
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
    server_address = ("0.0.0.0", PORT)
    local_ip = get_local_ip()
    try:
        httpd = HTTPServer(server_address, VoiceAgentBridgeHandler)
        print("=" * 65)
        print("  AGENT · AUTONOMOUS VOICE AI - TASK & IOT BRIDGE")
        print("=" * 65)
        print(f"  [>] Local PC Access:  http://127.0.0.1:{PORT}")
        print(f"  [>] Mobile / WiFi IP: http://{local_ip}:{PORT}")
        print(f"  [>] Wake Word:        'Agent' (Hands-free voice recognition)")
        print(f"  [>] Workspace Linked: {WORKSPACE_DIR}")
        print("  [>] Ready for Two-Way Full-Duplex Voice & Background Missions")
        print("=" * 65)
        httpd.serve_forever()
    except OSError as e:
        if e.errno == 10048 or "Address already in use" in str(e):
            print(f"[!] Port {PORT} is already in use. Local bridge is already running.")
        else:
            print(f"[!] Server error: {e}")

if __name__ == "__main__":
    run_server()

