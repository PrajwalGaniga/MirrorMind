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


def build_nova_config(student_doc: dict, user_name: str, resumption_handle: Optional[str] = None) -> types.LiveConnectConfig:
    system_instruction = build_personalized_instruction(student_doc, user_name)
    nova_start_sens = _get_env_sensitivity(os.getenv("NOVA_START_SENSITIVITY", "LOW"))
    nova_end_sens = _get_env_end_sensitivity(os.getenv("NOVA_END_SENSITIVITY", "LOW"))
    nova_silence_ms = int(os.getenv("NOVA_SILENCE_MS", "1000"))
    nova_prefix_padding_ms = int(os.getenv("NOVA_PREFIX_PADDING_MS", "200"))

    resumption_config = types.SessionResumptionConfig(
        handle=resumption_handle,
        transparent=True if resumption_handle else None
    )

    return types.LiveConnectConfig(
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
        session_resumption=resumption_config,
    )


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

    client = genai.Client(api_key=api_key, http_options={"api_version": "v1beta"})

    # Session State (persists across Gemini session reconnections)
    session_state = {
        "recent_actions": [],
        "temp_project": {},
        "last_added_project": None
    }
    latest_resumption_handle: Optional[str] = None
    audio_queue: asyncio.Queue[bytes] = asyncio.Queue(maxsize=60)
    setup_complete = asyncio.Event()
    active_session = None

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

    # ── Task: Ping broker (keeps WebSocket open through proxies/tunnels every 15s) ───
    async def ping_broker():
        try:
            while websocket.client_state.name == "CONNECTED":
                await asyncio.sleep(15)
                if websocket.client_state.name == "CONNECTED":
                    await websocket.send_json({"type": "PING"})
        except (asyncio.CancelledError, WebSocketDisconnect):
            pass

    # ── Task: Browser to Audio Queue & Control Messages ──────────────────────
    async def browser_to_queue():
        nonlocal active_session
        _binary_frames = 0
        try:
            while websocket.client_state.name == "CONNECTED":
                msg = await websocket.receive()
                if "bytes" in msg and msg["bytes"]:
                    pcm_chunk = msg["bytes"]
                    _binary_frames += 1
                    try:
                        audio_queue.put_nowait(pcm_chunk)
                    except asyncio.QueueFull:
                        try:
                            audio_queue.get_nowait()
                        except Exception:
                            pass
                        audio_queue.put_nowait(pcm_chunk)

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
                                if active_session:
                                    await active_session.send_client_content(
                                        turns=[types.Content(parts=[types.Part.from_text(text=text)])],
                                        turn_complete=True
                                    )
                                    voice_logger.log("SENT_TO_MODEL", f"Query forwarded to Gemini in {((time.time() - t_send)*1000):.1f}ms")

                        elif msg_type == "START_GREETING":
                            if active_session:
                                t_greet = time.time()
                                voice_logger.log("GREETING_TRIGGER", f"Requesting native Gemini greeting for '{user_name}'")
                                greet_prompt = f"Please greet me warmly in one short sentence: 'Hello {user_name}, how can I help you today?'"
                                await active_session.send_client_content(
                                    turns=[types.Content(parts=[types.Part.from_text(text=greet_prompt)])],
                                    turn_complete=True
                                )
                                voice_logger.log("GREETING_SENT", f"Greeting request dispatched to Gemini in {((time.time() - t_greet)*1000):.1f}ms")

                        elif msg_type == "PING":
                            await websocket.send_json({"type": "PONG"})

                    except Exception as parse_err:
                        voice_logger.log("WARNING", f"JSON parse error: {parse_err}")
        except (WebSocketDisconnect, RuntimeError):
            pass
        except Exception as e:
            voice_logger.log("INPUT_ERROR", f"Exception in browser_to_queue: {e}")

    # ── Task: Audio Queue -> Gemini Live (waits for setup_complete) ──────────
    async def queue_to_gemini(session, reconnect_event: asyncio.Event):
        try:
            await setup_complete.wait()
            while websocket.client_state.name == "CONNECTED" and not reconnect_event.is_set():
                chunk = await audio_queue.get()
                await session.send_realtime_input(
                    audio={"data": chunk, "mime_type": "audio/pcm;rate=16000"}
                )
        except asyncio.CancelledError:
            pass
        except Exception as e:
            voice_logger.log("INPUT_ERROR", f"Exception in queue_to_gemini: {e}")
            if websocket.client_state.name == "CONNECTED":
                try:
                    await websocket.send_json({"type": "ERROR", "message": f"Microphone forward error: {str(e)}"})
                except Exception:
                    pass

    # ── Task: Gemini to Client (Audio stream & Tool events) ──────────────────
    async def gemini_to_client(session, reconnect_event: asyncio.Event):
        nonlocal latest_resumption_handle
        try:
            while websocket.client_state.name == "CONNECTED" and not reconnect_event.is_set():
                first_chunk_received = False
                total_audio_bytes = 0
                _turn_audio_chunks = 0
                turn_received_any = False

                async for response in session.receive():
                    turn_received_any = True

                    # 1. Update session resumption handle
                    if hasattr(response, 'session_resumption_update') and response.session_resumption_update:
                        sru = response.session_resumption_update
                        new_handle = getattr(sru, 'new_handle', None)
                        if new_handle:
                            latest_resumption_handle = new_handle
                            voice_logger.log("SESSION_RESUMPTION", f"Handle updated: {latest_resumption_handle}")
                            await websocket.send_json({"type": "SESSION_RESUMED", "handle": latest_resumption_handle})

                    # 2. Server GoAway notification: trigger seamless reconnect with latest handle
                    if hasattr(response, 'go_away') and response.go_away:
                        time_left = getattr(response.go_away, 'time_left', None)
                        voice_logger.log("GO_AWAY", f"Server sent go_away signal — time_left={time_left}")
                        await websocket.send_json({"type": "RECONNECTING", "reason": "go_away", "timeLeft": str(time_left)})
                        reconnect_event.set()
                        break

                    # 3. Handle top-level tool call requests
                    if response.tool_call and response.tool_call.function_calls:
                        function_responses = []
                        for fc in response.tool_call.function_calls:
                            fc_name = getattr(fc, 'name', '') or ''
                            fc_args = getattr(fc, 'args', {}) or {}
                            fc_id = getattr(fc, 'id', None)
                            voice_logger.log("TOOL_CALL", f"Model requested tool: {fc_name} with args: {fc_args}")
                            await websocket.send_json({
                                "type": "TOOL_START",
                                "name": fc_name,
                                "args": fc_args
                            })
                            t_tool_start = time.time()
                            try:
                                result = await execute_tool(fc_name, fc_args)
                                tool_status = "success"
                            except Exception as tool_err:
                                tool_status = "error"
                                result = {"status": "error", "message": str(tool_err)}
                                voice_logger.log("TOOL_ERROR", f"Tool {fc_name} execution error: {tool_err}")

                            elapsed_ms = (time.time() - t_tool_start) * 1000
                            voice_logger.log("TOOL_DONE", f"Tool {fc_name} status={tool_status} in {elapsed_ms:.1f}ms", elapsed_ms)
                            function_responses.append(
                                types.FunctionResponse(name=fc_name, id=fc_id, response=result)
                            )

                        t_resp_send = time.time()
                        try:
                            await session.send_tool_response(function_responses=function_responses)
                            voice_logger.log("TOOL_RETURN", f"Tool responses returned to model in {((time.time() - t_resp_send)*1000):.1f}ms")
                        except Exception as resp_err:
                            voice_logger.log("TOOL_RETURN_FALLBACK", f"send_tool_response primary failed ({resp_err}), trying fallback input format")
                            try:
                                await session.send(input={
                                    "function_responses": [
                                        {"response": fr.response, "id": fr.id} for fr in function_responses
                                    ]
                                })
                                voice_logger.log("TOOL_RETURN", f"Fallback tool responses returned to model in {((time.time() - t_resp_send)*1000):.1f}ms")
                            except Exception as fb_err:
                                voice_logger.log("TOOL_RETURN_ERROR", f"All tool response methods failed: {resp_err} | {fb_err}")

                    # 4. Direct streaming audio PCM & text chunks from Live API
                    if hasattr(response, 'data') and response.data:
                        chunk_len = len(response.data)
                        total_audio_bytes += chunk_len
                        _turn_audio_chunks += 1
                        if not first_chunk_received:
                            first_chunk_received = True
                            voice_logger.log("AUDIO_TTFB", f"First audio chunk received ({chunk_len} bytes)")
                        await websocket.send_bytes(response.data)

                    if hasattr(response, 'text') and response.text:
                        text_chunk = response.text.strip()
                        if text_chunk:
                            voice_logger.log("TEXT_OUT", f"Chunk: '{text_chunk}'")
                            await websocket.send_json({
                                "type": "TEXT_CHUNK",
                                "text": text_chunk
                            })

                    # 5. Handle server_content
                    if response.server_content:
                        sc = response.server_content
                        if sc.interrupted:
                            voice_logger.log("INTERRUPTED", "User barge-in interrupted Nova speech. reason=server")
                            await websocket.send_json({"type": "INTERRUPTED"})

                        if hasattr(sc, 'input_transcription') and sc.input_transcription:
                            t_in = sc.input_transcription
                            t_text = getattr(t_in, 'text', '') or ''
                            voice_logger.log("TRANSCRIPTION_IN", f"len={len(t_text)} finished={getattr(t_in, 'finished', None)}")

                        if hasattr(sc, 'output_transcription') and sc.output_transcription:
                            t_out = sc.output_transcription
                            t_text = getattr(t_out, 'text', '') or ''
                            voice_logger.log("TRANSCRIPTION_OUT", f"len={len(t_text)} finished={getattr(t_out, 'finished', None)}")

                        # Process EVERY part in model_turn.parts in order
                        model_turn = sc.model_turn
                        if model_turn and model_turn.parts:
                            for part in model_turn.parts:
                                # 1. Audio part
                                if part.inline_data and part.inline_data.data:
                                    chunk_len = len(part.inline_data.data)
                                    total_audio_bytes += chunk_len
                                    _turn_audio_chunks += 1
                                    if not first_chunk_received:
                                        first_chunk_received = True
                                        voice_logger.log("AUDIO_TTFB", f"First audio chunk received ({chunk_len} bytes)")
                                    await websocket.send_bytes(part.inline_data.data)

                                # 2. Text part
                                if part.text and not getattr(part, 'thought', False):
                                    text_chunk = part.text.strip()
                                    if text_chunk:
                                        voice_logger.log("TEXT_OUT", f"Chunk: '{text_chunk}'")
                                        await websocket.send_json({
                                            "type": "TEXT_CHUNK",
                                            "text": text_chunk
                                        })

                                # 3. Inline function call part
                                if getattr(part, 'function_call', None):
                                    fc = part.function_call
                                    fc_name = getattr(fc, 'name', '') or ''
                                    fc_args = getattr(fc, 'args', {}) or {}
                                    fc_id = getattr(fc, 'id', None)
                                    voice_logger.log("TOOL_CALL", f"Model requested tool (inline): {fc_name} with args: {fc_args}")
                                    await websocket.send_json({
                                        "type": "TOOL_START",
                                        "name": fc_name,
                                        "args": fc_args
                                    })
                                    t_part_tool = time.time()
                                    try:
                                        result = await execute_tool(fc_name, fc_args)
                                        tool_status = "success"
                                    except Exception as tool_err:
                                        tool_status = "error"
                                        result = {"status": "error", "message": str(tool_err)}
                                        voice_logger.log("TOOL_ERROR", f"Tool {fc_name} execution error: {tool_err}")

                                    elapsed_ms = (time.time() - t_part_tool) * 1000
                                    voice_logger.log("TOOL_DONE", f"Tool {fc_name} status={tool_status} in {elapsed_ms:.1f}ms", elapsed_ms)
                                    fr = types.FunctionResponse(name=fc_name, id=fc_id, response=result)
                                    try:
                                        await session.send_tool_response(function_responses=[fr])
                                    except Exception:
                                        try:
                                            await session.send(input={"function_responses": [{"response": fr.response, "id": fr.id}]})
                                        except Exception as part_fb_err:
                                            voice_logger.log("TOOL_RETURN_ERROR", f"Failed returning inline tool response: {part_fb_err}")

                        if sc.turn_complete:
                            voice_logger.log("TURN_COMPLETE", f"Model turn finished. Streamed {total_audio_bytes} bytes in {_turn_audio_chunks} chunks.")
                            await websocket.send_json({"type": "TURN_COMPLETE"})
                            # Let session.receive() finish iteration naturally without manual break

                if not turn_received_any:
                    if getattr(session, '_ws', None) and getattr(session._ws, 'closed', False):
                        voice_logger.log("SESSION_CLOSED", "Underlying Gemini Live session closed.")
                        break
                    await asyncio.sleep(0.05)

        except (asyncio.CancelledError, WebSocketDisconnect):
            pass
        except Exception as e:
            voice_logger.log("OUTPUT_ERROR", f"Exception in gemini_to_client: {e}")
            if websocket.client_state.name == "CONNECTED":
                try:
                    await websocket.send_json({"type": "ERROR", "message": f"Streaming output error: {str(e)}"})
                except Exception:
                    pass

    # ── Main Connection Loop with Resumption & Reconnection ──────────────────
    browser_task = asyncio.create_task(browser_to_queue())
    ping_task = asyncio.create_task(ping_broker())

    is_reconnect = False
    try:
        while websocket.client_state.name == "CONNECTED":
            setup_complete.clear()
            reconnect_event = asyncio.Event()

            config = build_nova_config(student_doc, user_name, resumption_handle=latest_resumption_handle)

            if is_reconnect:
                voice_logger.log("RECONNECT", f"Reconnecting to Gemini Live (resumption_handle={'<set>' if latest_resumption_handle else '<none>'})...")
                await websocket.send_json({"type": "RECONNECTING"})

            primary_model = os.getenv("GEMINI_LIVE_MODEL", "gemini-2.5-flash-native-audio-latest")
            fallback_model = os.getenv("GEMINI_LIVE_FALLBACK_MODEL")

            models_to_try = [primary_model]
            if fallback_model and fallback_model.strip() and fallback_model != primary_model:
                models_to_try.append(fallback_model.strip())

            session = None
            connected_model = None
            last_err = None

            for model_name in models_to_try:
                try:
                    if model_name != primary_model:
                        voice_logger.log("FALLBACK_MODEL_USED", f"WARNING: Primary live model '{primary_model}' failed. Falling back to configured fallback '{model_name}'!")
                    voice_logger.log("CONNECT", f"Attempting live connection to {model_name}...")
                    ctx = client.aio.live.connect(model=model_name, config=config)
                    session = await ctx.__aenter__()
                    connected_model = model_name
                    break
                except Exception as conn_err:
                    last_err = conn_err
                    voice_logger.log("CONNECT_ERROR", f"Model {model_name} failed: {conn_err}")

            if session is None:
                voice_logger.log("ERROR", f"Failed to connect to configured Gemini Live Audio model(s): {last_err}")
                await websocket.send_json({"type": "ERROR", "message": f"Failed to connect to Gemini Live Audio service: {str(last_err)}"})
                if not is_reconnect:
                    break
                else:
                    await asyncio.sleep(1.0)
                    continue

            is_reconnect = True
            active_session = session
            setup_complete.set()

            await websocket.send_json({
                "type": "SESSION_READY",
                "model": connected_model,
                "user_name": user_name,
                "message": "Nova Live Audio session established."
            })

            t_in = asyncio.create_task(queue_to_gemini(session, reconnect_event))
            t_out = asyncio.create_task(gemini_to_client(session, reconnect_event))
            t_rec = asyncio.create_task(reconnect_event.wait())

            done, pending = await asyncio.wait([t_in, t_out, t_rec], return_when=asyncio.FIRST_COMPLETED)
            for p in pending:
                p.cancel()

            active_session = None
            try:
                await session.close()
            except Exception as close_err:
                voice_logger.log("SESSION_CLOSE_WARN", f"Session close: {close_err}")

            if websocket.client_state.name != "CONNECTED":
                break
    finally:
        browser_task.cancel()
        ping_task.cancel()
        session_duration = (time.time() - t_ws_connect) * 1000
        voice_logger.log("WS_CLEANUP", f"Cleaning up live voice session (duration={session_duration:.1f}ms)", session_duration)
