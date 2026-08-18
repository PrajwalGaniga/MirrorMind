import re

file_path = "frontend/src/components/Intelligence.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add audio element ref for unlocking
if "const unlockAudioRef = useRef(null);" not in content:
    content = content.replace(
        "const audioPlayerRef = useRef(null);",
        "const audioPlayerRef = useRef(null);\n  const unlockAudioRef = useRef(null);"
    )

# 2. Add unlock logic in toggle click
old_toggle = """onClick={() => setHandsFree(!handsFree)}"""
new_toggle = """onClick={() => {
              setHandsFree(!handsFree);
              // Unlock audio on interaction
              if (!handsFree) {
                const audio = new Audio();
                audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
                audio.volume = 0.01;
                audio.play().catch(() => {});
              }
            }}"""
content = content.replace(old_toggle, new_toggle)

# 3. Add confirmation TTS in stopRecording
old_stop = """      const transcribedText = res.data.text;
      setQuestion(transcribedText);
      setVoiceState('THINKING');
      handleAsk(null, transcribedText);
    } catch (err) {"""

new_stop = """      const transcribedText = res.data.text;
      setQuestion(transcribedText);
      
      if (handsFreeRef.current) {
        setVoiceState('SPEAKING');
        try {
          const confText = `I heard: ${transcribedText}. Let me check.`;
          const confRes = await api.post('/api/voice/synthesize', { text: confText }, { responseType: 'blob' });
          const audioUrl = URL.createObjectURL(confRes.data);
          const audio = new Audio(audioUrl);
          audioPlayerRef.current = audio;
          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            setVoiceState('THINKING');
            handleAsk(null, transcribedText);
          };
          await audio.play();
        } catch (e) {
          setVoiceState('THINKING');
          handleAsk(null, transcribedText);
        }
      } else {
        setVoiceState('THINKING');
        handleAsk(null, transcribedText);
      }
    } catch (err) {"""
content = content.replace(old_stop, new_stop)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
