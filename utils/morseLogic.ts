// Get global constants
const { MORSE_CODE } = window as any;

export const generateRandomText = (charset: string, length: number, groupSize: number): string => {
  if (!charset) return '';
  
  const chars = charset.toUpperCase().split('');
  let result = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    result += chars[randomIndex];
    
    if ((i + 1) % groupSize === 0 && i !== length - 1) {
      result += ' ';
    }
  }
  
  return result;
};

export const getTimingUnits = (wpm: number) => {
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

    for (let j = 0; j < morse.length; j++) {
      const symbol = morse[j];
      sequence.push({ type: symbol === '.' ? 'dot' : 'dash', char });
    }

    if (i < text.length - 1 && text[i+1] !== ' ') {
      sequence.push({ type: 'charSpace' });
    }
  }

  return sequence;
};

// Attach to window
(window as any).generateRandomText = generateRandomText;
(window as any).getTimingUnits = getTimingUnits;
(window as any).textToMorseSequence = textToMorseSequence;
