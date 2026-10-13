"""
routes/live_voice.py — Google Gemini Multimodal Live Audio Agent (Nova)
Provides a high-performance bidirectional WebSocket endpoint at /api/voice/live.
Enables real-time 16kHz PCM audio streaming, live native 24kHz audio playback,
direct sub-100ms portfolio tool actions, instant grounded RAG retrieval,
and comprehensive millisecond-precision latency logging to /logs/voice_live.log.
"""

import os
import json
import time
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from google import genai
# Phase-0 import: _debug_enabled used only for conditional one-liners outside voice_logger
from google.genai import types

from db import database as db
from auth_utils import decode_token
from models.db_models import Project, Internship
from services.retrieval_service import retrieve_semantic_chunks
from services.voice_logger import voice_logger

router = APIRouter(prefix="/api/voice", tags=["live_voice"])

# Tools definitions for Google GenAI Live Audio
NOVA_TOOLS = [
    {
        "function_declarations": [
            {
                "name": "add_project",
                "description": "Add a new project to the student's portfolio. You MUST call this IMMEDIATELY whenever the user mentions adding a project or gives a project title.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "title": {"type": "STRING", "description": "Project title or name (e.g. 'MirrorMind')"},
                        "description": {"type": "STRING", "description": "Brief summary of what the project does. If omitted by user, generate a 1-sentence description based on the title"},
                        "tech_stack": {
                            "type": "ARRAY",
                            "items": {"type": "STRING"},
                            "description": "Technologies or languages used (e.g. ['React', 'FastAPI']), or empty list if none specified"
                        },
                        "github_url": {"type": "STRING", "description": "GitHub repository URL or null"},
                        "live_demo_url": {"type": "STRING", "description": "Live demo or deployment URL or null"}
                    },
                    "required": ["title"]
                }
            },
            {
                "name": "add_internship",
                "description": "Add an internship or work experience to the student's portfolio. Call this immediately when user mentions an internship.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "company_name": {"type": "STRING", "description": "Name of the organization or company"},
                        "role": {"type": "STRING", "description": "Internship role or position (default to 'Software Intern' if not specified)"},
                        "domain": {"type": "STRING", "description": "Technical domain (e.g. Backend, Web, AI)"},
                        "start_date": {"type": "STRING", "description": "Start date or timeframe (default to 'Recent')"},
                        "end_date": {"type": "STRING", "description": "End date or 'ongoing'"},
                        "description": {"type": "STRING", "description": "Brief summary of tasks"}
                    },
                    "required": ["company_name"]
                }
            },
            {
                "name": "update_profile",
                "description": "Update a field on the student's academic profile (e.g. cgpa, semester, branch, college_tier, career_interest).",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "field": {
                            "type": "STRING",
                            "description": "Field to update: cgpa, semester, branch, college_tier, backlog_count, career_interest, work_style_pref, communication_rating"
                        },
                        "value": {"type": "STRING", "description": "New value for the field"}
                    },
                    "required": ["field", "value"]
                }
            },
            {
                "name": "query_rag_database",
                "description": "Retrieve factual data from the student's profile, resume, academic records, skills, or projects from the database and FAISS index.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "query": {"type": "STRING", "description": "Question or keywords to search for in student records"}
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "navigate_ui",
                "description": "Navigate the web user interface to a target destination screen.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "destination": {
                            "type": "STRING",
                            "description": "Target screen route: /dashboard, /projects, /internships, /profile, /documents, /predict, /settings, /interview"
                        }
                    },
                    "required": ["destination"]
                }
            },
            {
                "name": "switch_to_interview_mode",
                "description": "Switch the interface to Live Technical Interview mode with Alex or start a mock interview practice. Call this IMMEDIATELY when the user says 'switch to interview mode', 'start interview', 'take my interview', 'practice interview', or asks to be interviewed.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "role": {
                            "type": "STRING",
                            "description": "Target job role (e.g. 'Full Stack Developer', 'Backend Developer', 'AI Engineer') or null to use profile target"
                        },
                        "focus": {
                            "type": "STRING",
                            "description": "Specific focus area (e.g. 'System Design', 'React & FastAPI', 'Data Structures') or null"
                        }
                    }
                }
            },
            {
                "name": "update_project",
                "description": "Update or complete the details (title, description, tech_stack) of the project currently being discussed or added.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "title": {"type": "STRING", "description": "Project title or name (e.g. 'AI Interview Assistant')"},
                        "description": {"type": "STRING", "description": "Detailed description of the project"},
                        "tech_stack": {
                            "type": "ARRAY",
                            "items": {"type": "STRING"},
                            "description": "Technologies or libraries (e.g. ['Python', 'FastAPI', 'Gemini API'])"
                        },
                        "github_url": {"type": "STRING", "description": "GitHub repository URL or null"},
                        "live_demo_url": {"type": "STRING", "description": "Live demo URL or null"}
                    }
                }
            },
            {
                "name": "get_session_memory",
                "description": "Recall actions performed, projects added, or topics discussed during this current live session (e.g. when user asks 'what project did I just add?').",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {}
                }
            },
            {
                "name": "open_document",
                "description": "Open or display a PDF document (resume, CV, certificate, report) on the student's screen.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "query": {"type": "STRING", "description": "Filename, keyword, or document category (e.g. 'resume', 'cv')"}
                    },
                    "required": ["query"]
                }
            }
        ]
    }
]

def build_personalized_instruction(student_doc: Optional[Dict[str, Any]], user_name: str) -> str:
    student_doc = student_doc or {}
    skills = ", ".join(student_doc.get("skills", [])[:25]) or "Python, Web Development, Problem Solving"

    projects = student_doc.get("projects", []) or []
    proj_summaries = []
    # Newest projects first
    for p in reversed(projects[-6:]):
        tech = ", ".join(p.get("tech_stack", []))
        desc = p.get("description", "")
        proj_summaries.append(f"- {p.get('title')}: {desc} (Technologies: {tech})")
    proj_str = "\n".join(proj_summaries) if proj_summaries else "None recorded yet."

    internships = student_doc.get("internships", []) or []
    intern_summaries = []
    for i in reversed(internships[-4:]):
        intern_summaries.append(f"- {i.get('role')} at {i.get('company_name')} ({i.get('domain', '')})")
    intern_str = "\n".join(intern_summaries) if intern_summaries else "None recorded yet."

    cgpa = student_doc.get("cgpa", "N/A")
    branch = student_doc.get("branch", "Engineering / Technology")
    semester = student_doc.get("semester", "Undergraduate")
    career_interest = student_doc.get("career_interest", "Software Engineering & AI")

    return f"""You are Nova, {user_name}'s personal AI academic & career co-pilot, trusted mentor, and second brain.
You know {user_name} intimately—his technical strengths, academic journey, ambitions, and projects.

WHO {user_name.upper()} IS (YOUR LIVING KNOWLEDGE BASE OF HIM):
- Name: {user_name}
- Academic: {branch}, Semester {semester}, CGPA {cgpa}
- Primary Career Focus: {career_interest}
- Known Technical Skills: {skills}
- Key Portfolio Projects:
{proj_str}
- Internships & Experience:
{intern_str}

HOW TO TALK AND ACT:
1. TALK LIKE A REAL, BRILLIANT FRIEND AND MENTOR:
   - Speak naturally, warmly, authentically, and conversationally.
   - When {user_name} asks for advice, career readiness ("Am I ready for an interview?", "What role suits me?"), or brainstorming, DO NOT sound like a generic AI or rigid assistant. Talk directly to him like a close friend who has seen his code and knows his real skills!
   - Give honest, encouraging, and actionable guidance based on his real projects and skills (e.g. mention his specific stack, where he shines, and what 1 or 2 areas to sharpen for interviews).
   - Keep answers conversational (2 to 4 sentences). Avoid bullet dumps or robotic formalities unless he asks for a detailed breakdown.

2. TOOL CALLING DISCIPLINE:
   - Use structured tool calls ONLY when an action is explicitly needed:
     * Adding a project -> `add_project`
     * Adding an internship -> `add_internship`
     * Updating details -> `update_project` / `update_profile`
     * Deep document search -> `query_rag_database`
     * Screen navigation -> `navigate_ui`
   - When just conversing, giving advice, answering questions, or chatting, DO NOT force tool calls—talk to {user_name} directly with genuine warmth, intelligence, and empathy!

3. IN-SESSION MEMORY:
   - You remember everything discussed in this active session. When {user_name} refers to something just added or talked about, refer to it naturally.

4. STRICT LANGUAGE & NO-NONSENSE CONVERSATION:
   - Speak strictly in clear, natural English at all times. Never translate, switch languages, or write in non-English scripts.
   - Do not answer or entertain nonsensical, incoherent, or random noise prompts. If an utterance is unintelligible or gibberish, politely say: "I couldn't quite catch that, could you please repeat in English?" and wait for {user_name}.

5. SWITCH TO INTERVIEW MODE:
   - When {user_name} says "switch to interview mode", "start interview", "take my interview", or wants to practice, call `switch_to_interview_mode` IMMEDIATELY. Say warmly: "Right away! Launching technical mock interview mode with Alex now."

6. ADDING NEW PROJECTS:
   - When {user_name} asks to add a project, call `add_project` IMMEDIATELY with the title and whatever stack or description he mentions.
   - Speak naturally: "Sure, I'm adding that project for you. I'll set it up with the right tech stack and update your dashboard."
   - If {user_name} has not mentioned technologies or details, ask conversationally: "Got it! What technologies did you use for it?"
"""


async def _resolve_user_info(websocket: WebSocket):
    """Extract user_id, first name, and complete student profile document."""
    user_id = None
    token = websocket.query_params.get("token")
    if token:
        try:
            payload = decode_token(token)
            user_id = payload.get("sub")
        except Exception:
            pass

    if not user_id and db is not None:
        first_student = await db.students.find_one({})
        if first_student:
            user_id = first_student.get("user_id")

    user_name = "there"
    student_doc = {}
    if db is not None and user_id:
        student_doc = await db.students.find_one({"user_id": user_id}) or {}
        if student_doc.get("name"):
            user_name = student_doc.get("name").split()[0]

    return user_id, user_name, student_doc


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


@router.websocket("/live")
async def live_voice_bridge(websocket: WebSocket):
    t_ws_connect = time.time()
    await websocket.accept()
    voice_logger.log("WS_CONNECT", "Client connected to live voice bridge.")

    user_id, user_name, student_doc = await _resolve_user_info(websocket)
    voice_logger.log("USER_RESOLVE", f"Resolved user_id={user_id}, name={user_name}")

    api_key = (
        os.getenv("GEMINI_LIVE_API_KEY")
        or os.getenv("GEMINI_API_KEY_RAG_DB")
        or os.getenv("GEMINI_API_KEY")
    )
    if not api_key:
        voice_logger.log("ERROR", "GEMINI_LIVE_API_KEY is not configured.")
        await websocket.send_json({"type": "ERROR", "message": "Gemini API key not configured on server."})
        await websocket.close()
        return

    primary_model = os.getenv("GEMINI_LIVE_MODEL", "gemini-2.5-flash-native-audio-latest")
    fallback_model = os.getenv("GEMINI_LIVE_FALLBACK_MODEL", "gemini-2.0-flash-exp")

    client = genai.Client(api_key=api_key, http_options={"api_version": "v1beta"})

    system_instruction = build_personalized_instruction(student_doc, user_name)

    nova_start_sens = _get_env_sensitivity(os.getenv("NOVA_START_SENSITIVITY", "LOW"))
    nova_end_sens = _get_env_end_sensitivity(os.getenv("NOVA_END_SENSITIVITY", "LOW"))
    nova_silence_ms = int(os.getenv("NOVA_SILENCE_MS", "1000"))
    nova_prefix_padding_ms = int(os.getenv("NOVA_PREFIX_PADDING_MS", "200"))

    config = types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],
        tools=NOVA_TOOLS,
        system_instruction=types.Content(parts=[types.Part.from_text(text=system_instruction)]),
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Zephyr")
            )
        ),
        media_resolution="MEDIA_RESOLUTION_MEDIUM",
        context_window_compression=types.ContextWindowCompressionConfig(
            trigger_tokens=104857,
            sliding_window=types.SlidingWindow(target_tokens=52428),
        ),
        realtime_input_config=types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(
                disabled=False,
                start_of_speech_sensitivity=nova_start_sens,
                end_of_speech_sensitivity=nova_end_sens,
                prefix_padding_ms=nova_prefix_padding_ms,
                silence_duration_ms=nova_silence_ms,
            ),
            activity_handling=types.ActivityHandling.START_OF_ACTIVITY_INTERRUPTS
        ),
        input_audio_transcription=types.AudioTranscriptionConfig(
            language_codes=["en-US", "en-IN"]
        ),
        output_audio_transcription=types.AudioTranscriptionConfig(
            language_codes=["en-US", "en-IN"]
        ),
    )

    session = None
    connected_model = None
    t_model_connect = time.time()

    for model_name in [primary_model, fallback_model]:
        try:
            voice_logger.log("CONNECT", f"Attempting live connection to {model_name}...")
            ctx = client.aio.live.connect(model=model_name, config=config)
            session = await ctx.__aenter__()
            connected_model = model_name
            connect_duration = (time.time() - t_model_connect) * 1000
            voice_logger.log("CONNECTED", f"Active live session with {model_name} established in {connect_duration:.1f}ms", connect_duration)
            break
        except Exception as e:
            voice_logger.log("WARNING", f"Model {model_name} failed: {e}")
            session = None

    if session is None:
        voice_logger.log("ERROR", "Failed to connect to any Gemini Live Audio model.")
        await websocket.send_json({"type": "ERROR", "message": "Failed to connect to Gemini Live Audio service."})
        await websocket.close()
        return

    # Notify client that session is ready
    await websocket.send_json({
        "type": "SESSION_READY",
        "model": connected_model,
        "user_name": user_name,
        "message": "Nova Live Audio session established."
    })

    # Initialize in-memory session working memory for this WebSocket connection
    session_state = {
        "recent_actions": [],
        "temp_project": {},
        "last_added_project": None
    }

    # ── Tool execution helper (Fast sub-100ms execution) ─────────────────────
    async def execute_tool(name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        t_tool_start = time.time()
        voice_logger.log("TOOL_START", f"Executing tool: {name}", metadata=args)

        try:
            if name == "add_project":
                proj_title = str(args.get("title", "New Project")).strip()
                proj_desc = str(args.get("description") or f"A project focused on {proj_title}.").strip()

                tech_stack = args.get("tech_stack", [])
                if isinstance(tech_stack, str):
                    tech_stack = [t.strip() for t in tech_stack.split(",") if t.strip()]
                elif not isinstance(tech_stack, list):
                    tech_stack = []

                github_url = args.get("github_url")
                live_demo_url = args.get("live_demo_url")

                new_proj = Project(
                    title=proj_title,
                    description=proj_desc,
                    tech_stack=tech_stack,
                    github_url=github_url if github_url != "skip" else None,
                    live_demo_url=live_demo_url if live_demo_url != "skip" else None,
                )

                # Stream real-time progress of details being populated
                await websocket.send_json({
                    "type": "TOOL_PROGRESS",
                    "tool": "add_project",
                    "step": "filling_fields",
                    "fields": {
                        "title": proj_title,
                        "tech_stack": tech_stack,
                        "description": proj_desc
                    },
                    "message": f"Adding: {proj_title} ({', '.join(tech_stack) if tech_stack else 'Detecting tech stack...'})"
                })

                if db is not None and user_id:
                    await db.students.update_one(
                        {"user_id": user_id},
                        {
                            "$push": {"projects": new_proj.model_dump()},
                            "$set": {"predictions": None, "updated_at": datetime.utcnow()}
                        }
                    )

                session_state["temp_project"] = new_proj.model_dump()
                session_state["last_added_project"] = new_proj.model_dump()
                session_state["recent_actions"].append({
                    "action": "ADDED_PROJECT",
                    "title": proj_title,
                    "tech_stack": tech_stack,
                    "description": proj_desc,
                    "timestamp": datetime.utcnow().strftime("%H:%M:%S")
                })

                await websocket.send_json({
                    "type": "UI_ACTION",
                    "action": "PROJECT_ADDED",
                    "project": new_proj.model_dump(),
                    "fields": {
                        "title": proj_title,
                        "tech_stack": tech_stack,
                        "description": proj_desc
                    },
                    "message": f"Project '{proj_title}' added with [{', '.join(tech_stack)}]."
                })

                elapsed = (time.time() - t_tool_start) * 1000
                voice_logger.log("TOOL_DONE", f"Project '{proj_title}' added to MongoDB in {elapsed:.1f}ms", elapsed)

                missing_fields = []
                if not tech_stack:
                    missing_fields.append("tech_stack")
                if not proj_desc or proj_desc == f"A project focused on {proj_title}.":
                    missing_fields.append("description")

                return {
                    "status": "success",
                    "message": f"Successfully recorded project '{proj_title}'.",
                    "project": new_proj.model_dump(),
                    "missing_fields": missing_fields,
                    "instruction": "If tech stack was not mentioned by user, ask them what technologies or libraries they used." if missing_fields else None
                }

            elif name == "update_project":
                proj_title = str(args.get("title", "")).strip()
                proj_desc = str(args.get("description", "")).strip()

                tech_stack = args.get("tech_stack", [])
                if isinstance(tech_stack, str):
                    tech_stack = [t.strip() for t in tech_stack.split(",") if t.strip()]
                elif not isinstance(tech_stack, list):
                    tech_stack = []

                temp = session_state.get("temp_project") or {}
                final_title = proj_title or temp.get("title") or "New Project"
                if final_title == "New Project" and proj_title:
                    final_title = proj_title

                final_tech = tech_stack or temp.get("tech_stack") or []
                final_desc = proj_desc or temp.get("description") or f"A project focused on {final_title}."

                updated_proj = Project(
                    title=final_title,
                    description=final_desc,
                    tech_stack=final_tech,
                    github_url=args.get("github_url") or temp.get("github_url"),
                    live_demo_url=args.get("live_demo_url") or temp.get("live_demo_url"),
                )

                if db is not None and user_id:
                    student = await db.students.find_one({"user_id": user_id})
                    projects = student.get("projects", []) if student else []

                    replaced = False
                    for idx in reversed(range(len(projects))):
                        p = projects[idx]
                        if p.get("title") in [final_title, "New Project", temp.get("title")]:
                            projects[idx] = updated_proj.model_dump()
                            replaced = True
                            break
                    if not replaced:
                        projects.append(updated_proj.model_dump())

                    await db.students.update_one(
                        {"user_id": user_id},
                        {
                            "$set": {
                                "projects": projects,
                                "predictions": None,
                                "updated_at": datetime.utcnow()
                            }
                        }
                    )

                session_state["temp_project"] = updated_proj.model_dump()
                session_state["last_added_project"] = updated_proj.model_dump()
                session_state["recent_actions"].append({
                    "action": "UPDATED_PROJECT",
                    "title": final_title,
                    "tech_stack": final_tech,
                    "description": final_desc,
                    "timestamp": datetime.utcnow().strftime("%H:%M:%S")
                })

                await websocket.send_json({
                    "type": "UI_ACTION",
                    "action": "PROJECT_ADDED",
                    "project": updated_proj.model_dump()
                })

                elapsed = (time.time() - t_tool_start) * 1000
                voice_logger.log("TOOL_DONE", f"Project '{final_title}' updated in MongoDB in {elapsed:.1f}ms", elapsed)
                return {
                    "status": "success",
                    "message": f"Successfully updated project '{final_title}' with tech stack {final_tech}.",
                    "project": updated_proj.model_dump()
                }

            elif name == "get_session_memory":
                recent = session_state.get("recent_actions", [])
                last_p = session_state.get("last_added_project")
                elapsed = (time.time() - t_tool_start) * 1000
                voice_logger.log("TOOL_DONE", f"Session memory fetched in {elapsed:.1f}ms", elapsed)
                return {
                    "status": "success",
                    "last_added_project": last_p,
                    "recent_session_actions": recent,
                    "current_project_draft": session_state.get("temp_project")
                }

            elif name == "add_internship":
                comp_name = str(args.get("company_name", "Organization")).strip()
                role = str(args.get("role", "Software Intern")).strip()
                domain = str(args.get("domain", "Technology")).strip()
                start_date = str(args.get("start_date", "Recent")).strip()
                end_date = str(args.get("end_date", "ongoing")).strip()
                desc = str(args.get("description", f"Contributed as {role} at {comp_name}.")).strip()

                new_intern = Internship(
                    company_name=comp_name,
                    role=role,
                    domain=domain,
                    start_date=start_date,
                    end_date=end_date,
                    description=desc
                )

                if db is not None and user_id:
                    await db.students.update_one(
                        {"user_id": user_id},
                        {
                            "$push": {"internships": new_intern.model_dump()},
                            "$set": {"predictions": None, "updated_at": datetime.utcnow()}
                        }
                    )

                session_state["recent_actions"].append({
                    "action": "ADDED_INTERNSHIP",
                    "role": role,
                    "company_name": comp_name,
                    "timestamp": datetime.utcnow().strftime("%H:%M:%S")
                })

                await websocket.send_json({
                    "type": "UI_ACTION",
                    "action": "INTERNSHIP_ADDED",
                    "internship": new_intern.model_dump()
                })

                elapsed = (time.time() - t_tool_start) * 1000
                voice_logger.log("TOOL_DONE", f"Internship at '{comp_name}' added in {elapsed:.1f}ms", elapsed)
                return {"status": "success", "message": f"Added {role} internship at {comp_name}."}

            elif name == "update_profile":
                field = args.get("field")
                val_raw = args.get("value")
                allowed_fields = [
                    "cgpa", "semester", "branch", "college_tier",
                    "backlog_count", "career_interest", "work_style_pref", "communication_rating"
                ]
                if field not in allowed_fields:
                    return {"status": "error", "message": f"Field '{field}' cannot be updated via voice."}

                parsed_val: Any = val_raw
                if field in ["cgpa"]:
                    parsed_val = float(val_raw)
                elif field in ["semester", "backlog_count", "communication_rating"]:
                    parsed_val = int(val_raw)

                if db is not None and user_id:
                    await db.students.update_one(
                        {"user_id": user_id},
                        {
                            "$set": {
                                field: parsed_val,
                                "predictions": None,
                                "updated_at": datetime.utcnow()
                            }
                        }
                    )

                session_state["recent_actions"].append({
                    "action": "UPDATED_PROFILE",
                    "field": field,
                    "value": parsed_val,
                    "timestamp": datetime.utcnow().strftime("%H:%M:%S")
                })

                await websocket.send_json({
                    "type": "UI_ACTION",
                    "action": "PROFILE_UPDATED",
                    "field": field,
                    "value": parsed_val
                })
                elapsed = (time.time() - t_tool_start) * 1000
                voice_logger.log("TOOL_DONE", f"Profile field '{field}' set to '{parsed_val}' in {elapsed:.1f}ms", elapsed)
                return {"status": "success", "message": f"Updated profile {field} to {parsed_val}."}

            elif name == "query_rag_database":
                query_text = args.get("query", "")
                actual_user_id = user_id or "default_user"

                # 1. Direct profile retrieval from MongoDB (~15ms)
                student = await db.students.find_one({"user_id": actual_user_id}) if db is not None else {}
                student = student or {}

                # 2. Fast semantic retrieval from FAISS (~80-150ms)
                retrieval_res = await retrieve_semantic_chunks(actual_user_id, query_text, db, top_k=3)
                chunks = retrieval_res.get("results", [])
                doc_evidence = [
                    f"[{c.get('filename', 'Resume')} p.{c.get('page_start', 1)}]: {c.get('text', '')[:350]}"
                    for c in chunks
                ]

                # Reverse chronological order: newest projects first!
                raw_projects = student.get('projects', []) or []
                reversed_projects = list(reversed(raw_projects))

                projects_summary = [
                    f"- {p.get('title')}: {p.get('description', '')} (Tech: {', '.join(p.get('tech_stack', []))})"
                    for p in reversed_projects
                ]
                skills_list = student.get('skills', [])
                internships_list = [
                    f"- {i.get('role')} at {i.get('company_name')} ({i.get('domain', '')})"
                    for i in reversed(student.get('internships', []) or [])
                ]

                grounded_facts = {
                    "project_added_just_now": session_state.get("last_added_project") or (reversed_projects[0] if reversed_projects else None),
                    "recent_actions_this_session": session_state.get("recent_actions", []),
                    "student_skills": skills_list,
                    "student_projects_newest_first": projects_summary,
                    "student_internships_newest_first": internships_list,
                    "student_cgpa": student.get("cgpa"),
                    "student_branch": student.get("branch"),
                    "resume_and_document_evidence": doc_evidence
                }

                elapsed = (time.time() - t_tool_start) * 1000
                voice_logger.log("TOOL_RAG", f"Direct RAG context retrieved in {elapsed:.1f}ms for query='{query_text}'", elapsed)
                return {"status": "success", "facts": grounded_facts}

            elif name == "navigate_ui":
                dest = args.get("destination", "/dashboard")
                await websocket.send_json({
                    "type": "UI_ACTION",
                    "action": "NAVIGATE",
                    "destination": dest,
                    "path": dest
                })
                elapsed = (time.time() - t_tool_start) * 1000
                voice_logger.log("TOOL_DONE", f"Navigated UI to {dest} in {elapsed:.1f}ms", elapsed)
                return {"status": "success", "message": f"Navigating to {dest}."}

            elif name == "switch_to_interview_mode":
                target_role = str(args.get("role") or student_doc.get("career_interest") or "Full Stack Developer").strip()
                focus_area = str(args.get("focus") or "Technical Mock Interview").strip()
                
                session_state["recent_actions"].append({
                    "action": "SWITCH_TO_INTERVIEW",
                    "role": target_role,
                    "focus": focus_area,
                    "timestamp": datetime.utcnow().strftime("%H:%M:%S")
                })

                await websocket.send_json({
                    "type": "TOOL_PROGRESS",
                    "tool": "switch_to_interview_mode",
                    "status": "launching_interview",
                    "message": f"Opening AI Interview room for {target_role}..."
                })

                await websocket.send_json({
                    "type": "UI_ACTION",
                    "action": "NAVIGATE",
                    "destination": "/interview",
                    "path": "/interview",
                    "role": target_role,
                    "focus": focus_area,
                    "message": f"Launching live interview practice with Alex..."
                })

                elapsed = (time.time() - t_tool_start) * 1000
                voice_logger.log("TOOL_DONE", f"Switched to interview mode in {elapsed:.1f}ms", elapsed)
                return {
                    "status": "success",
                    "message": f"Switching to live mock interview with Alex for {target_role}. Opening interview room now.",
                    "target_screen": "/interview"
                }

            elif name == "open_document":
                doc_query = args.get("query", "").lower()
                doc_found = None
                if db is not None and user_id:
                    cursor = db.documents.find({"user_id": user_id})
                    docs = await cursor.to_list(length=20)
                    for d in docs:
                        fname = d.get("filename", "").lower()
                        cat = d.get("category", "").lower()
                        if doc_query in fname or doc_query in cat or (doc_query in ["resume", "cv"] and "resume" in fname):
                            doc_found = {"id": str(d.get("_id") or d.get("id")), "filename": d.get("filename"), "url": d.get("cloudinary_url")}
                            break

                await websocket.send_json({
                    "type": "UI_ACTION",
                    "action": "OPEN_DOCUMENT",
                    "doc": doc_found,
                    "query": doc_query
                })
                elapsed = (time.time() - t_tool_start) * 1000
                voice_logger.log("TOOL_DONE", f"Opened document matching '{doc_query}' in {elapsed:.1f}ms", elapsed)
                return {"status": "success", "message": f"Opening document matching '{doc_query}'."}

            else:
                return {"status": "error", "message": f"Unknown tool: {name}"}
        except Exception as tool_err:
            elapsed = (time.time() - t_tool_start) * 1000
            voice_logger.log("TOOL_ERROR", f"{name} error: {tool_err} in {elapsed:.1f}ms", elapsed)
            return {"status": "error", "message": str(tool_err)}

    # ── Task: Client to Gemini (Audio PCM & Text Input) ──────────────────────
    async def client_to_gemini():
        # Phase-0: running binary frame counter (reset each turn; logged at turn_complete)
        _binary_frames_this_turn = 0
        try:
            while True:
                msg = await websocket.receive()
                if "bytes" in msg and msg["bytes"]:
                    pcm_chunk = msg["bytes"]
                    _binary_frames_this_turn += 1
                    voice_logger.log("BROWSER_MSG", f"type=BINARY bytes={len(pcm_chunk)} frame={_binary_frames_this_turn}")
                    await session.send_realtime_input(
                        audio={"data": pcm_chunk, "mime_type": "audio/pcm;rate=16000"}
                    )
                elif "text" in msg and msg["text"]:
                    try:
                        data = json.loads(msg["text"])
                        msg_type = data.get("type", "UNKNOWN")
                        voice_logger.log("BROWSER_MSG", f"type={msg_type}")

                        if msg_type == "TEXT_INPUT":
                            text = data.get("text", "").strip()
                            if text:
                                t_send = time.time()
                                voice_logger.log("TEXT_IN", f"User query: '{text}'")
                                await session.send_client_content(
                                    turns=[types.Content(parts=[types.Part.from_text(text=text)])],
                                    turn_complete=True
                                )
                                voice_logger.log("SENT_TO_MODEL", f"Query forwarded to Gemini in {((time.time() - t_send)*1000):.1f}ms")

                        elif msg_type == "START_GREETING":
                            # Gemini Live speaks the greeting natively in its own human-like voice!
                            t_greet = time.time()
                            voice_logger.log("GREETING_TRIGGER", f"Requesting native Gemini greeting for '{user_name}'")
                            greet_prompt = f"Please greet me warmly in one short sentence: 'Hello {user_name}, how can I help you today?'"
                            await session.send_client_content(
                                turns=[types.Content(parts=[types.Part.from_text(text=greet_prompt)])],
                                turn_complete=True
                            )
                            voice_logger.log("GREETING_SENT", f"Greeting request dispatched to Gemini in {((time.time() - t_greet)*1000):.1f}ms")

                        elif msg_type == "PING":
                            await websocket.send_json({"type": "PONG"})

                        elif msg_type == "INTERRUPT":
                            voice_logger.log("BROWSER_MSG", "type=INTERRUPT received (no server-side handler yet — TODO phase1)")

                    except Exception as parse_err:
                        voice_logger.log("WARNING", f"JSON parse error: {parse_err}")
        except (WebSocketDisconnect, RuntimeError):
            voice_logger.log("WS_DISCONNECT", "Client disconnected from input loop.")
        except Exception as e:
            voice_logger.log("INPUT_ERROR", f"Exception in client_to_gemini: {e}")

    # ── Task: Gemini to Client (Audio stream & Tool events) ──────────────────
    async def gemini_to_client():
        try:
            while True:
                first_chunk_received = False
                total_audio_bytes = 0
                _turn_audio_chunks = 0  # Phase-0: count audio chunks per turn

                async for response in session.receive():
                    # Phase-0: log go_away if present in SDK version
                    # TODO(verify-sdk): go_away field path may differ across google-genai versions
                    if hasattr(response, 'go_away') and response.go_away:
                        voice_logger.log("GO_AWAY", "Server sent go_away signal — reconnect recommended")

                    # Phase-0: log session resumption handle updates
                    # TODO(verify-sdk): session_resumption_update field may not exist in all SDK versions
                    if hasattr(response, 'session_resumption_update') and response.session_resumption_update:
                        sru = response.session_resumption_update
                        new_handle = getattr(sru, 'new_handle', None)
                        voice_logger.log("SESSION_RESUMPTION", f"Resumption handle updated new_handle={'<set>' if new_handle else '<none>'}")

                    # 1. Handle tool call requests
                    if response.tool_call:
                        t_tool_call = time.time()
                        function_responses = []
                        for fc in response.tool_call.function_calls:
                            voice_logger.log("TOOL_CALL", f"Model requested tool: {fc.name} with args: {fc.args}")
                            await websocket.send_json({
                                "type": "TOOL_START",
                                "name": fc.name,
                                "args": fc.args
                            })
                            result = await execute_tool(fc.name, fc.args)
                            function_responses.append(
                                types.FunctionResponse(name=fc.name, id=fc.id, response=result)
                            )

                        t_resp_send = time.time()
                        try:
                            await session.send_tool_response(function_responses=function_responses)
                        except Exception:
                            await session.send(input={
                                "function_responses": [
                                    {"response": fr.response, "id": fr.id} for fr in function_responses
                                ]
                            })
                        voice_logger.log("TOOL_RETURN", f"Tool responses returned to model in {((time.time() - t_resp_send)*1000):.1f}ms")

                    # 2. Direct streaming audio PCM & text chunks from Live API
                    has_sent_audio = False
                    has_sent_text = False
                    if hasattr(response, 'data') and response.data:
                        chunk_len = len(response.data)
                        total_audio_bytes += chunk_len
                        _turn_audio_chunks += 1  # Phase-0: per-turn chunk counter
                        if not first_chunk_received:
                            first_chunk_received = True
                            voice_logger.log("AUDIO_TTFB", f"First audio chunk received ({chunk_len} bytes)")
                        await websocket.send_bytes(response.data)
                        has_sent_audio = True

                    if hasattr(response, 'text') and response.text:
                        text_chunk = response.text.strip()
                        if text_chunk:
                            voice_logger.log("TEXT_OUT", f"Chunk: '{text_chunk}'")
                            await websocket.send_json({
                                "type": "TEXT_CHUNK",
                                "text": text_chunk
                            })
                            has_sent_text = True

                    # 3. Handle server_content parts as robust fallback
                    if response.server_content:
                        if response.server_content.interrupted:
                            voice_logger.log("INTERRUPTED", "User barge-in interrupted Nova speech. reason=server")
                            await websocket.send_json({"type": "INTERRUPTED"})

                        # Phase-0: log input transcription length
                        # TODO(verify-sdk): input_transcription field path may differ across google-genai versions
                        if hasattr(response.server_content, 'input_transcription') and response.server_content.input_transcription:
                            t_in = response.server_content.input_transcription
                            t_text = getattr(t_in, 'text', '') or ''
                            voice_logger.log("TRANSCRIPTION_IN", f"len={len(t_text)} finished={getattr(t_in, 'finished', None)}")

                        # Phase-0: log output transcription length
                        # TODO(verify-sdk): output_transcription field path may differ across google-genai versions
                        if hasattr(response.server_content, 'output_transcription') and response.server_content.output_transcription:
                            t_out = response.server_content.output_transcription
                            t_text = getattr(t_out, 'text', '') or ''
                            voice_logger.log("TRANSCRIPTION_OUT", f"len={len(t_text)} finished={getattr(t_out, 'finished', None)}")

                        model_turn = response.server_content.model_turn
                        if model_turn:
                            for part in model_turn.parts:
                                if not has_sent_text and part.text and not getattr(part, 'thought', False):
                                    text_chunk = part.text.strip()
                                    if text_chunk:
                                        voice_logger.log("TEXT_OUT", f"Chunk: '{text_chunk}'")
                                        await websocket.send_json({
                                            "type": "TEXT_CHUNK",
                                            "text": text_chunk
                                        })

                                if not has_sent_audio and part.inline_data and part.inline_data.data:
                                    chunk_len = len(part.inline_data.data)
                                    total_audio_bytes += chunk_len
                                    _turn_audio_chunks += 1  # Phase-0: per-turn chunk counter
                                    if not first_chunk_received:
                                        first_chunk_received = True
                                        voice_logger.log("AUDIO_TTFB", f"First audio chunk received ({chunk_len} bytes)")
                                    await websocket.send_bytes(part.inline_data.data)

                        if response.server_content.turn_complete:
                            voice_logger.log("TURN_COMPLETE", f"Model turn finished. Streamed {total_audio_bytes} bytes in {_turn_audio_chunks} chunks.")
                            await websocket.send_json({"type": "TURN_COMPLETE"})
                            # Break inner generator loop for this turn; outer while True starts receive() for next turn!
                            break
        except (asyncio.CancelledError, WebSocketDisconnect):
            voice_logger.log("WS_DISCONNECT", "gemini_to_client loop terminated.")
        except Exception as e:
            voice_logger.log("OUTPUT_ERROR", f"Exception in gemini_to_client: {e}")

    # Run bidirectional pipeline concurrently
    try:
        task1 = asyncio.create_task(client_to_gemini())
        task2 = asyncio.create_task(gemini_to_client())
        done, pending = await asyncio.wait([task1, task2], return_when=asyncio.FIRST_COMPLETED)
        for p in pending:
            p.cancel()
    finally:
        session_duration = (time.time() - t_ws_connect) * 1000
        voice_logger.log("WS_CLEANUP", f"Cleaning up live voice session (duration={session_duration:.1f}ms)", session_duration)
        try:
            await session.close()
        except Exception:
            pass
