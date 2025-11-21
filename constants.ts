import { Lesson, AppSettings } from './types';

export const MORSE_CODE: Record<string, string> = {
  'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
  'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
  'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
  'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
  'Y': '-.--', 'Z': '--..',
  '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....',
  '6': '-....', '7': '--...', '8': '---..', '9': '----.', '0': '-----',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', '/': '-..-.', '@': '.--.-.',
  '=': '-...-'
};

export const LESSONS: Lesson[] = [
  { id: 'lesson1', name: 'Lesson 1: K M', chars: 'KM' },
  { id: 'lesson2', name: 'Lesson 2: K M R S', chars: 'KMRS' },
  { id: 'lesson3', name: 'Lesson 3: K M R S U A', chars: 'KMRSUA' },
  { id: 'lesson4', name: 'Lesson 4: K M R S U A P T', chars: 'KMRSUAPT' },
  { id: 'lesson5', name: 'Lesson 5: All Letters', chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
  { id: 'lesson6', name: 'Numbers', chars: '0123456789' },
  { id: 'custom', name: 'Custom Characters', chars: '' }, // Chars taken from custom input
];

export const DEFAULT_SETTINGS: AppSettings = {
  wpm: 18,
  frequency: 750,
  volume: 0.5,
  charSpacing: 25, 
  wordSpacing: 25,
  groupSize: 4,
  numCharacters: 120,
  preStartText: 'VVVV',
  showCurrentChar: false,
  transcriptionMode: true,
  selectedLessonId: 'lesson5',
  customCharset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
};