import React from 'react';
import { AppSettings } from '../types';
import { LESSONS, DEFAULT_SETTINGS } from '../constants';

interface ControlPanelProps {
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
  onReset: () => void;
  disabled: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ settings, onSettingsChange, onReset, disabled }) => {
  
  const handleChange = (key: keyof AppSettings, value: any) => {
    // Mutual exclusion logic
    if (key === 'showCurrentChar' && value === true) {
      onSettingsChange({ ...settings, showCurrentChar: true, transcriptionMode: false });
    } else if (key === 'transcriptionMode' && value === true) {
      onSettingsChange({ ...settings, transcriptionMode: true, showCurrentChar: false });
    } else {
      onSettingsChange({ ...settings, [key]: value });
    }
  };

  const currentLesson = LESSONS.find(l => l.id === settings.selectedLessonId) || LESSONS[0];

  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 space-y-6">
      <div className="flex justify-between items-center border-b border-slate-700 pb-4">
         <h2 className="text-lg font-bold text-slate-200">Settings</h2>
         <button 
            onClick={onReset}
            disabled={disabled}
            className="text-xs text-teal-400 hover:text-teal-300 disabled:opacity-50 underline"
         >
            Reset Defaults
         </button>
      </div>
      
      {/* Lesson Selector */}
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-2">Lesson</label>
        <select
          disabled={disabled}
          value={settings.selectedLessonId}
          onChange={(e) => handleChange('selectedLessonId', e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg p-3 focus:ring-2 focus:ring-teal-500 outline-none"
        >
          {LESSONS.map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      {/* Custom Charset Input - Only if Custom is selected */}
      {settings.selectedLessonId === 'custom' && (
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Custom Chars</label>
          <input
            type="text"
            disabled={disabled}
            value={settings.customCharset}
            onChange={(e) => handleChange('customCharset', e.target.value.toUpperCase())}
            className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg p-3 focus:ring-2 focus:ring-teal-500 outline-none font-mono"
            placeholder="e.g., ABC123"
          />
        </div>
      )}

      <div className="text-xs text-slate-500 font-mono break-all">
        Using: {settings.selectedLessonId === 'custom' ? settings.customCharset : currentLesson.chars}
      </div>

      {/* Pre-start Text */}
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-2">Pre-start Text (Audio only)</label>
        <input
          type="text"
          disabled={disabled}
          value={settings.preStartText}
          onChange={(e) => handleChange('preStartText', e.target.value.toUpperCase())}
          className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg p-3 focus:ring-2 focus:ring-teal-500 outline-none font-mono"
        />
      </div>

      <hr className="border-slate-700" />

      {/* Sliders */}
      <div className="space-y-4">
        <Slider
          label="Speed"
          value={settings.wpm}
          min={5} max={60}
          unit="wpm"
          onChange={(v) => handleChange('wpm', v)}
          disabled={disabled}
        />
        <Slider
          label="Frequency"
          value={settings.frequency}
          min={400} max={1200}
          unit="Hz"
          onChange={(v) => handleChange('frequency', v)}
          disabled={disabled}
        />
        <Slider
          label="Volume"
          value={settings.volume}
          min={0} max={1} step={0.05}
          unit=""
          onChange={(v) => handleChange('volume', v)}
          disabled={disabled}
        />
        <Slider
          label="Character Spacing"
          value={settings.charSpacing}
          min={1} max={30}
          unit="dots"
          onChange={(v) => handleChange('charSpacing', v)}
          disabled={disabled}
        />
        <Slider
          label="Word Spacing"
          value={settings.wordSpacing}
          min={3} max={30}
          unit="dots"
          onChange={(v) => handleChange('wordSpacing', v)}
          disabled={disabled}
        />
        <Slider
          label="Group Size"
          value={settings.groupSize}
          min={1} max={10}
          unit="chars"
          onChange={(v) => handleChange('groupSize', v)}
          disabled={disabled}
        />
        <Slider
          label="Number of Characters"
          value={settings.numCharacters}
          min={5} max={200} step={5}
          unit="chars"
          onChange={(v) => handleChange('numCharacters', v)}
          disabled={disabled}
        />
      </div>

      {/* Toggles */}
      <div className="flex flex-col gap-3 pt-2">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            disabled={disabled}
            checked={settings.showCurrentChar}
            onChange={(e) => handleChange('showCurrentChar', e.target.checked)}
            className="w-5 h-5 rounded border-slate-600 text-teal-500 focus:ring-teal-500 bg-slate-900"
          />
          <span className="text-slate-300">Show characters</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            disabled={disabled}
            checked={settings.transcriptionMode}
            onChange={(e) => handleChange('transcriptionMode', e.target.checked)}
            className="w-5 h-5 rounded border-slate-600 text-teal-500 focus:ring-teal-500 bg-slate-900"
          />
          <span className="text-slate-300">Transcription Mode</span>
        </label>
      </div>

    </div>
  );
};

const Slider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (val: number) => void;
  disabled: boolean;
}> = ({ label, value, min, max, step = 1, unit, onChange, disabled }) => (
  <div>
    <div className="flex justify-between mb-1">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className="text-teal-400 font-bold text-sm">{value} {unit}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full"
    />
  </div>
);