export interface TTSState {
  isPlaying: boolean;
  isPaused: boolean;
  currentSentenceIndex: number;
  totalSentences: number;
  currentSentenceText: string;
  selectedVoiceURI: string;
  rate: number;
  pitch: number;
  sleepTimerRemainingSeconds: number | null;
}

export type TTSListener = (state: TTSState) => void;

class TTSService {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private sentences: string[] = [];
  private currentSentenceIndex = 0;
  private isPlaying = false;
  private isPaused = false;
  private selectedVoiceURI = '';
  private rate = 1.0;
  private pitch = 1.0;
  private onChapterFinishedCallback: (() => void) | null = null;
  private listeners: Set<TTSListener> = new Set();
  private sleepTimerId: number | null = null;
  private sleepTimerEndTimestamp: number | null = null;
  private sleepTimerIntervalId: number | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  public subscribe(listener: TTSListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }

  public getState(): TTSState {
    let remainingSeconds: number | null = null;
    if (this.sleepTimerEndTimestamp) {
      const diff = Math.max(0, Math.round((this.sleepTimerEndTimestamp - Date.now()) / 1000));
      remainingSeconds = diff;
    }

    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      currentSentenceIndex: this.currentSentenceIndex,
      totalSentences: this.sentences.length,
      currentSentenceText: this.sentences[this.currentSentenceIndex] || '',
      selectedVoiceURI: this.selectedVoiceURI,
      rate: this.rate,
      pitch: this.pitch,
      sleepTimerRemainingSeconds: remainingSeconds,
    };
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    const voices = this.synth.getVoices();
    // Sort Vietnamese voices to the top
    return voices.sort((a, b) => {
      const aVi = a.lang.toLowerCase().startsWith('vi') ? 1 : 0;
      const bVi = b.lang.toLowerCase().startsWith('vi') ? 1 : 0;
      return bVi - aVi;
    });
  }

  public setVoice(voiceURI: string) {
    this.selectedVoiceURI = voiceURI;
    this.notify();
  }

  public setRate(rate: number) {
    this.rate = Math.min(2.0, Math.max(0.5, rate));
    this.notify();
  }

  public setPitch(pitch: number) {
    this.pitch = Math.min(1.5, Math.max(0.5, pitch));
    this.notify();
  }

  public setOnChapterFinished(cb: () => void) {
    this.onChapterFinishedCallback = cb;
  }

  /**
   * Split raw text into sentences for fine-grained highlighting and control
   */
  public splitIntoSentences(text: string): string[] {
    if (!text) return [];
    
    // Split by punctuation (. ! ? \n) while keeping sentence intact
    const rawParts = text
      .replace(/\r\n/g, '\n')
      .split(/(?<=[.!?。！？\n])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const result: string[] = [];
    for (const part of rawParts) {
      // If a part has newlines inside, split further
      const subLines = part.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
      result.push(...subLines);
    }

    return result.length > 0 ? result : [text.trim()];
  }

  public loadChapterText(text: string, startIndex = 0) {
    this.stop();
    this.sentences = this.splitIntoSentences(text);
    this.currentSentenceIndex = Math.min(startIndex, Math.max(0, this.sentences.length - 1));
    this.notify();
  }

  public play(fromSentenceIndex?: number) {
    if (!this.synth) return;

    if (fromSentenceIndex !== undefined) {
      this.currentSentenceIndex = Math.min(fromSentenceIndex, Math.max(0, this.sentences.length - 1));
    }

    if (this.sentences.length === 0) return;

    this.isPlaying = true;
    this.isPaused = false;
    this.notify();
    this.speakCurrentSentence();
  }

  private speakCurrentSentence() {
    if (!this.synth || !this.isPlaying) return;

    this.synth.cancel();

    if (this.currentSentenceIndex >= this.sentences.length) {
      // Reached end of chapter
      this.isPlaying = false;
      this.isPaused = false;
      this.notify();
      if (this.onChapterFinishedCallback) {
        this.onChapterFinishedCallback();
      }
      return;
    }

    const textToSpeak = this.sentences[this.currentSentenceIndex];
    if (!textToSpeak || textToSpeak.trim().length === 0) {
      this.currentSentenceIndex++;
      this.speakCurrentSentence();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    this.currentUtterance = utterance;

    // Apply voice
    const voices = this.getAvailableVoices();
    let chosenVoice = voices.find((v) => v.voiceURI === this.selectedVoiceURI);
    if (!chosenVoice) {
      // Look for any Vietnamese voice
      chosenVoice = voices.find((v) => v.lang.toLowerCase().startsWith('vi'));
    }
    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }

    utterance.rate = this.rate;
    utterance.pitch = this.pitch;

    utterance.onend = () => {
      if (this.isPlaying && !this.isPaused) {
        this.currentSentenceIndex++;
        this.notify();
        this.speakCurrentSentence();
      }
    };

    utterance.onerror = (e) => {
      // Ignore 'interrupted' errors when user pauses or skips
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.warn('TTS error:', e.error);
      }
    };

    this.synth.speak(utterance);
    this.notify();
  }

  public pause() {
    if (!this.synth || !this.isPlaying) return;
    this.synth.cancel();
    this.isPlaying = true;
    this.isPaused = true;
    this.notify();
  }

  public resume() {
    if (!this.synth || !this.isPaused) return;
    this.isPaused = false;
    this.isPlaying = true;
    this.notify();
    this.speakCurrentSentence();
  }

  public stop() {
    if (this.synth) {
      this.synth.cancel();
    }
    this.isPlaying = false;
    this.isPaused = false;
    this.currentUtterance = null;
    this.notify();
  }

  public nextSentence() {
    if (this.currentSentenceIndex < this.sentences.length - 1) {
      this.currentSentenceIndex++;
      this.notify();
      if (this.isPlaying && !this.isPaused) {
        this.speakCurrentSentence();
      }
    }
  }

  public prevSentence() {
    if (this.currentSentenceIndex > 0) {
      this.currentSentenceIndex--;
      this.notify();
      if (this.isPlaying && !this.isPaused) {
        this.speakCurrentSentence();
      }
    }
  }

  // Sleep Timer (minutes)
  public setSleepTimer(minutes: number | null) {
    if (this.sleepTimerId) {
      clearTimeout(this.sleepTimerId);
      this.sleepTimerId = null;
    }
    if (this.sleepTimerIntervalId) {
      clearInterval(this.sleepTimerIntervalId);
      this.sleepTimerIntervalId = null;
    }

    if (!minutes || minutes <= 0) {
      this.sleepTimerEndTimestamp = null;
      this.notify();
      return;
    }

    const durationMs = minutes * 60 * 1000;
    this.sleepTimerEndTimestamp = Date.now() + durationMs;

    this.sleepTimerId = window.setTimeout(() => {
      this.stop();
      this.setSleepTimer(null);
    }, durationMs);

    this.sleepTimerIntervalId = window.setInterval(() => {
      this.notify();
    }, 1000);

    this.notify();
  }
}

export const ttsService = new TTSService();
