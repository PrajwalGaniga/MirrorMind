
# Low-Latency Full-Duplex Voice Interview System
### Browser <-> FastAPI WebSocket Proxy <-> Gemini Live API

Built with the official `google-genai` SDK (`client.aio.live.connect`), Web Audio API, and AudioWorklet for low-latency bidirectional real-time conversation.

---

## 1. System Architecture

```
                                  BROWSER (Client)
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                                                                             │
  │  Microphone -> getUserMedia(AEC, NS, AGC)                                   │
  │                     │                                                       │
  │                     ▼                                                       │
  │           AudioWorkletProcessor                                            │
  │           [Linear downsampling to 16 kHz PCM16 mono]                        │
  │                     │                                                       │
  │                     ▼ (40ms binary chunks = 1280 bytes)                     │
  │                 WebSocket                                                   │
  └─────────────────────┬───────────────────────────────────────────────────────┘
                        │ Binary PCM16 (16kHz)
                        ▼
            FASTAPI WEBSOCKET PROXY (/ws or /api/voice/interview-ws)
  ┌─────────────────────┴───────────────────────────────────────────────────────┐
  │  Two Concurrent Asyncio Tasks:                                              │
  │  - browser_to_queue & queue_to_gemini (Zero re-encoding / no batching)      │
  │  - gemini_to_browser:                                                       │
  │      * Binary frames: 24 kHz PCM16 audio relayed to browser                 │
  │      * JSON frames: INTERRUPTED, TRANSCRIPT, METRICS, SESSION_RESUMED       │
  │  Session Resumption & Context Sliding Window (4096 tokens)                  │
  └─────────────────────┬───────────────────────────────────────────────────────┘
                        │
                        ▼ (Realtime Bi-directional Streaming)
           GOOGLE GEMINI LIVE API (gemini-2.5-flash-native-audio-latest)
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  - Modality: AUDIO (24 kHz PCM16 mono response)                             │
  │  - Built-in Voice Activity Detection (VAD)                                  │
  │  - Candidate & AI real-time transcription                                   │
  │  - Interruption detection (server_content.interrupted)                      │
  └─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Project Structure

```
MirrorMind/
├── backend/
│   ├── routes/
│   │   └── live_interview.py          # Full-duplex WebSocket proxy router
│   ├── main.py                        # FastAPI entrypoint (/ws & /api/voice/interview-ws)
│   ├── logs/
│   │   └── interviews/                # Auto-persisted session JSON transcripts
│   ├── .env                           # Backend environment variables
│   └── .env.example                   # Template with VAD & live interview parameters
│
├── frontend/
│   ├── public/
│   │   └── audio-recorder-worklet.js  # AudioWorkletProcessor downsampling to 16kHz PCM16
│   ├── src/
│   │   ├── utils/
│   │   │   ├── audio-worklet-capture.js # getUserMedia + AudioWorklet lifecycle + RMS meter
│   │   │   ├── audio-playback-manager.js# Gapless 24kHz PCM16 playback + queue flusher
│   │   │   └── interview-live-client.js # WebSocket client + auto-reconnect logic
│   │   ├── hooks/
│   │   │   ├── useAudioCapture.js     # React hook for mic capture
│   │   │   └── useLiveInterview.js    # React hook for full interview orchestration
│   │   ├── components/
│   │   │   └── LiveInterviewPanel.jsx # Interactive UI + VU meter + Telemetry Debug Panel
│   │   └── pages/
│   │       └── LiveInterview.jsx      # Full-page interview view (/interview route)
│
└── scratch/
    └── test_voice_interview_e2e.py    # Automated E2E verification test suite
```

---

## 3. Environment Configuration (`.env`)

Add the following to `backend/.env`:

```env
# Gemini Live API Key (Kept strictly on the backend, never exposed to the frontend)
GEMINI_LIVE_API_KEY=your_gemini_api_key_here
GEMINI_LIVE_MODEL=gemini-2.5-flash-native-audio-latest

# VAD Tuning (Configurable via environment)
VAD_SILENCE_DURATION_MS=600
VAD_PREFIX_PADDING_MS=100
VAD_START_SENSITIVITY=HIGH
VAD_END_SENSITIVITY=HIGH

# Context Compression & Voice
TARGET_COMPRESSION_TOKENS=4096
GEMINI_VOICE_NAME=Aoede
```

---

## 4. How to Run Locally

### Step 1: Start Backend (FastAPI)
```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
*The WebSocket proxy will be available at:*
- `ws://localhost:8000/ws`
- `ws://localhost:8000/api/voice/interview-ws`

### Step 2: Start Frontend (React + Vite)
```bash
cd frontend
npm run dev
```
Navigate to `http://localhost:5173/interview` or click the **Interview 🎙️** tab in the main navigation.

---

## 5. Verification Test Checklist

| # | Test Case | Action | Expected Behavior |
|---|-----------|--------|-------------------|
| 1 | **Sample Rate Downsampling** | Open Debug Panel on `/interview` and click *Start Interview*. | `Mic AudioContext Rate` reflects hardware rate (e.g., 44100 / 48000 Hz), downsampled cleanly in `audio-recorder-worklet.js` to 16,000 Hz. |
| 2 | **Chunk Size & Streaming** | Observe Telemetry panel during candidate speech. | Dispatches continuous 1280-byte (40 ms) PCM16 chunks without utterance buffering. |
| 3 | **AI Playback Roundtrip** | Candidate completes speaking or says "Hello". | AI responds with natural spoken voice at 24 kHz; round-trip response latency displayed in Debug Panel (typically < 1200ms). |
| 4 | **Interruption Handling** | Talk while the AI is speaking. | Server fires `INTERRUPTED` JSON frame; `AudioPlaybackManager.flush()` stops all running `AudioBufferSourceNode`s instantly; playback stops with zero residual lag. |
| 5 | **Silence Handling** | Remain silent for > 5 seconds after AI asks question. | VAD respects `VAD_SILENCE_DURATION_MS=600`, does not hallucinate or disconnect the socket. |
| 6 | **Auto-Reconnect Test** | Temporarily drop server connection or network. | Client switches to `RECONNECTING` status and executes exponential backoff reconnection. |
| 7 | **Transcript Persistence** | End interview or disconnect. | Session JSON containing full role-based transcript with ISO timestamps is written to `backend/logs/interviews/interview_<timestamp>.json`. |

---

## 6. Automated End-to-End Test Execution

To execute the automated headless verification test:
```bash
python scratch/test_voice_interview_e2e.py
```
This tests:
1. WebSocket handshake and session initiation
2. 40ms 16kHz PCM16 chunk streaming
3. Gemini Live 24kHz PCM16 audio packet reception
4. Transcript event streaming
5. Round-trip latency calculation
