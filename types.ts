export interface AppSettings {
  wpm: number;
  frequency: number;
  volume: number;
  charSpacing: number; // in dots (standard is 3)
  wordSpacing: number; // in dots (standard is 7)
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
  score: number; // Normalized score out of 10
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