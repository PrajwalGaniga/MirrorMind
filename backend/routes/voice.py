from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from fastapi.responses import Response

from auth_utils import get_current_user
from services.voice_service import STTService, TTSService

router = APIRouter()

class SynthesizeRequest(BaseModel):
    text: str

@router.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...), user_id: str = Depends(get_current_user)):
    try:
        print("[VOICE] STT processing started")
        wav_bytes = await audio.read()
        
        if not wav_bytes:
            raise ValueError("Empty audio received.")
            
        transcript = STTService.transcribe_wav(wav_bytes)
        print(f"[VOICE] Transcript generated: {transcript}")
        
        return {"text": transcript}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[VOICE][ERROR] Transcribe error: {e}")
        raise HTTPException(status_code=500, detail="Audio transcription failed.")

@router.post("/synthesize")
async def synthesize_audio(request: SynthesizeRequest, user_id: str = Depends(get_current_user)):
    try:
        print("[VOICE] TTS processing started")
        
        if not request.text or not request.text.strip():
            raise ValueError("Empty text received for synthesis.")
            
        wav_bytes = TTSService.synthesize_speech(request.text)
        print("[VOICE] Audio generated")
        
        return Response(content=wav_bytes, media_type="audio/wav")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[VOICE][ERROR] Synthesize error: {e}")
        raise HTTPException(status_code=500, detail="Speech synthesis failed.")

import asyncio
from fastapi import WebSocket, WebSocketDisconnect

@router.websocket("/ws/tts")
async def tts_stream(websocket: WebSocket):
    # Notice we don't strictly enforce get_current_user here for simplicity of the websocket connection
    # from the browser. In production, pass a token via query param.
    await websocket.accept()
    loop = asyncio.get_event_loop()
    try:
        while True:
            text = await websocket.receive_text()
            if not text.strip():
                await websocket.send_text("__END__")
                continue
                
            queue: asyncio.Queue = asyncio.Queue()
            
            # Run blocking Piper synthesis in a thread pool executor
            loop.run_in_executor(None, TTSService.synthesize_to_queue, text, queue, loop)
            
            while True:
                data = await queue.get()
                if data is None:
                    break
                await websocket.send_bytes(data)
                
            await websocket.send_text("__END__")
    except WebSocketDisconnect:
        print("[VOICE] WebSocket disconnected")
    except Exception as e:
        print(f"[VOICE][ERROR] WebSocket stream error: {e}")
        try:
            await websocket.close()
        except:
            pass
