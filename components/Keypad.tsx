import React from 'react';

interface KeypadProps {
  onKeyPress: (char: string) => void;
  onDelete: () => void;
  disabled: boolean;
  availableChars: string;
}

export const Keypad: React.FC<KeypadProps> = ({ onKeyPress, onDelete, disabled, availableChars }) => {
  const keysToShow = availableChars.toUpperCase().split('').filter((char, index, self) => {
    return self.indexOf(char) === index && /[A-Z0-9]/.test(char);
  }).sort();

  return (
    <div className="grid grid-cols-5 gap-2 mt-4">
      {keysToShow.length > 0 ? (
        keysToShow.map((k) => (
          <button
            key={k}
            disabled={disabled}
            onClick={() => onKeyPress(k)}
            className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:hover:bg-teal-600 text-white font-bold py-3 rounded shadow active:transform active:scale-95 transition-all"
          >
            {k}
          </button>
        ))
      ) : (
        <div className="col-span-5 text-center text-slate-500 py-4">
            No valid characters available for keypad.
        </div>
      )}
      
      {keysToShow.length > 0 && (
          <button
            disabled={disabled}
            onClick={onDelete}
            className="col-span-5 bg-slate-700 hover:bg-red-500/80 disabled:opacity-50 text-white font-bold py-3 rounded shadow flex items-center justify-center gap-2 transition-colors mt-2"
          >
            <span>DELETE</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path><line x1="18" y1="9" x2="12" y2="15"></line><line x1="12" y1="9" x2="18" y2="15"></line></svg>
          </button>
      )}
    </div>
  );
};

(window as any).Keypad = Keypad;
