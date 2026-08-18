export function cleanTextForSpeech(text) {
  if (!text) return '';
  let cleaned = text;

  // Remove code blocks
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
  cleaned = cleaned.replace(/`/g, '');

  // Remove markdown headings
  cleaned = cleaned.replace(/^#+\s+/gm, '');

  // Remove bold and italic markers
  cleaned = cleaned.replace(/\*\*/g, '');
  cleaned = cleaned.replace(/\*/g, '');
  cleaned = cleaned.replace(/__/g, '');
  cleaned = cleaned.replace(/_/g, '');

  // Remove markdown list markers
  cleaned = cleaned.replace(/^\s*-\s+/gm, '');
  cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, '');

  // Replace excessive dashes/newlines with a single space or pause
  cleaned = cleaned.replace(/-{2,}/g, ' ');
  cleaned = cleaned.replace(/\n{2,}/g, '. ');
  cleaned = cleaned.replace(/\n/g, ' ');

  // Normalize spaces
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  return cleaned;
}

class BrowserTTS {
  constructor() {
    this.voices = [];
    this.selectedVoice = null;
    this.isInitialized = false;

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      this.initVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        this.initVoices();
      };
    }
  }

  initVoices() {
    if (!window.speechSynthesis) return;
    this.voices = window.speechSynthesis.getVoices();
    if (this.voices.length > 0) {
      console.log(`[MIRRORMIND][BROWSER_TTS] voices_available=${this.voices.length}`);
      
      this.selectedVoice = this.voices.find(v => v.lang === 'en-IN') ||
                           this.voices.find(v => v.lang === 'en-US') ||
                           this.voices.find(v => v.lang.startsWith('en')) ||
                           this.voices[0];
                           
      console.log(`[MIRRORMIND][BROWSER_TTS] selected_voice=${this.selectedVoice.name} (${this.selectedVoice.lang})`);
      this.isInitialized = true;
    }
  }

  speak(text) {
    return new Promise((resolve, reject) => {
      if (!window.speechSynthesis) {
        console.error(`[MIRRORMIND][BROWSER_TTS][ERROR] SpeechSynthesis API not supported`);
        return reject(new Error('SpeechSynthesis API not supported'));
      }

      this.stop(); // Cancel any existing speech

      const cleanedText = cleanTextForSpeech(text);
      console.log(`[MIRRORMIND][BROWSER_TTS] request_started text_length=${cleanedText.length}`);

      const utterance = new SpeechSynthesisUtterance(cleanedText);
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }

      utterance.onstart = () => {
        console.log(`[MIRRORMIND][BROWSER_TTS] speech_started`);
      };

      utterance.onend = () => {
        console.log(`[MIRRORMIND][BROWSER_TTS] speech_ended`);
        resolve();
      };

      utterance.onerror = (event) => {
        if (event.error === 'interrupted') {
          // If paused/canceled intentionally
          resolve(); 
          return;
        }
        console.error(`[MIRRORMIND][BROWSER_TTS][ERROR] name=${event.error} message=${event.type}`);
        reject(new Error(`SpeechSynthesis error: ${event.error}`));
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  pause() {
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
    }
  }

  resume() {
    if (window.speechSynthesis && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }

  stop() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  isSpeaking() {
    return window.speechSynthesis && window.speechSynthesis.speaking;
  }
}

export const browserTTS = new BrowserTTS();
