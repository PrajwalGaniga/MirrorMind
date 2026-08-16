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
