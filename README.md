# 🎙️ Agent · Autonomous Real-Time Voice AI & IoT Copilot

A low-latency, full-duplex two-way voice AI agent inspired by OpenAI's "Dots". Speak naturally hands-free, interrupt the agent mid-sentence, control local IoT hardware, and execute background tasks.

![Agent Banner](https://img.shields.io/badge/Agent-Autonomous%20Voice%20AI-00f2fe?style=for-the-badge&logo=openai&logoColor=white)
![Status](https://img.shields.io/badge/Status-Production%20Ready-10b981?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

---

## 🌟 Key Features

- 🗣️ **Wake Word Detection ("Agent" / "Hey Agent"):**
  Call out *"Agent"* from across the room to wake it up from standby into continuous listening.
- 🎙️ **Hyper-Realistic OpenAI & GPT-Live 1.1 Voice Matrix:**
  Switch between human-sounding voices right from the top bar:
  - **Arbor**: Easygoing and versatile
  - **Breeze**: Animated and earnest
  - **Cove**: Composed and direct
  - **Ember**: Confident and optimistic
  - **Juniper**: Open and upbeat
  - **Maple**: Cheerful and candid
  - **Sol**: Savvy and relaxed
  - **Spruce**: Calm and affirming
  - **Vale**: Bright and inquisitive
  - **Bubbie**: Warm English conversational
  - **Himari & Rindō**: Japanese (Expressive & Composed)
  - **Haetsal & Hanul**: Korean (Bright & Smooth)
  - **Tinta & Arrullo**: Mexican Spanish (Expressive & Melodic)
  - **Céleste & Léopold**: French (Refined & Classic)
  - **Friedrich & Greta**: German (Authoritative & Dynamic)
  - *Plus classic Alloy, Echo, Fable, Onyx, Nova, and Shimmer.*
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
  - OpenAI GPT-4o / GPT-4o-mini
  - Groq Cloud Llama 3.3 70B (Sub-200ms latency)
  - Google Gemini 2.0 Flash
- 👁️ **Optic Vision Feed:**
  Real-time camera feed analysis for vision assistance.

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

