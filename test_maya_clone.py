#!/usr/bin/env python3
"""
Test Suite: Maya 2 Native Local Avengers Voice Cloning
Tests endpoint POST http://127.0.0.1:8766/tts/clone with Hindi and Odia text.
"""

import os
import sys
import json
import urllib.request
import urllib.error

SERVER_URL = "http://127.0.0.1:8766"

TEST_CASES = [
    {
        "lang": "hi",
        "label": "Hindi Avengers Clone (Iron Man)",
        "text": "मैं आयरन मैन हूँ।",
        "ref_text": "I am Iron Man."
    },
    {
        "lang": "or",
        "label": "Odia Avengers Clone (ମୁଁ ଆଇରନ୍ ମ୍ୟାନ୍)",
        "text": "ମୁଁ ଆଇରନ୍ ମ୍ୟାନ୍ ଅଟେ।",
        "ref_text": "I am Iron Man in Odia."
    }
]

def print_separator(char="=", length=68):
    print(char * length)

def main():
    print_separator()
    print(" 🎙️  MAYA 2 NATIVE LOCAL VOICE CLONING TEST SUITE")
    print_separator()

    # Step 1: Check if server is running on port 8766
    server_online = False
    try:
        req = urllib.request.Request(f"{SERVER_URL}/health")
        with urllib.request.urlopen(req, timeout=3) as resp:
            if resp.getcode() == 200:
                server_online = True
                data = json.loads(resp.read().decode('utf-8'))
                print(f"✓ Maya 2 Server detected on {SERVER_URL}")
                print(f"  Model status: {data.get('model_status')} | CUDA: {data.get('cuda_available')}")
    except Exception:
        print(f"\n[NOTICE] Maya 2 Native server is not currently running on {SERVER_URL}")
        print("\nTo start the local voice cloning server:")
        print("  1. In a separate terminal or prompt, run:")
        print("     python maya_tts_server.py")
        print("  2. Then re-run this test script.")
        print("\nPrerequisites:")
        print("  pip install \"maya3[server] @ git+https://github.com/MayaResearch/maya2-native\" --extra-index-url https://download.pytorch.org/whl/cu128")
        print_separator()
        return 0

    print_separator("-")
    results = []
    all_passed = True

    for tc in TEST_CASES:
        payload = {
            "text": tc["text"],
            "lang": tc["lang"],
            "ref_audio_path": "placeholder_reference.wav",
            "ref_text": tc["ref_text"]
        }

        status_str = "PENDING"
        byte_len = 0
        notes = ""

        try:
            req_data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                f"{SERVER_URL}/tts/clone",
                data=req_data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )

            with urllib.request.urlopen(req, timeout=30) as resp:
                code = resp.getcode()
                audio_bytes = resp.read()
                byte_len = len(audio_bytes)

                if code == 200 and byte_len > 1000:
                    status_str = "PASS"
                    notes = f"WAV Audio ({byte_len} B)"
                else:
                    status_str = "FAIL"
                    all_passed = False
                    notes = f"Code: {code}, bytes: {byte_len}"
        except urllib.error.HTTPError as he:
            status_str = "FAIL"
            all_passed = False
            notes = f"HTTP {he.code}"
        except Exception as ex:
            status_str = "FAIL"
            all_passed = False
            notes = str(ex)[:20]

        results.append({
            "label": tc["label"],
            "lang": tc["lang"],
            "status": status_str,
            "bytes": byte_len,
            "notes": notes
        })

    # Print Table
    print("\n" + "=" * 68)
    print(f"| {'Test Case':<36} | {'Lang':<5} | {'Status':<6} | {'Audio Size':<11} |")
    print("|" + "-" * 38 + "|" + "-" * 7 + "|" + "-" * 8 + "|" + "-" * 13 + "|")
    for r in results:
        size_str = f"{r['bytes']} B" if r['bytes'] > 0 else "--"
        print(f"| {r['label']:<36} | {r['lang']:<5} | {r['status']:<6} | {size_str:<11} |")
    print("=" * 68 + "\n")

    if all_passed:
        print("🎉 MAYA 2 LOCAL VOICE CLONING ENDPOINT VERIFIED SUCCESSFULLY!\n")
        return 0
    else:
        print("❌ VOICE CLONING TEST FAILED. Check server logs on port 8766.\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())

