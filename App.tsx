

import React, { useState, useEffect, useRef, useCallback } from 'react';

// Get globals
const { 
  DEFAULT_SETTINGS, 
  MORSE_CODE, 
  LESSONS, 
  AudioEngine, 
  ControlPanel, 
  Keypad, 
  HistoryPanel, 
  generateRandomText, 
  getTimingUnits,
  textToMorseSequence,
  PlayState 
} = window as any;

function App() {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('morse_settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });
  
  const [playState, setPlayState] = useState(PlayState.IDLE);
  
  // generatedText is the full planned text
  const [generatedText, setGeneratedText] = useState('');
  
  // playedText tracks what has actually been outputted by audio so far
  const [playedText, setPlayedText] = useState('');
  
  const [userTranscript, setUserTranscript] = useState('');
  const [history, setHistory] = useState(() => {
      const saved = localStorage.getItem('morse_history');
      return saved ? JSON.parse(saved) : [];
  });

  const audioEngineRef = useRef(new AudioEngine());
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Refs for accessing latest state inside async/cleanup
  const playedTextRef = useRef(''); 
  const userTranscriptRef = useRef('');

  // Sync refs
  useEffect(() => { userTranscriptRef.current = userTranscript; }, [userTranscript]);
  useEffect(() => { playedTextRef.current = playedText; }, [playedText]);

  // Audio Engine Init
  useEffect(() => {
      audioEngineRef.current.init();
      return () => audioEngineRef.current.close();
  }, []);

  useEffect(() => {
    localStorage.setItem('morse_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('morse_history', JSON.stringify(history));
  }, [history]);

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  const clearHistory = () => {
    if(window.confirm("Are you sure you want to clear all history?")) {
        setHistory([]);
        localStorage.removeItem('morse_history');
    }
  };

  const calculateScore = (target: string, user: string): number => {
      if (!target) return 0;
      const t = target.replace(/\s/g, '').toUpperCase();
      const u = user.replace(/\s/g, '').toUpperCase();
      const len = Math.max(t.length, 1);
      let correct = 0;
      for(let i=0; i < Math.min(t.length, u.length); i++) {
          if (t[i] === u[i]) correct++;
      }
      const rawScore = (correct / len) * 10;
      return Math.round(rawScore * 10) / 10; 
  };

  const saveHistory = useCallback(() => {
      if (!playedTextRef.current) return;
      
      const score = calculateScore(playedTextRef.current, userTranscriptRef.current);
      const newItem = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          targetText: playedTextRef.current,
          userTranscript: userTranscriptRef.current,
          score: score,
          mode: settings.transcriptionMode ? 'transcription' : 'presentation',
          settings: {
              wpm: settings.wpm,
              groupSize: settings.groupSize
          }
      };
      
      setHistory(prev => [newItem, ...prev]);
  }, [settings.transcriptionMode, settings.wpm, settings.groupSize]);

  const stopPlayback = useCallback(() => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
    }
    audioEngineRef.current.stopTone();
    setPlayState(PlayState.FINISHED);
    saveHistory();
  }, [saveHistory]);

  const handleStop = () => {
      stopPlayback();
      setPlayState(PlayState.IDLE); // Go to idle on manual stop
  };

  const wait = (ms: number, signal: AbortSignal) => {
      return new Promise<void>((resolve, reject) => {
          if (signal.aborted) {
              reject(new DOMException('Aborted', 'AbortError'));
              return;
          }
          const timer = setTimeout(() => resolve(), ms);
          signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new DOMException('Aborted', 'AbortError'));
          });
      });
  };

  // Generic player for a string of text
  const playSequence = async (text: string, signal: AbortSignal, onChar?: (char: string) => void) => {
      const dotDuration = getTimingUnits(settings.wpm);
      const sequence = textToMorseSequence(text);
      
      // Used to track when we have finished playing a specific character
      let lastCharPlayed = '';

      for (let i = 0; i < sequence.length; i++) {
          if (signal.aborted) break;

          const item = sequence[i];

          // Detect new character start to trigger callback for the PREVIOUS character
          // Or trigger callback after the character finishes?
          // Let's trigger callback when we start playing a character's first symbol,
          // or better, when we finish the character spacing. 
          // The requirement is "show each one as its audio is played".
          
          // Simple approach: If we encounter a 'char' property and it's different or new index
          if (item.char && onChar) {
              // We only want to call onChar once per actual character in the text.
              // The sequence array has multiple dots/dashes for one char.
              // We look ahead: if this is the first symbol of a char.
              const isFirstSymbolOfChar = i === 0 || sequence[i-1].char !== item.char || sequence[i-1].type === 'wordSpace' || sequence[i-1].type === 'charSpace';
              
              if (isFirstSymbolOfChar) {
                   // We schedule the visual update. 
                   // To make it sync with audio, we do it here.
                   onChar(item.char);
              }
          }
          
          if (item.type === 'dot') {
              audioEngineRef.current.playTone(settings.frequency, settings.volume);
              await wait(dotDuration, signal);
              audioEngineRef.current.stopTone();
              await wait(dotDuration, signal); 
          } else if (item.type === 'dash') {
              audioEngineRef.current.playTone(settings.frequency, settings.volume);
              await wait(dotDuration * 3, signal);
              audioEngineRef.current.stopTone();
              await wait(dotDuration, signal);
          } else if (item.type === 'charSpace') {
              // Standard char space is 3 dots. 1 dot is already consumed by element gap.
              // Wait 2 more.
              await wait(dotDuration * 2, signal);
              // Extra spacing
              if (settings.charSpacing > 3) {
                   const extra = (settings.charSpacing - 3) * dotDuration;
                   if (extra > 0) await wait(extra, signal);
              }
          } else if (item.type === 'wordSpace') {
              // Standard word space is 7 dots. Previous element was char end (1 dot).
              // Wait 6 more.
              if (onChar) onChar(' '); // Visually add space
              await wait(dotDuration * 6, signal);
              // Extra spacing
              if (settings.wordSpacing > 7) {
                  const extra = (settings.wordSpacing - 7) * dotDuration;
                  if (extra > 0) await wait(extra, signal);
              }
          }
      }
  };

  const handleStart = async () => {
      // Setup
      audioEngineRef.current.init();
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      
      setPlayState(PlayState.PLAYING);
      setUserTranscript('');
      userTranscriptRef.current = '';
      setPlayedText('');
      playedTextRef.current = '';
      
      // Generate Text
      const lesson = LESSONS.find((l: any) => l.id === settings.selectedLessonId);
      let charset = lesson ? lesson.chars : settings.customCharset;
      if (!charset) charset = 'KM';
      const textToPlay = generateRandomText(charset, settings.numCharacters, settings.groupSize);
      setGeneratedText(textToPlay);

      try {
          // 1. Play Pre-Start Text (if any)
          if (settings.preStartText && settings.preStartText.trim().length > 0) {
              // We don't update playedText for pre-start
              await playSequence(settings.preStartText, signal);
              // Wait a word space before starting lesson
              await wait(getTimingUnits(settings.wpm) * 7, signal); 
          }

          // 2. Play Main Text
          await playSequence(textToPlay, signal, (char) => {
             setPlayedText(prev => prev + char);
          });

          stopPlayback();

      } catch (err: any) {
          if (err.name !== 'AbortError') {
              console.error("Playback error", err);
          }
      }
  };

  const handleKeyPress = (char: string) => {
      if (playState === PlayState.PLAYING || playState === PlayState.FINISHED || playState === PlayState.IDLE) {
          setUserTranscript(prev => prev + char);
      }
  };

  const handleDelete = () => {
      setUserTranscript(prev => prev.slice(0, -1));
  };

  // Keyboard support
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.repeat) return;
          if (e.key === 'Backspace') {
              handleDelete();
              return;
          }
          if (e.key === 'Enter') {
              if (playState === PlayState.IDLE || playState === PlayState.FINISHED) {
                  handleStart();
              } else if (playState === PlayState.PLAYING) {
                  handleStop();
              }
              return;
          }
          if (/^[a-zA-Z0-9]$/.test(e.key)) {
              handleKeyPress(e.key.toUpperCase());
          }
          if (e.key === ' ') {
               handleKeyPress(' ');
          }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playState]);

  const currentLesson = LESSONS.find((l: any) => l.id === settings.selectedLessonId) || LESSONS[0];

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-8 max-w-6xl mx-auto">
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
            <h1 className="text-3xl md:text-4xl font-bold text-teal-400 tracking-tight flex items-center gap-3">
                <span className="text-4xl">..-</span>
                Morse Master
            </h1>
            <p className="text-slate-400 mt-2">Professional CW Trainer</p>
        </div>
        <div className="flex gap-4 text-sm font-mono text-slate-500">
            <span>{playState === PlayState.PLAYING ? 'TRANSMITTING...' : 'READY'}</span>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Controls */}
        <div className="lg:col-span-4 space-y-6">
          <ControlPanel 
            settings={settings} 
            onSettingsChange={setSettings} 
            onReset={resetSettings}
            disabled={playState === PlayState.PLAYING}
          />
        </div>

        {/* Right Column: Display & Input */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Main Display Area */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 md:p-10 min-h-[200px] flex flex-col justify-center items-center text-center shadow-inner relative overflow-hidden">
            
            {!settings.transcriptionMode ? (
                // Presentation Mode: Show characters as they accumulate (playedText)
                <div className="font-mono text-4xl md:text-5xl leading-relaxed tracking-widest break-all text-slate-200">
                    {playedText ? (
                         playedText.split('').map((char, idx) => (
                            <span 
                                key={idx} 
                                className="text-teal-400 inline-block animate-in fade-in zoom-in duration-100"
                            >
                                {char === ' ' ? '\u00A0' : char}
                            </span>
                         ))
                    ) : (
                        <span className="text-slate-600 text-xl">Press Play to Start</span>
                    )}
                </div>
            ) : (
                // Transcription Mode
                <div className="w-full">
                    {playState === PlayState.PLAYING ? (
                         <div className="animate-pulse flex flex-col items-center gap-4">
                             <div className="h-16 w-16 rounded-full bg-teal-500/20 flex items-center justify-center">
                                <div className="h-4 w-4 bg-teal-400 rounded-full animate-ping" />
                             </div>
                             <span className="text-teal-400 font-mono text-sm tracking-widest">INCOMING TRANSMISSION</span>
                         </div>
                    ) : playedText ? (
                        // When stopped/finished, show what was played
                        <div className="text-left">
                            <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Target Text</p>
                            <p className="font-mono text-xl text-slate-400 mb-6 break-all bg-slate-900/50 p-4 rounded">
                                {playedText}
                            </p>
                            {playState === PlayState.IDLE && generatedText.length > playedText.length && (
                                <p className="text-xs text-red-400/60 mt-2">
                                    (Transmission stopped early)
                                </p>
                            )}
                        </div>
                    ) : (
                         <span className="text-slate-600 text-xl">Press Play to Start Transcription</span>
                    )}
                </div>
            )}

          </div>

          {/* User Input Area */}
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
             <div className="flex justify-between items-center mb-4">
                 <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">Your Transcript</label>
                 {playState === PlayState.PLAYING && (
                     <span className="text-xs text-teal-500 animate-pulse">● LIVE</span>
                 )}
             </div>
             
             <div className="bg-black/30 rounded-lg p-4 min-h-[60px] mb-4 font-mono text-2xl tracking-widest text-yellow-100 break-all border border-slate-700/50">
                 {userTranscript || <span className="text-slate-700 opacity-50">_</span>}
                 <span className="animate-pulse text-teal-500">|</span>
             </div>

             <div className="flex gap-4">
                {playState === PlayState.PLAYING ? (
                    <button 
                        onClick={handleStop}
                        className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-lg shadow-lg shadow-red-500/20 transition-all transform active:scale-98"
                    >
                        STOP
                    </button>
                ) : (
                    <button 
                        onClick={handleStart}
                        className="w-full bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold py-4 rounded-lg shadow-lg shadow-teal-500/20 transition-all transform active:scale-98"
                    >
                        {playedText ? 'PLAY AGAIN' : 'START LESSON'}
                    </button>
                )}
             </div>

             <Keypad 
                onKeyPress={handleKeyPress} 
                onDelete={handleDelete} 
                disabled={false}
                availableChars={settings.selectedLessonId === 'custom' ? settings.customCharset : currentLesson.chars}
             />
          </div>

          <HistoryPanel history={history} onClear={clearHistory} />
        
        </div>
      </main>
    </div>
  );
}

// Attach to window so index.tsx can find it
(window as any).App = App;
