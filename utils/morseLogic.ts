import { MORSE_CODE } from '../constants.ts';

export const generateRandomText = (charset: string, length: number, groupSize: number): string => {
  if (!charset) return '';
  
  const chars = charset.toUpperCase().split('');
  let result = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    result += chars[randomIndex];
    
    // Add space after group size, but not at the very end
    if ((i + 1) % groupSize === 0 && i !== length - 1) {
      result += ' ';
    }
  }
  
  return result;
};

export const getTimingUnits = (wpm: number) => {
  // Standard Paris definition: 50 units per word "PARIS "
  // Time for one unit (dot) in milliseconds
  const dotDurationMs = 1200 / wpm; 
  return dotDurationMs;
};

export const textToMorseSequence = (text: string) => {
  const sequence: { type: 'dot' | 'dash' | 'charSpace' | 'wordSpace', char?: string }[] = [];
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i].toUpperCase();
    
    if (char === ' ') {
      sequence.push({ type: 'wordSpace' });
      continue;
    }
    
    const morse = MORSE_CODE[char];
    if (!morse) continue;

    // Add symbols for this char
    for (let j = 0; j < morse.length; j++) {
      const symbol = morse[j];
      sequence.push({ type: symbol === '.' ? 'dot' : 'dash', char });
      
      // Inter-element gap (1 unit) is handled by the player logic as a pause after sound
    }

    // Inter-character gap happens after the letter is finished
    // Unless it's the last character or next is a space
    if (i < text.length - 1 && text[i+1] !== ' ') {
      sequence.push({ type: 'charSpace' });
    }
  }

  return sequence;
};