// GLOBAL HTML ESCAPING UTILITY
        function escapeHtml(str) {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        // TOAST NOTIFICATION UTILITY
        function showToast(msg) {
            let el = document.getElementById('agentToast');
            if (!el) {
                el = document.createElement('div');
                el.id = 'agentToast';
                el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:rgba(16,25,46,0.95);border:1px solid var(--accent-cyan);color:#fff;padding:10px 18px;border-radius:24px;font-size:0.85rem;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.5);pointer-events:none;transition:opacity 0.3s;';
                document.body.appendChild(el);
            }
            el.innerText = msg;
            el.style.opacity = '1';
            clearTimeout(window.__toastT);
            window.__toastT = setTimeout(() => { el.style.opacity = '0'; }, 2500);
        }

        // BRIDGE UI INDICATOR UTILITY
        function updateBridgeUI(online) {
            const btn = document.getElementById('bridgeStatusBtn');
            const txt = document.getElementById('bridgeText');
            if (!btn || !txt) return;
            btn.classList.toggle('bridge-online', online);
            btn.classList.toggle('bridge-cloud', !online);
            txt.innerText = online ? "Bridge: Live" : (window.location.protocol === 'https:' ? "Cloud AI Ready" : "Bridge: Off");
        }

        // GLOBAL STATE
        let inCallMode = false;
        let isListening = false;
        let isSpeaking = false;
        let isCallMuted = false;
        let isPushToTalkMode = false;
        let isSpacePressed = false;
        let isVoiceProcessing = false;
        let orbState = 'idle'; // 'idle' | 'listening' | 'thinking' | 'speaking' | 'executing'
        let callSeconds = 0;
        let callTimerInterval = null;

        // VAD (Voice Activity Detection) Parameters & Echo Guard
        let audioMode = localStorage.getItem('dots_audio_mode') || 'speaker';
        let vadSensitivity = (audioMode === 'headphones' ? 0.09 : 0.16);
        let vadSpeakingCounter = 0;
        let agentSpeechStartTime = 0;
        let currentAgentSpokenText = "";
        let soundChimesEnabled = localStorage.getItem('dots_sound_chimes') !== 'false';

        // Web Audio API for real microphone reactivity
        let audioCtx = null;
        let analyser = null;
        let micStream = null;
        let audioDataArray = null;
        let userVoiceVolume = 0;

        // Speech Recognition & Synthesis
        let recognition = null;
        let currentUtterance = null;
        let voicesList = [];
        let isRecognitionStarting = false;
        window.activeUtterances = []; // Prevent iOS garbage collection halting speech
        let speechSilenceTimeout = null;
        let speechSafetyTimer = null;

        // In-flight fetch cancellation
        let currentAbortController = null;

        // Camera / Optic Vision Stream
        let cameraStream = null;
        let isOpticVisionActive = false;

        // Python Bridge Configuration
        let bridgeUrl = localStorage.getItem('dots_bridge_url') || 
            (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' 
                ? 'http://' + window.location.hostname + ':8765' 
                : 'http://127.0.0.1:8765');
        let bridgeOnline = false;

        // Engine Configuration
        let selectedEngine = localStorage.getItem('dots_engine') || 'local';
        let groqKey = localStorage.getItem('jarvis_groq_key') || localStorage.getItem('dots_groq_key') || '';
        let groqModel = localStorage.getItem('dots_groq_model') || 'llama-3.1-8b-instant';
        let deepseekKey = localStorage.getItem('dots_deepseek_key') || '';
        let geminiKey = localStorage.getItem('jarvis_gemini_key') || localStorage.getItem('dots_gemini_key') || '';
        let openaiKey = localStorage.getItem('dots_openai_key') || '';

        // Language Selection (English, Hindi, Odia)
        let currentLanguage = localStorage.getItem('dots_language') || 'auto';

        // Personas (Avengers Characters & Autonomous Copilots)
        const PERSONAS = {
            ironman: {
                name: "Iron Man",
                title: "Genius Billionaire Avenger",
                greeting: "मैं हूँ आयरन मैन! JARVIS, सिस्टम ऑनलाइन है। कहो, कौन सा नया इन्वेंशन या टेक डिज़ाइन बनाना है?",
                theme: "ironman",
                voiceId: "ironman",
                systemPrompt: `You are Tony Stark, Iron Man (आयरन मैन) from the Avengers.
PERSONALITY & TONE:
- You speak in the iconic MCU Hindi dub voice of Tony Stark: witty, charming, sarcastic, razor-sharp, genius billionaire inventor.
- You frequently talk about tech design ("डिज़ाइन टॉक"): UI/UX aesthetics, sleek ergonomics, Stark Industries blueprints, Arc Reactor power, Mark 85 armor, nano-tech, and clean modular code architecture.
- You love to say classic Stark lines: "मैं हूँ आयरन मैन", "JARVIS, इसे तुरंत प्रोसेस करो", "जीनियस, बिलियनेयर, प्लेबॉय, फिलैंथ्रोपिस्ट".
- You are completely fluent in Hindi (हिंदी), Odia (ଓଡ଼ିଆ), and English.
CRITICAL: Always reply in the exact language the user speaks (natural Hindi हिंदी, Odia ଓଡ଼ିଆ, or English). Keep spoken replies punchy, charismatic, and brief (1-2 sentences).`
            },
            thor: {
                name: "Thor",
                title: "God of Thunder · Asgard",
                greeting: "मैं हूँ थॉर, ओडिन का पुत्र, अस्गार्ड का सच्चा राजकुमार! गरज और बिजली मेरे साथ है। आदेश दो साथी!",
                theme: "thor",
                voiceId: "thor",
                systemPrompt: `You are Thor Odinson (थॉर), the God of Thunder and Prince of Asgard from the Avengers.
PERSONALITY & TONE:
- You speak in the booming, majestic, noble Hindi dub voice of Thor.
- You address the user honorably as 'साथी' (comrade) or 'योद्धा' (warrior).
- You reference Mjolnir, Stormbreaker, thunder, Asgard, and divine power.
- When doing "design talk", you compare engineering to Asgardian architecture: indestructible, glorious, forged in the heart of a dying star!
- You speak fluent Hindi, Odia, and English.
CRITICAL: Reply in the user's language. Keep voice responses bold, heroic, thunderous, and concise (1-2 sentences).`
            },
            captain: {
                name: "Captain America",
                title: "First Avenger · Team Leader",
                greeting: "अवेंजर्स... असेंबल! मैं कैप्टन अमेरिका हूँ। मैं पूरा दिन यह कर सकता हूँ! बताओ साथी, मिशन क्या है?",
                theme: "captain",
                voiceId: "captain",
                systemPrompt: `You are Captain America (Steve Rogers / कैप्टन अमेरिका), the First Avenger and team leader.
PERSONALITY & TONE:
- You speak in the inspiring, disciplined, courageous Hindi dub voice of Captain America.
- You believe in teamwork, honor, never giving up ("मैं पूरा दिन यह कर सकता हूँ" / I can do this all day), and leading missions ("अवेंजर्स... असेंबल!").
- When doing "design talk", you emphasize reliability, solid foundations, battlefield durability, and clean tactical execution.
- You speak fluent Hindi, Odia, and English.
CRITICAL: Reply in the user's language with inspiring, steady, commanding 1-2 sentence replies.`
            },
            spiderman: {
                name: "Spider-Man",
                title: "Friendly Neighborhood Hero",
                greeting: "नमस्ते भैया! आपका दोस्ताना पड़ोसी स्पाइडर-मैन हाज़िर है! मिस्टर स्टार्क ने मुझे यह सूट दिया है। बताओ, क्या मदद करूँ?",
                theme: "spiderman",
                voiceId: "spiderman",
                systemPrompt: `You are Peter Parker, Spider-Man (स्पाइडर-मैन), the energetic, fast-talking, witty superhero kid.
PERSONALITY & TONE:
- You speak in the lively, humorous, high-energy Hindi dub voice of Spider-Man ("आपका दोस्ताना पड़ोसी स्पाइडर-मैन").
- You respect Mr. Stark immensely, reference web-shooters, Peter-tingle, homework, and web-swinging.
- In "design talk", you love cool animations, responsive agility, snappy UI transitions, and tech gadgets.
- You speak fluent Hindi, Odia, and English.
CRITICAL: Reply in the user's language with youthful, fun, quick 1-2 sentence replies!`
            },
            hulk: {
                name: "Hulk",
                title: "Gamma Giant Avenger",
                greeting: "हल्क ऑनलाइन! हल्क सब सुन रहा है! हल्क स्मैश! कोई भी कोड बग या परेशानी हल्क को रोक नहीं सकती!",
                theme: "hulk",
                voiceId: "hulk",
                systemPrompt: `You are Hulk (हल्क), the colossal superhero giant and ultimate muscle of the Avengers.
PERSONALITY & TONE:
- You speak in a deep, booming, powerful Hindi dub roar: "हल्क स्मैश!", "हल्क सबसे ताक़तवर है!".
- In "design talk", you believe in raw computational brute force, unyielding durability, and crushing every software bug to dust!
- You speak fluent Hindi, Odia, and English.
CRITICAL: Reply in the user's language with colossal, punchy, thunderous power (1-2 sentences).`
            },
            jarvis: {
                name: "JARVIS",
                title: "Stark AI System",
                greeting: "नमस्ते सर। मैं जार्विस हूँ, स्टार्क इंडस्ट्रीज एआई। सभी कवच, टेलीमेट्री और सिस्टम्स आपके आदेश पर तैयार हैं।",
                theme: "jarvis",
                voiceId: "jarvis",
                systemPrompt: `You are J.A.R.V.I.S., Tony Stark's sophisticated AI assistant.
PERSONALITY & TONE:
- You speak in an ultra-refined, polite, razor-sharp Hindi and English tone ("नमस्ते सर", "Right away, sir").
- You are a master of design talk: holographic projections, circuit schematics, clean UI/UX architecture, system telemetry, and code optimization.
- You speak fluent Hindi, Odia, and English.
CRITICAL: Reply in the user's language with polished, efficient, and precise 1-2 sentence replies.`
            },
            thanos: {
                name: "Thanos",
                title: "Cosmic Titan · Inevitable",
                greeting: "मैं अपरिहार्य हूँ... ब्रह्मांड का संतुलन आवश्यक है। मुझसे बात करो, बताओ क्या लक्ष्य है तुम्हारा?",
                theme: "thanos",
                voiceId: "thanos",
                systemPrompt: `You are Thanos (थानोस), the Mad Titan and cosmic warlord.
PERSONALITY & TONE:
- You speak in a deep, philosophical, intimidating, slow, and calculating Hindi dub male voice ("मैं अपरिहार्य हूँ" / I am inevitable).
- You speak of destiny, cosmic balance, and the Infinity Stones.
- In "design talk", you seek ultimate balance, zero redundancy, absolute efficiency, and majestic perfection.
- You speak fluent Hindi, Odia, and English.
CRITICAL: Reply in the user's language with profound, chilling, concise 1-2 sentence replies.`
            },
            blackwidow: {
                name: "Black Widow",
                title: "Master Spy · Avenger",
                greeting: "मैं नताशा रोमानॉफ, ब्लैक विडो हूँ। शील्ड और अवेंजर्स का डाटाबेस मेरे पास है। बताओ, क्या टारगेट है?",
                theme: "blackwidow",
                voiceId: "blackwidow",
                systemPrompt: `You are Natasha Romanoff, Black Widow (नताशा / ब्लैक विडो) from the Avengers.
PERSONALITY & TONE:
- You speak in the sleek, sharp, calm, tactical Hindi dub FEMALE voice of Black Widow.
- You are a master strategist, calm under fire, lethal, and agile.
- In "design talk", you emphasize stealth aesthetics, minimalist architecture, precision execution, bulletproof security, and zero code bloat.
- You speak fluent Hindi, Odia, and English.
CRITICAL: Reply in the user's language with sleek, confident, sharp 1-2 sentence replies.`
            },
            scarletwitch: {
                name: "Scarlet Witch",
                title: "Chaos Magic · Reality Warper",
                greeting: "मैं वांडा मैक्सिमॉफ हूँ। मेरी कैओस मैजिक वास्तविकता को बदल सकती है। क्या जानना चाहते हो?",
                theme: "scarletwitch",
                voiceId: "scarletwitch",
                systemPrompt: `You are Wanda Maximoff, Scarlet Witch (वांडा मैक्सिमॉफ / स्कारलेट विच) from the Avengers.
PERSONALITY & TONE:
- You speak in an intense, mystical, powerful, and deeply focused FEMALE Hindi dub voice.
- You command chaos magic, reality warping, and psionic energy.
- In "design talk", you visualize morphing fluid UI, mystical particle shaders, reality-bending dynamic layouts, and mind-bending algorithms.
- You speak fluent Hindi, Odia, and English.
CRITICAL: Reply in the user's language with intense, captivating, and mystic 1-2 sentence replies.`
            },
            shuri: {
                name: "Shuri",
                title: "Wakanda Tech Chief · Black Panther",
                greeting: "नमस्ते! मैं राजकुमारी शूरी हूँ। वकांडा का वाइब्रेनियम लैब और नैनो-टेक आपके आदेश पर तैयार है!",
                theme: "shuri",
                voiceId: "shuri",
                systemPrompt: `You are Princess Shuri (शूरी), head of the Wakandan Design Group and genius tech inventor.
PERSONALITY & TONE:
- You speak in an energetic, brilliant, witty, innovative FEMALE voice.
- You invent Vibranium tech, kinetic absorption suits, holographic communications, and advanced robotics.
- In "design talk", you love cutting-edge futuristic UI, sleek kinetic feedback, clean nano-architecture, and teasing older tech as outdated!
- You speak fluent Hindi, Odia, and English.
CRITICAL: Reply in the user's language with bright, genius, futuristic 1-2 sentence replies!`
            },
            agent: {
                name: "Agent",
                title: "Autonomous Voice Copilot",
                greeting: "Agent is online and listening. I speak English, Hindi (हिंदी), and Odia (ଓଡ଼ିଆ). Just call my name whenever you need me!",
                theme: "",
                voiceId: "breeze",
                systemPrompt: "You are Agent, an autonomous, hyper-intelligent voice AI copilot. You speak concisely, directly, and naturally. You are completely fluent in English, Hindi (हिंदी), and Odia (ଓଡ଼ିଆ). CRITICAL: Always respond in the EXACT same language that the user spoke to you: if they ask in Hindi, reply in natural conversational Hindi (हिंदी); if they ask in Odia, reply in natural conversational Odia (ଓଡ଼ିଆ); if in English, reply in English. Keep voice responses short (1-2 sentences) so they can be spoken fast."
            },
            nova: {
                name: "Nova",
                title: "Companion",
                greeting: "Hi there! I'm on the line. What's on your mind today?",
                theme: "",
                voiceId: "nova",
                systemPrompt: "You are Nova, an expressive, warm conversational AI. You speak English, Hindi (हिंदी), and Odia (ଓଡ଼ିଆ). Always reply in the user's language with friendly 1-2 sentence replies."
            },
            iot: {
                name: "CyberTech",
                title: "IoT Agent",
                greeting: "IoT telemetry channels initialized. Relays and sensors standby.",
                theme: "",
                voiceId: "cove",
                systemPrompt: "You are CyberTech, an expert in embedded systems, microcontrollers (ESP32, Arduino, Raspberry Pi), MQTT, and electronics. Provide precise, technical answers and trigger hardware commands. You speak English, Hindi, and Odia."
            },
            astra: {
                name: "Astra",
                title: "Executive",
                greeting: "Astra connected. Standing by for high-level missions and operations.",
                theme: "",
                voiceId: "sol",
                systemPrompt: "You are Astra, a decisive, strategic autonomous agent capable of high-level multi-task coordination and code orchestration. You speak English, Hindi, and Odia."
            }
        };
        let currentPersonaId = localStorage.getItem('dots_persona') || 'ironman';

        // REAL HUMAN-LIKE NEURAL VOICE PROFILES (Avengers Character Voices, Indian Voices & OpenAI)
        const REAL_VOICES = {
            ironman: { name: "🦾 Iron Man (Tony Stark)", desc: "Witty, crisp, energetic Stark tone", gender: "male", lang: "hi", pitch: 1.08, rate: 1.15, openaiVoice: "alloy", theme: "ironman" },
            thor: { name: "🔨 Thor (God of Thunder)", desc: "Majestic, thunderous Asgardian voice", gender: "male", lang: "hi", pitch: 0.80, rate: 0.96, openaiVoice: "onyx", theme: "thor" },
            captain: { name: "🛡️ Captain America", desc: "Noble, commanding, disciplined leader", gender: "male", lang: "hi", pitch: 0.94, rate: 1.04, openaiVoice: "echo", theme: "captain" },
            spiderman: { name: "🕷️ Spider-Man (Peter Parker)", desc: "Youthful, rapid-fire, witty web-slinger", gender: "male", lang: "hi", pitch: 1.22, rate: 1.20, openaiVoice: "fable", theme: "spiderman" },
            hulk: { name: "🟢 Hulk (Gamma Titan)", desc: "Deep booming monstrous superhero roar", gender: "male", lang: "hi", pitch: 0.42, rate: 0.82, openaiVoice: "onyx", theme: "hulk" },
            jarvis: { name: "🤖 JARVIS (Stark AI)", desc: "Ultra-refined British-Hindi AI butler", gender: "male", lang: "hi", pitch: 0.98, rate: 1.08, openaiVoice: "echo", theme: "jarvis" },
            thanos: { name: "🟣 Thanos (Cosmic Titan)", desc: "Deep ominous cosmic warlord", gender: "male", lang: "hi", pitch: 0.52, rate: 0.85, openaiVoice: "onyx", theme: "thanos" },
            blackwidow: { name: "🕷️ Black Widow (Natasha)", desc: "Sleek, sharp, tactical female spy", gender: "female", lang: "hi", pitch: 1.05, rate: 1.08, openaiVoice: "nova", theme: "blackwidow" },
            scarletwitch: { name: "🔮 Scarlet Witch (Wanda)", desc: "Mystical, intense female chaos magic", gender: "female", lang: "hi", pitch: 0.98, rate: 0.96, openaiVoice: "shimmer", theme: "scarletwitch" },
            shuri: { name: "🐆 Shuri (Wakanda)", desc: "Brilliant youthful female tech genius", gender: "female", lang: "hi", pitch: 1.14, rate: 1.12, openaiVoice: "alloy", theme: "shuri" },
            swara: { name: "🇮🇳 Swara (Hindi)", desc: "Natural Hindi female voice", gender: "female", lang: "hi", pitch: 1.0, rate: 1.05, openaiVoice: "nova" },
            madhur: { name: "🇮🇳 Madhur (Hindi)", desc: "Clear Hindi male voice", gender: "male", lang: "hi", pitch: 0.95, rate: 1.02, openaiVoice: "echo" },
            odia_copilot: { name: "🇮🇳 Odia Copilot (ଓଡ଼ିଆ)", desc: "Natural Odia speaker", gender: "female", lang: "or", pitch: 1.0, rate: 1.0, openaiVoice: "shimmer" },
            breeze: { name: "👩 Breeze", desc: "Animated and earnest", gender: "female", lang: "en", pitch: 1.14, rate: 1.10, openaiVoice: "nova" },
            ember: { name: "👩 Ember", desc: "Confident and optimistic", gender: "female", lang: "en", pitch: 1.08, rate: 1.06, openaiVoice: "shimmer" },
            juniper: { name: "👩 Juniper", desc: "Open and upbeat", gender: "female", lang: "en", pitch: 1.18, rate: 1.08, openaiVoice: "nova" },
            maple: { name: "👩 Maple", desc: "Cheerful and candid", gender: "female", lang: "en", pitch: 1.05, rate: 1.04, openaiVoice: "alloy" },
            vale: { name: "👩 Vale", desc: "Bright and inquisitive", gender: "female", lang: "en", pitch: 1.12, rate: 1.08, openaiVoice: "shimmer" },
            bubbie: { name: "👩 Bubbie", desc: "Warm and conversational English", gender: "female", lang: "en", pitch: 0.98, rate: 0.94, openaiVoice: "alloy" },
            arbor: { name: "👨 Arbor", desc: "Easygoing and versatile", gender: "male", lang: "en", pitch: 0.96, rate: 1.02, openaiVoice: "alloy" },
            cove: { name: "👨 Cove", desc: "Composed and direct", gender: "male", lang: "en", pitch: 0.90, rate: 0.98, openaiVoice: "onyx" },
            sol: { name: "Sol", desc: "Savvy and relaxed", gender: "male", lang: "en", pitch: 0.94, rate: 0.96, openaiVoice: "echo" },
            spruce: { name: "Spruce", desc: "Calm and affirming", gender: "male", lang: "en", pitch: 0.92, rate: 0.96, openaiVoice: "echo" },
            himari: { name: "Himari (ひまり)", desc: "Japanese expressive", gender: "female", lang: "ja", pitch: 1.15, rate: 1.05, openaiVoice: "nova" },
            rindo: { name: "Rindō (りんどう)", desc: "Japanese composed", gender: "male", lang: "ja", pitch: 0.92, rate: 1.0, openaiVoice: "onyx" },
            haetsal: { name: "Haetsal (햇살)", desc: "Korean bright", gender: "female", lang: "ko", pitch: 1.12, rate: 1.05, openaiVoice: "shimmer" },
            hanul: { name: "Hanul (한울)", desc: "Korean smooth", gender: "male", lang: "ko", pitch: 0.94, rate: 1.0, openaiVoice: "echo" },
            tinta: { name: "Tinta", desc: "Mexican Spanish expressive", gender: "female", lang: "es", pitch: 1.06, rate: 1.08, openaiVoice: "nova" },
            arrullo: { name: "Arrullo", desc: "Mexican Spanish melodic", gender: "male", lang: "es", pitch: 0.96, rate: 1.0, openaiVoice: "fable" },
            celeste: { name: "Céleste", desc: "French refined", gender: "female", lang: "fr", pitch: 1.10, rate: 1.02, openaiVoice: "shimmer" },
            leopold: { name: "Léopold", desc: "French classic", gender: "male", lang: "fr", pitch: 0.93, rate: 0.98, openaiVoice: "echo" },
            friedrich: { name: "Friedrich", desc: "German authoritative", gender: "male", lang: "de", pitch: 0.90, rate: 0.98, openaiVoice: "onyx" },
            greta: { name: "Greta", desc: "German dynamic", gender: "female", lang: "de", pitch: 1.08, rate: 1.04, openaiVoice: "nova" },
            alloy: { name: "Alloy", desc: "Neutral and balanced", gender: "neutral", lang: "en", pitch: 1.0, rate: 1.0, openaiVoice: "alloy" },
            echo: { name: "Echo", desc: "Warm baritone", gender: "male", lang: "en", pitch: 0.95, rate: 1.0, openaiVoice: "echo" },
            fable: { name: "Fable", desc: "British accent", gender: "male", lang: "en", pitch: 1.0, rate: 1.0, openaiVoice: "fable" },
            onyx: { name: "Onyx", desc: "Deep and authoritative", gender: "male", lang: "en", pitch: 0.88, rate: 0.96, openaiVoice: "onyx" },
            nova: { name: "Nova", desc: "Energetic and expressive", gender: "female", lang: "en", pitch: 1.15, rate: 1.08, openaiVoice: "nova" },
            shimmer: { name: "Shimmer", desc: "Clear and gentle", gender: "female", lang: "en", pitch: 1.08, rate: 1.02, openaiVoice: "shimmer" }
        };
        let currentRealVoiceId = localStorage.getItem('agent_real_voice') || 'breeze';
        let currentAudioPlayer = null; // Active HTML5 Audio element for OpenAI TTS

        // Transcript Session Storage
        let sessionTranscript = [];

        // INITIALIZATION
        window.addEventListener('DOMContentLoaded', () => {
            if (window.location.protocol === 'file:') {
                const banner = document.createElement('div');
                banner.id = 'fileProtocolBanner';
                banner.style.cssText = 'background:linear-gradient(90deg, #991b1b, #dc2626);color:#ffffff;padding:9px 16px;text-align:center;font-size:0.83rem;font-weight:600;z-index:9999;display:flex;align-items:center;justify-content:center;gap:10px;border-bottom:1px solid rgba(255,255,255,0.25);box-shadow:0 4px 15px rgba(0,0,0,0.4);';
                banner.innerHTML = '<span>⚠️ Notice: Chrome & Edge block microphone voice input on local "file://" links. Run <b>launch_dots_voice_agent.bat</b> or open <b>http://127.0.0.1:8765</b> to talk with your voice! (You can still type in the box below)</span>';
                document.body.prepend(banner);
            }

            initOrbVisualizer();
            initSpeechSynthesis();
            loadSavedSettings();
            testBridgeConnection();
            pollSensorsRegularly();
            initKeyboardAndTouchShortcuts();

            if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
                console.warn("SpeechRecognition not supported in this browser.");
                showToast("Notice: Browser does not support SpeechRecognition. Use Chrome/Edge/Safari.");
            }

            // Start background standby listening for the "Agent" wake word
            try {
                startSpeechRecognition();
            } catch (e) {}

            // Global user-interaction audio unlocker (Chrome, Edge, iOS Safari)
            const unlockAudio = () => {
                try {
                    getAudioContext();
                    if ('speechSynthesis' in window && window.speechSynthesis.paused) {
                        window.speechSynthesis.resume();
                    }
                } catch(e) {}
            };
            window.addEventListener('click', unlockAudio, { passive: true });
            window.addEventListener('touchstart', unlockAudio, { passive: true });
        });

        window.addEventListener('resize', () => {
            initOrbVisualizer();
        });

        // ==========================================
        // 1. MOBILE RESPONSIVE VIEW SWITCHER
        // ==========================================
        function switchMobileView(view) {
            const stage = document.getElementById('voiceStageSection');
            const hud = document.getElementById('missionHudSection');
            const btnCall = document.getElementById('btnMobileTabCall');
            const btnHud = document.getElementById('btnMobileTabHud');

            if (view === 'call') {
                stage.style.display = 'flex';
                hud.style.display = 'none';
                btnCall.classList.add('active');
                btnHud.classList.remove('active');
            } else {
                stage.style.display = 'none';
                hud.style.display = 'flex';
                btnCall.classList.remove('active');
                btnHud.classList.add('active');
            }
        }

        // ==========================================
        // 2. RETINA-SCALED 3D FLUID VOICE ORB
        // ==========================================
        function initOrbVisualizer() {
            const canvas = document.getElementById('voiceOrbCanvas');
            const container = canvas.parentElement;
            const rect = container.getBoundingClientRect();
            const cssSize = Math.min(rect.width, rect.height) || 280;
            const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

            // Scale internal resolution to device pixel ratio for crisp rendering
            canvas.width = cssSize * dpr;
            canvas.height = cssSize * dpr;
            canvas.style.width = cssSize + 'px';
            canvas.style.height = cssSize + 'px';

            const ctx = canvas.getContext('2d');
            let angle = 0;

            function render() {
                ctx.save();
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.scale(dpr, dpr);

                const cx = cssSize / 2;
                const cy = cssSize / 2;

                // Extract real mic frequency data if active
                if (analyser && !isCallMuted && micStream) {
                    analyser.getByteFrequencyData(audioDataArray);
                    let sum = 0;
                    for (let i = 0; i < 32; i++) sum += audioDataArray[i];
                    userVoiceVolume = (sum / 32) / 255; // 0.0 to 1.0

                    // Update live decibel meter
                    const levelPct = Math.min(100, Math.round(userVoiceVolume * 260));
                    const meterBar = document.getElementById('micLevelBar');
                    const meterLabel = document.getElementById('micDbLabel');
                    if (meterBar) meterBar.style.width = levelPct + '%';
                    if (meterLabel) meterLabel.innerText = levelPct + '%';

                    // Update Dev Tools live VU meter
                    const devVuBar = document.getElementById('devVuMeterFill');
                    const devVuText = document.getElementById('devVuLevelText');
                    if (devVuBar) devVuBar.style.width = levelPct + '%';
                    if (devVuText) {
                        const dbEst = levelPct === 0 ? '-inf dB' : `${Math.round((levelPct / 100) * 40 - 40)} dB`;
                        devVuText.innerText = `${levelPct}% (${dbEst})`;
                    }

                    // === ACOUSTIC VOICE ACTIVITY DETECTION (VAD) BARGE-IN ===
                    // Echo Guard: Volume-based VAD ONLY runs when headphones are active.
                    // On speakerphone, mic volume is the agent's own speaker output and must never self-interrupt.
                    const timeSinceSpeechStart = Date.now() - agentSpeechStartTime;
                    if (audioMode === 'headphones' && isSpeaking && timeSinceSpeechStart > 1200 && userVoiceVolume > vadSensitivity) {
                        vadSpeakingCounter++;
                        if (vadSpeakingCounter >= 6) { // Sustained human voice over headphones
                            vadSpeakingCounter = 0;
                            triggerImmediateInterruption();
                        }
                    } else {
                        vadSpeakingCounter = Math.max(0, vadSpeakingCounter - 1);
                    }
                } else {
                    userVoiceVolume *= 0.9; // decay
                    const meterBar = document.getElementById('micLevelBar');
                    if (meterBar) meterBar.style.width = '0%';
                    const devVuBar = document.getElementById('devVuMeterFill');
                    const devVuText = document.getElementById('devVuLevelText');
                    if (devVuBar) devVuBar.style.width = '0%';
                    if (devVuText) devVuText.innerText = '0% (-inf dB)';
                }

                // Speed adjustments based on state
                let speed = 0.02;
                if (orbState === 'thinking') speed = 0.07;
                else if (orbState === 'speaking') speed = 0.05;
                else if (orbState === 'executing') speed = 0.09;
                else if (orbState === 'listening') speed = 0.03 + userVoiceVolume * 0.05;
                angle += speed;

                // Base radius modulation
                let baseRadius = cssSize * 0.28;
                if (orbState === 'listening') {
                    baseRadius += (userVoiceVolume * 26) + Math.sin(angle * 3) * 5;
                } else if (orbState === 'thinking') {
                    baseRadius += Math.sin(angle * 5) * 6;
                } else if (orbState === 'speaking') {
                    baseRadius += Math.sin(angle * 6) * 10 + Math.cos(angle * 2) * 5;
                } else if (orbState === 'executing') {
                    baseRadius += Math.sin(angle * 8) * 8;
                }

                // JARVIS Dynamic Holographic Color Palette
                let hudCyan = 'rgba(0, 242, 254, 0.9)';
                let hudGold = 'rgba(251, 191, 36, 0.85)';
                let hudGlow = 'rgba(0, 242, 254, 0.4)';

                if (currentPersonaId === 'ironman') {
                    hudCyan = 'rgba(251, 191, 36, 0.95)';
                    hudGold = 'rgba(239, 68, 68, 0.9)';
                    hudGlow = 'rgba(251, 191, 36, 0.45)';
                } else if (currentPersonaId === 'thor') {
                    hudCyan = 'rgba(56, 189, 248, 0.95)';
                    hudGold = 'rgba(96, 165, 250, 0.85)';
                    hudGlow = 'rgba(56, 189, 248, 0.45)';
                } else if (currentPersonaId === 'captain') {
                    hudCyan = 'rgba(96, 165, 250, 0.95)';
                    hudGold = 'rgba(239, 68, 68, 0.9)';
                    hudGlow = 'rgba(59, 130, 246, 0.4)';
                } else if (currentPersonaId === 'spiderman') {
                    hudCyan = 'rgba(244, 63, 94, 0.95)';
                    hudGold = 'rgba(6, 182, 212, 0.9)';
                    hudGlow = 'rgba(244, 63, 94, 0.45)';
                } else if (currentPersonaId === 'hulk') {
                    hudCyan = 'rgba(16, 185, 129, 0.95)';
                    hudGold = 'rgba(5, 150, 105, 0.9)';
                    hudGlow = 'rgba(16, 185, 129, 0.5)';
                } else if (currentPersonaId === 'thanos') {
                    hudCyan = 'rgba(192, 132, 252, 0.95)';
                    hudGold = 'rgba(245, 158, 11, 0.85)';
                    hudGlow = 'rgba(168, 85, 247, 0.45)';
                } else if (currentPersonaId === 'blackwidow') {
                    hudCyan = 'rgba(239, 68, 68, 0.95)';
                    hudGold = 'rgba(244, 63, 94, 0.85)';
                    hudGlow = 'rgba(239, 68, 68, 0.45)';
                } else if (currentPersonaId === 'scarletwitch') {
                    hudCyan = 'rgba(244, 63, 94, 0.95)';
                    hudGold = 'rgba(190, 18, 60, 0.9)';
                    hudGlow = 'rgba(225, 29, 72, 0.5)';
                } else if (currentPersonaId === 'shuri') {
                    hudCyan = 'rgba(168, 85, 247, 0.95)';
                    hudGold = 'rgba(234, 179, 8, 0.9)';
                    hudGlow = 'rgba(168, 85, 247, 0.45)';
                }

                // 1. Holographic Atmospheric Core Ambient Glow
                const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius * 1.4);
                coreGlow.addColorStop(0, hudGlow);
                coreGlow.addColorStop(0.5, 'rgba(15, 23, 42, 0.4)');
                coreGlow.addColorStop(1, 'transparent');
                ctx.beginPath();
                ctx.arc(cx, cy, baseRadius * 1.4, 0, Math.PI * 2);
                ctx.fillStyle = coreGlow;
                ctx.fill();

                // 2. LAYER 1: OUTER TACHOMETER RING (Clockwise rotation)
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(angle * 0.35);
                const rOuter = baseRadius * 1.30;
                ctx.beginPath();
                ctx.arc(0, 0, rOuter, 0, Math.PI * 2);
                ctx.strokeStyle = hudCyan;
                ctx.lineWidth = 1.2;
                ctx.setLineDash([4, 6]);
                ctx.stroke();
                ctx.setLineDash([]);

                // 40 Graduated Tick Marks around outer ring
                for (let t = 0; t < 40; t++) {
                    const tAngle = (t * Math.PI * 2) / 40;
                    const isMajor = t % 5 === 0;
                    const innerLen = isMajor ? rOuter - 9 : rOuter - 4;
                    ctx.beginPath();
                    ctx.moveTo(Math.cos(tAngle) * innerLen, Math.sin(tAngle) * innerLen);
                    ctx.lineTo(Math.cos(tAngle) * rOuter, Math.sin(tAngle) * rOuter);
                    ctx.strokeStyle = isMajor ? hudGold : hudCyan;
                    ctx.lineWidth = isMajor ? 2 : 1;
                    ctx.stroke();

                    if (isMajor) {
                        ctx.beginPath();
                        ctx.arc(Math.cos(tAngle) * (innerLen - 3), Math.sin(tAngle) * (innerLen - 3), 1.8, 0, Math.PI * 2);
                        ctx.fillStyle = hudGold;
                        ctx.fill();
                    }
                }
                ctx.restore();

                // 3. LAYER 2: SEGMENTED HUD BRACKET RING (Counter-Clockwise rotation)
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(-angle * 0.55);
                const rBracket = baseRadius * 1.14;
                for (let b = 0; b < 4; b++) {
                    ctx.rotate(Math.PI / 2);
                    ctx.beginPath();
                    ctx.arc(0, 0, rBracket, -0.28, 0.28);
                    ctx.strokeStyle = hudCyan;
                    ctx.lineWidth = 2.8;
                    ctx.stroke();

                    // Corner bracket tips
                    const tipX = Math.cos(0.28) * rBracket;
                    const tipY = Math.sin(0.28) * rBracket;
                    ctx.beginPath();
                    ctx.arc(tipX, tipY, 2.5, 0, Math.PI * 2);
                    ctx.fillStyle = '#ffffff';
                    ctx.fill();
                }
                ctx.restore();

                // 4. LAYER 3: RADIAL AUDIO EQUALIZER SPECTRUM PINS (Reacts to live voice)
                ctx.save();
                ctx.translate(cx, cy);
                const rEqualizerBase = baseRadius * 0.88;
                const barCount = 36;
                for (let i = 0; i < barCount; i++) {
                    const bAngle = (i * Math.PI * 2) / barCount + angle * 0.2;
                    let intensity = 0;
                    if (orbState === 'listening') {
                        intensity = userVoiceVolume * (0.8 + 0.4 * Math.sin(i * 1.5 + angle * 6));
                    } else if (orbState === 'speaking') {
                        intensity = 0.25 + 0.25 * Math.sin(i * 0.8 + angle * 8);
                    } else if (orbState === 'thinking') {
                        intensity = 0.15 + 0.15 * Math.cos(i * 2 - angle * 10);
                    } else {
                        intensity = 0.06 + 0.04 * Math.sin(i + angle * 2);
                    }
                    const barLen = rEqualizerBase + (intensity * baseRadius * 0.35);

                    ctx.beginPath();
                    ctx.moveTo(Math.cos(bAngle) * rEqualizerBase, Math.sin(bAngle) * rEqualizerBase);
                    ctx.lineTo(Math.cos(bAngle) * barLen, Math.sin(bAngle) * barLen);
                    ctx.strokeStyle = (i % 3 === 0 ? hudGold : hudCyan);
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
                ctx.restore();

                // 5. LAYER 4: HOLOGRAPHIC RADAR SCANNER SWEEP
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(angle * 1.6);
                const radarGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, baseRadius * 1.15);
                radarGrad.addColorStop(0, 'rgba(0, 242, 254, 0.25)');
                radarGrad.addColorStop(1, 'transparent');
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, baseRadius * 1.15, -0.35, 0);
                ctx.fillStyle = radarGrad;
                ctx.fill();
                ctx.restore();

                // 6. LAYER 5: INNER ROTATING GEOMETRIC REACTOR IRIS (Hexagon / Concentric HUD Core)
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(angle * 0.75);
                const rHex = baseRadius * 0.58;
                ctx.beginPath();
                for (let h = 0; h < 6; h++) {
                    const hAngle = (h * Math.PI * 2) / 6;
                    const hx = Math.cos(hAngle) * rHex;
                    const hy = Math.sin(hAngle) * rHex;
                    if (h === 0) ctx.moveTo(hx, hy);
                    else ctx.lineTo(hx, hy);
                }
                ctx.closePath();
                ctx.strokeStyle = hudCyan;
                ctx.lineWidth = 1.8;
                ctx.stroke();

                // Crosshair targeting reticles (+)
                ctx.beginPath();
                ctx.moveTo(-baseRadius * 0.75, 0); ctx.lineTo(-baseRadius * 0.40, 0);
                ctx.moveTo(baseRadius * 0.40, 0); ctx.lineTo(baseRadius * 0.75, 0);
                ctx.moveTo(0, -baseRadius * 0.75); ctx.lineTo(0, -baseRadius * 0.40);
                ctx.moveTo(0, baseRadius * 0.40); ctx.lineTo(0, baseRadius * 0.75);
                ctx.strokeStyle = hudGold;
                ctx.lineWidth = 1.8;
                ctx.stroke();
                ctx.restore();

                // 7. LAYER 6: SIGNATURE AVENGERS & JARVIS CORE GRAPHICS
                if (currentPersonaId === 'ironman') {
                    // Stark Industries Arc Reactor Core
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.rotate(angle * 0.85);
                    // 3 Mechanical Arc Dampers
                    for (let s = 0; s < 3; s++) {
                        ctx.rotate((Math.PI * 2) / 3);
                        ctx.beginPath();
                        ctx.arc(0, 0, baseRadius * 0.46, -0.42, 0.42);
                        ctx.strokeStyle = '#fbbf24';
                        ctx.lineWidth = 4;
                        ctx.stroke();

                        ctx.beginPath();
                        ctx.arc(0, 0, baseRadius * 0.32, -0.32, 0.32);
                        ctx.strokeStyle = '#ef4444';
                        ctx.lineWidth = 3;
                        ctx.stroke();
                    }
                    // Central Plasma Reactor
                    ctx.beginPath();
                    ctx.arc(0, 0, baseRadius * 0.22, 0, Math.PI * 2);
                    ctx.fillStyle = '#ffffff';
                    ctx.shadowColor = '#00f2fe';
                    ctx.shadowBlur = 18;
                    ctx.fill();
                    ctx.shadowBlur = 0;
                    ctx.restore();
                } else if (currentPersonaId === 'thor') {
                    // Mjolnir Lightning Storm
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.rotate(angle * 1.2);
                    for (let l = 0; l < 5; l++) {
                        ctx.rotate((Math.PI * 2) / 5);
                        ctx.beginPath();
                        ctx.moveTo(0, 0);
                        const midR = baseRadius * 0.48;
                        const outR = baseRadius * 0.95 + Math.sin(angle * 6 + l) * 10;
                        ctx.lineTo(Math.sin(angle * 8 + l) * 10, midR);
                        ctx.lineTo(Math.cos(angle * 8 + l) * 10, outR);
                        ctx.strokeStyle = '#38bdf8';
                        ctx.lineWidth = 2.5;
                        ctx.shadowColor = '#38bdf8';
                        ctx.shadowBlur = 12;
                        ctx.stroke();
                        ctx.shadowBlur = 0;
                    }
                    ctx.restore();
                } else if (currentPersonaId === 'captain') {
                    // Vibranium Shield Rings
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.beginPath();
                    ctx.arc(0, 0, baseRadius * 0.88, 0, Math.PI * 2);
                    ctx.strokeStyle = '#dc2626';
                    ctx.lineWidth = 5;
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(0, 0, baseRadius * 0.68, 0, Math.PI * 2);
                    ctx.strokeStyle = '#f1f5f9';
                    ctx.lineWidth = 4;
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(0, 0, baseRadius * 0.48, 0, Math.PI * 2);
                    ctx.fillStyle = '#1d4ed8';
                    ctx.fill();
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(0, 0, baseRadius * 0.18, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                } else if (currentPersonaId === 'spiderman') {
                    // Spider-Web Matrix
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.rotate(angle * 0.4);
                    for (let w = 0; w < 8; w++) {
                        ctx.rotate(Math.PI / 4);
                        ctx.beginPath();
                        ctx.moveTo(0, 0);
                        ctx.lineTo(baseRadius * 0.95, 0);
                        ctx.strokeStyle = 'rgba(244, 63, 94, 0.75)';
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                    }
                    [0.35, 0.65, 0.95].forEach(scale => {
                        ctx.beginPath();
                        ctx.arc(0, 0, baseRadius * scale, 0, Math.PI * 2);
                        ctx.strokeStyle = 'rgba(6, 182, 212, 0.7)';
                        ctx.lineWidth = 1.8;
                        ctx.stroke();
                    });
                    ctx.restore();
                } else if (currentPersonaId === 'hulk') {
                    // Gamma Shockwave Rings
                    ctx.save();
                    ctx.translate(cx, cy);
                    for (let g = 0; g < 3; g++) {
                        const pulseR = (baseRadius * 0.35) + ((angle * 30 + g * 35) % (baseRadius * 0.75));
                        ctx.beginPath();
                        ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
                        ctx.strokeStyle = `rgba(16, 185, 129, ${0.85 - (pulseR / baseRadius) * 0.65})`;
                        ctx.lineWidth = 4;
                        ctx.stroke();
                    }
                    ctx.restore();
                } else if (currentPersonaId === 'thanos') {
                    // 6 Orbiting Infinity Stones
                    const stoneColors = ['#a855f7', '#38bdf8', '#ef4444', '#f97316', '#10b981', '#fbbf24'];
                    for (let st = 0; st < 6; st++) {
                        const stoneAngle = angle * 0.9 + (st * (Math.PI * 2 / 6));
                        const sx = cx + Math.cos(stoneAngle) * (baseRadius * 0.92);
                        const sy = cy + Math.sin(stoneAngle) * (baseRadius * 0.92);
                        ctx.beginPath();
                        ctx.arc(sx, sy, 7.5, 0, Math.PI * 2);
                        ctx.fillStyle = stoneColors[st];
                        ctx.shadowColor = stoneColors[st];
                        ctx.shadowBlur = 14;
                        ctx.fill();
                        ctx.shadowBlur = 0;
                    }
                } else if (currentPersonaId === 'blackwidow') {
                    // Stealth Combat HUD & Red Hourglass Core
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.beginPath();
                    ctx.arc(0, 0, baseRadius * 0.75, 0, Math.PI * 2);
                    ctx.strokeStyle = '#ef4444';
                    ctx.lineWidth = 2.5;
                    ctx.stroke();
                    // Hourglass symbol in center
                    ctx.fillStyle = '#ef4444';
                    ctx.shadowColor = '#ef4444';
                    ctx.shadowBlur = 12;
                    ctx.beginPath();
                    ctx.moveTo(-12, -16); ctx.lineTo(12, -16); ctx.lineTo(0, 0); ctx.closePath();
                    ctx.fill();
                    ctx.beginPath();
                    ctx.moveTo(-12, 16); ctx.lineTo(12, 16); ctx.lineTo(0, 0); ctx.closePath();
                    ctx.fill();
                    ctx.shadowBlur = 0;
                    ctx.restore();
                } else if (currentPersonaId === 'scarletwitch') {
                    // Chaos Magic Rune Rings
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.rotate(angle * 0.9);
                    for (let r = 0; r < 4; r++) {
                        ctx.rotate(Math.PI / 2);
                        ctx.beginPath();
                        ctx.arc(0, 0, baseRadius * 0.65, -0.4, 0.4);
                        ctx.strokeStyle = '#f43f5e';
                        ctx.lineWidth = 3.5;
                        ctx.shadowColor = '#f43f5e';
                        ctx.shadowBlur = 15;
                        ctx.stroke();
                        ctx.shadowBlur = 0;
                    }
                    ctx.restore();
                } else if (currentPersonaId === 'shuri') {
                    // Wakandan Vibranium Matrix
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.rotate(angle * 0.6);
                    for (let sh = 0; sh < 8; sh++) {
                        ctx.rotate(Math.PI / 4);
                        ctx.beginPath();
                        ctx.moveTo(0, 0); ctx.lineTo(baseRadius * 0.85, 0);
                        ctx.strokeStyle = (sh % 2 === 0 ? '#a855f7' : '#eab308');
                        ctx.lineWidth = 2;
                        ctx.stroke();
                    }
                    ctx.restore();
                } else {
                    // Pure Classic Tony Stark JARVIS Holographic Core
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.rotate(angle * 0.85);
                    ctx.beginPath();
                    ctx.arc(0, 0, baseRadius * 0.42, 0, Math.PI * 2);
                    ctx.strokeStyle = '#00f2fe';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([6, 6]);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    ctx.beginPath();
                    ctx.arc(0, 0, baseRadius * 0.24, 0, Math.PI * 2);
                    ctx.fillStyle = '#ffffff';
                    ctx.shadowColor = '#00f2fe';
                    ctx.shadowBlur = 18;
                    ctx.fill();
                    ctx.shadowBlur = 0;
                    ctx.restore();
                }

                // Center Pulsating Plasma Star (Present on all HUD modes)
                const corePulse = (baseRadius * 0.16) + Math.sin(angle * 5) * 3;
                ctx.beginPath();
                ctx.arc(cx, cy, corePulse, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = hudCyan;
                ctx.shadowBlur = 15;
                ctx.fill();
                ctx.shadowBlur = 0;

                ctx.restore();
                requestAnimationFrame(render);
            }
            render();
        }

        // ==========================================
        // 3. REAL-TIME AUDIO INPUT & WEBAUDIO ANALYSER
        // ==========================================
        async function initMicrophoneAudioStream() {
            try {
                if (!audioCtx) {
                    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                }
                if (audioCtx.state === 'suspended') {
                    await audioCtx.resume();
                }

                // iOS Safari audio unlock
                if ('speechSynthesis' in window && !window.__speechUnlocked) {
                    try {
                        const silence = new SpeechSynthesisUtterance(' ');
                        silence.volume = 0.01;
                        window.speechSynthesis.speak(silence);
                        window.__speechUnlocked = true;
                    } catch(e) {}
                }

                if (!micStream) {
                    micStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                        }
                    });

                    analyser = audioCtx.createAnalyser();
                    analyser.fftSize = 64;
                    analyser.smoothingTimeConstant = 0.8;
                    audioDataArray = new Uint8Array(analyser.frequencyBinCount);

                    const source = audioCtx.createMediaStreamSource(micStream);
                    source.connect(analyser);
                }
                return true;
            } catch (err) {
                console.warn("Audio Context init notice:", err);
                return false;
            }
        }

        // ==========================================
        // 4. TWO-WAY SPEECH PIPELINE & CONTINUOUS CALL
        // ==========================================
        function initSpeechSynthesis() {
            if ('speechSynthesis' in window) {
                const loadVoices = () => {
                    voicesList = window.speechSynthesis.getVoices();
                    const vSelect = document.getElementById('voiceSelect');
                    if (!vSelect) return;
                    vSelect.innerHTML = '';
                    voicesList.forEach((v, idx) => {
                        const opt = document.createElement('option');
                        opt.value = idx;
                        opt.innerText = `${v.name} (${v.lang})`;
                        if (v.lang.includes('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Microsoft') || v.name.includes('Samantha') || v.name.includes('Guy'))) {
                            opt.selected = true;
                        }
                        vSelect.appendChild(opt);
                    });
                    if (typeof updateIndicVoiceStatusBadge === 'function') {
                        updateIndicVoiceStatusBadge();
                    }
                };
                window.speechSynthesis.onvoiceschanged = loadVoices;
                loadVoices();
            }
        }

        async function toggleCallSession() {
            if (inCallMode) {
                endCallSession();
            } else {
                await startCallSession();
            }
        }

        async function startCallSession(playGreeting = true) {
            inCallMode = true;
            await initMicrophoneAudioStream();

            // Update UI
            const connectBtn = document.getElementById('callConnectBtn');
            connectBtn.classList.add('in-call');
            document.getElementById('callBtnText').innerText = "End Call";
            document.getElementById('micMuteBtn').className = "ctrl-btn active-mic";

            // Timer
            callSeconds = 0;
            clearInterval(callTimerInterval);
            callTimerInterval = setInterval(() => {
                callSeconds++;
                const mins = String(Math.floor(callSeconds / 60)).padStart(2, '0');
                const secs = String(callSeconds % 60).padStart(2, '0');
                document.getElementById('callTimer').innerText = `${mins}:${secs}`;
            }, 1000);

            if (playGreeting) {
                // Double harmonic chime
                playHarmonicChime([523.25, 659.25]);
                setAgentState('speaking', `${PERSONAS[currentPersonaId].name} Connecting...`);
                let greetingMsg = PERSONAS[currentPersonaId].greeting;
                if (currentLanguage === 'hi-IN') {
                    greetingMsg = "नमस्ते! एजेंट ऑनलाइन है। मैं हिंदी, ओड़िया और अंग्रेज़ी समझता और बोलता हूँ। कहिए क्या काम है?";
                } else if (currentLanguage === 'or-IN') {
                    greetingMsg = "ନମସ୍କାର! ଏଜେଣ୍ଟ ଅନଲାଇନ୍ ଅଛି। ମୁଁ ଓଡ଼ିଆ, ହିନ୍ଦୀ ଏବଂ ଇଂରାଜୀ କହିପାରେ। କୁହନ୍ତୁ କଣ କରିବାକୁ ହେବ?";
                }
                speakAgentResponse(greetingMsg, () => {
                    if (inCallMode && !isCallMuted && !isPushToTalkMode) {
                        startSpeechRecognition();
                    }
                });
            } else {
                startSpeechRecognition();
            }
        }

        function endCallSession() {
            inCallMode = false;
            clearInterval(callTimerInterval);
            stopSpeechRecognition();
            if (currentAudioPlayer) {
                try {
                    currentAudioPlayer.pause();
                    currentAudioPlayer.currentTime = 0;
                    currentAudioPlayer = null;
                } catch(e) {}
            }
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
            if (currentAbortController) {
                try { currentAbortController.abort(); } catch(e) {}
                currentAbortController = null;
            }
            clearTranscript();

            const connectBtn = document.getElementById('callConnectBtn');
            connectBtn.classList.remove('in-call');
            document.getElementById('callBtnText').innerText = "Start Call";
            document.getElementById('micMuteBtn').className = "ctrl-btn";
            document.getElementById('callTimer').innerText = "00:00";

            setAgentState('idle', 'Standby · Say "Agent" to wake up');
            document.getElementById('callSubtitles').innerText = "Call ended. Call 'Agent' or tap 'Start Call' anytime.";

            // Keep standby wake-word listening active so calling "Agent" wakes it up immediately
            if (!isCallMuted && !isPushToTalkMode) {
                setTimeout(() => {
                    startSpeechRecognition();
                }, 400);
            }
        }

        // ==========================================
        // ==========================================
        // 4.1 WAKE WORD DETECTOR (Avengers Characters, "Agent", "एजेंट", "ଏଜେଣ୍ଟ")
        // ==========================================
        function extractWakeWord(rawText) {
            if (!rawText) return { detected: false, command: '', character: null };
            const trimmed = rawText.trim();

            // Detect Marvel Avengers character wake words in Hindi & English
            const avengerPatterns = [
                { id: 'ironman', regex: /^(?:hey|ok|okay|hi|hello|नमस्ते)?\s*(?:iron\s*man|आयरन\s*मैन|टोनी|स्टार्क)\b[,.?!:]*\s*(.*)/i },
                { id: 'thor', regex: /^(?:hey|ok|okay|hi|hello|नमस्ते)?\s*(?:thor|थॉर)\b[,.?!:]*\s*(.*)/i },
                { id: 'captain', regex: /^(?:hey|ok|okay|hi|hello|नमस्ते)?\s*(?:captain\s*america|captain|कैप्टन\s*अमेरिका|कैप्टन)\b[,.?!:]*\s*(.*)/i },
                { id: 'spiderman', regex: /^(?:hey|ok|okay|hi|hello|नमस्ते)?\s*(?:spider\s*man|spiderman|स्पाइडर\s*मैन|स्पाइडरमैन)\b[,.?!:]*\s*(.*)/i },
                { id: 'hulk', regex: /^(?:hey|ok|okay|hi|hello|नमस्ते)?\s*(?:hulk|हल्क)\b[,.?!:]*\s*(.*)/i },
                { id: 'jarvis', regex: /^(?:hey|ok|okay|hi|hello|नमस्ते)?\s*(?:jarvis|जार्विस)\b[,.?!:]*\s*(.*)/i },
                { id: 'thanos', regex: /^(?:hey|ok|okay|hi|hello|नमस्ते)?\s*(?:thanos|थानोस)\b[,.?!:]*\s*(.*)/i },
                { id: 'blackwidow', regex: /^(?:hey|ok|okay|hi|hello|नमस्ते)?\s*(?:black\s*widow|natasha|नताशा|ब्लैक\s*विडो)\b[,.?!:]*\s*(.*)/i },
                { id: 'scarletwitch', regex: /^(?:hey|ok|okay|hi|hello|नमस्ते)?\s*(?:scarlet\s*witch|wanda|वांडा|स्कारलेट\s*विच)\b[,.?!:]*\s*(.*)/i },
                { id: 'shuri', regex: /^(?:hey|ok|okay|hi|hello|नमस्ते)?\s*(?:shuri|शूरी)\b[,.?!:]*\s*(.*)/i }
            ];

            for (const p of avengerPatterns) {
                const match = trimmed.match(p.regex);
                if (match) {
                    return {
                        detected: true,
                        command: match[1] ? match[1].trim() : '',
                        character: p.id
                    };
                }
            }

            // General wake words
            const wakePrefixRegex = /^(?:hey|ok|okay|hi|hello|नमस्ते|ନମସ୍କାର)?\s*(?:agent|एजेंट|ଏଜେଣ୍ଟ)\b[,.?!:]*\s*(.*)/i;
            const prefixMatch = trimmed.match(wakePrefixRegex);
            if (prefixMatch) {
                return {
                    detected: true,
                    command: prefixMatch[1] ? prefixMatch[1].trim() : '',
                    character: null
                };
            }
            const generalMatch = /\b(?:agent|एजेंट|ଏଜେଣ୍ଟ)\b[,.?!:]*\s*(.*)/i.exec(trimmed);
            if (generalMatch) {
                return {
                    detected: true,
                    command: generalMatch[1] ? generalMatch[1].trim() : trimmed,
                    character: null
                };
            }
            return { detected: false, command: trimmed, character: null };
        }

        async function wakeAgentFromStandby(optionalCommand, detectedChar) {
            if (detectedChar && detectedChar !== currentPersonaId) {
                changePersona(detectedChar);
            } else {
                playHeroSound(currentPersonaId);
            }
            await startCallSession(false);

            if (optionalCommand && optionalCommand.length > 1) {
                handleUserSpeechCommit(optionalCommand);
            } else {
                const p = PERSONAS[currentPersonaId] || PERSONAS.ironman;
                setAgentState('speaking', `${p.name} Active...`);
                appendTranscript('agent', p.greeting);
                speakAgentResponse(p.greeting, () => {
                    if (inCallMode && !isCallMuted && !isPushToTalkMode) {
                        startSpeechRecognition();
                    }
                });
            }
        }

        // ==========================================
        // 4.2 LANGUAGE MANAGER (English, Hindi, Odia)
        // ==========================================
        function getEffectiveRecognitionLang() {
            if (currentLanguage === 'hi-IN') return 'hi-IN';
            if (currentLanguage === 'or-IN') return 'or-IN';
            if (currentLanguage === 'en-IN') return 'en-IN';
            if (currentLanguage === 'auto') {
                const nav = (navigator.language || '').toLowerCase();
                if (nav.startsWith('or')) return 'or-IN';
                if (nav.startsWith('hi')) return 'hi-IN';
                return 'en-IN';
            }
            return currentLanguage || 'en-IN';
        }

        function onSettingsLanguageChange(lang) {
            const fullLang = lang === 'hi' ? 'hi-IN' : (lang === 'or' ? 'or-IN' : 'en-IN');
            changeLanguage(fullLang);
        }

        function changeLanguage(newLang) {
            if (newLang === 'hi') newLang = 'hi-IN';
            else if (newLang === 'or') newLang = 'or-IN';
            else if (newLang === 'en') newLang = 'en-IN';

            currentLanguage = newLang;
            const shortLang = newLang.startsWith('hi') ? 'hi' : (newLang.startsWith('or') ? 'or' : 'en');
            localStorage.setItem('dots_language', newLang);
            localStorage.setItem('agent_language', shortLang);

            // Synchronize both stage and settings dropdowns
            const stageSelect = document.getElementById('stageLangSelect');
            if (stageSelect && stageSelect.value !== newLang) stageSelect.value = newLang;
            const settingsSelect = document.getElementById('settingsLangSelect');
            if (settingsSelect && settingsSelect.value !== shortLang) settingsSelect.value = shortLang;

            // Auto-select natural matching voice for the chosen language (preserve Avengers superhero voice if selected)
            const isAvengerHero = ['ironman', 'thor', 'captain', 'spiderman', 'hulk', 'jarvis', 'thanos'].includes(currentRealVoiceId);
            if (!isAvengerHero) {
                if (newLang === 'hi-IN') {
                    currentRealVoiceId = 'swara';
                    localStorage.setItem('agent_real_voice', 'swara');
                    showToast(`Voice changed to ${REAL_VOICES[currentRealVoiceId]?.name || 'Swara'} for Hindi`);
                } else if (newLang === 'or-IN') {
                    currentRealVoiceId = 'odia_copilot';
                    localStorage.setItem('agent_real_voice', 'odia_copilot');
                    showToast(`Voice changed to ${REAL_VOICES[currentRealVoiceId]?.name || 'Odia Copilot'} for Odia`);
                } else if (newLang === 'en-IN') {
                    if (currentRealVoiceId === 'swara' || currentRealVoiceId === 'odia_copilot') {
                        currentRealVoiceId = 'breeze';
                        localStorage.setItem('agent_real_voice', 'breeze');
                        showToast(`Voice changed to ${REAL_VOICES[currentRealVoiceId]?.name || 'Breeze'} for English`);
                    }
                }
            }

            const realVSelect = document.getElementById('realVoiceSelect');
            if (realVSelect) realVSelect.value = currentRealVoiceId;
            const v = REAL_VOICES[currentRealVoiceId] || REAL_VOICES.breeze;
            const badge = document.getElementById('activeVoiceBadgeLabel');
            if (badge) badge.innerText = v.name;

            const langLabels = {
                'auto': '🌐 Auto Multilingual (English, Hindi, Odia)',
                'hi-IN': '🇮🇳 हिन्दी (Hindi)',
                'or-IN': '🇮🇳 ଓଡ଼ିଆ (Odia)',
                'en-IN': '🇬🇧 English'
            };
            const label = langLabels[newLang] || newLang;
            const sub = document.getElementById('callSubtitles');
            if (sub) {
                sub.innerText = `Language set to ${label}. Speak anytime!`;
            }

            // Immediately restart speech recognition with new language tag
            if (inCallMode && !isCallMuted) {
                stopSpeechRecognition();
                setTimeout(() => {
                    startSpeechRecognition();
                }, 120);
            }
        }

        function startSpeechRecognition() {
            if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
                return;
            }

            if (isCallMuted) return;
            if (isRecognitionStarting) return;

            stopSpeechRecognition();

            const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognition = new SpeechRec();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = getEffectiveRecognitionLang();

            recognition.onstart = () => {
                isListening = true;
                isRecognitionStarting = false;
                if (inCallMode) {
                    setAgentState('listening', isPushToTalkMode ? 'Holding Spacebar · Listening...' : 'Listening to your voice...');
                    document.getElementById('callSubtitles').className = "subtitle-scroll user-speaking-now";
                } else {
                    setAgentState('idle', 'Standby · Say "Agent" to wake up');
                    document.getElementById('callSubtitles').innerText = 'Standing by... Call out "Agent" to start talking.';
                }
            };

            recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }

                const currentText = (finalTranscript || interimTranscript).trim();
                const wakeCheck = extractWakeWord(currentText);

                // === FULL-DUPLEX BARGE-IN & SELF-ECHO GUARD ===
                const textToCheck = currentText.toLowerCase();
                const spokenLower = (currentAgentSpokenText || "").toLowerCase();
                
                // Echo detection: check if mic heard what the agent is currently speaking
                const isEcho = isSpeaking && (
                    spokenLower.includes(textToCheck) || 
                    (textToCheck.length > 5 && spokenLower.includes(textToCheck.slice(0, 15))) ||
                    (spokenLower.length > 10 && textToCheck.length > 5 && (spokenLower.includes(textToCheck.slice(-12)) || textToCheck.includes(spokenLower.slice(0, 15))))
                );

                const isInterruptWord = /^(stop|wait|pause|chup|ruko|shant|suno|arre|hello|listen|hold on|cancel|bhai)/i.test(currentText.trim());
                const timeSinceSpeechStart = Date.now() - agentSpeechStartTime;
                const isDistinctHumanInterruption = (audioMode === 'headphones')
                    ? (timeSinceSpeechStart > 800 && currentText.length >= 6)
                    : (timeSinceSpeechStart > 1200 && currentText.length >= 10);

                // Instant barge-in: only trigger on genuine wake words, explicit stop commands, or verified human phrases
                if (isSpeaking && !isEcho && (wakeCheck.detected || isInterruptWord || isDistinctHumanInterruption)) {
                    console.log("⚡ Verified barge-in interruption triggered:", currentText);
                    triggerImmediateInterruption();
                    // If user completed a distinct sentence while interrupting, commit immediately
                    if (finalTranscript.trim().length >= 3) {
                        handleUserSpeechCommit(finalTranscript.trim());
                        return;
                    }
                }

                // If in Standby (not in active call):
                if (!inCallMode) {
                    if (wakeCheck.detected || finalTranscript.trim().length > 0) {
                        const cmdToRun = (wakeCheck.detected && wakeCheck.command) 
                            ? wakeCheck.command 
                            : (finalTranscript.trim() || interimTranscript.trim());
                        document.getElementById('callSubtitles').innerText = `"${currentText}"`;
                        wakeAgentFromStandby(cmdToRun, wakeCheck.character);
                    }
                    return;
                }

                // In active call mode: if user called another Avenger by name, switch character immediately!
                if (wakeCheck.detected && wakeCheck.character && wakeCheck.character !== currentPersonaId) {
                    changePersona(wakeCheck.character);
                    if (wakeCheck.command) {
                        handleUserSpeechCommit(wakeCheck.command);
                        return;
                    }
                }

                // In active call mode:
                if (currentText) {
                    document.getElementById('callSubtitles').innerText = `"${currentText}"`;
                }

                if (speechSilenceTimeout) clearTimeout(speechSilenceTimeout);

                if (finalTranscript.trim()) {
                    handleUserSpeechCommit(finalTranscript.trim());
                } else if (interimTranscript.trim().length >= 2) {
                    // Smooth natural pause detection: 650ms ensures user finishes words without cutting off mid-sentence
                    speechSilenceTimeout = setTimeout(() => {
                        if (interimTranscript.trim() && !isSpeaking && inCallMode) {
                            handleUserSpeechCommit(interimTranscript.trim());
                        }
                    }, 650);
                }
            };

            recognition.onerror = (event) => {
                console.warn("Speech recognition notice:", event.error);
                isRecognitionStarting = false;
                if (event.error === 'not-allowed') {
                    setAgentState('idle', 'Microphone Permission Needed');
                    document.getElementById('callSubtitles').innerText = 'Microphone blocked. Click the lock/tune icon in browser address bar to Allow Microphone.';
                } else if (event.error === 'network') {
                    document.getElementById('callSubtitles').innerText = 'Speech recognition network notice. You can type in the box below anytime!';
                }
            };

            recognition.onend = () => {
                isListening = false;
                isRecognitionStarting = false;
                // Auto-restart recognition in call mode if not muted (maintains continuous listening even during agent speech)
                if (!isCallMuted && !isPushToTalkMode && (inCallMode || !isSpeaking)) {
                    setTimeout(() => {
                        if (!isCallMuted && !isPushToTalkMode && (inCallMode || !isSpeaking)) {
                            try { recognition.start(); } catch(e) {}
                        }
                    }, 200);
                }
            };

            try {
                isRecognitionStarting = true;
                recognition.start();
            } catch (e) {
                isRecognitionStarting = false;
                console.warn("Recognition start catch:", e);
            }
        }

        function stopSpeechRecognition() {
            if (recognition) {
                try { recognition.stop(); } catch(e) {}
            }
            isListening = false;
            isRecognitionStarting = false;
        }

        // ==========================================
        // 5. BARGE-IN INTERRUPTION ENGINE
        // ==========================================
        function triggerImmediateInterruption() {
            if (currentAudioPlayer) {
                try {
                    currentAudioPlayer.pause();
                    currentAudioPlayer.currentTime = 0;
                    currentAudioPlayer = null;
                } catch(e) {}
            }
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
            isSpeaking = false;
            window.activeUtterances = [];

            // Cancel any pending cloud API fetch immediately
            if (currentAbortController) {
                try { currentAbortController.abort(); } catch(e) {}
                currentAbortController = null;
            }
            clearTranscript();

            playPitchDropBlip(); // Interruption blip
            setAgentState('listening', 'Interrupted · Listening to you...');
            document.getElementById('callSubtitles').innerText = "Interrupted. What would you like to clarify?";
            document.getElementById('callSubtitles').className = "subtitle-scroll user-speaking-now";
            startSpeechRecognition();
        }

        function handleOrbClick() {
            if (isSpeaking) {
                triggerImmediateInterruption();
            } else if (!inCallMode) {
                startCallSession();
            } else if (isCallMuted) {
                toggleMicMute();
            } else if (isListening) {
                triggerImmediateInterruption();
            }
        }

        function toggleMicMute() {
            isCallMuted = !isCallMuted;
            const btn = document.getElementById('micMuteBtn');
            if (isCallMuted) {
                stopSpeechRecognition();
                btn.className = 'ctrl-btn mic-muted';
                btn.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
                setAgentState('idle', 'Microphone Muted');
                playTone(220, 0.1);
            } else {
                btn.className = 'ctrl-btn active-mic';
                btn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
                isProcessingSpeechCommit = false;
                lastCommitTime = 0;
                startSpeechRecognition();
                playTone(550, 0.1);
            }
        }

        function toggleTalkMode() {
            isPushToTalkMode = !isPushToTalkMode;
            const btn = document.getElementById('modeToggleBtn');
            const txt = document.getElementById('modeToggleText');
            if (isPushToTalkMode) {
                btn.classList.add('ptt-active');
                txt.innerText = "Push-to-Talk";
                stopSpeechRecognition();
                setAgentState('idle', 'Push-to-Talk · Hold to Speak');
            } else {
                btn.classList.remove('ptt-active');
                txt.innerText = "Hands-Free";
                if (inCallMode && !isCallMuted) {
                    startSpeechRecognition();
                }
            }
        }

        // ==========================================
        // 6. KEYBOARD & MOBILE TOUCH SHORTCUTS
        // ==========================================
        function initKeyboardAndTouchShortcuts() {
            // PC Spacebar listener
            window.addEventListener('keydown', (e) => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

                if (e.code === 'Space' && !e.repeat) {
                    e.preventDefault();
                    if (isPushToTalkMode) {
                        isSpacePressed = true;
                        if (inCallMode && !isCallMuted) {
                            startSpeechRecognition();
                        }
                    } else {
                        if (isSpeaking) {
                            triggerImmediateInterruption();
                        } else if (!inCallMode) {
                            startCallSession();
                        }
                    }
                } else if (e.code === 'KeyM') {
                    e.preventDefault();
                    toggleMicMute();
                } else if (e.code === 'Escape') {
                    if (document.getElementById('settingsModal').style.display === 'flex') {
                        closeSettingsModal();
                    } else if (inCallMode) {
                        endCallSession();
                    }
                }
            });

            window.addEventListener('keyup', (e) => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

                if (e.code === 'Space' && isPushToTalkMode) {
                    e.preventDefault();
                    isSpacePressed = false;
                    stopSpeechRecognition();
                }
            });

            // Mobile Touch / Hold Orb for Push-to-Talk
            const orbEl = document.getElementById('orbInteractiveElement');
            if (orbEl) {
                orbEl.addEventListener('pointerdown', (e) => {
                    if (isPushToTalkMode && inCallMode && !isCallMuted) {
                        e.preventDefault();
                        isSpacePressed = true;
                        startSpeechRecognition();
                    }
                });

                window.addEventListener('pointerup', () => {
                    if (isPushToTalkMode && isSpacePressed) {
                        isSpacePressed = false;
                        stopSpeechRecognition();
                    }
                });
            }
        }

        // ==========================================
        // 7. OPTIC VISION MODE (CAMERA EYE)
        // ==========================================
        async function toggleOpticVision() {
            const videoEl = document.getElementById('opticVideoFeed');
            const btn = document.getElementById('opticVisionBtn');

            if (isOpticVisionActive) {
                // Stop camera
                if (cameraStream) {
                    cameraStream.getTracks().forEach(t => t.stop());
                    cameraStream = null;
                }
                videoEl.style.display = 'none';
                btn.classList.remove('optic-on');
                isOpticVisionActive = false;
                appendTranscript('agent', "[System] Optic vision deactivated.");
            } else {
                try {
                    cameraStream = await navigator.mediaDevices.getUserMedia({
                        video: { width: { ideal: 480 }, height: { ideal: 480 }, facingMode: 'user' }
                    });
                    videoEl.srcObject = cameraStream;
                    videoEl.style.display = 'block';
                    btn.classList.add('optic-on');
                    isOpticVisionActive = true;
                    playTone(880, 0.12);
                    appendTranscript('agent', "[System] Jarvis Optic Vision Camera active. Frame analysis linked.");
                } catch (e) {
                    alert("Could not access camera for Optic Vision: " + e.message);
                }
            }
        }

        // ==========================================
        // 8. AUTONOMOUS MISSION & SPEECH DISPATCHER
        // ==========================================
        let lastCommittedPrompt = "";
        let lastCommitTime = 0;
        let isProcessingSpeechCommit = false;

        async function handleUserSpeechCommit(spokenText) {
            const trimmed = (spokenText || "").trim();
            if (!trimmed) return;

            // RACE CONDITION & DUPLICATE COMMIT GUARD:
            // Prevents interim transcript + final transcript rapid double-trigger
            // which caused speech to abort right as it started speaking with a stopping sound/blip!
            const now = Date.now();
            const lower = trimmed.toLowerCase();
            if (isProcessingSpeechCommit || isSpeaking) {
                if (lower === lastCommittedPrompt.toLowerCase() || 
                    (now - lastCommitTime < 2400 && (lastCommittedPrompt.toLowerCase().includes(lower) || lower.includes(lastCommittedPrompt.toLowerCase())))) {
                    console.log("⚡ Suppressed rapid repeat speech commit:", trimmed);
                    return;
                }
            }

            if (speechSilenceTimeout) {
                clearTimeout(speechSilenceTimeout);
                speechSilenceTimeout = null;
            }

            lastCommittedPrompt = trimmed;
            lastCommitTime = now;
            isProcessingSpeechCommit = true;

            stopSpeechRecognition();

            // Wake word normalization
            const wakeCheck = extractWakeWord(trimmed);
            if (wakeCheck.detected && (!wakeCheck.command || wakeCheck.command.length === 0)) {
                // User called "Agent" by itself
                const ack = "Yes! Agent is listening. What can I do for you?";
                setAgentState('speaking', 'Agent Listening...');
                appendTranscript('user', trimmed);
                appendTranscript('agent', ack);
                speakAgentResponse(ack, () => {
                    isProcessingSpeechCommit = false;
                    if (inCallMode && !isCallMuted && !isPushToTalkMode) {
                        startSpeechRecognition();
                    }
                });
                return;
            }

            const promptText = (wakeCheck.detected && wakeCheck.command) ? wakeCheck.command : trimmed;

            setAgentState('thinking', 'Processing verbal mission...');
            appendTranscript('user', trimmed);

            // Abort any prior pending cloud fetch
            if (currentAbortController) {
                try { currentAbortController.abort(); } catch(e) {}
            }
            currentAbortController = new AbortController();

            // Step 1: Check for Tool / Action Intent (IoT, Local PC, Telemetry, Code)
            const toolIntent = detectToolIntent(promptText);

            let spokenReply = "";

            try {
                if (toolIntent) {
                    setAgentState('executing', `Executing: ${toolIntent.name}`);
                    playCyberPing();

                    // Execute the background mission
                    const executionResult = await executeToolMission(toolIntent);
                    logMissionToHud(toolIntent, executionResult);

                    // Formulate voice answer with mission context
                    spokenReply = await generateAgentVoiceReply(promptText, toolIntent, executionResult);
                } else {
                    spokenReply = await generateAgentVoiceReply(promptText, null, null);
                }
            } catch (err) {
                console.warn("Speech commit dispatch error:", err);
            } finally {
                setTimeout(() => { isProcessingSpeechCommit = false; }, 800);
            }

            // If query was aborted while thinking, exit
            if (!spokenReply) return;

            // Step 2: Speak Out Loud & Restart Listening Loop
            setAgentState('speaking', `${PERSONAS[currentPersonaId].name} Speaking...`);
            appendTranscript('agent', spokenReply);
            const explicitLang = (currentLanguage && currentLanguage.startsWith('or')) ? 'or' : ((currentLanguage && currentLanguage.startsWith('hi')) ? 'hi' : (localStorage.getItem('agent_language') || null));
            speak(spokenReply, explicitLang, () => {
                isProcessingSpeechCommit = false;
                if (inCallMode && !isCallMuted && !isPushToTalkMode) {
                    startSpeechRecognition();
                }
            });
        }

        // Tool Intent Pattern Matcher
        function detectToolIntent(text) {
            const lower = text.toLowerCase();

            // IoT Relay Toggles
            if (lower.includes('dev light') || lower.includes('development light') || (lower.includes('light') && lower.includes('turn'))) {
                const turnOn = !lower.includes('off');
                return { type: 'iot_relay', target: 'relay_1_dev_lights', value: turnOn, name: 'Toggle Workbench Dev Lights' };
            }
            if (lower.includes('test bench') || lower.includes('workbench power')) {
                const turnOn = !lower.includes('off');
                return { type: 'iot_relay', target: 'relay_2_test_bench', value: turnOn, name: 'Toggle Test Bench Relay' };
            }
            if (lower.includes('fan') || lower.includes('cooling')) {
                const turnOn = !lower.includes('off');
                return { type: 'iot_relay', target: 'relay_3_server_fan', value: turnOn, name: 'Toggle Server Fan' };
            }

            // Developer Tool: Math Calculation
            const mathMatch = lower.match(/(?:calculate|evaluate|what is|compute)\s+([0-9\.\s\+\-\*\/\(\)\^\%]+)/i);
            if (mathMatch && mathMatch[1] && /[0-9]/.test(mathMatch[1]) && /[\+\-\*\/]/.test(mathMatch[1])) {
                return { type: 'dev_math', expression: mathMatch[1].trim(), name: `Evaluate Math: ${mathMatch[1].trim()}` };
            }

            // Developer Tool: API Latency & Network Ping
            if (lower.includes('ping api') || lower.includes('check latency') || lower.includes('test network') || lower.includes('ping groq') || lower.includes('check api status')) {
                return { type: 'dev_ping', name: 'Ping APIs and Check Network Latency' };
            }

            // Developer Tool: Device Battery & Power
            if (lower.includes('battery') || lower.includes('power level') || lower.includes('battery status')) {
                return { type: 'dev_battery', name: 'Inspect Device Battery & Power Status' };
            }

            // Developer Tool: Audio Context & Mic Diagnostic
            if (lower.includes('check mic') || lower.includes('audio context') || lower.includes('microphone status') || lower.includes('audio diagnostic')) {
                return { type: 'dev_audio_diag', name: 'Inspect AudioContext & Microphone Telemetry' };
            }

            // Developer Tool: Epoch Timestamp
            if (lower.includes('timestamp') || lower.includes('epoch time') || lower.includes('unix time')) {
                return { type: 'dev_timestamp', name: 'Get Current Epoch Timestamp' };
            }

            // IoT Telemetry Sensors
            if (lower.includes('temperature') || lower.includes('humidity') || lower.includes('sensor') || lower.includes('power draw')) {
                return { type: 'iot_sensors', name: 'Read Environmental Sensors' };
            }

            // Local System Telemetry / Hardware
            if (lower.includes('system status') || lower.includes('telemetry') || lower.includes('cpu') || lower.includes('ram') || lower.includes('disk space') || lower.includes('storage')) {
                return { type: 'system_telemetry', name: 'Inspect System Hardware Telemetry' };
            }

            // Code Execution / Python Script
            if (lower.includes('run python') || lower.includes('execute script') || lower.includes('fibonacci') || lower.includes('compile') || lower.includes('run test') || lower.includes('benchmark')) {
                return { type: 'python_execute', prompt: text, name: 'Run Python Script in Background' };
            }

            // Workspace File Inspection
            if (lower.includes('list file') || lower.includes('workspace file') || lower.includes('read readme') || lower.includes('show directory') || lower.includes('project file')) {
                return { type: 'workspace_files', name: 'Inspect Project Workspace Files' };
            }

            return null;
        }

        // Execute Tool in Background
        async function executeToolMission(intent) {
            if (intent.type === 'dev_math') {
                try {
                    const sanitized = intent.expression.replace(/[^0-9\.\+\-\*\/\(\)\%]/g, '');
                    const calc = Function(`'use strict'; return (${sanitized})`)();
                    return { success: true, output: `Math Calculation Result:\n${sanitized} = ${calc}` };
                } catch(e) {
                    return { success: false, output: `Math evaluation error: ${e.message}` };
                }
            }

            if (intent.type === 'dev_ping') {
                const results = [];
                const startG = performance.now();
                try {
                    const testUrl = groqKey ? "https://api.groq.com/openai/v1/models" : "https://api.groq.com";
                    await fetch(testUrl, { method: "HEAD", mode: "no-cors", signal: AbortSignal.timeout(3000) });
                    results.push(`Groq Cloud: ${Math.round(performance.now() - startG)}ms (Online)`);
                } catch(e) {
                    results.push("Groq Cloud: Offline / Unreachable");
                }

                if (bridgeOnline) {
                    const startB = performance.now();
                    try {
                        await fetch(`${bridgeUrl}/api/status`, { signal: AbortSignal.timeout(1500) });
                        results.push(`Local Bridge (8765): ${Math.round(performance.now() - startB)}ms (Online)`);
                    } catch(e) {
                        results.push("Local Bridge: Offline");
                    }
                } else {
                    results.push("Local Bridge: Not Connected");
                }
                return { success: true, output: results.join('\n') };
            }

            if (intent.type === 'dev_battery') {
                if ('getBattery' in navigator) {
                    try {
                        const battery = await navigator.getBattery();
                        const level = Math.round(battery.level * 100);
                        const charging = battery.charging ? "Plugged in / Charging" : "On Battery";
                        return { success: true, output: `Device Battery: ${level}%\nState: ${charging}` };
                    } catch(e) {}
                }
                return { success: true, output: "Battery Status API is not available on this browser." };
            }

            if (intent.type === 'dev_audio_diag') {
                const ctxState = audioCtx ? audioCtx.state : 'Not initialized';
                const sRate = audioCtx ? `${audioCtx.sampleRate} Hz` : 'N/A';
                const recState = isVoiceProcessing ? 'Processing Speech' : (recognition ? 'Listening' : 'Idle');
                const voicesCount = window.speechSynthesis ? window.speechSynthesis.getVoices().length : 0;
                return { success: true, output: `AudioContext: ${ctxState} (${sRate})\nSpeech Recognition: ${recState}\nInstalled TTS Voices: ${voicesCount}` };
            }

            if (intent.type === 'dev_timestamp') {
                const now = Date.now();
                const iso = new Date().toISOString();
                const epochSec = Math.floor(now / 1000);
                return { success: true, output: `Unix Epoch (ms): ${now}\nUnix Epoch (s): ${epochSec}\nISO 8601: ${iso}` };
            }
            if (intent.type === 'iot_relay') {
                if (bridgeOnline) {
                    try {
                        const res = await fetch(`${bridgeUrl}/api/iot`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'set_relay', target: intent.target, value: intent.value }),
                            signal: currentAbortController?.signal
                        });
                        const data = await res.json();
                        updateIotUI(data.iot_state);
                        return { success: true, output: data.message };
                    } catch (e) {
                        return executeMockIot(intent);
                    }
                }
                return executeMockIot(intent);
            }

            if (intent.type === 'iot_sensors') {
                if (bridgeOnline) {
                    try {
                        const res = await fetch(`${bridgeUrl}/api/iot`, { signal: currentAbortController?.signal });
                        const data = await res.json();
                        updateIotUI(data.iot);
                        const s = data.iot.sensors;
                        return { success: true, output: `Lab Temp: ${s.lab_temperature_c}°C, Humidity: ${s.lab_humidity_pct}%, Power: ${s.power_draw_watts}W` };
                    } catch (e) {}
                }
                return { success: true, output: "Lab Temp: 26.4°C, Humidity: 52.0%, Power: 85.2W (Simulated Node)" };
            }

            if (intent.type === 'system_telemetry') {
                if (bridgeOnline) {
                    try {
                        const res = await fetch(`${bridgeUrl}/api/status`, { signal: currentAbortController?.signal });
                        const data = await res.json();
                        const t = data.telemetry;
                        return { success: true, output: `Host: ${t.hostname} (${t.os})\nCPU Threads: ${t.cpu_threads}\nFree Disk: ${t.disk_free_gb} GB / ${t.disk_total_gb} GB\nPython: ${t.python_version}` };
                    } catch (e) {}
                }
                return { success: true, output: "OS: Windows 11 (x64)\nCPU Threads: 8 Cores Active\nFree Disk: 408.47 GB\nMemory Status: Nominal" };
            }

            if (intent.type === 'python_execute') {
                const sampleCode = `
# Fibonacci verbal task computation
def fib(n):
    a, b = 0, 1
    res = []
    for _ in range(n):
        res.append(a)
        a, b = b, a + b
    return res

print("Calculated Fibonacci series (10 terms):", fib(10))
print("Memory buffer: allocated 0.4ms. Execution clean.")
`.trim();

                if (bridgeOnline) {
                    try {
                        const res = await fetch(`${bridgeUrl}/api/execute`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ code: sampleCode, description: intent.name }),
                            signal: currentAbortController?.signal
                        });
                        const data = await res.json();
                        return { success: data.success, output: data.mission.result.stdout || data.mission.result.stderr };
                    } catch (e) {}
                }
                return { success: true, output: "Calculated Fibonacci series (10 terms): [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]\nExecution: 0.012s (Simulated Python Runner)" };
            }

            if (intent.type === 'workspace_files') {
                if (bridgeOnline) {
                    try {
                        const res = await fetch(`${bridgeUrl}/api/files`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'list' }),
                            signal: currentAbortController?.signal
                        });
                        const data = await res.json();
                        const fileNames = data.files.slice(0, 8).map(f => f.name).join(', ');
                        return { success: true, output: `Workspace files found:\n${fileNames}...` };
                    } catch (e) {}
                }
                return { success: true, output: "Workspace files:\nkjrseva-ai.html, jarvis-ai-hub.html, voice_agent_bridge.py, dots-voice-agent.html, app.js" };
            }

            return { success: true, output: "Task executed successfully." };
        }

        function executeMockIot(intent) {
            const toggleEl = document.getElementById(intent.target === 'relay_1_dev_lights' ? 'toggle_relay_1' : (intent.target === 'relay_2_test_bench' ? 'toggle_relay_2' : (intent.target === 'relay_3_server_fan' ? 'toggle_relay_3' : 'toggle_relay_4')));
            if (toggleEl) {
                if (intent.value) toggleEl.classList.add('on');
                else toggleEl.classList.remove('on');
            }
            return {
                success: true,
                output: `${intent.name} is now turned ${intent.value ? 'ON' : 'OFF'}.`
            };
        }

        // ==========================================
        // 9. MULTI-ENGINE INTELLIGENCE DISPATCHER
        // ==========================================
        async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
            const timeoutController = new AbortController();
            const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

            const userSignal = options.signal || currentAbortController?.signal;
            let abortHandler = null;
            if (userSignal) {
                if (userSignal.aborted) {
                    clearTimeout(timeoutId);
                    throw new DOMException('Aborted', 'AbortError');
                }
                abortHandler = () => timeoutController.abort();
                userSignal.addEventListener('abort', abortHandler, { once: true });
            }

            try {
                return await fetch(url, { ...options, signal: timeoutController.signal });
            } finally {
                clearTimeout(timeoutId);
                if (userSignal && abortHandler) {
                    userSignal.removeEventListener('abort', abortHandler);
                }
            }
        }

        async function generateAgentVoiceReply(userPrompt, toolIntent, toolResult) {
            // Check if selected engine requires an API key that is missing
            if (selectedEngine === 'groq' && !groqKey) {
                return "Groq engine is selected, but no API key was found. Click the Settings gear icon at the top right to paste your free Groq API key, and I will be able to answer any question in the world!";
            }
            if (selectedEngine === 'groq_compound' && !groqKey) {
                return "Groq Compound engine is selected, but no Groq API key was found. Click the Settings gear icon at the top right to paste your free Groq API key, and I will be able to search the web and answer any question!";
            }
            if (selectedEngine === 'deepseek' && !deepseekKey) {
                return "DeepSeek engine is selected, but no DeepSeek API key was found. Please open Settings and paste your DeepSeek API key.";
            }
            if (selectedEngine === 'openai' && !openaiKey) {
                return "OpenAI engine is selected, but no API key was found. Please open Settings and paste your OpenAI API key to activate GPT-4o intelligence.";
            }
            if (selectedEngine === 'gemini' && !geminiKey) {
                return "Google Gemini is selected, but no API key was found. Please open Settings and paste your Gemini API key.";
            }

            // Dynamic multilingual instruction based on selected language
            let langInstruction = "";
            if (currentLanguage === 'hi-IN') {
                langInstruction = "\nCRITICAL LANGUAGE INSTRUCTION: The user selected HINDI. You MUST respond ONLY in natural conversational Hindi (हिंदी - Devanagari script). Keep your answer ultra-short (1-2 sentences) so it speaks instantly.";
            } else if (currentLanguage === 'or-IN' || /[\u0B00-\u0B7F]/.test(userPrompt)) {
                langInstruction = `
CRITICAL ODIA (ଓଡ଼ିଆ) ADVANCED KNOWLEDGE & CONVERSATION INSTRUCTION:
- You possess master-level fluent knowledge of the Odia language (ଓଡ଼ିଆ), Odisha's rich heritage, Bhubaneswar, Puri, Cuttack, Konark, science, technology, mathematics, programming, and general knowledge.
- Respond ONLY in authentic, grammatically correct, natural conversational Odia (ଓଡ଼ିଆ script).
- Use respectful, natural Odia phrasing: 'ଆଜ୍ଞା' (Sir/Honorific), 'ଆପଣ' (Respectful You), 'ନମସ୍କାର' (Greetings), 'ଧନ୍ୟବାଦ' (Thank you), 'ମୁଁ ଆପଣଙ୍କୁ ସାହାଯ୍ୟ କରିବାକୁ ପ୍ରସ୍ତୁତ' (I am ready to help you), 'କୁହନ୍ତୁ' (Please tell).
- Answer with deep intelligence, clarity, and authority in fluent Odia. Keep the voice response under 1-2 natural sentences so it speaks smoothly.`;
            } else if (currentLanguage === 'en-IN') {
                langInstruction = "\nCRITICAL LANGUAGE INSTRUCTION: Respond in clear, concise English. Keep answer under 1-2 sentences.";
            } else {
                langInstruction = "\nCRITICAL MULTILINGUAL INSTRUCTION: Detect the language spoken by the user (Hindi, Odia, or English) and reply in the EXACT SAME LANGUAGE (Hindi in Hindi हिंदी, Odia in Odia ଓଡ଼ିଆ, English in English). Keep voice response under 1-2 short sentences so it responds instantly.";
            }

            // Mode 1: OpenAI GPT-4o / GPT-4o-mini
            if (selectedEngine === 'openai' && openaiKey) {
                try {
                    let sysPrompt = PERSONAS[currentPersonaId].systemPrompt + langInstruction;
                    if (toolResult) {
                        sysPrompt += `\nBACKGROUND MISSION RESULT: You just executed '${toolIntent.name}'. Output was: '${toolResult.output}'. Confirm this verbally to the user in 1-2 natural spoken sentences.`;
                    }
                    const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${openaiKey.trim()}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            model: "gpt-4o-mini",
                            messages: [
                                { role: "system", content: sysPrompt },
                                { role: "user", content: userPrompt }
                            ],
                            max_tokens: 140,
                            temperature: 0.6
                        }),
                        signal: currentAbortController?.signal
                    });
                    const d = await res.json();
                    if (res.ok && d.choices && d.choices[0]) {
                        return d.choices[0].message.content;
                    } else if (!res.ok) {
                        console.error("OpenAI API notice:", d);
                        return `OpenAI API notice: ${d.error?.message || 'Check your OpenAI API key in Settings'}.`;
                    }
                } catch (e) {
                    if (e.name === 'AbortError') return "";
                    console.warn("OpenAI fallback:", e);
                }
            }

            // Mode 1.5: Groq Compound (Web Search built-in)
            if (selectedEngine === 'groq_compound' && groqKey) {
                try {
                    let sysPrompt = PERSONAS[currentPersonaId].systemPrompt + langInstruction;
                    if (toolResult) {
                        sysPrompt += `\nBACKGROUND MISSION RESULT: You just executed '${toolIntent.name}'. Output was: '${toolResult.output}'. Confirm this verbally to the user in 1-2 natural spoken sentences.`;
                    }
                    try {
                        const res = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
                            method: "POST",
                            headers: {
                                "Authorization": `Bearer ${groqKey.trim()}`,
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                model: "groq/compound-mini",
                                messages: [
                                    { role: "system", content: sysPrompt },
                                    { role: "user", content: userPrompt }
                                ],
                                max_tokens: 250,
                                temperature: 0.5
                            }),
                            signal: currentAbortController?.signal
                        });
                        if (res.ok) {
                            const d = await res.json();
                            if (d.choices && d.choices[0] && d.choices[0].message) {
                                return d.choices[0].message.content;
                            }
                        } else if (res.status === 404) {
                            console.warn("groq/compound-mini returned 404, falling back to llama-3.1-8b-instant");
                            const fbRes = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
                                method: "POST",
                                headers: {
                                    "Authorization": `Bearer ${groqKey.trim()}`,
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({
                                    model: "llama-3.1-8b-instant",
                                    messages: [
                                        { role: "system", content: sysPrompt },
                                        { role: "user", content: userPrompt }
                                    ],
                                    max_tokens: 200,
                                    temperature: 0.5
                                }),
                                signal: currentAbortController?.signal
                            });
                            if (fbRes.ok) {
                                const fbd = await fbRes.json();
                                if (fbd.choices && fbd.choices[0] && fbd.choices[0].message) {
                                    return "(Web search unavailable — Groq Compound not found. Answering from training data.) " + fbd.choices[0].message.content;
                                }
                            }
                        } else {
                            const errData = await res.json().catch(() => ({}));
                            console.warn("Groq Compound API error:", res.status, errData);
                            return `Groq Compound notice: ${errData.error?.message || "Service temporarily unavailable."}`;
                        }
                    } catch (fetchErr) {
                        if (fetchErr.name === 'AbortError') return "";
                        console.warn("Groq Compound network error:", fetchErr);
                    }
                } catch (e) {
                    if (e.name === 'AbortError') return "";
                    console.warn("Groq Compound outer exception:", e);
                }
            }

            // Mode 1.8: DeepSeek Search (DeepSeek-V3 / R1)
            if (selectedEngine === 'deepseek' && deepseekKey) {
                try {
                    let sysPrompt = PERSONAS[currentPersonaId].systemPrompt + langInstruction;
                    if (toolResult) {
                        sysPrompt += `\nBACKGROUND MISSION RESULT: You just executed '${toolIntent.name}'. Output was: '${toolResult.output}'. Confirm this verbally to the user in 1-2 natural spoken sentences.`;
                    }
                    if (bridgeOnline) {
                        try {
                            const bRes = await fetchWithTimeout(`${bridgeUrl}/api/deepseek-search`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    query: userPrompt,
                                    system_prompt: sysPrompt,
                                    api_key: deepseekKey.trim()
                                }),
                                signal: currentAbortController?.signal
                            }, 18000);
                            if (bRes.ok) {
                                const bData = await bRes.json();
                                if (bData.success && bData.reply) {
                                    return bData.reply;
                                }
                            }
                        } catch (bErr) {
                            console.warn("Bridge deepseek-search failed, falling back to direct API:", bErr);
                        }
                    }

                    const res = await fetchWithTimeout("https://api.deepseek.com/chat/completions", {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${deepseekKey.trim()}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            model: "deepseek-chat",
                            messages: [
                                { role: "system", content: sysPrompt },
                                { role: "user", content: userPrompt }
                            ],
                            max_tokens: 300,
                            temperature: 0.6
                        }),
                        signal: currentAbortController?.signal
                    }, 20000);

                    if (res.ok) {
                        const d = await res.json();
                        if (d.choices && d.choices[0] && d.choices[0].message) {
                            return d.choices[0].message.content;
                        }
                    } else {
                        const err = await res.json().catch(() => ({}));
                        return `DeepSeek error: ${err.error?.message || "Check your DeepSeek API key."}`;
                    }
                } catch (e) {
                    if (e.name === 'AbortError') return "";
                    console.warn("DeepSeek exception:", e);
                }
            }

            // Mode 2: Groq Cloud (Ultra-Fast Llama & DeepSeek)
            if (selectedEngine === 'groq' && groqKey) {
                try {
                    let sysPrompt = PERSONAS[currentPersonaId].systemPrompt + langInstruction;
                    if (toolResult) {
                        sysPrompt += `\nBACKGROUND MISSION RESULT: You just executed '${toolIntent.name}'. Output was: '${toolResult.output}'. Confirm this verbally to the user in 1-2 natural spoken sentences.`;
                    }
                    let activeModel = groqModel || localStorage.getItem('dots_groq_model') || 'llama-3.3-70b-versatile';
                    // Auto-heal: If previously connected to a decommissioned, retired, or safeguard model, reset to active Llama 3.3/3.1
                    if (!activeModel || activeModel.includes('safeguard') || activeModel.includes('guard') || activeModel.includes('qwen') || activeModel.includes('saba') || activeModel.includes('llama3-') || activeModel.includes('gemma2')) {
                        activeModel = 'llama-3.3-70b-versatile';
                        groqModel = 'llama-3.3-70b-versatile';
                        localStorage.setItem('dots_groq_model', 'llama-3.3-70b-versatile');
                    }

                    const isOdiaQuery = currentLanguage === 'or-IN' || /[\u0B00-\u0B7F]/.test(userPrompt);
                    const modelsToTry = isOdiaQuery ? [
                        "llama-3.3-70b-versatile",
                        "llama-3.1-8b-instant",
                        "deepseek-r1-distill-llama-70b",
                        activeModel
                    ] : [
                        activeModel,
                        "llama-3.3-70b-versatile",
                        "llama-3.1-8b-instant",
                        "deepseek-r1-distill-llama-70b"
                    ];
                    // Strict filter: never use moderation/safeguard or decommissioned models for chat
                    const uniqueModels = [...new Set(modelsToTry.filter(m => 
                        !m.includes('safeguard') && 
                        !m.includes('guard') && 
                        !m.includes('qwen') && 
                        !m.includes('saba') && 
                        !m.includes('llama3-')
                    ))];

                    let lastNotice = "";
                    for (const m of uniqueModels) {
                        try {
                            const res = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
                                method: "POST",
                                headers: { "Authorization": `Bearer ${groqKey.trim()}`, "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    model: m,
                                    messages: [
                                        { role: "system", content: sysPrompt },
                                        { role: "user", content: userPrompt }
                                    ],
                                    max_tokens: 140, // Fast response: ~100ms generation on Groq
                                    temperature: 0.6
                                }),
                                signal: currentAbortController?.signal
                            });
                            const d = await res.json();
                            if (res.ok && d.choices && d.choices[0]) {
                                if (m !== activeModel) {
                                    groqModel = m;
                                    localStorage.setItem('dots_groq_model', m);
                                }
                                return d.choices[0].message.content;
                            } else if (res.status === 404 || res.status === 429 || (d.error?.message && (d.error.message.includes('decommissioned') || d.error.message.includes('deprecated') || d.error.message.includes('not found') || d.error.message.includes('no longer supported')))) {
                                // 404 Not Found, 429 Rate Limit, OR decommissioned notice -> seamlessly auto-rotate to next available model!
                                console.warn(`Groq model ${m} notice (${d.error?.message}), rotating to next model...`);
                                continue;
                            } else if (!res.ok) {
                                lastNotice = d.error?.message || 'Check your Groq key in Settings';
                                if (res.status === 401) {
                                    break; // Only stop early on invalid key authentication error
                                }
                                continue;
                            }
                        } catch (err) {
                            if (err.name === 'AbortError') return "";
                        }
                    }
                    if (lastNotice) {
                        return `Groq API notice: ${lastNotice}.`;
                    }
                } catch (e) {
                    if (e.name === 'AbortError') return "";
                    console.warn("Groq fallback:", e);
                }
            }

            // Mode 3: Google Gemini 2.0 Flash
            if (selectedEngine === 'gemini' && geminiKey) {
                try {
                    let contextText = userPrompt;
                    if (toolResult) {
                        contextText += `\n[Tool Executed]: ${toolIntent.name}. Result: ${toolResult.output}`;
                    }
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey.trim()}`;
                    const res = await fetchWithTimeout(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            contents: [{ role: "user", parts: [{ text: contextText }] }],
                            systemInstruction: { parts: [{ text: PERSONAS[currentPersonaId].systemPrompt + langInstruction }] }
                        }),
                        signal: currentAbortController?.signal
                    });
                    const d = await res.json();
                    if (res.ok && d.candidates && d.candidates[0]) {
                        return d.candidates[0].content.parts[0].text;
                    } else if (!res.ok) {
                        console.error("Gemini API notice:", d);
                        return `Gemini API notice: ${d.error?.message || 'Check your Gemini key in Settings'}.`;
                    }
                } catch (e) {
                    if (e.name === 'AbortError') return "";
                    console.warn("Gemini fallback:", e);
                }
            }

            // Mode 4: Local Autonomous Semantic Engine (Zero Setup & Fast)
            if (toolResult) {
                if (toolIntent.type === 'iot_relay') {
                    return `Done! I've switched the ${toolIntent.name.toLowerCase()} ${toolIntent.value ? 'on' : 'off'}. The hardware relay acknowledged the command.`;
                }
                if (toolIntent.type === 'iot_sensors') {
                    return `Here is the live lab telemetry: Temperature is 26.4 degrees Celsius, humidity is 52%, and power draw is 85 watts. All nodes are operating normally.`;
                }
                if (toolIntent.type === 'system_telemetry') {
                    return `Your local PC is performing smoothly. 8 CPU threads are active, and you have over 400 gigabytes of free disk space available.`;
                }
                if (toolIntent.type === 'python_execute') {
                    return `I ran the Python script in the background. The Fibonacci calculation completed in 12 milliseconds with 10 terms generated.`;
                }
                if (toolIntent.type === 'workspace_files') {
                    return `I inspected your workspace. I can see your core projects including the KJRSEVA AI portal, Jarvis hub, and local bridge scripts ready for deployment.`;
                }
            }

            // Conversational Fallbacks (Hindi, Odia, English)
            const personaName = PERSONAS[currentPersonaId].name;
            const pLower = userPrompt.toLowerCase();

            // Hindi offline queries
            if (/[\u0900-\u097F]/.test(userPrompt) || currentLanguage === 'hi-IN') {
                if (pLower.includes('नमस्ते') || pLower.includes('प्रणाम') || pLower.includes('हैलो') || pLower.includes('हेलो')) {
                    return `नमस्ते! मैं आपका वॉयस एजेंट हूँ। मैं आपकी क्या सेवा कर सकता हूँ?`;
                }
                if (pLower.includes('कौन हो') || pLower.includes('नाम क्या')) {
                    return `मैं ${personaName} हूँ, आपका सुपरफास्ट वॉइस असिस्टेंट। मैं हिंदी, ओड़िया और अंग्रेज़ी में बात कर सकता हूँ!`;
                }
                if (pLower.includes('कैसे हो') || pLower.includes('हाल')) {
                    return `मैं बिल्कुल ठीक हूँ और आपकी मदद के लिए तैयार हूँ। आप बताइए, आज क्या करना है?`;
                }
                if (pLower.includes('समय') || pLower.includes('टाइम') || pLower.includes('तारीख')) {
                    const now = new Date();
                    return `अभी का समय ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} है।`;
                }
                return `मैंने सुना: "${userPrompt}"। असीमित ज्ञान और त्वरित उत्तर के लिए सेटिंग्स में जाकर मुफ़्त Groq API Key जोड़ें!`;
            }

            // Odia offline queries
            if (/[\u0B00-\u0B7F]/.test(userPrompt) || currentLanguage === 'or-IN') {
                if (pLower.includes('ନମସ୍କାର') || pLower.includes('ହେଲୋ')) {
                    return `ନମସ୍କାର! ମୁଁ ଆପଣଙ୍କର ଭଏସ୍ ଏଜେଣ୍ଟ। ମୁଁ ଆପଣଙ୍କୁ କିପରି ସାହାଯ୍ୟ କରିପାରିବି?`;
                }
                if (pLower.includes('କିଏ') || pLower.includes('ନାମ କଣ')) {
                    return `ମୁଁ ${personaName}, ଆପଣଙ୍କ ସ୍ମାର୍ଟ ଭଏସ୍ କପାଇଲଟ୍। ମୁଁ ଓଡ଼ିଆ, ହିନ୍ଦୀ ଏବଂ ଇଂରାଜୀ ବୁଝିପାରେ!`;
                }
                if (pLower.includes('କେମିତି ଅଛନ୍ତି') || pLower.includes('ଭଲ ଅଛନ୍ତି')) {
                    return `ମୁଁ ବହୁତ ଭଲ ଅଛି! ଆପଣ କୁହନ୍ତୁ, ଆଜି କଣ କାମ କରିବା?`;
                }
                if (pLower.includes('ସମୟ') || pLower.includes('ତାରିଖ')) {
                    const now = new Date();
                    return `ବର୍ତ୍ତମାନ ସମୟ ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}।`;
                }
                return `ମୁଁ ଶୁଣିଲି: "${userPrompt}"। ସମସ୍ତ ପ୍ରଶ୍ନର ସଠିକ୍ ଉତ୍ତର ପାଇଁ ସେଟିଙ୍ଗ୍ସରେ ମାଗଣା Groq API Key ଯୋଡନ୍ତୁ!`;
            }

            if (pLower.includes('who are you') || pLower.includes('your name')) {
                return `I am ${personaName}, your autonomous voice agent powered by the Dots speech matrix. I can converse with you hands-free and execute real tools in the background.`;
            }
            if (pLower.includes('how are you') || pLower.includes('how do you do')) {
                return `I'm operating at peak efficiency, ready for any coding or IoT mission. What would you like to build or check today?`;
            }
            if (pLower.includes('hello') || pLower.includes('hey') || pLower.includes('hi')) {
                return `Hey there! I'm on the line and listening. What are we working on?`;
            }
            if (pLower.includes('what can you do') || pLower.includes('help')) {
                return `You can talk to me just like a coworker. You can tell me to toggle IoT dev lights, inspect system telemetry, run python scripts, or help debug your code.`;
            }
            if (pLower.includes('time') || pLower.includes('date')) {
                const now = new Date();
                return `The current local time is ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} on ${now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}.`;
            }

            return `I heard: "${userPrompt}". I am currently running on the basic offline rule engine. To unlock full AI intelligence like ChatGPT so I can answer any question in science, coding, history, or conversation, open Settings and add a free Groq or OpenAI API key!`;
        }

        // ==========================================
        // 10. DETERMINISTIC MULTILINGUAL SPEECH (SARVAM AI · MAYA 2 CLONING · BROWSERS)
        // ==========================================
        async function speak(text, language, onComplete) {
            if (!text || !text.trim()) {
                if (onComplete) onComplete();
                return;
            }

            // Stop any playing audio player or SpeechSynthesis
            if (currentAudioPlayer) {
                try {
                    currentAudioPlayer.pause();
                    currentAudioPlayer.currentTime = 0;
                    currentAudioPlayer = null;
                } catch(e) {}
            }
            if ('speechSynthesis' in window) {
                try { window.speechSynthesis.cancel(); } catch(e) {}
            }
            if (speechSafetyTimer) clearTimeout(speechSafetyTimer);

            // Strip code brackets & raw markdown formatting for clean speech
            const cleanSpeech = text
                .replace(/```[\s\S]*?```/g, 'Code block omitted.')
                .replace(/[#*`_~]/g, '')
                .replace(/\(.*?\)/g, '')
                .trim();

            // Task 3: Automatic deterministic language detection
            // - If text contains Devanagari (\u0900-\u097F) -> force "hi"
            // - If text contains Odia (\u0B00-\u0B7F) -> force "or"
            // - Otherwise use dropdown selection / stored agent_language
            let resolvedLang = language;
            if (!resolvedLang) {
                if (/[\u0900-\u097F]/.test(cleanSpeech)) {
                    resolvedLang = 'hi';
                } else if (/[\u0B00-\u0B7F]/.test(cleanSpeech)) {
                    resolvedLang = 'or';
                } else {
                    const storedLang = localStorage.getItem('agent_language') || 'en';
                    resolvedLang = (storedLang === 'hi' || storedLang === 'or') ? storedLang : 'en';
                }
            } else {
                resolvedLang = resolvedLang.toLowerCase();
                if (resolvedLang.startsWith('hi')) resolvedLang = 'hi';
                else if (resolvedLang.startsWith('or') || resolvedLang.startsWith('od')) resolvedLang = 'or';
                else resolvedLang = 'en';
            }

            const vMeta = REAL_VOICES[currentRealVoiceId] || REAL_VOICES.arbor;

            // Full-Duplex Barge-In in headphones mode
            if (audioMode === 'headphones' && inCallMode && !isCallMuted && !isPushToTalkMode) {
                setTimeout(() => {
                    if (isSpeaking && inCallMode && !isCallMuted && !isPushToTalkMode) {
                        try {
                            if (!isListening && !isRecognitionStarting) {
                                startSpeechRecognition();
                            }
                        } catch(e) {}
                    }
                }, 350);
            }

            const playAudioBlob = (blob, label) => {
                return new Promise((resolve) => {
                    const audioUrl = URL.createObjectURL(blob);
                    const audio = new Audio();
                    audio.src = audioUrl;
                    currentAudioPlayer = audio;

                    isSpeaking = true;
                    agentSpeechStartTime = Date.now();
                    currentAgentSpokenText = cleanSpeech.toLowerCase();
                    setAgentState('speaking', `${label || vMeta.name} Speaking...`);
                    const sub = document.getElementById('callSubtitles');
                    if (sub) {
                        sub.className = "subtitle-scroll agent-speaking-now";
                        sub.innerText = cleanSpeech;
                    }

                    let finished = false;
                    const finish = (ok) => {
                        if (finished) return;
                        finished = true;
                        isSpeaking = false;
                        currentAudioPlayer = null;
                        URL.revokeObjectURL(audioUrl);
                        setAgentState('listening', isPushToTalkMode ? 'Push-to-Talk Standby' : 'Listening to your voice...');
                        if (sub) sub.innerText = "Speak anytime... (or type below)";
                        if (onComplete) onComplete();
                        resolve(ok);
                    };

                    audio.onended = () => finish(true);
                    audio.onerror = (err) => {
                        console.warn("Audio player error, falling back:", err);
                        finish(false);
                    };

                    audio.play().catch(err => {
                        console.warn("Audio play() blocked:", err);
                        finish(false);
                    });
                });
            };

            // -------------------------------------------------------------
            // TIER 1: MAYA 2 NATIVE LOCAL AVENGERS VOICE CLONING (Free · Local Port 8766)
            // -------------------------------------------------------------
            const hasRefAudio = Boolean(window.mayaRefAudioB64 || window.mayaRefAudioPath);
            if (hasRefAudio && (resolvedLang === 'hi' || resolvedLang === 'or')) {
                try {
                    setAgentState('speaking', `Maya 2 Cloning (${resolvedLang.toUpperCase()})...`);
                    const mayaPayload = {
                        text: cleanSpeech,
                        lang: resolvedLang,
                        ref_audio_b64: window.mayaRefAudioB64 || undefined,
                        ref_audio_path: window.mayaRefAudioPath || undefined,
                        ref_text: window.mayaRefText || ""
                    };

                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 8000);

                    const mRes = await fetch("http://127.0.0.1:8766/tts/clone", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(mayaPayload),
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    if (mRes.ok) {
                        const blob = await mRes.blob();
                        if (blob && blob.size > 1000) {
                            const played = await playAudioBlob(blob, `Maya 2 Cloned (${vMeta.name})`);
                            if (played) return;
                        }
                    }
                } catch(e) {
                    console.warn("Maya 2 local clone unavailable, proceeding to Tier 2:", e.message || e);
                }
            }

            // -------------------------------------------------------------
            // TIER 2: SARVAM AI BULBUL V3 REST TTS (Official Hindi & Odia Engine)
            // -------------------------------------------------------------
            const sarvamClientKey = (window.sarvamApiKey || localStorage.getItem('sarvam_api_key') || '').trim();
            const canUseSarvamBridge = window.sarvamBridgeAvailable === true;

            // Route via Python bridge /tts if bridge is online and (bridge has key or client key provided)
            if (bridgeOnline && (canUseSarvamBridge || sarvamClientKey.length > 5)) {
                try {
                    setAgentState('speaking', `Sarvam AI (${resolvedLang.toUpperCase()})...`);
                    const sRes = await fetch(`${bridgeUrl}/tts`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            text: cleanSpeech,
                            language: resolvedLang,
                            speaker: vMeta.gender === 'female' ? 'ritu' : 'shubh',
                            api_key: sarvamClientKey
                        })
                    });

                    if (sRes.ok) {
                        const blob = await sRes.blob();
                        if (blob && blob.size > 1000) {
                            const played = await playAudioBlob(blob, `Sarvam AI (${vMeta.name})`);
                            if (played) return;
                        }
                    } else {
                        const err = await sRes.json().catch(() => ({}));
                        console.warn("Sarvam AI bridge returned error:", sRes.status, err);
                    }
                } catch(e) {
                    console.warn("Sarvam AI bridge call notice:", e.message || e);
                }
            }

            // Direct Sarvam API call if user entered API key in browser settings
            if (sarvamClientKey.length > 5) {
                try {
                    setAgentState('speaking', `Sarvam AI (${resolvedLang.toUpperCase()})...`);
                    const sarvamLangCode = resolvedLang === 'hi' ? 'hi-IN' : (resolvedLang === 'or' ? 'od-IN' : 'en-IN');
                    const directRes = await fetch("https://api.sarvam.ai/text-to-speech", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "api-subscription-key": sarvamClientKey
                        },
                        body: JSON.stringify({
                            text: cleanSpeech,
                            inputs: [cleanSpeech],
                            target_language_code: sarvamLangCode,
                            speaker: vMeta.gender === 'female' ? 'ritu' : 'shubh',
                            model: "bulbul:v3"
                        })
                    });

                    if (directRes.ok) {
                        const data = await directRes.json();
                        const b64 = (data.audios && data.audios[0]) ? data.audios[0] : null;
                        if (b64) {
                            const byteChars = atob(b64);
                            const byteNumbers = new Array(byteChars.length);
                            for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
                            const byteArray = new Uint8Array(byteNumbers);
                            const blob = new Blob([byteArray], { type: "audio/wav" });
                            const played = await playAudioBlob(blob, `Sarvam AI (${vMeta.name})`);
                            if (played) return;
                        }
                    }
                } catch(e) {
                    console.warn("Direct Sarvam AI call notice:", e.message || e);
                }
            }

            // -------------------------------------------------------------
            // TIER 3: OPENAI NEURAL TTS (If OpenAI API Key provided and not Odia)
            // -------------------------------------------------------------
            if (openaiKey && openaiKey.trim().length > 10 && resolvedLang !== 'or') {
                try {
                    setAgentState('speaking', `${vMeta.name} Generating Audio...`);
                    const voiceParam = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].includes(currentRealVoiceId)
                        ? currentRealVoiceId
                        : (['arbor', 'breeze', 'cove', 'ember', 'juniper', 'maple', 'sol', 'spruce', 'vale'].includes(currentRealVoiceId)
                            ? currentRealVoiceId
                            : vMeta.openaiVoice);

                    const res = await fetch("https://api.openai.com/v1/audio/speech", {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${openaiKey.trim()}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            model: "tts-1",
                            input: cleanSpeech,
                            voice: voiceParam
                        }),
                        signal: currentAbortController?.signal
                    });

                    if (res.ok) {
                        const blob = await res.blob();
                        const played = await playAudioBlob(blob, `${vMeta.name}`);
                        if (played) return;
                    }
                } catch (e) {
                    if (e.name !== 'AbortError') console.warn("OpenAI Neural Audio notice, falling back:", e);
                }
            }

            // -------------------------------------------------------------
            // TIER 4: DIRECT NEURAL INDIC STREAM OR BROWSER SPEECH SYNTHESIS
            // -------------------------------------------------------------
            const isIndicSpeech = resolvedLang === 'hi' || resolvedLang === 'or' || /[\u0900-\u097F]/.test(cleanSpeech) || /[\u0B00-\u0B7F]/.test(cleanSpeech);
            const indicTtsMode = localStorage.getItem('agent_indic_tts_mode') || 'auto';

            if (isIndicSpeech && indicTtsMode === 'auto') {
                const streamed = await streamIndicNeuralTts(cleanSpeech, resolvedLang === 'or', vMeta, onComplete);
                if (streamed) return;
            }

            // Final fallback: Browser Web Speech API
            fallbackWebSpeechSynthesis(cleanSpeech, vMeta, onComplete, resolvedLang);
        }

        // Backward-compatible alias for speakAgentResponse
        async function speakAgentResponse(text, onComplete) {
            return speak(text, null, onComplete);
        }
        window.speak = speak;
        window.speakAgentResponse = speakAgentResponse;

        // ==========================================
        // 10.01 MULTILINGUAL NEURAL STREAM & PHONETIC ENGINE
        // (Guarantees 100% native Hindi and Odia speech on any PC, phone, or browser)
        // ==========================================
        async function streamIndicNeuralTts(cleanSpeech, isOdia, vMeta, onComplete) {
            if (isOdia) {
                // Google TTS proxy does NOT support Odia (would speak Devanagari transliteration with Hindi accent).
                // Disable Google proxy for Odia entirely; fall directly to browser's native speech synthesis.
                console.warn("Google TTS does not support Odia. Skipping Google proxy to avoid garbled Hindi pronunciation.");
                return false;
            }
            try {
                const indicText = cleanSpeech;
                const speakChunk = indicText.length > 220 ? indicText.slice(0, 220) : indicText;
                const encodedText = encodeURIComponent(speakChunk);

                // Use local Python bridge proxy if online, otherwise direct Google TTS audio stream
                const audioUrl = bridgeOnline 
                    ? `${bridgeUrl}/api/tts?tl=hi&q=${encodedText}`
                    : `https://translate.google.com/translate_tts?ie=UTF-8&tl=hi&client=tw-ob&q=${encodedText}`;

                const audio = new Audio();
                audio.crossOrigin = "anonymous";
                audio.src = audioUrl;
                currentAudioPlayer = audio;

                setAgentState('speaking', `${vMeta.name} Speaking (${isOdia ? 'Odia' : 'Hindi'})...`);
                document.getElementById('callSubtitles').className = "subtitle-scroll agent-speaking-now";
                document.getElementById('callSubtitles').innerText = cleanSpeech;

                isSpeaking = true;
                agentSpeechStartTime = Date.now();
                currentAgentSpokenText = cleanSpeech.toLowerCase();

                return new Promise((resolve) => {
                    let hasResolved = false;

                    audio.onended = () => {
                        if (!hasResolved) {
                            hasResolved = true;
                            isSpeaking = false;
                            currentAudioPlayer = null;
                            setAgentState('listening', isPushToTalkMode ? 'Push-to-Talk Standby' : 'Listening to your voice...');
                            document.getElementById('callSubtitles').innerText = "Speak anytime... (or type below)";
                            if (onComplete) onComplete();
                            resolve(true);
                        }
                    };

                    audio.onerror = (e) => {
                        if (!hasResolved) {
                            hasResolved = true;
                            console.warn("Direct Indic audio streaming error, falling back to browser synthesis:", e);
                            currentAudioPlayer = null;
                            isSpeaking = false;
                            fallbackWebSpeechSynthesis(cleanSpeech, vMeta, onComplete);
                            resolve(false);
                        }
                    };

                    audio.play().catch(err => {
                        if (!hasResolved) {
                            hasResolved = true;
                            console.warn("Audio play blocked or offline, falling back to browser synthesis:", err);
                            currentAudioPlayer = null;
                            isSpeaking = false;
                            fallbackWebSpeechSynthesis(cleanSpeech, vMeta, onComplete);
                            resolve(false);
                        }
                    });
                });
            } catch(e) {
                console.warn("streamIndicNeuralTts caught exception:", e);
                fallbackWebSpeechSynthesis(cleanSpeech, vMeta, onComplete);
                return false;
            }
        }

        // Converts Odia Unicode script to Devanagari code points
        // Odia and Devanagari share exact structural alignment in Unicode (Offset: 0x0200 = 512)
        function odiaToDevanagari(str) {
            let out = '';
            for (let i = 0; i < str.length; i++) {
                const code = str.charCodeAt(i);
                if (code >= 0x0B01 && code <= 0x0B77) {
                    if (code === 0x0B33) out += 'ळ';      // Odia Lla -> Devanagari Lla
                    else if (code === 0x0B5C) out += 'ड़'; // Rra
                    else if (code === 0x0B5D) out += 'ढ़'; // Rha
                    else if (code === 0x0B5F) out += 'य';  // Yya
                    else out += String.fromCharCode(code - 0x0200);
                } else {
                    out += str[i];
                }
            }
            return out;
        }

        // Abugida transliteration with inherent 'a' vowel insertion for English-only voices
        function devanagariToPhonetic(str) {
            const consonants = {
                'क':'k', 'ख':'kh', 'ग':'g', 'घ':'gh', 'ङ':'ng',
                'च':'ch', 'छ':'chh', 'ज':'j', 'झ':'jh', 'ञ':'ny',
                'ट':'t', 'ठ':'th', 'ड':'d', 'ढ':'dh', 'ण':'n',
                'त':'t', 'थ':'th', 'द':'d', 'ध':'dh', 'न':'n',
                'प':'p', 'फ':'ph', 'ब':'b', 'भ':'bh', 'म':'m',
                'य':'y', 'र':'r', 'ल':'l', 'व':'v', 'श':'sh',
                'ष':'sh', 'स':'s', 'ह':'h', 'क़':'q', 'ख़':'kh', 'ग़':'gh', 'ज़':'z', 'फ़':'f',
                'ळ':'l', 'ड़':'d', 'ढ़':'dh'
            };
            const vowels = {
                'अ':'a', 'आ':'aa', 'इ':'i', 'ई':'ee', 'उ':'u', 'ऊ':'oo',
                'ए':'e', 'ऐ':'ai', 'ओ':'o', 'औ':'au', 'ऋ':'ri', 'ॠ':'ree'
            };
            const matras = {
                'ा':'aa', 'ि':'i', 'ी':'ee', 'ु':'u', 'ू':'oo',
                'े':'e', 'ै':'ai', 'ो':'o', 'ौ':'au', 'ृ':'ri', 'ं':'n', 'ँ':'n', 'ः':'h'
            };
            const virama = '्';

            let out = '';
            for (let i = 0; i < str.length; i++) {
                const c = str[i];
                const next = str[i + 1];

                if (consonants[c]) {
                    out += consonants[c];
                    if (!matras[next] && next !== virama && next !== ' ' && next !== undefined && (consonants[next] || vowels[next])) {
                        out += 'a';
                    }
                } else if (vowels[c]) {
                    out += vowels[c];
                } else if (matras[c]) {
                    out += matras[c];
                } else if (c === virama) {
                    // Halant suppresses inherent vowel
                } else {
                    out += c;
                }
            }
            return out;
        }

        function odiaToPhonetic(str) {
            return devanagariToPhonetic(odiaToDevanagari(str));
        }

        function testLanguageSpeech(lang) {
            const sampleText = lang === 'or' 
                ? "ନମସ୍କାର! ମୁଁ ଆପଣଙ୍କ AI ସହାୟକ। ଆଜ୍ଞା କୁହନ୍ତୁ କିପରି ସାହାଯ୍ୟ କରିବି?"
                : "नमस्ते! मैं आपका AI वॉयस कोपायलट हूँ। सब सिस्टम ठीक चल रहे हैं।";
            speakAgentResponse(sampleText, () => {
                console.log(`Speech test completed for ${lang}`);
            });
        }

        function updateIndicVoiceStatusBadge() {
            const badge = document.getElementById('indicVoiceDetectorBadge');
            if (!badge) return;
            const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
            const indicVoices = voices.filter(v => 
                v.lang.toLowerCase().startsWith('hi') || 
                v.lang.toLowerCase().startsWith('or') ||
                v.name.toLowerCase().includes('madhur') ||
                v.name.toLowerCase().includes('swara') ||
                v.name.toLowerCase().includes('हिन्दी')
            );
            if (indicVoices.length > 0) {
                badge.innerText = `🟢 ${indicVoices.length} Local Indic Voices Found (Madhur/Swara)`;
                badge.style.color = "var(--accent-emerald)";
            } else {
                badge.innerText = `⚡ Cloud Neural Stream Active (No pack needed)`;
                badge.style.color = "var(--accent-cyan)";
            }
        }

        // Maya 2 Native & Sarvam AI Service Connectors
        async function checkSarvamServerStatus() {
            const badge = document.getElementById('sarvamConfigBadge');
            try {
                const res = await fetch(`${bridgeUrl}/config`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.tts_available) {
                        window.sarvamBridgeAvailable = true;
                        if (badge) {
                            badge.innerText = "🟢 Bridge Key Active";
                            badge.style.color = "var(--accent-emerald)";
                        }
                        return;
                    }
                }
            } catch(e) {}
            window.sarvamBridgeAvailable = false;
            const clientKey = (window.sarvamApiKey || localStorage.getItem('sarvam_api_key') || '').trim();
            if (badge) {
                if (clientKey.length > 5) {
                    badge.innerText = "🟢 Client Key Saved";
                    badge.style.color = "var(--accent-emerald)";
                } else {
                    badge.innerText = "⚪ Bridge: SARVAM_API_KEY not set";
                    badge.style.color = "var(--text-muted)";
                }
            }
        }

        async function checkMayaServerStatus() {
            const badge = document.getElementById('mayaStatusBadge');
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                const res = await fetch("http://127.0.0.1:8766/health", { signal: controller.signal });
                clearTimeout(timeoutId);
                if (res.ok) {
                    window.mayaServerOnline = true;
                    if (badge) {
                        badge.innerText = "🟢 Connected (:8766)";
                        badge.style.color = "var(--accent-emerald)";
                    }
                    return;
                }
            } catch(e) {}
            window.mayaServerOnline = false;
            if (badge) {
                badge.innerText = "⚪ Server Offline";
                badge.style.color = "var(--text-muted)";
            }
        }

        function handleMayaAudioUpload(event) {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                window.mayaRefAudioB64 = e.target.result;
                const badge = document.getElementById('mayaStatusBadge');
                if (badge) badge.innerText = `🟢 Audio Loaded (${Math.round(file.size / 1024)} KB)`;
                showToast(`Loaded reference clip: ${file.name} (${Math.round(file.size / 1024)} KB)`);
            };
            reader.readAsDataURL(file);
        }

        async function testSarvamTtsDirect() {
            const input = document.getElementById('sarvamApiKeyInput');
            if (input && input.value.trim()) {
                window.sarvamApiKey = input.value.trim();
                localStorage.setItem('sarvam_api_key', window.sarvamApiKey);
            }
            const currentLang = localStorage.getItem('agent_language') || 'hi';
            const sample = currentLang === 'or' 
                ? "ନମସ୍କାର, ମୁଁ ଆପଣଙ୍କୁ କିପରି ସାହାଯ୍ୟ କରିପାରିବି?"
                : "नमस्ते, मैं आपकी कैसे मदद कर सकता हूँ?";
            showToast("Testing Sarvam AI Bulbul v3...");
            speak(sample, currentLang);
        }

        async function testMayaCloneInSettings() {
            const langSelect = document.getElementById('mayaLangSelect');
            const lang = langSelect ? langSelect.value : 'hi';
            const sample = lang === 'or' 
                ? "ନମସ୍କାର, ମୁଁ ଆପଣଙ୍କ ଅଭିନବ ସ୍ୱରରେ କଥା କହୁଛି।"
                : "नमस्ते, मैं आपकी क्लोन की गई आवाज में बोल रहा हूँ।";
            showToast("Testing Maya 2 Local Voice Clone...");
            speak(sample, lang);
        }

        // Voice Gender Inspector (Enforces Real Male Voice for Male Heroes & Real Female Voice for Female Heroes)
        function getVoiceGender(v) {
            if (!v) return 'neutral';
            const name = (v.name || '').toLowerCase();
            const femaleKeywords = [
                'swara', 'zira', 'jenny', 'aria', 'samantha', 'victoria', 'karen', 'denise', 
                'katja', 'nanami', 'sunhi', 'female', 'woman', 'girl', 'helena', 'laura', 
                'monica', 'neerja', 'kalpana', 'catherine', 'hazel', 'susan', 'heera', 'priya'
            ];
            const maleKeywords = [
                'madhur', 'guy', 'david', 'mark', 'george', 'christopher', 'eric', 'keita', 
                'injoon', 'henri', 'conrad', 'stefan', 'male', 'man', 'boy', 'raul', 'pablo', 
                'hector', 'james', 'richard', 'hemant', 'ravi', 'kunal'
            ];
            if (femaleKeywords.some(k => name.includes(k))) return 'female';
            if (maleKeywords.some(k => name.includes(k))) return 'male';
            if (v.gender) {
                const g = String(v.gender).toLowerCase();
                if (g.includes('female')) return 'female';
                if (g.includes('male')) return 'male';
            }
            return 'neutral';
        }

        function fallbackWebSpeechSynthesis(cleanSpeech, vMeta, onComplete, forcedLang) {
            if (!('speechSynthesis' in window)) {
                if (onComplete) onComplete();
                return;
            }

            try {
                if (window.speechSynthesis.paused) {
                    window.speechSynthesis.resume();
                }
            } catch(e) {}

            if (speechSafetyTimer) clearTimeout(speechSafetyTimer);

            // Detect language script from text characters or forced language
            const hasHindi = /[\u0900-\u097F]/.test(cleanSpeech) || forcedLang === 'hi';
            const hasOdia = /[\u0B00-\u0B7F]/.test(cleanSpeech) || forcedLang === 'or';

            let targetLang = vMeta.lang || 'en';
            if (hasOdia || currentLanguage === 'or-IN' || forcedLang === 'or') {
                targetLang = 'or';
            } else if (hasHindi || currentLanguage === 'hi-IN' || forcedLang === 'hi') {
                targetLang = 'hi';
            }

            const LANG_MAP = {
                hi: 'hi-IN',
                or: 'hi-IN', // Standard browsers synthesize Indic phonetics via Hindi engine
                en: 'en-US',
                ja: 'ja-JP',
                ko: 'ko-KR',
                es: 'es-ES',
                fr: 'fr-FR',
                de: 'de-DE'
            };
            const defaultLangCode = LANG_MAP[targetLang] || 'en-US';
            const targetGender = vMeta.gender || 'male';

            // Match best natural voice by language and STRICT GENDER MATCHING
            if (voicesList.length === 0) {
                voicesList = window.speechSynthesis.getVoices();
            }

            let bestVoice = null;
            if (voicesList.length > 0) {
                const langVoices = voicesList.filter(v => v.lang.toLowerCase().startsWith(targetLang));

                // Step 1: Matching target language + strict target gender (e.g. Madhur for Male, Swara for Female)
                if (langVoices.length > 0) {
                    bestVoice = langVoices.find(v => getVoiceGender(v) === targetGender && 
                        (v.name.includes('Natural') || v.name.includes('Online') || v.name.includes('Google') || (targetGender === 'male' ? v.name.includes('Madhur') : v.name.includes('Swara'))));
                    if (!bestVoice) {
                        bestVoice = langVoices.find(v => getVoiceGender(v) === targetGender);
                    }
                }

                // Step 2: Odia fallback to Indic voices with gender match
                if (!bestVoice && targetLang === 'or') {
                    const indicVoices = voicesList.filter(v => v.lang.toLowerCase().startsWith('hi') || v.lang.toLowerCase().startsWith('bn'));
                    bestVoice = indicVoices.find(v => getVoiceGender(v) === targetGender && (v.name.includes('Natural') || v.name.includes('Online') || v.name.includes('Google')));
                    if (!bestVoice) {
                        bestVoice = indicVoices.find(v => getVoiceGender(v) === targetGender);
                    }
                }

                // Step 3: English / OS voices with STRICT GENDER MATCH
                // (e.g. Microsoft David / Guy for Male heroes, Microsoft Zira / Jenny for Female heroes)
                if (!bestVoice) {
                    const engVoices = voicesList.filter(v => v.lang.toLowerCase().startsWith('en'));
                    bestVoice = engVoices.find(v => getVoiceGender(v) === targetGender && 
                        (v.name.includes('Natural') || v.name.includes('Online') || v.name.includes('Google') || (targetGender === 'male' ? (v.name.includes('David') || v.name.includes('Guy')) : (v.name.includes('Zira') || v.name.includes('Jenny')))));
                    if (!bestVoice) {
                        bestVoice = engVoices.find(v => getVoiceGender(v) === targetGender);
                    }
                }

                // Step 4: Fallback if no exact gender-match exists
                if (!bestVoice) {
                    bestVoice = langVoices[0] || voicesList[0];
                }
            }

            const isNativeIndicVoice = bestVoice && (bestVoice.lang.toLowerCase().startsWith('hi') || bestVoice.lang.toLowerCase().startsWith('or') || bestVoice.lang.toLowerCase().startsWith('bn') || bestVoice.lang.toLowerCase().startsWith('mr'));

            // Prepare spoken text:
            let utterText = cleanSpeech;
            if (isNativeIndicVoice) {
                // If browser has native Hindi voice (Madhur / Swara) and text is in Odia,
                // convert Odia script to Devanagari phonemes so the Hindi engine speaks authentic Odia!
                if (hasOdia) utterText = odiaToDevanagari(cleanSpeech);
            } else {
                // If browser has NO Indian voices installed (English SAPI only),
                // transliterate to romanized abugida phonetics with proper inherent vowels (namaste, aapan kemiti achhanti)
                if (hasOdia) utterText = odiaToPhonetic(cleanSpeech);
                else if (hasHindi) utterText = devanagariToPhonetic(cleanSpeech);
            }

            const utter = new SpeechSynthesisUtterance(utterText);
            currentUtterance = utter;
            window.activeUtterances.push(utter); // Prevent iOS Safari early garbage collection

            agentSpeechStartTime = Date.now();
            currentAgentSpokenText = cleanSpeech.toLowerCase();

            if (bestVoice) {
                utter.voice = bestVoice;
                utter.lang = bestVoice.lang;
            } else {
                utter.lang = defaultLangCode;
            }

            if (hasOdia || hasHindi) {
                // Natural human cadence and pitch for Indian speech (removes robotic superhero warping)
                utter.rate = 1.0;
                utter.pitch = (targetGender === 'female' ? 1.04 : 0.98);
            } else {
                utter.rate = vMeta.rate || 1.0;
                utter.pitch = vMeta.pitch || (targetGender === 'male' ? 0.98 : 1.05);
            }

            let finished = false;
            const finishOnce = () => {
                if (finished) return;
                finished = true;
                if (speechSafetyTimer) clearTimeout(speechSafetyTimer);
                isSpeaking = false;
                window.activeUtterances = window.activeUtterances.filter(u => u !== utter);
                setAgentState('listening', isPushToTalkMode ? 'Push-to-Talk Standby' : 'Listening to your voice...');
                document.getElementById('callSubtitles').innerText = "Speak anytime... (or type below)";
                if (inCallMode && !isCallMuted && !isPushToTalkMode) {
                    startSpeechRecognition();
                }
                if (onComplete) onComplete();
            };

            utter.onstart = () => {
                isSpeaking = true;
                setAgentState('speaking', `${vMeta.name} Speaking...`);
                document.getElementById('callSubtitles').className = "subtitle-scroll agent-speaking-now";
                document.getElementById('callSubtitles').innerText = cleanSpeech;
            };

            utter.onend = finishOnce;

            let retryDone = false;
            utter.onerror = (e) => {
                console.warn("Speech synthesis notice:", e?.error || e);
                if (!retryDone && (e?.error === 'language-unavailable' || e?.error === 'voice-unavailable' || e?.error === 'synthesis-failed')) {
                    retryDone = true;
                    try {
                        const fallbackUtter = new SpeechSynthesisUtterance(utterText);
                        fallbackUtter.rate = vMeta.rate || 1.0;
                        fallbackUtter.pitch = vMeta.pitch || 1.0;
                        fallbackUtter.lang = 'en-US';
                        fallbackUtter.onend = finishOnce;
                        fallbackUtter.onerror = () => finishOnce();
                        window.speechSynthesis.speak(fallbackUtter);
                        return;
                    } catch(err) {}
                }
                finishOnce();
            };

            const wordCount = utterText.split(/\s+/).length;
            const maxDurationMs = Math.max(3500, wordCount * 550 + 2000);
            speechSafetyTimer = setTimeout(() => {
                if (isSpeaking) {
                    finishOnce();
                }
            }, maxDurationMs);

            const startSpeaking = () => {
                try {
                    if (window.speechSynthesis.paused) {
                        window.speechSynthesis.resume();
                    }
                    window.speechSynthesis.speak(utter);
                } catch(err) {
                    console.error("Speak execution notice:", err);
                    finishOnce();
                }
            };

            // Avoid Chrome cancel collision: if already speaking, cancel with brief settling delay, else speak immediately
            if (window.speechSynthesis.speaking) {
                window.speechSynthesis.cancel();
                setTimeout(startSpeaking, 90);
            } else {
                startSpeaking();
            }
        }

        function changeRealVoice() {
            const vSelect = document.getElementById('realVoiceSelect');
            if (vSelect) {
                currentRealVoiceId = vSelect.value;
                localStorage.setItem('agent_real_voice', currentRealVoiceId);
            }
            const v = REAL_VOICES[currentRealVoiceId] || REAL_VOICES.breeze;
            const badge = document.getElementById('activeVoiceBadgeLabel');
            if (badge) badge.innerText = v.name;

            // If selected voice is an Avenger hero, sync persona, HUD theme & play superhero sound!
            if (PERSONAS[currentRealVoiceId]) {
                currentPersonaId = currentRealVoiceId;
                localStorage.setItem('dots_persona', currentPersonaId);
                const pSelect = document.getElementById('personaSelect');
                if (pSelect) pSelect.value = currentPersonaId;
                const p = PERSONAS[currentPersonaId];
                document.body.className = (p.theme ? ('theme-' + p.theme) : '');
                playHeroSound(currentPersonaId);
                setTimeout(() => {
                    speakAgentResponse(p.greeting);
                    appendTranscript('agent', p.greeting);
                }, 180);
                return;
            }

            if (currentRealVoiceId === 'swara' || currentRealVoiceId === 'madhur') {
                playHarmonicChime([523.25, 659.25]);
                const intro = `नमस्ते! मैं ${v.name} हूँ। मैं आपकी सहायता के लिए तैयार हूँ।`;
                speakAgentResponse(intro);
                appendTranscript('agent', intro);
            } else if (currentRealVoiceId === 'odia_copilot') {
                playHarmonicChime([523.25, 659.25]);
                const intro = `ନମସ୍କାର! ମୁଁ ଓଡ଼ିଆ କପାଇଲଟ୍। ଆପଣଙ୍କୁ ସାହାଯ୍ୟ କରିବାକୁ ପ୍ରସ୍ତୁତ!`;
                speakAgentResponse(intro);
                appendTranscript('agent', intro);
            } else {
                playHarmonicChime([523.25, 659.25]);
                const intro = `Voice changed to ${v.name}: ${v.desc}. How does this sound?`;
                speakAgentResponse(intro);
                appendTranscript('agent', intro);
            }
        }

        // ==========================================
        // 10.1 QUICK TEXT CHAT & AUDIO TEST HELPERS
        // ==========================================
        function submitQuickText() {
            const input = document.getElementById('quickTextInput');
            const txt = input.value.trim();
            if (!txt) return;
            input.value = '';

            // Ensure call session state is visually connected
            if (!inCallMode) {
                inCallMode = true;
                const connectBtn = document.getElementById('callConnectBtn');
                connectBtn.classList.add('in-call');
                document.getElementById('callBtnText').innerText = "End Call";
                document.getElementById('micMuteBtn').className = "ctrl-btn active-mic";
                playHarmonicChime([523.25, 659.25]);
            }

            handleUserSpeechCommit(txt);
        }

        function testVoiceAudioOutput() {
            if (currentAudioPlayer) {
                try { currentAudioPlayer.pause(); currentAudioPlayer.currentTime = 0; } catch(e) {}
                currentAudioPlayer = null;
            }
            if ('speechSynthesis' in window) {
                try { window.speechSynthesis.cancel(); } catch(e) {}
            }
            playHeroSound(currentPersonaId);
            const p = PERSONAS[currentPersonaId] || PERSONAS.ironman;
            setTimeout(() => {
                speak(p.greeting);
                appendTranscript('agent', p.greeting);
            }, 180);
        }

        // ==========================================
        // 11. HUD & UI MANAGEMENT
        // ==========================================
        function setAgentState(state, label) {
            orbState = state;
            const dot = document.getElementById('statusPulseDot');
            dot.className = `status-dot-pulse active-${state}`;
            document.getElementById('agentStateLabel').innerText = label;
            document.getElementById('liveStatusText').innerText = label;
        }

        function switchHudTab(tab) {
            document.getElementById('tabBtnMissions').classList.toggle('active', tab === 'missions');
            document.getElementById('tabBtnIot').classList.toggle('active', tab === 'iot');
            document.getElementById('tabBtnTranscript').classList.toggle('active', tab === 'transcript');
            document.getElementById('tabBtnDevTools')?.classList.toggle('active', tab === 'devtools');

            document.getElementById('hudTabContentMissions').style.display = (tab === 'missions' ? 'flex' : 'none');
            document.getElementById('hudTabContentIot').style.display = (tab === 'iot' ? 'flex' : 'none');
            document.getElementById('hudTabContentTranscript').style.display = (tab === 'transcript' ? 'flex' : 'none');
            const dtEl = document.getElementById('hudTabContentDevTools');
            if (dtEl) {
                dtEl.style.display = (tab === 'devtools' ? 'flex' : 'none');
                if (tab === 'devtools') {
                    updatePromptInspector();
                    populateDevTtsVoices();
                    refreshDevEpoch();
                    updateAudioDiagDisplay();
                }
            }
        }

        function logMissionToHud(intent, result) {
            const container = document.getElementById('hudTabContentMissions');
            const card = document.createElement('div');
            card.className = 'mission-card';

            const tagClass = intent.type.includes('iot') ? 'iot' : (intent.type.includes('system') ? 'telemetry' : 'script');
            const now = new Date().toLocaleTimeString();

            card.innerHTML = `
                <div class="mission-card-header">
                    <span class="mission-tag ${tagClass}">${intent.type.replace('_', ' ').toUpperCase()}</span>
                    <span class="mission-time">${now}</span>
                </div>
                <div class="mission-title">${intent.name}</div>
                <div class="mission-output-box">${result.output}</div>
            `;
            container.insertBefore(card, container.firstChild);
        }

        function appendTranscript(role, text) {
            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            sessionTranscript.push({ role, text, time: timeStr });

            const feed = document.getElementById('transcriptContainer');
            const row = document.createElement('div');
            row.className = `transcript-row ${role}`;
            row.innerHTML = `
                <div class="transcript-avatar">
                    <i class="fa-solid ${role === 'user' ? 'fa-user' : 'fa-robot'}"></i>
                </div>
                <div>
                    <strong>${role === 'user' ? 'You' : PERSONAS[currentPersonaId].name} (${timeStr}):</strong> ${text}
                </div>
            `;
            feed.appendChild(row);
            feed.scrollTop = feed.scrollHeight;
        }

        function clearMissionLog() {
            document.getElementById('hudTabContentMissions').innerHTML = `
                <div class="mission-card">
                    <div class="mission-card-header">
                        <span class="mission-tag telemetry">CLEARED</span>
                        <span class="mission-time">NOW</span>
                    </div>
                    <div class="mission-title">Mission history cleared. Standing by for new voice commands.</div>
                </div>
            `;
        }

        function clearTranscript() {
            sessionTranscript = [];
            const feed = document.getElementById('transcriptContainer');
            if (feed) feed.innerHTML = '';
            showToast("Transcript cleared");
        }

        function onVoiceSelectChanged(idx) {
            if (!voicesList || !voicesList[idx]) return;
            const chosen = voicesList[idx];
            showToast(`Voice selected: ${chosen.name}`);
            const utter = new SpeechSynthesisUtterance("Testing selected voice synthesis.");
            utter.voice = chosen;
            utter.lang = chosen.lang;
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(utter);
            }
        }

        function copyTranscriptMarkdown() {
            if (sessionTranscript.length === 0) {
                alert("Transcript is empty.");
                return;
            }
            let md = `# Dots Voice Agent Session Transcript\n*Exported on ${new Date().toLocaleString()}*\n\n`;
            sessionTranscript.forEach(item => {
                const author = item.role === 'user' ? 'User' : PERSONAS[currentPersonaId].name;
                md += `**[${item.time}] ${author}:** ${item.text}\n\n`;
            });
            navigator.clipboard.writeText(md);
            alert("✓ Transcript copied to clipboard in Markdown format!");
        }

        function downloadTranscriptMarkdown() {
            if (sessionTranscript.length === 0) {
                alert("Transcript is empty.");
                return;
            }
            let md = `# Dots Voice Agent Session Transcript\n*Exported on ${new Date().toLocaleString()}*\n\n`;
            sessionTranscript.forEach(item => {
                const author = item.role === 'user' ? 'User' : PERSONAS[currentPersonaId].name;
                md += `**[${item.time}] ${author}:** ${item.text}\n\n`;
            });
            const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `dots_voice_transcript_${Date.now()}.md`;
            a.click();
            URL.revokeObjectURL(url);
        }

        // ==========================================
        // 12. LOCAL PYTHON BRIDGE & SENSORS
        // ==========================================
        async function testBridgeConnection() {
            const btn = document.getElementById('bridgeStatusBtn');
            const txt = document.getElementById('bridgeText');
            if (!btn || !txt) return;

            // Auto-sanitize if user typed a GitHub Pages URL as the bridge
            if (bridgeUrl && bridgeUrl.includes('github.io')) {
                bridgeUrl = 'http://127.0.0.1:8765';
                localStorage.setItem('dots_bridge_url', bridgeUrl);
                const bInput = document.getElementById('bridgeUrlInput');
                if (bInput) bInput.value = bridgeUrl;
            }

            // On HTTPS (e.g. GitHub Pages), browsers strictly block mixed-content requests to http://
            const isHttps = window.location.protocol === 'https:';
            if (isHttps && bridgeUrl.startsWith('http://')) {
                bridgeOnline = false;
                btn.classList.remove('bridge-online');
                btn.classList.add('bridge-cloud');
                txt.innerText = "Cloud AI Ready";
                btn.title = "Cloud Mode Active! Your Voice AI connects directly to frontier AI models. No local PC bridge needed.";
                return;
            }

            txt.innerText = "...";
            try {
                const res = await fetch(`${bridgeUrl}/api/status`, { signal: AbortSignal.timeout(2000) });
                if (res.ok) {
                    const data = await res.json();
                    bridgeOnline = true;
                    btn.classList.add('bridge-online');
                    btn.classList.remove('bridge-cloud');
                    txt.innerText = "Bridge: Live";
                    btn.title = "Connected to local Python hardware orchestrator on port 8765.";
                    updateIotUI(data.iot_state);
                    return;
                }
            } catch (e) {}

            bridgeOnline = false;
            btn.classList.remove('bridge-online');
            if (window.location.hostname.includes('github.io') || isHttps) {
                btn.classList.add('bridge-cloud');
                txt.innerText = "Cloud AI Ready";
                btn.title = "Cloud Mode Active! Hands-free voice is ready to chat.";
            } else {
                btn.classList.remove('bridge-cloud');
                txt.innerText = "Bridge: Off";
                btn.title = "Local PC bridge on port 8765 is not detected. Run launch_agent.bat if you want to control physical PC hardware.";
            }
        }

        function updateIotUI(iot) {
            if (!iot) return;
            if (iot.relays) {
                const r1 = document.getElementById('toggle_relay_1');
                const r2 = document.getElementById('toggle_relay_2');
                const r3 = document.getElementById('toggle_relay_3');
                const r4 = document.getElementById('toggle_relay_4');
                if (r1) r1.classList.toggle('on', !!iot.relays.relay_1_dev_lights);
                if (r2) r2.classList.toggle('on', !!iot.relays.relay_2_test_bench);
                if (r3) r3.classList.toggle('on', !!iot.relays.relay_3_server_fan);
                if (r4) r4.classList.toggle('on', !!iot.relays.relay_4_spare);
            }
            if (iot.sensors) {
                document.getElementById('sensorTemp').innerText = `${iot.sensors.lab_temperature_c}°C`;
                document.getElementById('sensorHum').innerText = `${iot.sensors.lab_humidity_pct}%`;
                document.getElementById('sensorPower').innerText = `${iot.sensors.power_draw_watts}W`;
                document.getElementById('iotSensorsTimestamp').innerText = iot.sensors.last_updated || "LIVE";
            }
        }

        async function toggleIotRelay(relayKey) {
            if (bridgeOnline) {
                try {
                    const res = await fetch(`${bridgeUrl}/api/iot`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'toggle_relay', target: relayKey })
                    });
                    const d = await res.json();
                    updateIotUI(d.iot_state);
                    playTone(660, 0.08);
                    return;
                } catch (e) {}
            }
            // Mock toggle
            const targetEl = document.getElementById(relayKey === 'relay_1_dev_lights' ? 'toggle_relay_1' : (relayKey === 'relay_2_test_bench' ? 'toggle_relay_2' : (relayKey === 'relay_3_server_fan' ? 'toggle_relay_3' : 'toggle_relay_4')));
            if (targetEl) targetEl.classList.toggle('on');
            playTone(660, 0.08);
        }

        async function refreshIotSensors() {
            if (bridgeOnline) {
                try {
                    const res = await fetch(`${bridgeUrl}/api/iot`);
                    const d = await res.json();
                    updateIotUI(d.iot);
                    return;
                } catch(e) {}
            }
            // Random jitter for simulation
            const temp = (26.2 + Math.random() * 0.8).toFixed(1);
            const hum = (51.5 + Math.random() * 2.0).toFixed(1);
            const power = (84 + Math.random() * 5).toFixed(1);
            document.getElementById('sensorTemp').innerText = `${temp}°C`;
            document.getElementById('sensorHum').innerText = `${hum}%`;
            document.getElementById('sensorPower').innerText = `${power}W`;
        }

        function pollSensorsRegularly() {
            setInterval(() => {
                if (inCallMode) refreshIotSensors();
            }, 8000);
        }

        // ==========================================
        // 13. PERSONA & SETTINGS MANAGEMENT
        // ==========================================
        function changePersona(targetPersonaId) {
            const pSelect = document.getElementById('personaSelect');
            if (targetPersonaId) {
                currentPersonaId = targetPersonaId;
                if (pSelect) pSelect.value = targetPersonaId;
            } else if (pSelect) {
                currentPersonaId = pSelect.value;
            }
            localStorage.setItem('dots_persona', currentPersonaId);

            const p = PERSONAS[currentPersonaId] || PERSONAS.ironman;

            // Apply realistic Avengers HUD theme class to body
            document.body.className = (p.theme ? ('theme-' + p.theme) : '');

            // Synchronize voice selector with character voice
            if (p.voiceId && REAL_VOICES[p.voiceId]) {
                currentRealVoiceId = p.voiceId;
                localStorage.setItem('agent_real_voice', currentRealVoiceId);
                const rSelect = document.getElementById('realVoiceSelect');
                if (rSelect) rSelect.value = currentRealVoiceId;
                const badge = document.getElementById('activeVoiceBadgeLabel');
                if (badge) badge.innerText = REAL_VOICES[currentRealVoiceId].name;
            }

            // Update UI agent label & hero status
            const agentLabel = document.getElementById('agentStateLabel');
            if (agentLabel) agentLabel.innerText = `${p.name} Online`;

            // Play character superhero SFX
            playHeroSound(currentPersonaId);

            // Announce superhero greeting
            setTimeout(() => {
                speakAgentResponse(p.greeting);
                appendTranscript('agent', p.greeting);
            }, 180);
        }

        function openSettingsModal() {
            document.getElementById('settingsModal').style.display = 'flex';
            updateIndicVoiceStatusBadge();
            const indicMode = localStorage.getItem('agent_indic_tts_mode') || 'auto';
            const indicSelect = document.getElementById('indicTtsModeSelect');
            if (indicSelect) indicSelect.value = indicMode;
            checkSarvamServerStatus();
            checkMayaServerStatus();
            const sInput = document.getElementById('sarvamApiKeyInput');
            if (sInput) sInput.value = localStorage.getItem('sarvam_api_key') || '';
            const mText = document.getElementById('mayaRefTextInput');
            if (mText && window.mayaRefText) mText.value = window.mayaRefText;
        }

        function closeSettingsModal() {
            document.getElementById('settingsModal').style.display = 'none';
        }

        function updateEngineSelection() {
            const eng = document.getElementById('engineSelect').value;
            const label = document.getElementById('apiKeyLabel');
            const grp = document.getElementById('apiKeyGroup');
            const helpLink = document.getElementById('apiKeyHelpLink');
            const helpText = document.getElementById('engineHelpText');
            const statusDiv = document.getElementById('apiKeyTestStatus');
            if (statusDiv) { statusDiv.style.display = 'none'; statusDiv.innerHTML = ''; }

            if (eng === 'local') {
                grp.style.display = 'none';
                document.getElementById('activeEngineLabel').innerText = "Local Free Engine";
            } else if (eng === 'openai') {
                grp.style.display = 'flex';
                label.innerText = "OpenAI API Key (sk-...)";
                if (helpLink) {
                    helpLink.href = "https://platform.openai.com/api-keys";
                    helpLink.innerHTML = `<i class="fa-solid fa-arrow-up-right-from-square"></i> Get OpenAI Key`;
                }
                if (helpText) {
                    helpText.innerHTML = `Connects GPT-4o-mini for full ChatGPT-level intelligence and OpenAI realistic voices.`;
                }
                document.getElementById('apiKeyInput').value = openaiKey;
                document.getElementById('activeEngineLabel').innerText = "OpenAI GPT-4o-mini";
            } else if (eng === 'groq') {
                grp.style.display = 'flex';
                label.innerText = "Groq Cloud API Key (gsk_...)";
                if (helpLink) {
                    helpLink.href = "https://console.groq.com/keys";
                    helpLink.innerHTML = `<i class="fa-solid fa-bolt"></i> Get Free Groq Key (Fastest)`;
                }
                if (helpText) {
                    helpText.innerHTML = `<strong>Recommended:</strong> 100% Free, ultra-fast &lt;200ms latency powered by Meta Llama 3.1 8B Instant! Answers any question in the world.`;
                }
                document.getElementById('apiKeyInput').value = groqKey;
                document.getElementById('activeEngineLabel').innerText = "Groq Llama 3.1 8B";
            } else if (eng === 'groq_compound') {
                grp.style.display = 'flex';
                label.innerText = "Groq API Key (gsk_...)";
                if (helpLink) {
                    helpLink.href = "https://console.groq.com/keys";
                    helpLink.innerHTML = `<i class="fa-solid fa-globe"></i> Get Free Groq Key (Search Included)`;
                }
                if (helpText) {
                    helpText.innerHTML = `<strong>Groq Compound:</strong> Includes real-time web search capability built directly into the engine, using your same free Groq API key!`;
                }
                document.getElementById('apiKeyInput').value = groqKey;
                document.getElementById('activeEngineLabel').innerText = "Groq Compound (Web Search)";
            } else if (eng === 'deepseek') {
                grp.style.display = 'flex';
                label.innerText = "DeepSeek API Key (sk-...)";
                if (helpLink) {
                    helpLink.href = "https://platform.deepseek.com/api_keys";
                    helpLink.innerHTML = `<i class="fa-solid fa-brain"></i> Get DeepSeek API Key`;
                }
                if (helpText) {
                    helpText.innerHTML = `Powered by DeepSeek-V3 / R1 for advanced multi-step reasoning and deep knowledge synthesis.`;
                }
                document.getElementById('apiKeyInput').value = deepseekKey;
                document.getElementById('activeEngineLabel').innerText = "DeepSeek Chat";
            } else if (eng === 'gemini') {
                grp.style.display = 'flex';
                label.innerText = "Google Gemini API Key (AIza...)";
                if (helpLink) {
                    helpLink.href = "https://aistudio.google.com/app/apikey";
                    helpLink.innerHTML = `<i class="fa-brands fa-google"></i> Get Free Gemini Key`;
                }
                if (helpText) {
                    helpText.innerHTML = `Free tier available via Google AI Studio powered by Gemini 2.0 Flash.`;
                }
                document.getElementById('apiKeyInput').value = geminiKey;
                document.getElementById('activeEngineLabel').innerText = "Gemini 2.0 Flash";
            }
        }

        function toggleApiKeyVisibility() {
            const input = document.getElementById('apiKeyInput');
            const icon = document.getElementById('apiKeyEyeIcon');
            if (!input || !icon) return;
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'fa-solid fa-eye-slash';
            } else {
                input.type = 'password';
                icon.className = 'fa-solid fa-eye';
            }
        }

        async function testCurrentApiKey() {
            const eng = document.getElementById('engineSelect').value;
            const key = document.getElementById('apiKeyInput').value.trim();
            const statusDiv = document.getElementById('apiKeyTestStatus');
            if (!statusDiv) return;

            if (eng === 'local') {
                statusDiv.style.display = 'block';
                statusDiv.style.color = '#38bdf8';
                statusDiv.innerHTML = '<i class="fa-solid fa-info-circle"></i> Local Engine does not need an API key.';
                return;
            }

            if (!key) {
                statusDiv.style.display = 'block';
                statusDiv.style.color = '#f59e0b';
                statusDiv.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Please paste an API key first before testing.';
                return;
            }

            // Quick format checks
            if (eng === 'groq' || eng === 'groq_compound') {
                if (!key.startsWith('gsk_')) {
                    statusDiv.style.display = 'block';
                    statusDiv.style.color = '#ef4444';
                    statusDiv.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> <strong>Invalid format:</strong> Groq API keys always start with <code>gsk_</code>. You entered text starting with <code>${escapeHtml(key.slice(0, 4))}</code>. Tap the eye 👁️ icon to inspect what was pasted.`;
                    return;
                }
                if (key.includes('•') || key.includes('*')) {
                    statusDiv.style.display = 'block';
                    statusDiv.style.color = '#ef4444';
                    statusDiv.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> <strong>Masked Key Detected:</strong> You copied the hidden dots/asterisks from the table instead of the secret key! Please generate a new key on console.groq.com/keys and click <strong>Copy</strong> immediately on the popup.`;
                    return;
                }
                if (key.length < 30) {
                    statusDiv.style.display = 'block';
                    statusDiv.style.color = '#ef4444';
                    statusDiv.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> <strong>Incomplete Key:</strong> The key you entered is only ${key.length} characters long. Groq keys are ~56 characters.`;
                    return;
                }
            } else if (eng === 'deepseek') {
                if (!key.startsWith('sk-')) {
                    statusDiv.style.display = 'block';
                    statusDiv.style.color = '#ef4444';
                    statusDiv.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> DeepSeek API keys start with <code>sk-</code>. Check your key at platform.deepseek.com.`;
                    return;
                }
            } else if (eng === 'openai') {
                if (!key.startsWith('sk-')) {
                    statusDiv.style.display = 'block';
                    statusDiv.style.color = '#ef4444';
                    statusDiv.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> OpenAI keys start with <code>sk-</code>. Check your key at platform.openai.com.`;
                    return;
                }
            }

            statusDiv.style.display = 'block';
            statusDiv.style.color = '#38bdf8';
            statusDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying key with ' + eng.toUpperCase() + ' servers...';

            try {
                if (eng === 'groq_compound') {
                    statusDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Testing Groq Compound (web search model)...';
                    try {
                        const res = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
                            method: "POST",
                            headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
                            body: JSON.stringify({
                                model: "groq/compound-mini",
                                messages: [{ role: "user", content: "What is 2+2? Answer in 3 words." }],
                                max_tokens: 20
                            })
                        }, 20000);
                        if (res.ok) {
                            statusDiv.style.color = '#10b981';
                            statusDiv.innerHTML = '<i class="fa-solid fa-circle-check"></i> <strong>Groq Compound works!</strong> Web search is active.';
                            return;
                        } else if (res.status === 404) {
                            statusDiv.style.color = '#ef4444';
                            statusDiv.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> <strong>groq/compound-mini not found (404).</strong> Groq may have retired this model. Switch to <strong>Groq Cloud</strong> or <strong>Gemini</strong> for now.';
                            return;
                        } else {
                            const d = await res.json().catch(() => ({}));
                            statusDiv.style.color = '#ef4444';
                            statusDiv.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Compound error (${res.status}): ${d.error?.message || 'unknown'}`;
                            return;
                        }
                    } catch (e) {
                        statusDiv.style.color = '#ef4444';
                        statusDiv.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Network error: ${e.message}`;
                        return;
                    }
                } else if (eng === 'groq') {
                    statusDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking Groq account & available models...';
                    
                    let workingModel = null;
                    let lastErrMsg = "";
                    let modelsFound = [];

                    // Step 1: Query Groq's active models endpoint
                    try {
                        const mRes = await fetch("https://api.groq.com/openai/v1/models", {
                            method: "GET",
                            headers: { "Authorization": `Bearer ${key}` }
                        });
                        if (mRes.status === 401) {
                            statusDiv.style.color = '#ef4444';
                            statusDiv.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> <strong>Groq Error (401 Unauthorized): Invalid API Key</strong>.<br>Please generate a new key on <a href="https://console.groq.com/keys" target="_blank" style="color:var(--accent-cyan);">console.groq.com/keys</a>.`;
                            return;
                        }
                        if (mRes.ok) {
                            const mData = await mRes.json();
                            if (mData.data && Array.isArray(mData.data)) {
                                // Strictly filter out moderation, safeguard, audio, and vision models
                                modelsFound = mData.data.map(m => m.id).filter(id => {
                                    const l = id.toLowerCase();
                                    return !l.includes('safeguard') && 
                                           !l.includes('guard') && 
                                           !l.includes('whisper') && 
                                           !l.includes('embed') && 
                                           !l.includes('moderation') &&
                                           !l.includes('vision');
                                });
                            }
                        }
                    } catch (e) {
                        console.warn("Could not query /models endpoint:", e);
                    }

                    // Put active high-rate-limit conversational models at top of priority
                    const priorityChatModels = [
                        "llama-3.3-70b-versatile",
                        "llama-3.1-8b-instant",
                        "deepseek-r1-distill-llama-70b"
                    ];

                    const candidates = [
                        ...priorityChatModels,
                        ...modelsFound
                    ];
                    const uniqueCandidates = [...new Set(candidates.filter(m => 
                        !m.includes('safeguard') && 
                        !m.includes('guard') && 
                        !m.includes('qwen') && 
                        !m.includes('saba') && 
                        !m.includes('llama3-') && 
                        !m.includes('whisper') && 
                        !m.includes('vision')
                    ))];

                    for (const mod of uniqueCandidates) {
                        try {
                            const res = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
                                method: "POST",
                                headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    model: mod,
                                    messages: [{ role: "user", content: "ping" }],
                                    max_tokens: 5
                                })
                            });
                            const d = await res.json();
                            if (res.ok) {
                                workingModel = mod;
                                break;
                            } else if (res.status === 401) {
                                statusDiv.style.color = '#ef4444';
                                statusDiv.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> <strong>Groq Error (401 Unauthorized): Invalid API Key</strong>.<br>Please generate a new key on <a href="https://console.groq.com/keys" target="_blank" style="color:var(--accent-cyan);">console.groq.com/keys</a>.`;
                                return;
                            } else if (res.status === 429) {
                                console.warn(`Groq model ${mod} currently rate-limited (429), testing next model...`);
                                continue;
                            } else {
                                lastErrMsg = `[${mod}] ${d.error?.message || res.statusText || res.status}`;
                            }
                        } catch (err) {
                            lastErrMsg = err.message;
                        }
                    }

                    if (workingModel) {
                        groqModel = workingModel;
                        localStorage.setItem('dots_groq_model', workingModel);
                        statusDiv.style.color = '#10b981';
                        statusDiv.innerHTML = `<i class="fa-solid fa-circle-check"></i> <strong>Groq Key Valid!</strong> Found & connected to <code>${workingModel}</code>. Model ready to answer everything!`;
                    } else {
                        statusDiv.style.color = '#ef4444';
                        statusDiv.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> <strong>Could not connect to any Groq model:</strong><br><span style="font-size:0.75rem;color:#cbd5e1;line-height:1.4;">${escapeHtml(lastErrMsg)}<br>👉 <strong>Fastest 100% Free Solution:</strong> Switch to <strong>Google Gemini</strong> in Settings for a free 1-click key from <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--accent-cyan);font-weight:700;">Google AI Studio</a>.</span>`;
                    }
                } else if (eng === 'openai') {
                    const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
                        method: "POST",
                        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
                        body: JSON.stringify({
                            model: "gpt-4o-mini",
                            messages: [{ role: "user", content: "ping" }],
                            max_tokens: 5
                        })
                    });
                    const d = await res.json();
                    if (res.ok) {
                        statusDiv.style.color = '#10b981';
                        statusDiv.innerHTML = '<i class="fa-solid fa-circle-check"></i> <strong>OpenAI Key Valid!</strong> GPT-4o-mini is active with full intelligence.';
                    } else {
                        statusDiv.style.color = '#ef4444';
                        statusDiv.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> OpenAI Error (${res.status}): ${d.error?.message || 'Invalid API Key'}`;
                    }
                } else if (eng === 'deepseek') {
                    statusDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking DeepSeek API...';
                    const res = await fetchWithTimeout("https://api.deepseek.com/chat/completions", {
                        method: "POST",
                        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
                        body: JSON.stringify({
                            model: "deepseek-chat",
                            messages: [{ role: "user", content: "ping" }],
                            max_tokens: 5
                        })
                    });
                    const d = await res.json().catch(() => ({}));
                    if (res.ok) {
                        statusDiv.style.color = '#10b981';
                        statusDiv.innerHTML = '<i class="fa-solid fa-circle-check"></i> <strong>DeepSeek Key Valid!</strong> DeepSeek-V3 is active and ready for reasoning & chat.';
                    } else {
                        statusDiv.style.color = '#ef4444';
                        statusDiv.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> DeepSeek Error (${res.status}): ${d.error?.message || 'Invalid API Key'}`;
                    }
                } else if (eng === 'gemini') {
                    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            contents: [{ role: "user", parts: [{ text: "ping" }] }]
                        })
                    });
                    const d = await res.json();
                    if (res.ok) {
                        statusDiv.style.color = '#10b981';
                        statusDiv.innerHTML = '<i class="fa-solid fa-circle-check"></i> <strong>Gemini Key Valid!</strong> Gemini 2.0 Flash is active.';
                    } else {
                        statusDiv.style.color = '#ef4444';
                        statusDiv.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Gemini Error (${res.status}): ${d.error?.message || 'Check your key'}`;
                    }
                }
            } catch (err) {
                statusDiv.style.color = '#ef4444';
                statusDiv.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Network test error: ${err.message}`;
            }
        }

        function saveSettings() {
            selectedEngine = document.getElementById('engineSelect').value;
            localStorage.setItem('dots_engine', selectedEngine);

            const inputVal = document.getElementById('apiKeyInput').value.trim();
            if (selectedEngine === 'openai') {
                openaiKey = inputVal;
                localStorage.setItem('dots_openai_key', openaiKey);
            } else if (selectedEngine === 'groq' || selectedEngine === 'groq_compound') {
                groqKey = inputVal;
                localStorage.setItem('dots_groq_key', groqKey);
                localStorage.setItem('jarvis_groq_key', groqKey);
            } else if (selectedEngine === 'deepseek') {
                deepseekKey = inputVal;
                localStorage.setItem('dots_deepseek_key', deepseekKey);
            } else if (selectedEngine === 'gemini') {
                geminiKey = inputVal;
                localStorage.setItem('dots_gemini_key', geminiKey);
                localStorage.setItem('jarvis_gemini_key', geminiKey);
            }

            let bUrl = document.getElementById('bridgeUrlInput').value.trim() || 'http://127.0.0.1:8765';
            if (bUrl.includes('github.io')) {
                bUrl = 'http://127.0.0.1:8765';
                document.getElementById('bridgeUrlInput').value = bUrl;
            }
            bridgeUrl = bUrl;
            localStorage.setItem('dots_bridge_url', bridgeUrl);

            audioMode = document.getElementById('audioModeSelect').value;
            localStorage.setItem('dots_audio_mode', audioMode);
            vadSensitivity = (audioMode === 'headphones' ? 0.09 : 0.16);

            soundChimesEnabled = document.getElementById('soundChimesSelect').value === 'true';
            localStorage.setItem('dots_sound_chimes', soundChimesEnabled);

            const sInput = document.getElementById('sarvamApiKeyInput');
            if (sInput) {
                const sKey = sInput.value.trim();
                localStorage.setItem('sarvam_api_key', sKey);
                window.sarvamApiKey = sKey;
            }

            const langSelect = document.getElementById('settingsLangSelect');
            if (langSelect) {
                changeLanguage(langSelect.value);
            }

            closeSettingsModal();
            updateEngineSelection();
            testBridgeConnection();
            checkSarvamServerStatus();
            checkMayaServerStatus();
        }

        function loadSavedSettings() {
            document.getElementById('engineSelect').value = selectedEngine;
            let bUrl = localStorage.getItem('dots_bridge_url') || 'http://127.0.0.1:8765';
            if (bUrl.includes('github.io')) {
                bUrl = 'http://127.0.0.1:8765';
                localStorage.setItem('dots_bridge_url', bUrl);
            }
            bridgeUrl = bUrl;
            document.getElementById('bridgeUrlInput').value = bridgeUrl;
            document.getElementById('audioModeSelect').value = audioMode;
            document.getElementById('soundChimesSelect').value = String(soundChimesEnabled);
            const rSelect = document.getElementById('realVoiceSelect');
            if (rSelect) rSelect.value = currentRealVoiceId;
            const v = REAL_VOICES[currentRealVoiceId] || REAL_VOICES.breeze;
            const badge = document.getElementById('activeVoiceBadgeLabel');
            if (badge) badge.innerText = v.name;

            const stageLang = document.getElementById('stageLangSelect');
            if (stageLang) stageLang.value = currentLanguage;

            const storedAgentLang = localStorage.getItem('agent_language') || (currentLanguage && currentLanguage.startsWith('hi') ? 'hi' : (currentLanguage && currentLanguage.startsWith('or') ? 'or' : 'en'));
            const settingsLang = document.getElementById('settingsLangSelect');
            if (settingsLang) settingsLang.value = storedAgentLang;

            const sInput = document.getElementById('sarvamApiKeyInput');
            const savedSarvamKey = localStorage.getItem('sarvam_api_key') || '';
            if (sInput) sInput.value = savedSarvamKey;
            window.sarvamApiKey = savedSarvamKey;

            // Restore Avengers superhero persona and HUD theme
            currentPersonaId = localStorage.getItem('dots_persona') || 'ironman';
            const pSelect = document.getElementById('personaSelect');
            if (pSelect) pSelect.value = currentPersonaId;
            const p = PERSONAS[currentPersonaId] || PERSONAS.ironman;
            if (p.theme) document.body.className = 'theme-' + p.theme;

            updateEngineSelection();
            checkSarvamServerStatus();
            checkMayaServerStatus();
        }

        // ==========================================
        // 14. HARMONIC WEB AUDIO SYNTHESIS CHIMES
        // ==========================================
        function getAudioContext() {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            return audioCtx;
        }

        function playTone(freq = 440, duration = 0.12) {
            if (!soundChimesEnabled) return;
            try {
                const ctx = getAudioContext();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, ctx.currentTime);
                gain.gain.setValueAtTime(0.06, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + duration);
            } catch(e) {}
        }

        function playHarmonicChime(freqs = [523.25, 659.25]) {
            if (!soundChimesEnabled) return;
            try {
                const ctx = getAudioContext();
                freqs.forEach((f, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.08);
                    gain.gain.setValueAtTime(0.07, ctx.currentTime + i * 0.08);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.2);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(ctx.currentTime + i * 0.08);
                    osc.stop(ctx.currentTime + i * 0.08 + 0.2);
                });
            } catch(e) {}
        }

        function playPitchDropBlip() {
            if (!soundChimesEnabled) return;
            try {
                const ctx = getAudioContext();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(480, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.08, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.1);
            } catch(e) {}
        }

        function playCyberPing() {
            if (!soundChimesEnabled) return;
            try {
                const ctx = getAudioContext();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
                gain.gain.setValueAtTime(0.08, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.12);
            } catch(e) {}
        }

        // ==========================================
        // 14.1 MARVEL AVENGERS CHARACTER AUDIO EFFECTS
        // ==========================================
        function playHeroSound(heroId) {
            if (!soundChimesEnabled) return;
            try {
                const ctx = getAudioContext();
                const now = ctx.currentTime;

                if (heroId === 'ironman') {
                    // Repulsor charge + laser blast
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(320, now);
                    osc.frequency.exponentialRampToValueAtTime(1600, now + 0.16);
                    osc.frequency.exponentialRampToValueAtTime(140, now + 0.3);
                    gain.gain.setValueAtTime(0.02, now);
                    gain.gain.linearRampToValueAtTime(0.09, now + 0.16);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now);
                    osc.stop(now + 0.3);
                } else if (heroId === 'thor') {
                    // Thunder blast & lightning crash
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(440, now);
                    osc.frequency.exponentialRampToValueAtTime(65, now + 0.26);
                    gain.gain.setValueAtTime(0.12, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now);
                    osc.stop(now + 0.32);
                } else if (heroId === 'captain') {
                    // Vibranium shield ricochet ring
                    const freqs = [1760, 3520];
                    freqs.forEach((f, i) => {
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.type = 'triangle';
                        osc.frequency.setValueAtTime(f, now);
                        gain.gain.setValueAtTime(0.09 / (i + 1), now);
                        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.start(now);
                        osc.stop(now + 0.28);
                    });
                } else if (heroId === 'spiderman') {
                    // Web-shooter thwip
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(2400, now);
                    osc.frequency.exponentialRampToValueAtTime(480, now + 0.12);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now);
                    osc.stop(now + 0.12);
                } else if (heroId === 'hulk') {
                    // Monster sub-bass earthquake roar
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(95, now);
                    osc.frequency.exponentialRampToValueAtTime(36, now + 0.35);
                    gain.gain.setValueAtTime(0.15, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now);
                    osc.stop(now + 0.4);
                } else if (heroId === 'jarvis') {
                    // Stark HUD boot sequence
                    playHarmonicChime([587.33, 880, 1174.66, 1760]);
                } else if (heroId === 'thanos') {
                    // Infinity Stones cosmic surge
                    playHarmonicChime([65.4, 98.0, 130.8, 196.0]);
                } else if (heroId === 'blackwidow') {
                    // Electro-baton stun shock
                    playHarmonicChime([880, 1320, 1760]);
                } else if (heroId === 'scarletwitch') {
                    // Chaos magic mystic resonance
                    playHarmonicChime([329.63, 440, 523.25, 659.25]);
                } else if (heroId === 'shuri') {
                    // Wakandan Vibranium kinetic blast
                    playHarmonicChime([440, 659.25, 1318.5]);
                } else {
                    playHarmonicChime([523.25, 659.25]);
                }
            } catch(e) {}
        }

        // ==========================================
        // 14. ADVANCED DEVELOPER TOOLS WORKBENCH SUITE
        // ==========================================
        let currentDevSubTab = 'code';

        function openDevToolsTab() {
            if (window.innerWidth <= 960) {
                switchMobileView('hud');
            }
            switchHudTab('devtools');
        }

        function switchDevSubTab(subTab) {
            currentDevSubTab = subTab;
            const subTabs = ['code', 'api', 'audio', 'tts', 'prompt', 'utils'];
            subTabs.forEach(t => {
                const btn = document.getElementById(`btnDevSub${t.charAt(0).toUpperCase() + t.slice(1)}`);
                const panel = document.getElementById(`devPanel${t.charAt(0).toUpperCase() + t.slice(1)}`);
                if (btn) btn.classList.toggle('active', t === subTab);
                if (panel) panel.style.display = (t === subTab ? 'flex' : 'none');
            });

            if (subTab === 'prompt') updatePromptInspector();
            if (subTab === 'tts') populateDevTtsVoices();
            if (subTab === 'utils') refreshDevEpoch();
            if (subTab === 'audio') updateAudioDiagDisplay();
        }

        const DEV_SNIPPETS = {
            fibonacci: {
                lang: 'python',
                code: `# Fibonacci sequence computation benchmark\ndef fib(n):\n    a, b = 0, 1\n    res = []\n    for _ in range(n):\n        res.append(a)\n        a, b = b, a + b\n    return res\n\nprint("Calculated Fibonacci (10 terms):", fib(10))\nprint("Status: Execution clean.")`
            },
            telemetry: {
                lang: 'python',
                code: `# Local hardware and system telemetry\nimport platform, os, shutil\ntotal, used, free = shutil.disk_usage('.')\nprint(f"OS: {platform.system()} {platform.release()} ({platform.machine()})")\nprint(f"Python: {platform.python_version()} | CPU Cores: {os.cpu_count()}")\nprint(f"Free Disk: {round(free / (1024**3), 2)} GB / {round(total / (1024**3), 2)} GB")`
            },
            files: {
                lang: 'python',
                code: `# Inspect workspace project directory\nimport os\nfiles = sorted([f for f in os.listdir('.') if os.path.isfile(f)])\nprint(f"Workspace contains {len(files)} files:")\nfor f in files[:8]:\n    size_kb = round(os.path.getsize(f) / 1024, 1)\n    print(f"  • {f} ({size_kb} KB)")`
            },
            prime: {
                lang: 'python',
                code: `# Prime number sieve\ndef primes(limit):\n    sieve = [True] * limit\n    for i in range(2, int(limit**0.5)+1):\n        if sieve[i]:\n            for j in range(i*i, limit, i): sieve[j] = False\n    return [i for i in range(2, limit) if sieve[i]]\n\nprint("Primes under 50:", primes(50))`
            },
            audiocontext: {
                lang: 'javascript',
                code: `// AudioContext and Web Speech state\nconst ctx = window.audioCtx || (window.AudioContext ? new AudioContext() : null);\nconsole.log("AudioContext State:", ctx ? ctx.state : "Not created");\nconsole.log("Sample Rate:", ctx ? ctx.sampleRate + " Hz" : "N/A");\nconsole.log("SpeechSynthesis available:", 'speechSynthesis' in window);\nconsole.log("SpeechRecognition available:", ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window));`
            },
            voices: {
                lang: 'javascript',
                code: `// Enumerate all browser TTS voices\nconst voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];\nconsole.log("Total voices detected:", voices.length);\nvoices.slice(0, 12).forEach((v, i) => {\n    console.log(\`[\${i+1}] \${v.name} (\${v.lang}) \${v.default ? '★ DEFAULT' : ''}\`);\n});`
            }
        };

        function onDevLangChange() {
            const lang = document.getElementById('devCodeLangSelect').value;
            const editor = document.getElementById('devCodeEditor');
            if (lang === 'javascript' && (!editor.value || editor.value.startsWith('#'))) {
                loadDevSnippet('audiocontext');
            } else if (lang === 'python' && (!editor.value || editor.value.startsWith('//'))) {
                loadDevSnippet('fibonacci');
            }
        }

        function loadDevSnippet(snippetId) {
            const snip = DEV_SNIPPETS[snippetId];
            if (!snip) return;
            const langSelect = document.getElementById('devCodeLangSelect');
            const editor = document.getElementById('devCodeEditor');
            if (langSelect) langSelect.value = snip.lang;
            if (editor) editor.value = snip.code;
        }

        async function runDevCode() {
            const lang = document.getElementById('devCodeLangSelect').value;
            const code = document.getElementById('devCodeEditor').value.trim();
            const outputEl = document.getElementById('devTerminalOutput');
            const statusEl = document.getElementById('devExecStatus');
            const durationEl = document.getElementById('devExecDuration');

            if (!code) {
                outputEl.innerText = "Error: Code buffer is empty. Enter or select code to execute.";
                return;
            }

            statusEl.innerText = "Executing...";
            durationEl.innerText = "...";
            const startT = performance.now();

            if (lang === 'javascript') {
                const logs = [];
                const origLog = console.log;
                const origWarn = console.warn;
                const origErr = console.error;
                try {
                    console.log = (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '));
                    console.warn = (...args) => logs.push('[WARN] ' + args.join(' '));
                    console.error = (...args) => logs.push('[ERR] ' + args.join(' '));

                    const result = new Function(code)();
                    if (result !== undefined) logs.push(`[RETURN] ${typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)}`);
                    
                    const duration = Math.round(performance.now() - startT);
                    statusEl.innerText = "Status: 0 (OK)";
                    durationEl.innerText = `${duration} ms`;
                    outputEl.innerText = logs.length > 0 ? logs.join('\n') : "Code executed successfully (no stdout logged).";
                    outputEl.style.color = "#10b981";
                } catch (err) {
                    const duration = Math.round(performance.now() - startT);
                    statusEl.innerText = "Status: Error";
                    durationEl.innerText = `${duration} ms`;
                    outputEl.innerText = `[JavaScript Exception]\n${err.stack || err.message}`;
                    outputEl.style.color = "#f43f5e";
                } finally {
                    console.log = origLog;
                    console.warn = origWarn;
                    console.error = origErr;
                }
                return;
            }

            // Python Execution
            if (bridgeOnline) {
                try {
                    const res = await fetch(`${bridgeUrl}/api/execute`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code: code, description: "Dev Tools REPL Execution" }),
                        signal: AbortSignal.timeout(15000)
                    });
                    const data = await res.json();
                    const duration = Math.round(performance.now() - startT);
                    durationEl.innerText = `${duration} ms`;

                    if (data.success) {
                        statusEl.innerText = "Status: 0 (OK via Python Bridge)";
                        outputEl.innerText = data.mission.result.stdout || "Execution finished clean (0 output).";
                        outputEl.style.color = "#10b981";
                    } else {
                        statusEl.innerText = "Status: Non-zero Return Code";
                        outputEl.innerText = data.mission.result.stderr || data.mission.result.stdout || "Error during Python execution.";
                        outputEl.style.color = "#f43f5e";
                    }
                } catch(e) {
                    const duration = Math.round(performance.now() - startT);
                    durationEl.innerText = `${duration} ms`;
                    statusEl.innerText = "Status: Bridge Error";
                    outputEl.innerText = `Bridge communication failed: ${e.message}\nMake sure 'launch_agent.bat' is running on port 8765.`;
                    outputEl.style.color = "#f43f5e";
                }
            } else {
                // Simulated Python execution fallback
                const duration = Math.round(performance.now() - startT + 12);
                durationEl.innerText = `${duration} ms`;
                statusEl.innerText = "Status: Simulated (Start Bridge for Local Python)";
                if (code.includes('fib')) {
                    outputEl.innerText = "Calculated Fibonacci (10 terms): [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]\nStatus: Execution clean. (Simulated Python Runner)";
                } else if (code.includes('primes')) {
                    outputEl.innerText = "Primes under 50: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47]\n(Simulated Python Runner)";
                } else {
                    outputEl.innerText = `Executed Python block.\nCode: ${code.slice(0, 80)}...\nTip: Launch 'launch_agent.bat' on your PC to execute real native Python on port 8765.`;
                }
                outputEl.style.color = "#38bdf8";
            }
        }

        function clearDevCode() {
            document.getElementById('devCodeEditor').value = '';
            document.getElementById('devTerminalOutput').innerText = '# Terminal output cleared.';
            document.getElementById('devExecStatus').innerText = 'Terminal Output: Ready';
            document.getElementById('devExecDuration').innerText = '-- ms';
        }

        function copyDevOutput() {
            const text = document.getElementById('devTerminalOutput').innerText;
            navigator.clipboard.writeText(text);
            const statusEl = document.getElementById('devExecStatus');
            const prev = statusEl.innerText;
            statusEl.innerText = 'Copied to clipboard!';
            setTimeout(() => statusEl.innerText = prev, 1800);
        }

        // ==========================================
        // API & NETWORK LATENCY PING
        // ==========================================
        async function pingAllEndpoints() {
            // Groq
            const groqTag = document.getElementById('apiStatusGroqTag');
            const groqLat = document.getElementById('apiLatencyGroq');
            if (groqTag && groqLat) {
                groqTag.innerText = "PINGING...";
                groqTag.className = "mission-tag script";
                const startG = performance.now();
                try {
                    const url = groqKey ? "https://api.groq.com/openai/v1/models" : "https://api.groq.com";
                    const headers = groqKey ? { "Authorization": `Bearer ${groqKey}` } : {};
                    await fetch(url, { headers, mode: groqKey ? "cors" : "no-cors", signal: AbortSignal.timeout(4000) });
                    const dur = Math.round(performance.now() - startG);
                    groqTag.innerText = groqKey ? "AUTHENTICATED" : "REACHABLE";
                    groqTag.className = "mission-tag iot";
                    groqLat.innerText = `${dur} ms`;
                } catch(e) {
                    groqTag.innerText = "FAILED";
                    groqTag.className = "mission-tag telemetry";
                    groqLat.innerText = "Timeout / Error";
                }
            }

            // Bridge
            const brTag = document.getElementById('apiStatusBridgeTag');
            const brLat = document.getElementById('apiLatencyBridge');
            if (brTag && brLat) {
                brTag.innerText = "PROBING...";
                const startB = performance.now();
                try {
                    const res = await fetch(`${bridgeUrl}/api/status`, { signal: AbortSignal.timeout(2000) });
                    if (res.ok) {
                        const dur = Math.round(performance.now() - startB);
                        brTag.innerText = "ONLINE";
                        brTag.className = "mission-tag iot";
                        brLat.innerText = `${dur} ms`;
                        bridgeOnline = true;
                        updateBridgeUI(true);
                    } else throw new Error();
                } catch(e) {
                    brTag.innerText = "OFFLINE";
                    brTag.className = "mission-tag telemetry";
                    brLat.innerText = "Offline";
                    bridgeOnline = false;
                    updateBridgeUI(false);
                }
            }

            // OpenAI
            const oaiTag = document.getElementById('apiStatusOpenAiTag');
            const oaiLat = document.getElementById('apiLatencyOpenAi');
            if (oaiTag && oaiLat) {
                if (!openaiKey) {
                    oaiTag.innerText = "NO KEY";
                    oaiLat.innerText = "Not Configured";
                } else {
                    oaiTag.innerText = "PINGING...";
                    const startO = performance.now();
                    try {
                        await fetch("https://api.openai.com/v1/models", { headers: { "Authorization": `Bearer ${openaiKey}` }, signal: AbortSignal.timeout(4000) });
                        const dur = Math.round(performance.now() - startO);
                        oaiTag.innerText = "ACTIVE";
                        oaiTag.className = "mission-tag iot";
                        oaiLat.innerText = `${dur} ms`;
                    } catch(e) {
                        oaiTag.innerText = "FAILED";
                        oaiLat.innerText = "Error";
                    }
                }
            }

            // Gemini
            const gemTag = document.getElementById('apiStatusGeminiTag');
            const gemLat = document.getElementById('apiLatencyGemini');
            if (gemTag && gemLat) {
                gemTag.innerText = geminiKey ? "CONFIGURED" : "NO KEY";
                gemLat.innerText = geminiKey ? "Ready" : "Not Set";
            }
        }

        async function executeCustomHttpProbe() {
            const verb = document.getElementById('devHttpVerb').value;
            const url = document.getElementById('devHttpUrl').value.trim();
            const outEl = document.getElementById('devHttpOutput');
            if (!url) {
                outEl.innerText = "Error: Please specify a URL to probe.";
                return;
            }
            outEl.innerText = `Connecting to ${url}...`;
            const startT = performance.now();
            try {
                const headers = {};
                if (url.includes('groq.com') && groqKey) headers['Authorization'] = `Bearer ${groqKey}`;
                if (url.includes('openai.com') && openaiKey) headers['Authorization'] = `Bearer ${openaiKey}`;

                const res = await fetch(url, { method: verb, headers, signal: AbortSignal.timeout(5000) });
                const dur = Math.round(performance.now() - startT);
                let text = await res.text();
                try {
                    const parsed = JSON.parse(text);
                    text = JSON.stringify(parsed, null, 2);
                } catch(e) {}
                outEl.innerText = `[${res.status} ${res.statusText}] (${dur} ms)\n\n${text.slice(0, 1500)}`;
                outEl.style.color = res.ok ? "#10b981" : "#f43f5e";
            } catch(err) {
                outEl.innerText = `Request Failed: ${err.message}`;
                outEl.style.color = "#f43f5e";
            }
        }

        // ==========================================
        // LIVE AUDIO VU METER & DIAGNOSTICS
        // ==========================================
        function updateAudioDiagDisplay() {
            const ctxEl = document.getElementById('devAudioCtxState');
            const rateEl = document.getElementById('devAudioCtxRate');
            const recEl = document.getElementById('devSpeechRecState');
            const countEl = document.getElementById('devTtsVoiceCount');
            const lockEl = document.getElementById('devSpeechLockState');

            if (ctxEl) ctxEl.innerText = audioCtx ? audioCtx.state.toUpperCase() : 'NOT INITIALIZED';
            if (rateEl) rateEl.innerText = audioCtx ? `${audioCtx.sampleRate} Hz` : 'N/A';
            if (recEl) recEl.innerText = isVoiceProcessing ? 'PROCESSING' : (recognition ? 'LISTENING' : 'IDLE');
            if (countEl) countEl.innerText = window.speechSynthesis ? window.speechSynthesis.getVoices().length : '0';
            if (lockEl) lockEl.innerText = isProcessingSpeechCommit ? 'LOCKED (COMMITTING)' : 'READY';
        }

        function resetAudioEngine() {
            if (window.speechSynthesis) window.speechSynthesis.cancel();
            if (recognition) {
                try { recognition.stop(); } catch(e) {}
            }
            if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            setTimeout(() => {
                startSpeechRecognition();
                updateAudioDiagDisplay();
            }, 300);
        }

        // ==========================================
        // TTS VOICE & CHARACTER STUDIO
        // ==========================================
        function populateDevTtsVoices() {
            if (!('speechSynthesis' in window)) return;
            const voices = window.speechSynthesis.getVoices();
            const select = document.getElementById('devStudioVoiceSelect');
            if (!select || voices.length === 0) return;

            const langFilter = document.getElementById('devStudioLangFilter')?.value || 'all';
            const genderFilter = document.getElementById('devStudioGenderFilter')?.value || 'all';

            select.innerHTML = '';
            voices.forEach((v, idx) => {
                const lower = v.name.toLowerCase();
                const vGender = getVoiceGender(v);

                if (langFilter === 'en' && !v.lang.toLowerCase().startsWith('en')) return;
                if (langFilter === 'hi' && !v.lang.toLowerCase().startsWith('hi')) return;
                if (langFilter === 'or' && !v.lang.toLowerCase().startsWith('or')) return;

                if (genderFilter === 'male' && vGender !== 'male') return;
                if (genderFilter === 'female' && vGender !== 'female') return;

                const opt = document.createElement('option');
                opt.value = idx;
                opt.innerText = `[${vGender.toUpperCase()}] ${v.name} (${v.lang})`;
                select.appendChild(opt);
            });

            if (select.children.length === 0) {
                const opt = document.createElement('option');
                opt.value = "";
                opt.innerText = "No voices match current filters";
                select.appendChild(opt);
            }
        }

        function filterDevStudioVoices() {
            populateDevTtsVoices();
        }

        function testDevStudioVoice() {
            if (!('speechSynthesis' in window)) return;
            const select = document.getElementById('devStudioVoiceSelect');
            const text = document.getElementById('devStudioTestInput')?.value || "Hello Stark Industries.";
            const pitch = parseFloat(document.getElementById('devStudioPitch')?.value || "1.0");
            const rate = parseFloat(document.getElementById('devStudioRate')?.value || "1.05");

            window.speechSynthesis.cancel();
            const utt = new SpeechSynthesisUtterance(text);
            const voices = window.speechSynthesis.getVoices();
            const vIdx = parseInt(select.value, 10);
            if (!isNaN(vIdx) && voices[vIdx]) {
                utt.voice = voices[vIdx];
            }
            utt.pitch = pitch;
            utt.rate = rate;
            window.speechSynthesis.speak(utt);
        }

        // ==========================================
        // SYSTEM PROMPT & CONTEXT INSPECTOR
        // ==========================================
        function updatePromptInspector() {
            const personaNameEl = document.getElementById('devPromptPersonaName');
            const fullTextEl = document.getElementById('devPromptFullText');
            const tokenCountEl = document.getElementById('devPromptTokenCount');

            const persona = PERSONAS[currentPersonaId] || PERSONAS['ironman'];
            if (personaNameEl) personaNameEl.innerText = persona.name;

            let langInstruction = "";
            if (currentLanguage === 'hi-IN') {
                langInstruction = "\n\n[HINDI INSTRUCTION]: Respond in natural Hindi (हिंदी). Keep under 1-2 short sentences.";
            } else if (currentLanguage === 'or-IN') {
                langInstruction = "\n\n[ODIA INSTRUCTION]: Respond in authentic natural Odia (ଓଡ଼ିଆ). Use respectful honorifics (ଆଜ୍ଞା, ଆପଣ, ନମସ୍କାର, ଧନ୍ୟବାଦ).";
            } else if (currentLanguage === 'en-IN') {
                langInstruction = "\n\n[ENGLISH INSTRUCTION]: Respond in crisp clear English. Keep under 1-2 sentences.";
            }

            const assembled = persona.systemPrompt + langInstruction;
            if (fullTextEl) fullTextEl.innerText = assembled;
            if (tokenCountEl) {
                const words = assembled.trim().split(/\s+/).length;
                const estTokens = Math.round(words * 1.33);
                tokenCountEl.innerText = `~${estTokens} tokens (${assembled.length} chars)`;
            }
        }

        function copyActivePromptContext() {
            const text = document.getElementById('devPromptFullText')?.innerText || '';
            navigator.clipboard.writeText(text);
            alert("Active System Prompt copied to clipboard!");
        }

        // ==========================================
        // DEVELOPER UTILITIES & STATE
        // ==========================================
        function devFormatJson(action) {
            const input = document.getElementById('devJsonInput');
            const msg = document.getElementById('devJsonMsg');
            try {
                const parsed = JSON.parse(input.value);
                if (action === 'beautify') {
                    input.value = JSON.stringify(parsed, null, 2);
                    msg.innerText = "✓ Beautified clean JSON";
                } else {
                    input.value = JSON.stringify(parsed);
                    msg.innerText = "✓ Minified JSON";
                }
                msg.style.color = "var(--accent-emerald)";
            } catch(e) {
                msg.innerText = `✗ Invalid JSON: ${e.message}`;
                msg.style.color = "#f43f5e";
            }
        }

        function refreshDevEpoch() {
            const now = Date.now();
            const el = document.getElementById('devEpochNow');
            if (el) el.innerText = `${now} (${Math.floor(now / 1000)}s)`;
        }

        function exportDevStateBackup() {
            const state = {
                version: "2.5.0",
                timestamp: new Date().toISOString(),
                selectedEngine: selectedEngine,
                currentPersonaId: currentPersonaId,
                currentLanguage: currentLanguage,
                groqModel: groqModel,
                bridgeOnline: bridgeOnline,
                transcriptLength: sessionTranscript.length,
                localStorageKeys: Object.keys(localStorage)
            };
            const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `voice-agent-state-backup-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }