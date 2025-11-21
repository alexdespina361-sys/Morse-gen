
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
  const [generatedText, setGeneratedText] = useState('');
  const [userTranscript, setUserTranscript] = useState('');
  const [displayIndex, setDisplayIndex] = useState(-1); 
  const [history, setHistory] = useState(() => {
      const saved = localStorage.getItem('morse_history');
      return saved ? JSON.parse(saved) : [];
  });

  const audioEngineRef = useRef(new AudioEngine());
  const abortControllerRef = useRef<AbortController | null>(null);
  const playedTextRef = useRef(''); 
  const userTranscriptRef = useRef('');

  // Keep ref in sync for the cleanup/save logic
  useEffect(() => { userTranscriptRef.current = userTranscript; }, [userTranscript]);

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
    setDisplayIndex(-1);
    saveHistory();
  }, [saveHistory]);

  const handleStop = () => {
      stopPlayback();
      setPlayState(PlayState.IDLE);
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

  const playMorseSequence = async (text: string) => {
      audioEngineRef.current.init();
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      
      setPlayState(PlayState.PLAYING);
      setUserTranscript('');
      userTranscriptRef.current = '';
      
      const dotDuration = getTimingUnits(settings.wpm);
      const sequence = textToMorseSequence(text);
      
      let charIndex = 0;

      try {
          // Pre-start delay
          await wait(500, signal);

          for (let i = 0; i < sequence.length; i++) {
              if (signal.aborted) break;

              const item = sequence[i];

              // Update visual tracker if it's a new character
              if (item.char && i > 0 && sequence[i-1].char !== item.char) {
                  charIndex++;
              } else if (i === 0 && item.char) {
                  // first char
              }
              
              // Map logic char index to string index (approximate for visualization)
              setDisplayIndex(charIndex);

              if (item.type === 'dot') {
                  audioEngineRef.current.playTone(settings.frequency, settings.volume);
                  await wait(dotDuration, signal);
                  audioEngineRef.current.stopTone();
                  await wait(dotDuration, signal); // inter-element gap
              } else if (item.type === 'dash') {
                  audioEngineRef.current.playTone(settings.frequency, settings.volume);
                  await wait(dotDuration * 3, signal);
                  audioEngineRef.current.stopTone();
                  await wait(dotDuration, signal); // inter-element gap
              } else if (item.type === 'charSpace') {
                  // 3 dots total (1 is already handled by inter-element, add 2)
                  await wait(dotDuration * 2, signal);
                  if (settings.charSpacing > 3) {
                       // Extra spacing from settings
                       const extra = (settings.charSpacing - 3) * dotDuration;
                       if (extra > 0) await wait(extra, signal);
                  }
              } else if (item.type === 'wordSpace') {
                  // 7 dots total (1 inter-element + 2 charSpace + 4 more)
                  // Simplification: Standard word space is 7 dots.
                  // Previous element was char end (1 dot wait).
                  // Need to wait 6 more.
                  await wait(dotDuration * 6, signal);
                  if (settings.wordSpacing > 7) {
                      const extra = (settings.wordSpacing - 7) * dotDuration;
                      if (extra > 0) await wait(extra, signal);
                  }
                  charIndex++; // Counts as a position in visual string
              }
          }

          stopPlayback();

      } catch (err: any) {
          if (err.name !== 'AbortError') {
              console.error("Playback error", err);
          }
      }
  };

  const handleStart = async () => {
      let textToPlay = '';
      
      // 1. Select source text
      const lesson = LESSONS.find((l: any) => l.id === settings.selectedLessonId);
      let charset = lesson ? lesson.chars : settings.customCharset;
      
      // If custom chars is empty, fallback
      if (!charset) charset = 'KM';

      textToPlay = generateRandomText(charset, settings.numCharacters, settings.groupSize);
      
      setGeneratedText(textToPlay);
      playedTextRef.current = textToPlay;
      
      // 2. Handle Pre-start VVV if needed (prepend to audio, but not to target text for scoring)
      // For simplicity in this version, we just play the text generated.
      // If you wanted 'VVVV' prefix, we'd need to chain two play sequences.
      
      await playMorseSequence(textToPlay);
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
          // Valid morse chars
          if (/^[a-zA-Z0-9]$/.test(e.key)) {
              handleKeyPress(e.key.toUpperCase());
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
                // Presentation Mode
                <div className="font-mono text-4xl md:text-5xl leading-relaxed tracking-widest break-all text-slate-200">
                    {generatedText ? (
                         generatedText.split('').map((char, idx) => {
                            const isActive = idx === displayIndex && playState === PlayState.PLAYING;
                            return (
                                <span 
                                    key={idx} 
                                    className={`${isActive ? 'text-teal-400 bg-teal-400/10 scale-110 inline-block transition-transform' : 'text-slate-500'}`}
                                >
                                    {char === ' ' ? '\u00A0' : char}
                                </span>
                            );
                         })
                    ) : (
                        <span className="text-slate-600 text-xl">Press Play to Start</span>
                    )}
                </div>
            ) : (
                // Transcription Mode (Hide text while playing)
                <div className="w-full">
                    {playState === PlayState.PLAYING ? (
                         <div className="animate-pulse flex flex-col items-center gap-4">
                             <div className="h-16 w-16 rounded-full bg-teal-500/20 flex items-center justify-center">
                                <div className="h-4 w-4 bg-teal-400 rounded-full animate-ping" />
                             </div>
                             <span className="text-teal-400 font-mono text-sm tracking-widest">INCOMING TRANSMISSION</span>
                         </div>
                    ) : generatedText ? (
                        <div className="text-left">
                            <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Target Text</p>
                            <p className="font-mono text-xl text-slate-400 mb-6 break-all bg-slate-900/50 p-4 rounded">{generatedText}</p>
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
                        {generatedText && playState === PlayState.FINISHED ? 'PLAY AGAIN' : 'START LESSON'}
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
