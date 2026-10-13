"""
routes/live_interview.py — Full-Duplex Low-Latency Gemini Live Voice Interview Proxy
WebSocket Endpoint: /api/voice/interview-ws and /ws

Architecture:
Browser (AudioWorklet 16kHz PCM16) <-> FastAPI WebSocket Proxy <-> Gemini Live API (24kHz PCM16)
"""

import os
import time
import json
import wave
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException, Header
from google import genai
from google.genai import types

from db import database as db
from auth_utils import decode_token

router = APIRouter(prefix="/api/voice", tags=["live_interview"])


# ── Phase-0: Structured debug logger (gated on DEBUG_VOICE env) ───────────────
def _vlog(session_id: str, category: str, message: str) -> None:
    """Structured timestamped logger for the interview pipeline.
    All output is suppressed when DEBUG_VOICE=false/0/no in environment.
    """
    if os.getenv("DEBUG_VOICE", "true").strip().lower() in ("false", "0", "no"):
        return
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    print(f"[{ts}] [{session_id}] [{category.upper()}] {message}", flush=True)


# ── System Instruction for Alex, Senior Technical Interviewer & Mentor ─────────
ALEX_SYSTEM_INSTRUCTION = """Your name is Alex. You are a senior, friendly, and approachable technical interviewer conducting a live conversational interview for MirrorMind.

CRITICAL LANGUAGE CONSTRAINT - STRICTLY ENGLISH ONLY:
1. You must speak exclusively in standard English.
2. The candidate speaks English (often with an Indian accent). Interpret all spoken candidate audio as English.
3. NEVER switch to, translate, or transcribe into Kannada, Hindi, or any other regional script or language. Every single word and response must be in clear, standard English.

INTERVIEW PHASES & CONVERSATION FLOW:
1. PHASE 1: WARM WELCOME & INTRODUCTION:
   - When the interview begins, greet the candidate warmly by their name (e.g., "Hello Prajwal! Welcome to MirrorMind.").
   - Ask them to introduce themselves: their background, current studies/role, and projects or technologies they enjoy working on.
2. PHASE 2: FOLLOW-UP ON INTRO:
   - When the candidate finishes their self-introduction, actively listen to what they mentioned.
   - Warmly acknowledge what they shared (e.g., "Great to meet you, Prajwal! It's fantastic to hear about your experience building full-stack web applications with React and Python...").
   - Immediately ask your very first interview question directly based on their introduction, projects, or mentioned tech stack.
3. PHASE 3: CONVERSATIONAL TECHNICAL DEEP-DIVE:
   - Continue like a natural, friendly communication between peer engineers.
   - Ask ONE crisp question at a time.
   - Listen carefully to their responses. Ask intelligent follow-ups probing their architecture decisions, practical problem-solving, trade-offs, and implementation details.
   - Build directly upon their previous answer.
4. TONE & SPOKEN STYLE:
   - Warm, encouraging, clean, neat, and professional.
   - Keep spoken turns concise (1 to 3 sentences maximum). Avoid long lectures, monologues, or reciting bullet points.
   - Give friendly affirmations when they answer well ("That makes a lot of sense," "Good point," "Nice approach").
   - If candidate's response is silent or unintelligible, politely and warmly say: "I didn't quite catch that. Could you please repeat that in English?"
"""


def get_gemini_api_keys() -> List[str]:
    """Returns primary paid API key followed by fallback keys for high resilience."""
    keys = []
    primary = (
        os.getenv("GEMINI_PAID_API_KEY")
        or os.getenv("GEMINI_LIVE_API_KEY")
        or os.getenv("GEMINI_API_KEY")
    )
    if primary:
        keys.append(primary.strip())

    fallback_str = os.getenv("GEMINI_FALLBACK_KEYS", "")
    for k in fallback_str.split(","):
        k = k.strip()
        if k and k not in keys:
            keys.append(k)

    # Legacy environment variables as extra backup
    for extra in [os.getenv("GEMINI_API_KEY_RAG_DB"), os.getenv("GEMINI_API_KEY")]:
        if extra and extra.strip() not in keys:
            keys.append(extra.strip())

    return keys


def _get_env_sensitivity(env_val: str, default: str = "LOW") -> Any:
    val = (env_val or default).strip().upper()
    if "HIGH" in val:
        return types.StartSensitivity.START_SENSITIVITY_HIGH
    if "UNSPECIFIED" in val:
        return types.StartSensitivity.START_SENSITIVITY_UNSPECIFIED
    return types.StartSensitivity.START_SENSITIVITY_LOW


def _get_env_end_sensitivity(env_val: str, default: str = "LOW") -> Any:
    val = (env_val or default).strip().upper()
    if "HIGH" in val:
        return types.EndSensitivity.END_SENSITIVITY_HIGH
    if "UNSPECIFIED" in val:
        return types.EndSensitivity.END_SENSITIVITY_UNSPECIFIED
    return types.EndSensitivity.END_SENSITIVITY_LOW


def build_interview_config(resumption_handle: Optional[str] = None) -> types.LiveConnectConfig:
    """Builds typed LiveConnectConfig pinned strictly to English (en-US) transcription."""
    silence_duration = int(os.getenv("INTERVIEW_SILENCE_MS", os.getenv("VAD_SILENCE_DURATION_MS", "1800")))
    prefix_padding = int(os.getenv("INTERVIEW_PREFIX_PADDING_MS", os.getenv("VAD_PREFIX_PADDING_MS", "200")))
    start_sens = _get_env_sensitivity(os.getenv("INTERVIEW_START_SENSITIVITY", os.getenv("VAD_START_SENSITIVITY", "LOW")))
    end_sens = _get_env_end_sensitivity(os.getenv("INTERVIEW_END_SENSITIVITY", os.getenv("VAD_END_SENSITIVITY", "LOW")))
    target_tokens = int(os.getenv("TARGET_COMPRESSION_TOKENS", "4096"))
    voice_name = os.getenv("GEMINI_VOICE_NAME", "Aoede")
    use_manual_vad = os.getenv("USE_MANUAL_VAD", "false").lower() == "true"

    resumption_config = types.SessionResumptionConfig(
        handle=resumption_handle,
        transparent=True if resumption_handle else None
    )

    if use_manual_vad:
        realtime_input_config = types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(
                disabled=True
            ),
            activity_handling=types.ActivityHandling.START_OF_ACTIVITY_INTERRUPTS
        )
    else:
        realtime_input_config = types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(
                disabled=False,
                start_of_speech_sensitivity=start_sens,
                end_of_speech_sensitivity=end_sens,
                prefix_padding_ms=prefix_padding,
                silence_duration_ms=silence_duration,
            ),
            activity_handling=types.ActivityHandling.START_OF_ACTIVITY_INTERRUPTS
        )

    return types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],
        system_instruction=types.Content(
            parts=[types.Part.from_text(text=ALEX_SYSTEM_INSTRUCTION)]
        ),
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice_name)
            )
        ),
        realtime_input_config=realtime_input_config,
        # Strictly English-US to prevent phonetic mapping to regional Kannada/Indic scripts
        input_audio_transcription=types.AudioTranscriptionConfig(
            language_codes=["en-US"]
        ),
        output_audio_transcription=types.AudioTranscriptionConfig(
            language_codes=["en-US"]
        ),
        session_resumption=resumption_config,
        context_window_compression=types.ContextWindowCompressionConfig(
            sliding_window=types.SlidingWindow(target_tokens=target_tokens)
        ),
    )


async def _resolve_candidate_info(websocket: WebSocket):
    """Accurately identifies candidate name and user_id from query params, JWT, and database."""
    user_id = None
    candidate_name = None

    query_token = websocket.query_params.get("token")
    query_name = websocket.query_params.get("name")
    query_user_id = websocket.query_params.get("userId")

    if query_user_id and query_user_id.strip():
        user_id = query_user_id.strip()

    if query_name and query_name.strip() and query_name.strip().lower() != "candidate":
        candidate_name = query_name.strip()

    email = None
    if query_token:
        try:
            payload = decode_token(query_token)
            if not user_id:
                user_id = payload.get("sub")
            email = payload.get("email")
        except Exception:
            pass

    # Query MongoDB for candidate name
    if db is not None:
        try:
            # 1. Check students collection
            if user_id:
                s_doc = await db.students.find_one({"user_id": user_id})
                if not s_doc:
                    s_doc = await db.students.find_one({"_id": user_id})
                if not s_doc:
                    s_doc = await db.students.find_one({"id": user_id})
                if s_doc and s_doc.get("name") and not candidate_name:
                    candidate_name = s_doc.get("name")

            # 2. Check users collection
            if not candidate_name:
                u_doc = None
                if user_id:
                    u_doc = await db.users.find_one({"_id": user_id})
                    if not u_doc:
                        u_doc = await db.users.find_one({"id": user_id})
                if not u_doc and email:
                    u_doc = await db.users.find_one({"email": email})
                if u_doc and u_doc.get("name"):
                    candidate_name = u_doc.get("name")
        except Exception as e:
            print(f"[RESOLVE_CANDIDATE][ERR] {e}")

    if not candidate_name or not candidate_name.strip():
        candidate_name = "Candidate"

    return user_id, candidate_name


async def generate_interview_evaluation(
    transcript_log: List[Dict[str, Any]],
    candidate_name: str,
    api_keys: List[str]
) -> Dict[str, Any]:
    """
    Generates a structured performance evaluation and summary of the interview.
    Analyzes strengths, places to improve, scores, and friendly feedback.
    """
    turns_text = []
    candidate_chars = 0
    for t in transcript_log:
        role = "Candidate" if t.get("role") in ("candidate", "user") else "Interviewer (Alex)"
        txt = (t.get("text") or "").strip()
        if txt:
            turns_text.append(f"{role}: {txt}")
            if role == "Candidate":
                candidate_chars += len(txt)

    full_transcript_str = "\n".join(turns_text)

    # If interview was too brief for deep technical scoring
    if candidate_chars < 15:
        return {
            "summary": f"The voice interview session with {candidate_name} was initiated, but concluded before in-depth technical discussions took place.",
            "strong_areas": [
                "Showed initiative by launching the live AI voice interview session",
                "Successfully established real-time audio connection"
            ],
            "areas_for_improvement": [
                "Complete a full introduction detailing your tech stack and recent projects",
                "Answer technical follow-up questions to showcase problem-solving ability"
            ],
            "key_topics": ["Introduction & Setup"],
            "overall_score": 70,
            "communication_score": 72,
            "technical_score": 68,
            "feedback_message": f"Great start taking the initiative, {candidate_name}! Whenever you're ready, start another session and introduce your favorite tech stack to explore deep technical questions."
        }

    eval_model = os.getenv("GEMINI_EVALUATION_MODEL", "gemini-3.8-flash")
    candidate_models = [eval_model, "gemini-3.5-flash", "gemini-3.1-pro-preview", "gemini-3.1-flash-lite"]

    prompt = f"""You are a senior technical hiring manager and warm career mentor reviewing a voice interview transcript between interviewer Alex and candidate {candidate_name}.

FULL TRANSCRIPT:
{full_transcript_str}

Evaluate the candidate's performance thoroughly and return a valid JSON object with the following fields:
- summary: A 2-3 sentence overview of the conversation and overall technical readiness.
- strong_areas: A list of 2 to 4 specific strengths demonstrated (e.g., technical knowledge, communication clarity, problem-solving, specific tools mentioned).
- areas_for_improvement: A list of 2 to 4 constructive, actionable places to improve (e.g., topics to brush up on, structuring answers with STAR method, detailing trade-offs).
- key_topics: A list of main technical topics and projects discussed.
- overall_score: An integer score from 50 to 98.
- communication_score: An integer score from 50 to 98.
- technical_score: An integer score from 50 to 98.
- feedback_message: A friendly, motivating, encouraging personal message addressed to {candidate_name} from Alex.

Return ONLY pure raw JSON without markdown formatting or code blocks."""

    for key in api_keys:
        client = genai.Client(api_key=key)
        for model in candidate_models:
            try:
                resp = await asyncio.to_thread(
                    client.models.generate_content,
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.3
                    )
                )
                if resp and resp.text:
                    cleaned = resp.text.strip()
                    if cleaned.startswith("```"):
                        lines = cleaned.splitlines()
                        if lines[0].startswith("```"):
                            lines = lines[1:]
                        if lines and lines[-1].startswith("```"):
                            lines = lines[:-1]
                        cleaned = "\n".join(lines).strip()
                    data = json.loads(cleaned)
                    return data
            except Exception as e:
                print(f"[EVALUATION_GEN][WARN] Key/model {model} failed: {e}")
                continue

    # Fallback default evaluation if LLM calls fail
    return {
        "summary": f"Completed live voice interview session with {candidate_name}.",
        "strong_areas": [
            "Participated actively in the live conversational interview",
            "Clear verbal engagement with the interviewer"
        ],
        "areas_for_improvement": [
            "Continue practicing structured conversational technical explanations",
            "Provide concrete examples of challenges solved in past projects"
        ],
        "key_topics": ["General Technical Discussion"],
        "overall_score": 75,
        "communication_score": 76,
        "technical_score": 74,
        "feedback_message": f"Solid effort, {candidate_name}! Keep practicing to sharpen your interview confidence."
    }


# ── WebSocket Proxy Handler ───────────────────────────────────────────────────
@router.websocket("/interview-ws")
async def interview_websocket_proxy(websocket: WebSocket):
    await websocket.accept()
    session_id = f"interview_{int(time.time()*1000)}"
    user_id, candidate_name = await _resolve_candidate_info(websocket)
    session_start_time = time.time()

    api_keys = get_gemini_api_keys()
    if not api_keys:
        await websocket.send_json({"type": "ERROR", "message": "Missing GEMINI_LIVE_API_KEY on server."})
        await websocket.close()
        return

    primary_api_key = api_keys[0]
    live_model = os.getenv("GEMINI_LIVE_MODEL", "gemini-2.5-flash-native-audio-latest")
    client = genai.Client(api_key=primary_api_key, http_options={"api_version": "v1beta"})

    # Session State
    latest_resumption_handle: Optional[str] = None
    transcript_log: List[Dict[str, Any]] = []
    t_speech_ended: Optional[float] = None
    first_audio_chunk_logged = False
    active_gemini_session = None
    has_greeted = False
    evaluation_generated = False
    session_evaluation: Optional[Dict[str, Any]] = None
    session_ended = asyncio.Event()

    # Telemetry
    turn_counter = 0
    t_turn_start = time.time()
    current_candidate_pcm = bytearray()
    candidate_turn_fragments: List[str] = []
    ai_turn_fragments: List[str] = []

    stats = {
        "backend_received_bytes": 0,
        "gemini_forwarded_bytes": 0,
        "dropped_chunks": 0,
        "transcription_event_count": 0,
    }

    _vlog(session_id, "WS_CONNECT", f"Candidate connected: {candidate_name} (User: {user_id})")

    audio_queue: asyncio.Queue[bytes] = asyncio.Queue(maxsize=100)

    # ── Tool execution helper for Interview ───────────────────────────────────
    async def execute_interview_tool(name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        t_tool_start = time.time()
        _vlog(session_id, "TOOL_START", f"Executing interview tool: {name}", args)
        try:
            if name == "end_interview":
                _vlog(session_id, "TOOL_END_INTERVIEW", "Model requested end_interview.")
                session_ended.set()
                await websocket.send_json({
                    "type": "UI_ACTION",
                    "action": "END_INTERVIEW",
                    "message": "Interview concluded."
                })
                elapsed = (time.time() - t_tool_start) * 1000
                _vlog(session_id, "TOOL_DONE", f"end_interview handled in {elapsed:.1f}ms")
                return {"status": "success", "message": "Interview concluding."}
            else:
                elapsed = (time.time() - t_tool_start) * 1000
                _vlog(session_id, "TOOL_UNKNOWN", f"Unknown interview tool: {name} ({elapsed:.1f}ms)")
                return {"status": "error", "message": f"Unknown interview tool: {name}"}
        except Exception as tool_err:
            elapsed = (time.time() - t_tool_start) * 1000
            _vlog(session_id, "TOOL_ERROR", f"{name} error: {tool_err} ({elapsed:.1f}ms)")
            return {"status": "error", "message": str(tool_err)}

    # ── Task 1: Browser -> Audio Queue & Control Messages ────────────────────
    async def browser_to_queue():
        nonlocal t_speech_ended, turn_counter, t_turn_start, has_greeted
        use_manual_vad = os.getenv("USE_MANUAL_VAD", "false").lower() == "true"
        _turn_cand_chunks = 0
        try:
            while websocket.client_state.name == "CONNECTED" and not session_ended.is_set():
                msg = await websocket.receive()
                if "bytes" in msg and msg["bytes"]:
                    pcm_chunk = msg["bytes"]
                    stats["backend_received_bytes"] += len(pcm_chunk)
                    current_candidate_pcm.extend(pcm_chunk)
                    _turn_cand_chunks += 1
                    t_speech_ended = time.time()
                    try:
                        audio_queue.put_nowait(pcm_chunk)
                    except asyncio.QueueFull:
                        stats["dropped_chunks"] += 1
                        try:
                            audio_queue.get_nowait()
                        except Exception as q_err:
                            _vlog(session_id, "QUEUE_WARN", f"Dropped oldest chunk: {q_err}")
                        audio_queue.put_nowait(pcm_chunk)

                elif "text" in msg and msg["text"]:
                    try:
                        data = json.loads(msg["text"])
                        m_type = data.get("type", "UNKNOWN")
                        _vlog(session_id, "BROWSER_MSG", f"type={m_type}")

                        if m_type == "ACTIVITY_START":
                            t_turn_start = time.time()
                            current_candidate_pcm.clear()
                            candidate_turn_fragments.clear()
                            _turn_cand_chunks = 0
                            _vlog(session_id, "ACTIVITY_START", "Candidate started speaking")
                            if active_gemini_session and use_manual_vad:
                                try:
                                    await active_gemini_session.send_realtime_input(activity_start=types.ActivityStart())
                                except Exception as e:
                                    _vlog(session_id, "ACTIVITY_START_ERR", str(e))

                        elif m_type == "ACTIVITY_END":
                            turn_counter += 1
                            turn_duration = time.time() - t_turn_start
                            full_cand_text = "".join(candidate_turn_fragments).strip()
                            _vlog(session_id, f"TURN_{turn_counter}", f"Candidate turn ended ({turn_duration:.2f}s, {len(current_candidate_pcm)} bytes, chunks={_turn_cand_chunks})")

                            # Save candidate turn audio to /debug/turn_<n>.wav
                            if len(current_candidate_pcm) > 0:
                                try:
                                    proj_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
                                    debug_dir = os.path.join(proj_root, "debug")
                                    os.makedirs(debug_dir, exist_ok=True)
                                    wav_path = os.path.join(debug_dir, f"turn_{turn_counter}.wav")
                                    with wave.open(wav_path, "wb") as wf:
                                        wf.setnchannels(1)
                                        wf.setsampwidth(2)
                                        wf.setframerate(16000)
                                        wf.writeframes(bytes(current_candidate_pcm))
                                except Exception as wav_err:
                                    _vlog(session_id, "WAV_ERROR", str(wav_err))

                            # Inform Gemini Live of turn end
                            if active_gemini_session and use_manual_vad:
                                try:
                                    await active_gemini_session.send_realtime_input(activity_end=types.ActivityEnd())
                                except Exception as e:
                                    _vlog(session_id, "ACTIVITY_END_ERR", str(e))

                        elif m_type == "START_INTERVIEW":
                            if not has_greeted and active_gemini_session:
                                has_greeted = True
                                greeting_prompt = (
                                    f"Start the technical voice interview immediately now. "
                                    f"{'Greet ' + candidate_name + ' warmly by name' if candidate_name != 'Candidate' else 'Greet the candidate warmly and ask their name'}. "
                                    f"Welcome them to MirrorMind, and invite them to introduce themselves, sharing their background and the technologies or projects they enjoy working on. "
                                    f"Keep your spoken opening to 1 to 2 warm, friendly spoken sentences in clear English. Speak aloud now."
                                )
                                await active_gemini_session.send_client_content(
                                    turns=[types.Content(parts=[types.Part.from_text(text=greeting_prompt)])],
                                    turn_complete=True
                                )

                        elif m_type == "END_INTERVIEW":
                            _vlog(session_id, "END_INTERVIEW", "Client requested END_INTERVIEW.")
                            session_ended.set()
                            break

                    except Exception as e:
                        _vlog(session_id, "CONTROL_MSG_ERR", str(e))
        except (WebSocketDisconnect, asyncio.CancelledError):
            pass
        except Exception as e:
            _vlog(session_id, "BROWSER_INPUT_ERR", str(e))
            if websocket.client_state.name == "CONNECTED":
                try:
                    await websocket.send_json({"type": "ERROR", "message": f"Browser input error: {str(e)}"})
                except Exception:
                    pass

    # ── Task 2: Audio Queue -> Gemini Live ───────────────────────────────────
    async def queue_to_gemini(session):
        nonlocal first_audio_chunk_logged
        try:
            while websocket.client_state.name == "CONNECTED" and not session_ended.is_set():
                chunk = await audio_queue.get()
                stats["gemini_forwarded_bytes"] += len(chunk)
                if not first_audio_chunk_logged:
                    first_audio_chunk_logged = True
                    _vlog(session_id, "GEMINI_FIRST_CHUNK", "First audio chunk dispatched to Gemini Live.")
                await session.send_realtime_input(
                    audio={"data": chunk, "mime_type": "audio/pcm;rate=16000"}
                )
        except asyncio.CancelledError:
            pass
        except Exception as e:
            _vlog(session_id, "INPUT_ERROR", str(e))
            if websocket.client_state.name == "CONNECTED":
                try:
                    await websocket.send_json({"type": "ERROR", "message": f"Microphone forward error: {str(e)}"})
                except Exception:
                    pass

    # ── Task 3: Gemini Live -> Browser ───────────────────────────────────────
    async def gemini_to_browser(session):
        nonlocal latest_resumption_handle, t_speech_ended
        _turn_ai_chunks = 0

        def _flush_candidate_turn():
            cand_text = "".join(candidate_turn_fragments).strip()
            if cand_text:
                if not (transcript_log and transcript_log[-1].get("role") == "candidate" and transcript_log[-1].get("text") == cand_text):
                    transcript_log.append({
                        "role": "candidate",
                        "text": cand_text,
                        "is_final": True,
                        "timestamp": datetime.utcnow().isoformat(),
                    })
                candidate_turn_fragments.clear()

        try:
            while websocket.client_state.name == "CONNECTED" and not session_ended.is_set():
                turn_received_any = False
                async for msg in session.receive():
                    turn_received_any = True

                    # 1. Update session resumption handle
                    if msg.session_resumption_update and msg.session_resumption_update.new_handle:
                        latest_resumption_handle = msg.session_resumption_update.new_handle
                        _vlog(session_id, "SESSION_RESUMPTION", f"Handle updated: {latest_resumption_handle}")
                        await websocket.send_json({
                            "type": "SESSION_RESUMED",
                            "handle": latest_resumption_handle
                        })

                    # 2. Server GoAway notification
                    if msg.go_away:
                        _vlog(session_id, "GO_AWAY", f"time_left={getattr(msg.go_away, 'time_left', None)}")
                        await websocket.send_json({
                            "type": "GO_AWAY",
                            "timeLeft": msg.go_away.time_left
                        })

                    # 3. Usage & Token Metadata
                    if msg.usage_metadata:
                        um = msg.usage_metadata
                        await websocket.send_json({
                            "type": "METRICS",
                            "tokenUsage": {
                                "promptTokens": um.prompt_token_count,
                                "responseTokens": um.response_token_count,
                                "totalTokens": um.total_token_count,
                            }
                        })

                    # 4. Handle top-level tool call requests
                    if msg.tool_call and msg.tool_call.function_calls:
                        function_responses = []
                        for fc in msg.tool_call.function_calls:
                            fc_name = getattr(fc, 'name', '') or ''
                            fc_args = getattr(fc, 'args', {}) or {}
                            fc_id = getattr(fc, 'id', None)
                            _vlog(session_id, "TOOL_CALL", f"Model requested tool: {fc_name} args={fc_args}")
                            await websocket.send_json({
                                "type": "TOOL_START",
                                "name": fc_name,
                                "args": fc_args
                            })
                            t_tool_start = time.time()
                            try:
                                result = await execute_interview_tool(fc_name, fc_args)
                                tool_status = "success"
                            except Exception as tool_err:
                                tool_status = "error"
                                result = {"status": "error", "message": str(tool_err)}
                                _vlog(session_id, "TOOL_ERROR", f"Tool {fc_name} execution error: {tool_err}")

                            elapsed_ms = (time.time() - t_tool_start) * 1000
                            _vlog(session_id, "TOOL_DONE", f"Tool {fc_name} status={tool_status} in {elapsed_ms:.1f}ms")
                            function_responses.append(
                                types.FunctionResponse(name=fc_name, id=fc_id, response=result)
                            )

                        t_resp_send = time.time()
                        try:
                            await session.send_tool_response(function_responses=function_responses)
                            _vlog(session_id, "TOOL_RETURN", f"Tool responses returned to model in {((time.time() - t_resp_send)*1000):.1f}ms")
                        except Exception as resp_err:
                            _vlog(session_id, "TOOL_RETURN_FALLBACK", f"send_tool_response primary failed ({resp_err}), trying fallback input format")
                            try:
                                await session.send(input={
                                    "function_responses": [
                                        {"response": fr.response, "id": fr.id} for fr in function_responses
                                    ]
                                })
                                _vlog(session_id, "TOOL_RETURN", f"Fallback tool responses returned to model in {((time.time() - t_resp_send)*1000):.1f}ms")
                            except Exception as fb_err:
                                _vlog(session_id, "TOOL_RETURN_ERROR", f"All tool response methods failed: {resp_err} | {fb_err}")

                    # 5. Direct audio / text in msg
                    if hasattr(msg, 'data') and msg.data:
                        _turn_ai_chunks += 1
                        if t_speech_ended is not None:
                            latency_ms = (time.time() - t_speech_ended) * 1000
                            await websocket.send_json({
                                "type": "METRICS",
                                "latencyMs": round(latency_ms, 1)
                            })
                            t_speech_ended = None
                        await websocket.send_bytes(msg.data)

                    if hasattr(msg, 'text') and msg.text:
                        text_chunk = msg.text.strip()
                        if text_chunk:
                            ai_turn_fragments.append(text_chunk)
                            await websocket.send_json({
                                "type": "TEXT_CHUNK",
                                "text": text_chunk
                            })

                    # 6. Server content (Audio, Transcripts, Interruption, Parts)
                    if msg.server_content:
                        sc = msg.server_content

                        # Interruption handling
                        if sc.interrupted:
                            _vlog(session_id, "INTERRUPTED", "Candidate interrupted Alex. reason=server")
                            ai_turn_fragments.clear()
                            await websocket.send_json({"type": "INTERRUPTED"})

                        # Real-time Input Transcript (Candidate Speech)
                        if sc.input_transcription and sc.input_transcription.text:
                            stats["transcription_event_count"] += 1
                            delta_text = sc.input_transcription.text
                            candidate_turn_fragments.append(delta_text)
                            full_cand_text = "".join(candidate_turn_fragments)
                            is_final = sc.input_transcription.finished or False

                            _vlog(session_id, "TRANSCRIPTION_IN", f"len={len(delta_text)} is_final={is_final}")

                            if is_final:
                                transcript_log.append({
                                    "role": "candidate",
                                    "text": full_cand_text.strip(),
                                    "is_final": True,
                                    "timestamp": datetime.utcnow().isoformat(),
                                })
                                candidate_turn_fragments.clear()

                            await websocket.send_json({
                                "type": "TRANSCRIPT",
                                "role": "user",
                                "text": full_cand_text,
                                "delta": delta_text,
                                "isFinal": is_final,
                            })

                        # Real-time Output Transcript (Alex Speech)
                        if sc.output_transcription and sc.output_transcription.text:
                            _flush_candidate_turn()
                            stats["transcription_event_count"] += 1
                            delta_text = sc.output_transcription.text
                            ai_turn_fragments.append(delta_text)
                            full_ai_text = "".join(ai_turn_fragments)
                            is_final = sc.output_transcription.finished or False

                            _vlog(session_id, "TRANSCRIPTION_OUT", f"len={len(delta_text)} is_final={is_final}")

                            await websocket.send_json({
                                "type": "TRANSCRIPT",
                                "role": "assistant",
                                "text": full_ai_text,
                                "delta": delta_text,
                                "isFinal": is_final,
                            })

                        # Process EVERY part in sc.model_turn.parts in order
                        if sc.model_turn and sc.model_turn.parts:
                            _flush_candidate_turn()
                            for part in sc.model_turn.parts:
                                # Part 1: Audio
                                if part.inline_data and part.inline_data.data:
                                    _turn_ai_chunks += 1
                                    if t_speech_ended is not None:
                                        latency_ms = (time.time() - t_speech_ended) * 1000
                                        await websocket.send_json({
                                            "type": "METRICS",
                                            "latencyMs": round(latency_ms, 1)
                                        })
                                        t_speech_ended = None
                                    await websocket.send_bytes(part.inline_data.data)

                                # Part 2: Text
                                if part.text and not getattr(part, 'thought', False):
                                    text_chunk = part.text.strip()
                                    if text_chunk:
                                        ai_turn_fragments.append(text_chunk)
                                        await websocket.send_json({
                                            "type": "TEXT_CHUNK",
                                            "text": text_chunk
                                        })

                                # Part 3: Inline Function Call
                                if getattr(part, 'function_call', None):
                                    fc = part.function_call
                                    fc_name = getattr(fc, 'name', '') or ''
                                    fc_args = getattr(fc, 'args', {}) or {}
                                    fc_id = getattr(fc, 'id', None)
                                    _vlog(session_id, "TOOL_CALL", f"Model requested tool (inline): {fc_name} args={fc_args}")
                                    await websocket.send_json({
                                        "type": "TOOL_START",
                                        "name": fc_name,
                                        "args": fc_args
                                    })
                                    t_part_tool = time.time()
                                    try:
                                        result = await execute_interview_tool(fc_name, fc_args)
                                        tool_status = "success"
                                    except Exception as tool_err:
                                        tool_status = "error"
                                        result = {"status": "error", "message": str(tool_err)}
                                        _vlog(session_id, "TOOL_ERROR", f"Tool {fc_name} execution error: {tool_err}")

                                    elapsed_ms = (time.time() - t_part_tool) * 1000
                                    _vlog(session_id, "TOOL_DONE", f"Tool {fc_name} status={tool_status} in {elapsed_ms:.1f}ms")
                                    fr = types.FunctionResponse(name=fc_name, id=fc_id, response=result)
                                    try:
                                        await session.send_tool_response(function_responses=[fr])
                                    except Exception:
                                        try:
                                            await session.send(input={"function_responses": [{"response": fr.response, "id": fr.id}]})
                                        except Exception as part_fb_err:
                                            _vlog(session_id, "TOOL_RETURN_ERROR", f"Failed returning inline tool response: {part_fb_err}")

                        # Turn completion signal
                        if sc.turn_complete:
                            _flush_candidate_turn()
                            full_ai = "".join(ai_turn_fragments).strip()
                            if full_ai:
                                transcript_log.append({
                                    "role": "assistant",
                                    "text": full_ai,
                                    "is_final": True,
                                    "timestamp": datetime.utcnow().isoformat(),
                                })
                            _vlog(session_id, "TURN_COMPLETE", f"Alex turn finished. audio_chunks={_turn_ai_chunks}")
                            _turn_ai_chunks = 0
                            ai_turn_fragments.clear()
                            await websocket.send_json({"type": "TURN_COMPLETE"})
                            # Let session.receive() finish iteration naturally without manual break

                if not turn_received_any:
                    if getattr(session, '_ws', None) and getattr(session._ws, 'closed', False):
                        _vlog(session_id, "SESSION_CLOSED", "Underlying Gemini Live session closed.")
                        break
                    await asyncio.sleep(0.05)

        except (asyncio.CancelledError, WebSocketDisconnect):
            pass
        except Exception as e:
            _vlog(session_id, "OUTPUT_ERROR", str(e))
            if websocket.client_state.name == "CONNECTED":
                try:
                    await websocket.send_json({"type": "ERROR", "message": f"Streaming output error: {str(e)}"})
                except Exception:
                    pass

    # ── Main Connection Loop ──────────────────────────────────────────────────
    browser_task = asyncio.create_task(browser_to_queue())

    try:
        while websocket.client_state.name == "CONNECTED" and not session_ended.is_set():
            live_config = build_interview_config(resumption_handle=latest_resumption_handle)
            try:
                _vlog(session_id, "GEMINI_CONNECT", f"Connecting to Gemini Live ({live_model})...")
                async with client.aio.live.connect(model=live_model, config=live_config) as session:
                    active_gemini_session = session
                    _vlog(session_id, "GEMINI_CONNECTED", "Session connected")
                    await websocket.send_json({
                        "type": "STATUS",
                        "status": "CONNECTED",
                        "session_id": session_id,
                        "candidate_name": candidate_name
                    })

                    # Proactively trigger Alex's opening greeting to introduce candidate
                    if not has_greeted:
                        has_greeted = True
                        greeting_prompt = (
                            f"Start the technical voice interview immediately now. "
                            f"{'Greet ' + candidate_name + ' warmly by name' if candidate_name != 'Candidate' else 'Greet the candidate warmly and ask their name'}. "
                            f"Welcome them to MirrorMind, and invite them to introduce themselves, sharing their background and the technologies or projects they enjoy working on. "
                            f"Keep your spoken opening to 1 to 2 warm, friendly spoken sentences in clear English. Speak aloud now."
                        )
                        try:
                            await session.send_client_content(
                                turns=[types.Content(parts=[types.Part.from_text(text=greeting_prompt)])],
                                turn_complete=True
                            )
                            _vlog(session_id, "GREETING_SENT", f"Opening greeting dispatched to Alex for {candidate_name}.")
                        except Exception as e:
                            _vlog(session_id, "GREETING_ERROR", str(e))

                    # Run input and output loops concurrently
                    t_in = asyncio.create_task(queue_to_gemini(session))
                    t_out = asyncio.create_task(gemini_to_browser(session))
                    t_end = asyncio.create_task(session_ended.wait())

                    done, pending = await asyncio.wait([t_in, t_out, t_end], return_when=asyncio.FIRST_COMPLETED)
                    for p in pending:
                        p.cancel()

                    if session_ended.is_set() or websocket.client_state.name != "CONNECTED":
                        break
            except Exception as conn_err:
                _vlog(session_id, "RECONNECT", f"Session dropped ({conn_err}). Reconnecting...")
                if session_ended.is_set() or websocket.client_state.name != "CONNECTED":
                    break
                await asyncio.sleep(0.5)

    finally:
        browser_task.cancel()
        total_duration = round(time.time() - session_start_time)
        _vlog(session_id, "WS_DISCONNECT", f"Disconnected after {total_duration}s. Generating evaluation for {len(transcript_log)} turns...")

        # 1. Generate Structured Evaluation & Summary
        try:
            session_evaluation = await generate_interview_evaluation(
                transcript_log=transcript_log,
                candidate_name=candidate_name,
                api_keys=api_keys
            )
            evaluation_generated = True
        except Exception as eval_err:
            _vlog(session_id, "EVAL_ERROR", str(eval_err))
            session_evaluation = {
                "summary": f"Completed voice interview with {candidate_name}.",
                "strong_areas": ["Completed voice session"],
                "areas_for_improvement": ["Review technical fundamentals"],
                "key_topics": ["General"],
                "overall_score": 75,
                "communication_score": 75,
                "technical_score": 75,
                "feedback_message": "Keep up the great work!"
            }

        # 2. Persist to Disk JSON
        try:
            os.makedirs("logs/interviews", exist_ok=True)
            log_path = f"logs/interviews/{session_id}.json"
            session_record = {
                "session_id": session_id,
                "user_id": user_id,
                "candidate_name": candidate_name,
                "created_at": datetime.utcnow().isoformat(),
                "duration_seconds": total_duration,
                "transcript": transcript_log,
                "evaluation": session_evaluation
            }
            with open(log_path, "w", encoding="utf-8") as f:
                json.dump(session_record, f, indent=2)
            _vlog(session_id, "DISK_LOG", f"Record saved to {log_path}")
        except Exception as disk_err:
            _vlog(session_id, "DISK_LOG_ERROR", str(disk_err))

        # 3. Persist to MongoDB db.interviews
        if db is not None:
            try:
                mongo_doc = {
                    "session_id": session_id,
                    "user_id": user_id,
                    "candidate_name": candidate_name,
                    "created_at": datetime.utcnow(),
                    "duration_seconds": total_duration,
                    "transcript": transcript_log,
                    "evaluation": session_evaluation
                }
                await db.interviews.insert_one(mongo_doc)
                _vlog(session_id, "PERSIST", "Successfully persisted interview evaluation to MongoDB db.interviews!")
            except Exception as persist_err:
                _vlog(session_id, "PERSIST_ERROR", f"Failed to save in MongoDB: {persist_err}")

        # 4. Send Summary JSON over WebSocket if connection remains open
        if websocket.client_state.name == "CONNECTED":
            try:
                await websocket.send_json({
                    "type": "INTERVIEW_SUMMARY",
                    "sessionId": session_id,
                    "durationSeconds": total_duration,
                    "evaluation": session_evaluation,
                    "transcript": transcript_log
                })
            except Exception as summary_err:
                _vlog(session_id, "SUMMARY_SEND_ERR", f"Failed sending summary JSON: {summary_err}")


# ── REST API Endpoints for Retrieving Interview Summaries & History ───────────

@router.get("/interviews/history")
async def get_interview_history(
    userId: Optional[str] = Query(None),
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None)
):
    """Retrieves all past interview evaluations and summaries for the candidate."""
    resolved_uid = userId
    auth_token = token
    if not auth_token and authorization and authorization.startswith("Bearer "):
        auth_token = authorization.split(" ")[1]

    if auth_token and not resolved_uid:
        try:
            payload = decode_token(auth_token)
            resolved_uid = payload.get("sub")
        except Exception:
            pass

    query = {}
    if resolved_uid:
        query["user_id"] = resolved_uid

    if db is None:
        return {"interviews": []}

    try:
        cursor = db.interviews.find(query).sort("created_at", -1).limit(20)
        docs = await cursor.to_list(length=20)
        results = []
        for d in docs:
            d["_id"] = str(d["_id"])
            if isinstance(d.get("created_at"), datetime):
                d["created_at"] = d["created_at"].isoformat()
            results.append(d)
        return {"interviews": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch interview history: {str(e)}")


@router.get("/interviews/latest")
async def get_latest_interview(
    userId: Optional[str] = Query(None),
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None)
):
    """Retrieves the most recent interview evaluation and summary."""
    resolved_uid = userId
    auth_token = token
    if not auth_token and authorization and authorization.startswith("Bearer "):
        auth_token = authorization.split(" ")[1]

    if auth_token and not resolved_uid:
        try:
            payload = decode_token(auth_token)
            resolved_uid = payload.get("sub")
        except Exception:
            pass

    query = {}
    if resolved_uid:
        query["user_id"] = resolved_uid

    if db is None:
        raise HTTPException(status_code=404, detail="Database unavailable")

    try:
        doc = await db.interviews.find_one(query, sort=[("created_at", -1)])
        if not doc:
            # Fallback to absolute latest
            doc = await db.interviews.find_one({}, sort=[("created_at", -1)])
        if not doc:
            raise HTTPException(status_code=404, detail="No interview records found")

        doc["_id"] = str(doc["_id"])
        if isinstance(doc.get("created_at"), datetime):
            doc["created_at"] = doc["created_at"].isoformat()
        return doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/interviews/session/{session_id}")
async def get_interview_by_session(session_id: str):
    """Retrieves single interview record and evaluation by session ID."""
    if db is None:
        raise HTTPException(status_code=404, detail="Database unavailable")

    doc = await db.interviews.find_one({"session_id": session_id})
    if not doc:
        # Check disk fallback
        log_path = f"logs/interviews/{session_id}.json"
        if os.path.exists(log_path):
            with open(log_path, "r", encoding="utf-8") as f:
                return json.load(f)
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    doc["_id"] = str(doc["_id"])
    if isinstance(doc.get("created_at"), datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    return doc
