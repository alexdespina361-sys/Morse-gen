import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppSettings, HistoryItem, PlayState } from './types';
import { DEFAULT_SETTINGS, MORSE_CODE, LESSONS } from './constants';
import { AudioEngine } from './services/AudioEngine';
import { ControlPanel } from './components/ControlPanel';
import { Keypad } from './components/Keypad';
import { HistoryPanel } from './components/HistoryPanel';
import { generateRandomText, getTimingUnits } from './utils/morseLogic';

function App() {
  // --- State ---
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('morse_settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });
  
  const [playState, setPlayState] = useState<PlayState>(PlayState.IDLE);
  const [generatedText, setGeneratedText] = useState<string>('');
  const [userTranscript, setUserTranscript] = useState<string>('');
  const [displayIndex, setDisplayIndex] = useState<number>(-1); 
  const [history, setHistory] = useState<HistoryItem[]>(() => {
      const saved = localStorage.getItem('morse_history');
      return saved ? JSON.parse(saved) : [];
  });

  // --- Refs ---
  const audioEngineRef = useRef<AudioEngine>(new AudioEngine());
  const abortControllerRef = useRef<AbortController | null>(null);
  const playedTextRef = useRef<string>(''); 
  const userTranscriptRef = useRef<string>('');

  // Keep refs in sync for access during cleanup/stop
  useEffect(() => { userTranscriptRef.current = userTranscript; }, [userTranscript]);

  // --- Effects ---
  useEffect(() => {
    localStorage.setItem('morse_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('morse_history', JSON.stringify(history));
  }, [history]);

  // --- Logic ---

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

  const saveHistory = () => {
      if (!playedTextRef.current) return;

      const actualTarget = playedTextRef.current;
      const score = calculateScore(actualTarget, userTranscriptRef.current);
      
      const newItem: HistoryItem = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          targetText: actualTarget,
          userTranscript: userTranscriptRef.current,
          score: score,
          mode: settings.transcriptionMode ? 'transcription' : 'presentation',
          settings: {
              wpm: settings.wpm,
              groupSize: settings.groupSize
          }
      };
      setHistory(prev => [newItem, ...prev]);
  };

  const stopPlayback = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    audioEngineRef.current.stopTone();
    
    setPlayState(prev => {
        if (prev === PlayState.PLAYING) {
            saveHistory();
        }
        return PlayState.IDLE;
    });
  }, [settings.transcriptionMode]); // Dep on mode to save correctly

  const sleep = (ms: number, signal: AbortSignal) => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => resolve(), ms);
      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new Error('Aborted'));
      });
    });
  };

  const startSession = async () => {
    audioEngineRef.current.init();
    if (playState === PlayState.PLAYING) {
        stopPlayback();
        return;
    }

    let charset = '';
    if (settings.selectedLessonId === 'custom') {
      charset = settings.customCharset;
    } else {
      const lesson = LESSONS.find(l => l.id === settings.selectedLessonId);
      charset = lesson ? lesson.chars : LESSONS[0].chars;
    }

    const text = generateRandomText(charset, settings.numCharacters, settings.groupSize);
    setGeneratedText(text);
    playedTextRef.current = ''; // Reset
    setUserTranscript('');
    setDisplayIndex(-1);
    setPlayState(PlayState.PLAYING);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    try {
      const dotMs = getTimingUnits(settings.wpm);
      
      if (settings.preStartText) {
        await playString(settings.preStartText, dotMs, signal, false);
        await sleep(dotMs * 10, signal);
      }

      await playString(text, dotMs, signal, true);
      
      // Normal finish
      setPlayState(PlayState.FINISHED);
      saveHistory(); 

    } catch (err: any) {
      if (err.message === 'Aborted') {
        console.log('Playback stopped manually');
      } else {
        console.error(err);
        setPlayState(PlayState.IDLE);
      }
    } finally {
        abortControllerRef.current = null;
    }
  };

  const playString = async (text: string, dotMs: number, signal: AbortSignal, isContent: boolean) => {
    const engine = audioEngineRef.current;
    
    for (let i = 0; i < text.length; i++) {
      if (signal.aborted) throw new Error('Aborted');
      
      // If this is the main content, update tracking immediately before playing
      if (isContent) {
        playedTextRef.current = text.slice(0, i + 1);
        if (settings.showCurrentChar) {
            setDisplayIndex(i);
        }
      }

      const char = text[i].toUpperCase();

      if (char === ' ') {
        await sleep(dotMs * settings.wordSpacing, signal);
        continue;
      }

      const morse = MORSE_CODE[char];
      if (morse) {
        for (const symbol of morse) {
          if (signal.aborted) throw new Error('Aborted');
          
          const duration = symbol === '.' ? dotMs : dotMs * 3;
          engine.playTone(settings.frequency, settings.volume);
          await sleep(duration, signal);
          engine.stopTone();
          
          await sleep(dotMs, signal); 
        }
      }

      const waitTime = (dotMs * settings.charSpacing) - dotMs; 
      if (waitTime > 0) await sleep(waitTime, signal);
    }
  };

  const handleKeypadPress = (char: string) => {
    setUserTranscript(prev => prev + char);
  };

  const handleDelete = () => {
    setUserTranscript(prev => prev.slice(0, -1));
  };

  const getCurrentCharset = () => {
      if (settings.selectedLessonId === 'custom') {
          return settings.customCharset;
      }
      const lesson = LESSONS.find(l => l.id === settings.selectedLessonId);
      return lesson ? lesson.chars : '';
  };

  // Render logic for the Session Area
  const renderSessionArea = () => {
      // CASE 1: Results (Stopped or Finished) AND Transcription Mode was used
      if ((playState === PlayState.IDLE || playState === PlayState.FINISHED) && settings.transcriptionMode && playedTextRef.current) {
          const target = playedTextRef.current.replace(/\s/g, '');
          const user = userTranscriptRef.current.replace(/\s/g, '');
          const displayLen = Math.max(target.length, user.length);
          
          let correctCount = 0;
          let incorrectCount = 0;
          
          // Calculate exact counts based on comparison
          for(let i = 0; i < displayLen; i++) {
              const t = target[i];
              const u = user[i];
              if (t && u && t === u) {
                  correctCount++;
              } else {
                  incorrectCount++;
              }
          }

          return (
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 text-center animate-fade-in">
                  <h3 className="text-teal-400 font-bold mb-4 text-xl">Session Results</h3>
                  
                  <div className="font-mono text-2xl bg-slate-900 p-4 rounded-lg overflow-x-auto whitespace-nowrap mb-4">
                    {Array.from({ length: displayLen }).map((_, i) => {
                        const t = target[i] || '';
                        const u = user[i] || '';
                        let color = 'text-slate-500';
                        if (t && u) color = t === u ? 'text-green-400' : 'text-red-400';
                        else if (t && !u) color = 'text-slate-600 opacity-50';
                        else if (!t && u) color = 'text-red-500';
                        
                        return <span key={i} className={`inline-block w-6 ${color}`}>{t || '_'}</span>;
                    })}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm bg-slate-700/30 p-4 rounded-lg">
                      <div>
                          <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Played</div>
                          <div className="font-mono text-slate-200 text-lg">{target.length}</div>
                      </div>
                      <div>
                          <div className="text-green-400 text-xs uppercase tracking-wider mb-1">Correct</div>
                          <div className="font-mono text-green-400 text-lg font-bold">{correctCount}</div>
                      </div>
                      <div>
                          <div className="text-red-400 text-xs uppercase tracking-wider mb-1">Incorrect</div>
                          <div className="font-mono text-red-400 text-lg font-bold">{incorrectCount}</div>
                      </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-slate-700">
                      <span className="text-slate-400 text-sm mr-2">Total Score:</span>
                      <span className="font-bold text-teal-400 text-xl">{calculateScore(playedTextRef.current, userTranscriptRef.current)}/10</span>
                  </div>
              </div>
          );
      }

      // CASE 2: Show Current Character Mode (Playing or Finished without transcription)
      if (settings.showCurrentChar) {
        // If idle and no text, show placeholder
        if (playState === PlayState.IDLE && !playedTextRef.current) {
             return (
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 h-32 flex items-center justify-center text-slate-600 italic">
                    Characters will appear here...
                </div>
             );
        }
        
        return (
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 min-h-[160px] flex items-center justify-center text-center">
                <div className="font-mono text-4xl text-teal-300 tracking-[0.2em] leading-relaxed break-all">
                    {/* Show what has been played so far */}
                    {playState === PlayState.PLAYING ? (
                        <>
                             {generatedText.slice(0, displayIndex + 1)}
                             <span className="opacity-10 animate-pulse">_</span>
                        </>
                    ) : (
                        playedTextRef.current || generatedText
                    )}
                </div>
            </div>
        );
      }

      // CASE 3: Transcription Mode (Input Area)
      if (settings.transcriptionMode) {
          return (
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                <div className="flex justify-between items-center mb-4">
                     <h3 className="text-teal-400 font-bold">Transcription</h3>
                     {playState === PlayState.PLAYING && (
                         <span className="text-xs text-slate-400 animate-pulse">Listening...</span>
                     )}
                </div>
                <div className="relative">
                    <textarea
                        readOnly
                        value={userTranscript}
                        placeholder="Tap keys below to transcribe..."
                        className="w-full h-24 bg-slate-900 text-slate-200 p-4 rounded-lg border border-slate-600 focus:border-teal-500 outline-none font-mono text-lg resize-none"
                    />
                </div>
                <Keypad 
                    onKeyPress={handleKeypadPress} 
                    onDelete={handleDelete} 
                    disabled={false} 
                    availableChars={getCurrentCharset()}
                />
            </div>
          );
      }
      
      return null;
  };

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-md space-y-6 pb-20">
        
        {/* Header */}
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
                <span className="text-teal-400">Morse</span>Master
            </h1>
            {playState === PlayState.PLAYING && (
                <div className="flex items-center gap-2">
                    <span className="animate-pulse h-3 w-3 bg-red-500 rounded-full"></span>
                    <span className="text-xs text-red-400 font-mono uppercase">Live</span>
                </div>
            )}
        </div>

        {/* Controls */}
        <ControlPanel 
            settings={settings} 
            onSettingsChange={setSettings} 
            onReset={resetSettings}
            disabled={playState === PlayState.PLAYING}
        />

        {/* Start/Stop Button */}
        <button
            onClick={playState === PlayState.PLAYING ? stopPlayback : startSession}
            className={`w-full py-4 rounded-lg font-bold text-lg uppercase tracking-wider shadow-lg transform transition-all active:scale-95 flex items-center justify-center gap-3 
                ${playState === PlayState.PLAYING 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : 'bg-teal-500 hover:bg-teal-400 text-slate-900'}`}
        >
            {playState === PlayState.PLAYING ? (
                <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>
                    Stop
                </>
            ) : (
                <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    Start
                </>
            )}
        </button>

        {/* Session Area (Display or Transcription) */}
        {renderSessionArea()}

        {/* History */}
        <HistoryPanel history={history} onClear={clearHistory} />
        
      </div>
    </div>
  );
}

export default App;