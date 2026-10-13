# PROJECT_ANALYSIS.md
**MirrorMind — Gemini Live Voice Pipeline Analysis**
*Read-only. No code was modified, run, or built. API keys redacted.*

---

## 1. Architecture

```
Browser
  └── AudioWorkletProcessor (audio-recorder-worklet.js, 16 kHz PCM16 @ 40ms chunks)
       └── AudioWorkletCapture  (audio-worklet-capture.js)
            ├── Level monitor (AnalyserNode, RAF loop, adaptive calibration 2s)
            └── Manual-VAD callbacks → ACTIVITY_START / ACTIVITY_END JSON frames

  └── WebSocket client
       ├── GeminiLiveClient   (gemini-live-client.js)   → /api/voice/live
       └── InterviewLiveClient (interview-live-client.js) → /api/voice/interview-ws
            └── AudioPlaybackManager (audio-playback-manager.js, 24 kHz PCM16)

FastAPI Server  (backend/main.py)
  ├── /api/voice/live          ← live_voice.py   (Nova, portfolio-CRUD + RAG tools)
  ├── /api/voice/interview-ws  ← live_interview.py (Alex, technical interview)
  └── /ws                      ← alias → interview_websocket_proxy()

Gemini Live API  (client.aio.live.connect, v1beta / v1alpha)
  └── Model: gemini-2.5-flash-native-audio-latest (primary)
      Fallback (live_voice): gemini-2.0-flash-exp
      Fallback (interview): reconnect loop, no model swap
```

Two independent pipelines share the same /api/voice prefix but differ in architecture:
- Nova (live_voice.py): Three-role asyncio.wait(FIRST_COMPLETED) pattern; binary PCM forwarded inside a single session.receive() generator.
- Alex (live_interview.py): Four-task pattern (browser_to_queue, queue_to_gemini, gemini_to_browser, browser_task); audio buffered through an asyncio.Queue(maxsize=100).

---

## 2. Session Setup Config

### live_voice.py — Nova
| Field | Value / Source |
|---|---|
| API version | v1beta (hardcoded, live_voice.py:284) |
| Primary model | GEMINI_LIVE_MODEL env → gemini-2.5-flash-native-audio-latest |
| Fallback model | GEMINI_LIVE_FALLBACK_MODEL env → gemini-2.0-flash-exp |
| Voice | Zephyr (hardcoded, live_voice.py:294) |
| Response modality | AUDIO only |
| VAD | disabled=False, start/end sensitivity = HIGH, silence_duration_ms=2500, prefix_padding_ms=100 |
| Activity handling | START_OF_ACTIVITY_INTERRUPTS |
| Transcription | en-US, en-IN (both input and output) |
| Context compression | trigger=104857 tokens, sliding window target=52428 tokens |
| Session resumption | NOT used |
| Tools | 6 function declarations (add_project, add_internship, update_profile, query_rag_database, navigate_ui, switch_to_interview_mode, open_document) |

### live_interview.py — Alex
| Field | Value / Source |
|---|---|
| API version | v1alpha (hardcoded, live_interview.py:338) |
| Primary model | GEMINI_LIVE_MODEL env → gemini-2.5-flash-native-audio-latest |
| Fallback model | NONE — reconnect loop retries same model (live_interview.py:635-639) |
| Voice | GEMINI_VOICE_NAME env → Aoede |
| Response modality | AUDIO only |
| VAD | USE_MANUAL_VAD=true → disabled=True (server-side Gemini VAD off); otherwise env-driven sensitivity values |
| Activity handling | START_OF_ACTIVITY_INTERRUPTS |
| Transcription | en-US only (input + output) |
| Context compression | sliding window target = TARGET_COMPRESSION_TOKENS env → 4096 tokens |
| Session resumption | enabled via SessionResumptionConfig(handle=..., transparent=True) |
| Tools | NONE |

---

## 3. Audio Input

### Worklet (audio-recorder-worklet.js)
- Hardware rate → 16 kHz via linear interpolation (resampleRatio = sampleRate / 16000).
- Quantised to PCM16 LE, batched to 640 samples = 40 ms chunks.
- 1-second circular pre-roll (25 chunks). Pre-roll flushed to main thread on START_RECORDING to avoid clipping (audio-recorder-worklet.js:33-37).
- AudioWorkletCapture does not set sampleRate on the AudioContext constructor (audio-worklet-capture.js:64), so context opens at hardware rate. Downsampling happens entirely inside the worklet.

### Manual-VAD (AudioWorkletCapture._startLevelMonitor)
```
// audio-worklet-capture.js:165-169
this.silenceTimeoutId = setTimeout(() => {
  this.isUserSpeaking = false;
  this.onActivityEnd();
}, this.pauseToleranceMs);   // default 2800 ms
```
- After 2 seconds of calibration, speech onset detected at rms >= speechThreshold (adaptive, min 0.012).
- End-of-turn fires 2.8 s after RMS drops below threshold → sends ACTIVITY_END to backend.
- Backend (manual VAD path) calls session.send_realtime_input(activity_end=...) to signal Gemini.

### ScriptProcessor fallback (GeminiLiveClient — Nova path)
```
// gemini-live-client.js:249
this.micProcessor = this.micContext.createScriptProcessor(2048, 1, 1);
```
- Uses deprecated ScriptProcessor (not AudioWorklet). Buffer = 2048 samples @ 16 kHz = 128 ms per callback.
- Barge-in check: if rms > 0.04 while activeSources.length > 0 → calls _flushAudioPlayback() locally, then sends {type:'INTERRUPT'} to server (gemini-live-client.js:269-271).
- No explicit ACTIVITY_START/ACTIVITY_END signals — relies entirely on Gemini server-side VAD.
- Connects micProcessor to micContext.destination (gemini-live-client.js:287) — this is the echo source.

---

## 4. Audio Output

### AudioPlaybackManager (interview path)
- Gapless scheduling via nextStartTime (audio-playback-manager.js:57-60).
- 24 kHz AudioContext, PCM16 → Float32 on each chunk.
- flush() stops all activeSources immediately and resets nextStartTime to currentTime.

### GeminiLiveClient._playPcmAudio (Nova path)
- Same gapless pattern (gemini-live-client.js:335-338).
- playContext lazily created on first chunk; if browser suspends context before first audio, resume() is called (gemini-live-client.js:311-313).

---

## 5. WebSocket Lifecycle

### Nova (live_voice.py)
```
# live_voice.py:884-897
task1 = asyncio.create_task(client_to_gemini())
task2 = asyncio.create_task(gemini_to_client())
done, pending = await asyncio.wait([task1, task2], return_when=asyncio.FIRST_COMPLETED)
for p in pending: p.cancel()
# finally: session.close()
```
- Single Gemini session per browser connection. No reconnect.
- TURN_COMPLETE keeps WS open; only 30 s silence watchdog (client-side) triggers disconnect().

### Alex (live_interview.py)
```
# live_interview.py:594-639
while True:   # outer reconnect loop
    async with client.aio.live.connect(...) as session:
        t_in  = asyncio.create_task(queue_to_gemini(session))
        t_out = asyncio.create_task(gemini_to_browser(session))
        done, pending = await asyncio.wait([t_in, t_out], FIRST_COMPLETED)
    if websocket.client_state.name != "CONNECTED": break
    await asyncio.sleep(0.5)   # reconnect delay
```
- Outer loop re-connects to Gemini Live if session drops (GO_AWAY), preserving the browser WS.
- Session resumption handle updated on every session_resumption_update event (live_interview.py:481-486).
- browser_to_queue task runs independently, allowing control messages during reconnect.

---

## 6. Message Handling

### Browser → Backend
| Message | Source | Handler |
|---|---|---|
| ArrayBuffer | mic PCM16 | forwarded to session.send_realtime_input(audio=...) |
| {type:'TEXT_INPUT'} | Nova sendText() | session.send_client_content(turn_complete=True) |
| {type:'START_GREETING'} | Nova autoGreet | prompts Gemini to speak greeting |
| {type:'INTERRUPT'} | Nova barge-in | NOT handled server-side — no INTERRUPT case in client_to_gemini() |
| {type:'ACTIVITY_START'} | Alex WorkletCapture | session.send_realtime_input(activity_start=...) if manual VAD |
| {type:'ACTIVITY_END'} | Alex WorkletCapture | session.send_realtime_input(activity_end=...) if manual VAD |
| {type:'START_INTERVIEW'} | Alex frontend | sends greeting prompt to session if not has_greeted |
| {type:'END_INTERVIEW'} | Alex frontend | breaks browser_to_queue loop → triggers finally/cleanup |
| {type:'PING'} | Nova client | {type:'PONG'} |

### Backend → Browser
| Message | Trigger |
|---|---|
| {type:'SESSION_READY'} | Nova: Gemini connect success |
| {type:'STATUS', status:'CONNECTED'} | Alex: Gemini connect success |
| ArrayBuffer (24 kHz PCM) | Gemini audio chunk |
| {type:'TEXT_CHUNK', text} | Gemini text token |
| {type:'TRANSCRIPT', role, text, isFinal} | Alex: input/output transcription events |
| {type:'TURN_COMPLETE'} | server_content.turn_complete |
| {type:'INTERRUPTED'} | server_content.interrupted |
| {type:'SESSION_RESUMED', handle} | session_resumption_update.new_handle |
| {type:'GO_AWAY', timeLeft} | msg.go_away |
| {type:'METRICS', latencyMs, tokenUsage} | Alex: latency + usage metadata |
| {type:'TOOL_START'/'TOOL_PROGRESS'/'UI_ACTION'} | Nova: tool execution |
| {type:'INTERVIEW_SUMMARY', evaluation, transcript} | Alex: post-session cleanup |
| {type:'ERROR', message} | Any failure path |

---

## 7. Suspected Root Causes of Known Bugs

### Bug 1 — Replies before user finishes / interrupts mid-sentence

**Cause A (Alex path):** USE_MANUAL_VAD=true (.env:37). The client-side VAD fires ACTIVITY_END after 2800 ms of silence (audio-worklet-capture.js:16). Any brief natural pause in speech crosses below threshold and starts the 2.8 s timer. More critically:
```
// audio-worklet-capture.js:70-75
onActivityStart: () => {
  this.ws.send(JSON.stringify({ type: 'ACTIVITY_START' }));
  this.playback.flush();   // flushes AI audio on ANY sound above threshold
}
```
Room noise or a mic click above speechThreshold sends ACTIVITY_START and immediately flushes ongoing AI audio.

**Cause B (Nova path):** Server-side VAD is enabled with END_SENSITIVITY_HIGH and silence_duration_ms=2500. Client sends INTERRUPT if rms > 0.04 and AI is playing — this 0.04 threshold is close to room noise for typical microphones. No server-side handling of INTERRUPT message exists in client_to_gemini() (live_voice.py:756-768).

### Bug 2 — Echo heard while AI speaks

**Direct cause (Nova path only):**
```
// gemini-live-client.js:287
this.micProcessor.connect(this.micContext.destination);  // mic audio → speakers
```
ScriptProcessor node is wired directly to the AudioContext destination. Every mic sample is routed to output speakers, creating a live echo. Hardware AEC (echoCancellation:true in getUserMedia) does not suppress this because it targets acoustic echo, not a direct JavaScript audio-graph route.

The Alex path (AudioWorkletCapture) does NOT connect workletNode or sourceNode to audioContext.destination — no echo on the interview path.

### Bug 3 — Responses cut off after ~5 words

SUSPECT — no direct confirming evidence found. Two candidate causes based on code:

1. gemini_to_browser breaks out of async for msg in session.receive() on turn_complete (live_interview.py:583), then asyncio.wait completes and cancels queue_to_gemini. If turn_complete arrives after the first few audio frames — before speech generation finishes — the loop exits prematurely.

2. AudioPlaybackManager flush() is triggered by a false-positive onActivityStart (room noise above speechThreshold). flush() discards all scheduled audio even if more chunks are mid-flight from the server.

### Bug 4 — Unstable / unestablished connection

SUSPECT — Three observations:

1. Alex client reconnect uses exponential backoff: delay = min(1000 * 1.5^(attempts-1), 5000) (interview-live-client.js:216). Under rapid reconnects this may never stabilize.

2. live_interview.py:338 uses api_version="v1alpha" — the Live API v1alpha is experimental and likely less stable than v1beta used by Nova (live_voice.py:284).

3. No model fallback in the Alex pipeline; each reconnect retries the same potentially-unavailable model.

---

## 8. Missing Pieces

| # | Gap | Evidence |
|---|---|---|
| 1 | Nova INTERRUPT not handled server-side. client_to_gemini() has no INTERRUPT case. Client sends {type:'INTERRUPT'} but backend ignores it; Gemini keeps generating audio. | live_voice.py:756-768 |
| 2 | mic→speaker loopback not guarded in Nova. micProcessor.connect(micContext.destination) is unconditional. | gemini-live-client.js:287 |
| 3 | No USE_MANUAL_VAD=false path active for Alex. .env:37 sets USE_MANUAL_VAD=true. Server-side VAD else-branch exists in build_interview_config but is not exercised. | live_interview.py:113-130, .env:37 |
| 4 | No model fallback for Alex. If primary model fails, reconnect loop retries the same model indefinitely. | live_interview.py:337, 635 |
| 5 | Non-standard model IDs used for evaluation (gemini-3.8-flash, gemini-3.1-flash-lite, gemini-3.5-flash). These do not match public Gemini SDK model names. | .env:21-22, live_interview.py:256 |
| 6 | Greeting sent from two places. Outer session open (live_interview.py:608-623) AND START_INTERVIEW handler (live_interview.py:433-445) both dispatch a greeting. has_greeted=True prevents the double-send in the normal case but greeting is silently skipped after any reconnect. | live_interview.py:346, 608, 434 |
| 7 | No server-side keep-alive / heartbeat. 30 s client silence closes Nova; Alex has no watchdog at all. Long thinking pauses in interview will cause Nova disconnect. | gemini-live-client.js:126-141; interview-live-client.js — no watchdog |
| 8 | Transcript building is cumulative not delta-only. candidate_turn_fragments joined on every event → UI receives ever-growing text strings rather than incremental deltas. | live_interview.py:522, 536 |

---

*End of analysis. 0 files modified.*
