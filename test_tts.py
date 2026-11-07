#!/usr/bin/env python3
"""
Test Suite: Sarvam AI Bulbul v3 Text-to-Speech Integration
Tests Hindi (hi-IN), Odia (od-IN), and English (en-IN) TTS synthesis.
"""

import os
import sys
import json
import base64
import urllib.request
import urllib.error

BRIDGE_URL = os.environ.get("BRIDGE_URL", "http://127.0.0.1:8765")
SARVAM_API_KEY = os.environ.get("SARVAM_API_KEY", "").strip()

TEST_CASES = [
    {
        "lang": "hi",
        "target_code": "hi-IN",
        "label": "Hindi (हिन्दी)",
        "text": "नमस्ते, मैं आपकी कैसे मदद कर सकता हूँ?"
    },
    {
        "lang": "or",
        "target_code": "od-IN",
        "label": "Odia (ଓଡ଼ିଆ)",
        "text": "ନମସ୍କାର, ମୁଁ ଆପଣଙ୍କୁ କିପରି ସାହାଯ୍ୟ କରିପାରିବି?"
    },
    {
        "lang": "en",
        "target_code": "en-IN",
        "label": "English (Indian English)",
        "text": "Hello, how can I help?"
    }
]

def print_separator(char="=", length=68):
    print(char * length)

def call_bridge_tts(text, lang):
    """Attempt calling local bridge /tts endpoint first."""
    url = f"{BRIDGE_URL}/tts"
    req_body = json.dumps({"text": text, "language": lang}).encode("utf-8")
    req = urllib.request.Request(url, data=req_body, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.getcode(), resp.read()

def call_direct_sarvam_tts(text, target_code, api_key):
    """Direct fallback to Sarvam API if local bridge is not running."""
    url = "https://api.sarvam.ai/text-to-speech"
    headers = {
        "api-subscription-key": api_key,
        "Content-Type": "application/json",
        "User-Agent": "SarvamTestClient/1.0"
    }
    payload = {
        "text": text,
        "target_language_code": target_code,
        "speaker": "shubh",
        "model": "bulbul:v3"
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        audios = data.get("audios", [])
        if audios and audios[0]:
            return 200, base64.b64decode(audios[0])
        return 500, b""

def main():
    print_separator()
    print(" 🎙️  SARVAM AI BULBUL V3 TTS VERIFICATION SUITE")
    print_separator()

    if not SARVAM_API_KEY:
        print("\n[SKIPPED] SARVAM_API_KEY environment variable is not set.")
        print("\nTo run this test with live Sarvam AI synthesis:")
        print("  Windows (CMD):        set SARVAM_API_KEY=your_sarvam_api_key")
        print("  Windows (PowerShell): $env:SARVAM_API_KEY='your_sarvam_api_key'")
        print("  Linux/Mac:            export SARVAM_API_KEY='your_sarvam_api_key'")
        print("\nGet a free API subscription key at: https://www.sarvam.ai/\n")
        print_separator()
        return 0

    print(f"API Key Detected: {SARVAM_API_KEY[:6]}...{SARVAM_API_KEY[-4:] if len(SARVAM_API_KEY) > 10 else ''}")
    print("Testing Languages: Hindi (hi-IN), Odia (od-IN), English (en-IN)")
    print_separator("-")

    # Check if local bridge is reachable
    bridge_running = False
    try:
        with urllib.request.urlopen(f"{BRIDGE_URL}/config", timeout=2) as resp:
            if resp.getcode() == 200:
                bridge_running = True
                print(f"✓ Local Voice Agent Bridge active on {BRIDGE_URL}")
    except Exception:
        print(f"ℹ Local bridge not active on {BRIDGE_URL}. Testing direct Sarvam AI REST API...")

    print_separator("-")

    results = []
    all_passed = True

    for tc in TEST_CASES:
        status_str = "PENDING"
        byte_len = 0
        error_msg = ""

        try:
            if bridge_running:
                code, audio_bytes = call_bridge_tts(tc["text"], tc["lang"])
            else:
                code, audio_bytes = call_direct_sarvam_tts(tc["text"], tc["target_code"], SARVAM_API_KEY)

            byte_len = len(audio_bytes)
            if code == 200 and byte_len > 1000:
                status_str = "PASS"
            else:
                status_str = "FAIL"
                all_passed = False
                error_msg = f"HTTP {code}, bytes: {byte_len}"
        except urllib.error.HTTPError as he:
            status_str = "FAIL"
            all_passed = False
            error_msg = f"HTTP {he.code}: {he.read().decode('utf-8', errors='replace')[:60]}"
        except Exception as e:
            status_str = "FAIL"
            all_passed = False
            error_msg = str(e)[:60]

        results.append({
            "label": tc["label"],
            "code": tc["target_code"],
            "status": status_str,
            "bytes": byte_len,
            "error": error_msg
        })

    # Print Formatted Result Table
    print("\n" + "=" * 68)
    print(f"| {'Language':<24} | {'Code':<8} | {'Status':<6} | {'Audio Size':<10} | {'Notes':<7} |")
    print("|" + "-" * 26 + "|" + "-" * 10 + "|" + "-" * 8 + "|" + "-" * 12 + "|" + "-" * 9 + "|")
    for r in results:
        size_str = f"{r['bytes']} B" if r['bytes'] > 0 else "--"
        print(f"| {r['label']:<24} | {r['code']:<8} | {r['status']:<6} | {size_str:<10} | {r['error'][:7]:<7} |")
    print("=" * 68 + "\n")

    if all_passed:
        print("🎉 ALL INDIAN & MULTILINGUAL TTS TESTS PASSED SUCCESSFULLY!\n")
        return 0
    else:
        print("❌ SOME TESTS FAILED. Check API key balance and permissions.\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())

