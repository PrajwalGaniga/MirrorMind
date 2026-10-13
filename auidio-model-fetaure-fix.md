TASK: Fix the voice pipeline in this project, ONE PHASE PER RUN.

RUN_PHASE = 0        <-- I will change this number each run. Execute ONLY this phase.

GLOBAL RULES
- First run only: create git branch `voice-fixes`. After each phase, commit with message "phase N: <summary>". Do not push.
- Touch only voice-related files: live_voice.py, live_interview.py, gemini-live-client.js, interview-live-client.js, audio-worklet-capture.js, audio-recorder-worklet.js, audio-playback-manager.js, the interview/voice UI components, and .env.example. Nothing else.
- Do not read node_modules, lockfiles, build output, or assets. Use grep first, then open only the relevant files.
- Do not install packages or start servers. Allowed checks: `python -m py_compile <file>`, `node --check <file>`, `pip show google-genai` (read-only version lookup).
- Do not rename existing assistants, message types, endpoints, or env vars. Add, don't rename.
- Before changing any Gemini SDK call, check the installed google-genai version and confirm the field/method exists in that version. If you cannot confirm it, do NOT guess: leave a `# TODO(verify-sdk)` comment and list it in your final report.
- Every tunable value (VAD sensitivity, silence ms, timeouts, thresholds) goes in .env with a default and a line in .env.example, so I can tune without editing code.
- Do not refactor or "improve" anything not listed in the current phase.
- Final output of each run: a change log of at most 30 lines (file, what changed, why), a list of `TODO(verify-sdk)` items, and a manual test checklist for this phase. No code dumps in the report.

========================================
PHASE 0 — INSTRUMENTATION (no behavior change)
========================================
Add a DEBUG_VOICE env flag (default true). When on, log with timestamps:
Backend (both pipelines):
- Every Gemini server message type received: audio chunk (count per turn, not each chunk), interrupted, turn_complete, generation_complete, go_away, tool_call, session_resumption_update, transcription events (length only).
- Every Gemini connect, setup-complete, close, and exception, including WebSocket close codes and reasons.
- Every browser message type received.
Frontend (both clients):
- Every playback flush with a `reason` string: "server_interrupted", "local_rms", "activity_start", "manual".
- RMS value at the moment any local barge-in or ACTIVITY_START fires.
- WS onopen/onclose (code, reason)/onerror, and every reconnect attempt number.
Expose the last 200 frontend log lines via `window.__voiceLog` so I can copy them from the console.
Acceptance: app behaves identically; logs make it possible to tell whether a cut-off was caused by the client (flush with no preceding server `interrupted`) or by the server.

========================================
PHASE 1 — ECHO AND SELF-INTERRUPTION (Nova / live_voice path first)
========================================
1. gemini-live-client.js: remove the direct `micProcessor.connect(micContext.destination)`. Replace ScriptProcessor capture with the existing AudioWorklet capture (capture only: no manual VAD, no ACTIVITY_START/END). If a zero-gain node is needed to keep the graph alive, use a GainNode with gain 0 to destination.
2. Delete the client-side RMS barge-in (the `rms > 0.04` check) and stop sending {type:'INTERRUPT'}. Server VAD handles barge-in. On server message INTERRUPTED, call the playback flush with reason "server_interrupted".
3. getUserMedia: set echoCancellation, noiseSuppression, autoGainControl explicitly as env/config-driven booleans (default all true). Print the actual applied settings via track.getSettings() in the debug log.
4. Add a SPEAKER_MODE toggle (UI switch, persisted in localStorage, default off): when on, do not send mic audio to the server while the assistant is playing audio; resume on turn_complete or when the playback queue drains. Document the trade-off (no barge-in) in a UI tooltip.
5. Confirm the playback AudioContext in the Nova client is created at 24000 Hz and report what it is.
6. Apply the same getUserMedia explicit-constraints and flush-reason changes to the interview client. Confirm that the interview path never routes mic to destination.
Acceptance: no mic loopback in the audio graph; no code path flushes playback except server INTERRUPTED or the manual toggle.

========================================
PHASE 2 — TURN-TAKING (VAD)
========================================
Nova (live_voice.py):
- Move VAD values to env: NOVA_START_SENSITIVITY (default LOW), NOVA_END_SENSITIVITY (default LOW), NOVA_SILENCE_MS (default 1000), NOVA_PREFIX_PADDING_MS (default 200). Replace the current HIGH/HIGH/2500 hardcode.
- Keep START_OF_ACTIVITY_INTERRUPTS.
Interview (live_interview.py + audio-worklet-capture.js + interview-live-client.js):
- Default USE_MANUAL_VAD=false. Server VAD uses env values: INTERVIEW_START_SENSITIVITY (LOW), INTERVIEW_END_SENSITIVITY (LOW), INTERVIEW_SILENCE_MS (1800), INTERVIEW_PREFIX_PADDING_MS (200).
- Keep the manual-VAD code behind the flag, but remove `this.playback.flush()` from `onActivityStart`. Playback flush happens only on server INTERRUPTED.
- When USE_MANUAL_VAD=false, the client must not send ACTIVITY_START/ACTIVITY_END and must not run the level monitor.
Acceptance: all values readable from env; no client-side code decides when the user's turn ended.

========================================
PHASE 3 — TRUNCATED RESPONSES
========================================
1. In BOTH gemini_to_client (Nova) and gemini_to_browser (Interview): find any `break`/`return` triggered by turn_complete or by the end of `session.receive()`. Check how session.receive() behaves in the installed SDK version. Restructure so the receive loop survives turn boundaries (outer `while True` around `async for msg in session.receive()`), exiting only on session close, cancellation, or an explicit end-of-session event. A completed turn must never cancel the sibling task or end the session.
2. Process EVERY part in model_turn.parts, not just the first. Handle audio, text, and function-call parts in order.
3. Every function call must receive a send_tool_response (success or error, always). Wrap tool execution so an exception still returns a response with an error payload. Log tool name, duration, result status.
4. Audit swallowed exceptions (`except: pass`, bare try/except around the send/receive loops) in both pipelines and replace with logged errors; forward a {type:'ERROR'} to the browser where user-visible.
5. Check the browser playback queue: confirm a chunk is never dropped on decode errors silently; log and continue.
Acceptance: a multi-turn conversation of 10+ turns stays in a single Gemini session unless go_away/close occurs; each turn plays to completion when nothing interrupts it.

========================================
PHASE 4 — CONNECTION STABILITY
========================================
Backend:
1. Nova: add session resumption (store the latest handle from session_resumption_update; enable resumption in the connect config). Add an outer reconnect loop like Interview has, keeping the browser WS open. Handle go_away by reconnecting with the latest handle BEFORE timeLeft expires. Notify the browser with {type:'RECONNECTING'} and {type:'SESSION_READY'}.
2. Wait for setup-complete before forwarding any mic audio to Gemini, in both pipelines. Buffer at most ~2 s of audio meanwhile, drop the oldest.
3. Add a server-side ping to the browser every 15 s (both pipelines) so idle proxies do not close the socket.
4. Model names: read only from env, no silent fallback. If connect fails, send {type:'ERROR', message} with the real exception text to the browser and log it. If a fallback model remains configured, log loudly when it is used.
Frontend:
5. Connection state machine in both clients: idle → connecting → connected → reconnecting → failed. Expose it to the UI with a visible status indicator (not just console).
6. Reconnect: exponential backoff with jitter, max attempts from env (default 6), then state "failed" with a Retry button. Reset the counter after 30 s of stable connection.
7. Replace Nova's 30 s silence disconnect with an idle timeout from env (default 5 min), preceded by a visible "still there?" prompt. Never silently disconnect.
8. AudioContexts: resume on user gesture; if state is "suspended" on first audio chunk, resume and log. Release mic tracks and close contexts on disconnect (no leaks across reconnects).
9. Handle `visibilitychange` and `online/offline` events: on offline show state; on online trigger reconnect.
Acceptance: killing the network for 10 s and restoring it results in automatic recovery with a visible state; a 10-minute session survives go_away.

========================================
PHASE 5 — INTERVIEW MODE FLOW (Nova → Interview handoff)
========================================
Target behavior:
a) In Nova, I say something like "start my interview". Nova asks "how many minutes?". I answer (e.g. "two"). Nova calls a function with the integer minutes (clamp 1–10; default 5 if unclear) and the app switches to interview mode.
b) Interview AI greets me and asks me to introduce myself. After my intro it asks questions personalised from my intro AND my skills/projects from the database.
c) A visible countdown runs. I can end early by voice ("stop the interview") or by a button.
d) At time-up or early stop, the interviewer wraps up, then I receive a structured summary: key strengths, areas to improve, what to focus on next.

Implementation requirements:
1. Reuse the existing switch_to_interview_mode tool. Add a `duration_minutes` integer parameter (required). Update Nova's system instruction so it ALWAYS asks for duration first, then calls the tool, and never starts the interview itself.
2. Handoff: close the Nova session fully (mic released, playback flushed) before the interview session opens. Never run two live audio sessions at once. Pass duration_minutes to the interview via the START_INTERVIEW message.
3. The timer is authoritative on the BACKEND (monotonic deadline per interview session), not in the model. The backend: sends {type:'TIMER', remainingSec} every second (or the deadline timestamp once, and the client counts down); at T-60s injects a client_content turn telling the interviewer to wrap up within one question; at T=0 injects a "time is up, give a brief closing" turn, then ends the live session and finalizes.
4. Load the user's skills/projects/internships from the database at interview start and put a compact summary in the interview system instruction (cap size; drop least important fields if long). The interviewer must: first ask for the introduction and wait; after it, ask questions grounded in the intro + DB skills; one question at a time; adapt difficulty to answers; keep each turn short (spoken, not essay-length).
5. Add an `end_interview` function tool to the interview session (and a button in the UI sending END_INTERVIEW). On either, finalize immediately.
6. Summary generation: build it from the stored transcript with a separate non-live text-model call, as already done today for INTERVIEW_SUMMARY. Do NOT change the evaluation model name; only report it if the call fails. Output JSON: {strengths[], improvement_areas[], focus_next[], overall_note}. Validate the JSON; on failure, retry once, then fall back to a plain-text summary. Send {type:'INTERVIEW_SUMMARY'} and render it in a clear summary screen.
7. Frontend: interview screen shows the countdown, a speaking/listening indicator, and an End button. After the summary, offer buttons "Back to assistant" (reopens Nova) and "Retake".
8. Edge cases to handle explicitly: user gives no duration; user gives >10 or <1; user disconnects mid-interview (still finalize and store the transcript); reconnect mid-interview must not replay the greeting and must keep the same deadline; go_away mid-interview resumes with the same deadline.
Acceptance: a full 2-minute interview runs end-to-end: duration asked → handoff → intro → personalised questions → wrap-up at the deadline → summary screen.

========================================
PHASE 6 — DO NOT RUN unless I say so (transcript deltas, shared Live module refactor)
========================================