# 🎙️ Agent · Autonomous Real-Time Voice AI & IoT Copilot

A low-latency, full-duplex two-way voice AI agent inspired by OpenAI's "Dots". Speak naturally hands-free, interrupt the agent mid-sentence, control local IoT hardware, and execute background tasks.

![Agent Banner](https://img.shields.io/badge/Agent-Autonomous%20Voice%20AI-00f2fe?style=for-the-badge&logo=openai&logoColor=white)
![Status](https://img.shields.io/badge/Status-Production%20Ready-10b981?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

---

## 🌟 Key Features

- 🗣️ **Wake Word Detection ("Agent" / "Hey Agent"):**
  Call out *"Agent"* from across the room to wake it up from standby into continuous listening.
- 🎙️ **Hyper-Realistic OpenAI, Indian Languages & Superhero Voices:**
  - 🇮🇳 **Hindi (हिंदी) & Odia (ଓଡ଼ିଆ) Native Speech Engine:**
    - High-fidelity **Neural Indic Audio Stream (100% Free)** with natural human-like pronunciation for Hindi and Odia.
    - Native support for Windows/Edge **Microsoft Madhur** (Male) and **Microsoft Swara** (Female) voices.
    - Advanced Abugida transliteration ensures audible speech on any device, even if no Indian language packs are installed.
  - 🦸 **Avengers Superhero Personas with Real Gender-Matched Voices:**
    - 🦾 **Iron Man** (Tony Stark - Male)
    - 🔨 **Thor** (God of Thunder - Male)
    - 🛡️ **Captain America** (Steve Rogers - Male)
    - 🕷️ **Spider-Man** (Peter Parker - Male)
    - 🟢 **Hulk** (Gamma Titan - Male)
    - 🤖 **JARVIS** (Stark AI - Male)
    - 🟣 **Thanos** (Cosmic Titan - Male)
    - 🕷️ **Black Widow** (Natasha Romanoff - Female)
    - 🔮 **Scarlet Witch** (Wanda Maximoff - Female)
    - 🐆 **Shuri** (Wakandan Princess - Female)
  - 🌐 **Global Voice Roster:**
    - **Arbor, Breeze, Cove, Ember, Juniper, Maple, Sol, Spruce, Vale, Bubbie**, plus classic Alloy, Echo, Fable, Onyx, Nova, and Shimmer.
- ⚡ **Full-Duplex Speech & Instant Barge-In:**
  No need to wait for the agent to finish talking. Interrupt mid-sentence to shift tasks or clarify instructions.
- 📱 **Mobile & Desktop Responsive:**
  Optimized for iPhone (Safari), Android (Chrome), and desktop PCs with high-DPI Retina fluid particle orb.
- 🔘 **Push-to-Talk & Hands-Free Modes:**
  Hold `Spacebar` on PC or touch-and-hold the glowing orb on mobile to talk walkie-talkie style, or toggle Hands-Free for continuous conversation.
- 💡 **IoT Hardware Workbench:**
  Control real relays, actuators, test benches, and read temperature/humidity/power telemetry.
- 🧠 **Multi-Engine Support:**
  - Free built-in Local Semantic Engine (Zero API key needed)
  - 🌐 **Groq Compound** with built-in Web Search (`groq/compound-mini`, fallback `llama-3.1-8b-instant`)
  - 🔍 **DeepSeek Search** (`deepseek-chat` / DeepSeek-V3 / R1)
  - ⚡ **Groq Cloud** Llama 3.1 8B Instant (Sub-200ms latency)
  - OpenAI GPT-4o / GPT-4o-mini
  - Google Gemini 2.0 Flash
- 👁️ **Optic Vision Feed:**
  Real-time camera feed analysis for vision assistance.

---

## 🇮🇳 Indian Language Support (Hindi / Odia)

Agent features deterministic, native Hindi (`hi-IN`) and Odia (`od-IN`) Text-to-Speech powered by **Sarvam AI Bulbul v3 REST API**:

### 1. Get a Sarvam AI API Key
1. Visit [Sarvam AI Platform](https://www.sarvam.ai/) and create an account.
2. Generate your API subscription key.

### 2. Configure Environment Variable or Settings UI
- **Via Environment Variable (Recommended for bridge):**
  - **Windows (CMD):**
    ```cmd
    set SARVAM_API_KEY=your_sarvam_api_key
    ```
  - **Windows (PowerShell):**
    ```powershell
    $env:SARVAM_API_KEY="your_sarvam_api_key"
    ```
  - **Linux / macOS:**
    ```bash
    export SARVAM_API_KEY="your_sarvam_api_key"
    ```
- **Via In-App Settings:**
  - Open **⚙️ Settings** in the app header.
  - Paste your key into **Sarvam AI TTS (Bulbul v3)** and click **Save Settings** (or click **🧪 Test**).

### 3. How to Select Language in the UI
- In the top header bar, use the language dropdown to choose **🌐 Auto Language**, **🇮🇳 हिन्दी (Hindi)**, **🇮🇳 ଓଡ଼ିଆ (Odia)**, or **🇬🇧 English**.
- Or open **⚙️ Settings** and select **Spoken & Recognition Language**:
  - `English`
  - `हिन्दी (Hindi - hi-IN)`
  - `ଓଡ଼ିଆ (Odia - od-IN)`
- **Auto Script Detection:** If text contains Devanagari characters (`\u0900-\u097F`), the agent automatically speaks Hindi. If text contains Odia characters (`\u0B00-\u0B7F`), the agent automatically speaks Odia.

### 4. Running the Verification Test Script
Verify your Sarvam AI endpoint anytime by running:
```bash
python test_tts.py
```
*(If `SARVAM_API_KEY` is not set, the test will cleanly report `[SKIPPED]` with setup guidance).*

---

## 🦾 Free Local Voice Cloning (Maya 2 Native · Port 8766)

Clone any voice (such as Avengers superheroes or custom reference audio) for **Hindi** and **Odia** with zero API cost using **Maya 2 Native**:

### Prerequisites
- NVIDIA GPU with 12GB+ VRAM
- CUDA 12.8 drivers installed
- Python 3.10+

### 1. Install Maya 2 Native Dependencies
```bash
pip install "maya3[server] @ git+https://github.com/MayaResearch/maya2-native" --extra-index-url https://download.pytorch.org/whl/cu128
```

### 2. Start the Inference Server
```bash
python maya_tts_server.py
```
*The local inference server runs on port `8766` separate from the main bridge.*

### 3. Clone a Voice in the UI
1. Open **⚙️ Settings** > **Avenger Voice Clone (Local · Maya 2 Native)**.
2. Upload a 3–10 second reference audio clip (`.wav` or `.mp3`).
3. Enter the exact reference transcript (`ref_text`) of what was spoken in the audio clip.
4. Select the target language (**Hindi** or **Odia**) and click **Test Clone**.
5. When reference audio is loaded and the language is Hindi or Odia, the agent will automatically synthesize speech using your cloned voice!

### 4. Running the Voice Cloning Test Script
```bash
python test_maya_clone.py
```
*(Tests both Hindi and Odia cloned generation against `http://127.0.0.1:8766/tts/clone` and prints a PASS/FAIL table).*

---

## 🧠 Unlocking Full AI Intelligence (Knows Everything)

Out of the box without an API key, the app runs on a **basic offline rule engine** (handling basic greetings, device toggles, and system telemetry).

To give the agent **infinite world knowledge** (coding, math, history, science, creative writing, reasoning) just like ChatGPT:

1. Click the **⚙️ Settings** icon in the top header.
2. Select your **AI Intelligence Engine**:
   - ⚡ **Groq Cloud (Recommended)**: **100% Free** and ultra-low latency (<200ms speech response). Powered by Meta's `llama-3.1-8b-instant`.
     - Get a free key at: [console.groq.com/keys](https://console.groq.com/keys)
   - 🌐 **Groq Compound (Web Search)**: Built-in real-time web search capability using your existing Groq API key!
   - 🔍 **DeepSeek Search**: High-reasoning search synthesis powered by DeepSeek-V3 / R1.
     - Get a key at: [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys)
     - Set bridge environment variable: `set DEEPSEEK_API_KEY=your_key` or enter in Settings.
   - 🤖 **OpenAI**: Connects `gpt-4o-mini` or `gpt-4o`.
     - Get key at: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - ✨ **Google Gemini**: Connects `gemini-2.0-flash`.
     - Get free key at: [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
3. Paste your key and click **🧪 Test Key** to verify.
4. Click **Save Settings**!

---

## 🚀 Live Online Demo (GitHub Pages)

You can run this directly in your mobile or desktop browser without installing anything:

👉 **`https://<your-username>.github.io/<your-repo-name>/`**

> **Note on Microphone Permission:** Modern browsers require HTTPS for permanent microphone access. Hosting on GitHub Pages enables permanent, 1-click microphone permission on both iOS and Android!

---

## 💻 Local PC & IoT Setup (For Real Hardware Execution)

If you want the agent to control your local PC files and physical IoT devices:

1. Clone or download this repository:
   ```bash
   git clone https://github.com/<your-username>/<your-repo-name>.git
   cd <your-repo-name>
   ```

2. Run the launcher:
   - **On Windows:** Double-click `launch_agent.bat`
   - **Or run via terminal:**
     ```bash
     python voice_agent_bridge.py
     ```

3. Open in your browser:
   - **PC:** `http://127.0.0.1:8765`
   - **Mobile Phone (Same Wi-Fi):** `http://<your-pc-ip>:8765`

---

## 🔒 Security & Safe Execution Notice

- **Local Loopback Default:** `voice_agent_bridge.py` binds to `127.0.0.1` by default to prevent unauthorized network access.
- **LAN Access:** Set `ALLOW_LAN=1` to allow other devices on your local Wi-Fi to connect (`http://<your-ip>:8765`). Only run on trusted networks.
- **Shell Execution:** Arbitrary shell execution is disabled by default for security. Set `ALLOW_SHELL=1` only if you explicitly require shell command execution.
- **API Keys on Public Pages:** Never store private API keys in client `localStorage` on public GitHub Pages deployments. Use server bridge environment variables (`SARVAM_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`).
- **Bridge Token:** A security token is generated in `bridge_token.txt` and verified via `X-Bridge-Token` header for external requests.

---

## 🗣️ Voice Commands Cheatsheet

| Intent | Spoken Command | Action Taken |
| :--- | :--- | :--- |
| **Wake Up** | *"Agent"* | Wakes from standby, chimes, and starts listening |
| **IoT Relays** | *"Agent, turn on developer lights"* | Toggles Workbench Relay 1 to ON |
| **IoT Cooling** | *"Agent, turn off the server fan"* | Shuts off Relay 3 |
| **Lab Sensors** | *"Agent, what is the temperature in the lab?"* | Reads live temperature, humidity & power telemetry |
| **Python Code** | *"Agent, run a test for Fibonacci"* | Executes Python script and speaks result |
| **System Info** | *"Agent, check PC storage and telemetry"* | Inspects CPU threads, RAM, and disk space |

---

## 📄 License

MIT License. Free to use, modify, and distribute.

