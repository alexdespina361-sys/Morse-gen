export interface AppSettings {
  wpm: number;
  frequency: number;
  volume: number;
  charSpacing: number;
  wordSpacing: number;
  groupSize: number;
  numCharacters: number;
  preStartText: string;
  showCurrentChar: boolean;
  transcriptionMode: boolean;
  selectedLessonId: string;
  customCharset: string;
}

export interface Lesson {
  id: string;
  name: string;
  chars: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  targetText: string;
  userTranscript: string;
  score: number;
  mode: 'transcription' | 'presentation';
  settings: {
    wpm: number;
    groupSize: number;
  };
}

export enum PlayState {
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  FINISHED = 'FINISHED',
}

// Attach to window for global access
(window as any).PlayState = PlayState;
