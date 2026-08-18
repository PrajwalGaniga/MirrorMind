import asyncio
import io
import wave
from fastapi import FastAPI, WebSocket, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from piper import PiperVoice

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Jinja2 templates (using a simple string template here for convenience)
import jinja2
templates = Jinja2Templates(directory=".")
template_str = """
<!DOCTYPE html>
<html>
<head>
    <title>Piper TTS Streaming Test</title>
    <style>
        body { font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; }
        textarea { width: 100%; height: 100px; margin-bottom: 10px; padding: 10px; }
        button { padding: 10px 20px; background: #6366f1; color: white; border: none; border-radius: 5px; cursor: pointer; }
        #status { margin-top: 10px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <h2>Piper TTS WebSocket Streaming Test</h2>
    <p>Type text below and hit "Speak". The audio will stream via WebSockets chunk-by-chunk.</p>
    <textarea id="textInput">Hello from Piper. This is a real-time streaming test.</textarea>
    <br>
    <button onclick="speakText()">Speak</button>
    <div id="status">Status: Ready</div>

    <script>
        const sampleRate = 22050; // Standard for lessac-medium
        let audioCtx = null;
        let nextStartTime = 0;

        function speakText() {
            const text = document.getElementById('textInput').value;
            if (!text.trim()) return;

            document.getElementById('status').innerText = 'Status: Connecting...';
            
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });
            }
            nextStartTime = audioCtx.currentTime + 0.1;

            // Connect to WebSocket
            const ws = new WebSocket(`ws://${window.location.host}/ws/tts`);
            ws.binaryType = "arraybuffer";
            
            ws.onopen = () => {
                document.getElementById('status').innerText = 'Status: Streaming...';
                ws.send(text);
            };

            ws.onmessage = (event) => {
                if (typeof event.data === "string") {
                    if (event.data === "__END__") {
                        document.getElementById('status').innerText = 'Status: Finished stream.';
                    }
                    return;
                }

                // Convert raw PCM int16 bytes to float32
                const int16 = new Int16Array(event.data);
                const float32 = new Float32Array(int16.length);
                for (let i = 0; i < int16.length; i++) {
                    float32[i] = int16[i] / 32768;
                }

                // Play chunk
                const buffer = audioCtx.createBuffer(1, float32.length, sampleRate);
                buffer.copyToChannel(float32, 0);

                const source = audioCtx.createBufferSource();
                source.buffer = buffer;
                source.connect(audioCtx.destination);

                const startAt = Math.max(audioCtx.currentTime, nextStartTime);
                source.start(startAt);
                nextStartTime = startAt + buffer.duration;
            };
            
            ws.onerror = (e) => {
                document.getElementById('status').innerText = 'Status: Error occurred.';
            };
        }
    </script>
</body>
</html>
"""
with open("test_template.html", "w") as f:
    f.write(template_str)


# Load Piper Voice (Using lessac-medium as recommended)
import os
try:
    models_dir = os.path.join(os.path.dirname(__file__), "models", "piper")
    onnx_path = os.path.join(models_dir, "en_US-lessac-medium.onnx")
    json_path = os.path.join(models_dir, "en_US-lessac-medium.onnx.json")
    voice = PiperVoice.load(onnx_path, config_path=json_path)
except Exception as e:
    print(f"WARNING: Could not load {onnx_path}. Exception: {e}")
    voice = None

def synthesize_to_queue(text, queue, loop):
    if not voice:
        asyncio.run_coroutine_threadsafe(queue.put(None), loop)
        return
    try:
        # Stream raw PCM chunks
        for chunk in voice.synthesize_stream_raw(text) if hasattr(voice, 'synthesize_stream_raw') else voice.synthesize(text):
            # Check what piper returns, it might be an object with audio_int16_bytes or just bytes
            audio_bytes = chunk.audio_int16_bytes if hasattr(chunk, 'audio_int16_bytes') else chunk
            asyncio.run_coroutine_threadsafe(queue.put(audio_bytes), loop)
    except Exception as e:
        print(f"Synthesis error: {e}")
    finally:
        asyncio.run_coroutine_threadsafe(queue.put(None), loop)

@app.get("/test-piper", response_class=HTMLResponse)
async def test_piper(request: Request):
    with open("test_template.html", "r") as f:
        return f.read()

@app.websocket("/ws/tts")
async def tts_stream(websocket: WebSocket):
    await websocket.accept()
    if not voice:
        await websocket.send_text("Error: Voice model not loaded.")
        await websocket.send_text("__END__")
        await websocket.close()
        return

    loop = asyncio.get_event_loop()
    try:
        while True:
            text = await websocket.receive_text()
            queue: asyncio.Queue = asyncio.Queue()
            # Run blocking synthesis in executor
            loop.run_in_executor(None, synthesize_to_queue, text, queue, loop)
            
            while True:
                data = await queue.get()
                if data is None:
                    break
                await websocket.send_bytes(data)
            await websocket.send_text("__END__")
    except Exception as e:
        print(f"WebSocket closed: {e}")

if __name__ == "__main__":
    print("Starting Test Piper Server on http://localhost:8001")
    uvicorn.run(app, host="0.0.0.0", port=8001)
