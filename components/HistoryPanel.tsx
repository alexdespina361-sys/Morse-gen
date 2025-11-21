
import React, { useState } from 'react';
// import { HistoryItem } from '../types.ts';

interface HistoryPanelProps {
  history: any[];
  onClear: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, onClear }) => {
  const [showAll, setShowAll] = useState(false);

  if (history.length === 0) return null;

  const displayedHistory = showAll ? history : history.slice(0, 1);

  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 mt-6 w-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-teal-400">
            {showAll ? `History (${history.length})` : 'Latest Result'}
        </h3>
        <div className="flex gap-2">
            {history.length > 1 && (
                <button 
                    onClick={() => setShowAll(!showAll)}
                    className="text-xs bg-slate-700 hover:bg-teal-600 text-slate-300 hover:text-white px-3 py-1 rounded transition-colors"
                >
                    {showAll ? 'Show Less' : 'Show All History'}
                </button>
            )}
            <button 
                onClick={onClear}
                className="text-xs bg-slate-700 hover:bg-red-500/80 text-slate-300 hover:text-white px-3 py-1 rounded transition-colors"
            >
                Clear
            </button>
        </div>
      </div>
      <div className="space-y-4">
        {displayedHistory.map((item, index) => (
            <HistoryItemView key={item.id} item={item} isLatest={index === 0 && !showAll} />
        ))}
      </div>
    </div>
  );
};

const HistoryItemView: React.FC<{ item: any; isLatest: boolean }> = ({ item, isLatest }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const dateStr = new Date(item.timestamp).toLocaleString();

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const renderDiff = () => {
    const target = item.targetText.replace(/\s/g, '');
    const user = item.userTranscript.replace(/\s/g, '');
    const displayLen = Math.max(target.length, user.length);
    
    const elements = [];
    for (let i = 0; i < displayLen; i++) {
        const t = target[i] || '';
        const u = user[i] || '';
        let colorClass = 'text-slate-400';
        
        if (t && u) {
            colorClass = t.toUpperCase() === u.toUpperCase() ? 'text-green-400' : 'text-red-400';
        } else if (t && !u) {
            colorClass = 'text-slate-500';
        } else if (!t && u) {
            colorClass = 'text-red-400';
        }

        elements.push(
            <span key={i} className={`inline-block w-4 text-center ${colorClass}`}>
                {t || '_'}
            </span>
        );
    }
    return elements;
  };

  return (
    <div 
      onClick={toggleExpand}
      className={`p-4 rounded-lg border border-slate-700 cursor-pointer transition-colors hover:bg-slate-750 ${isLatest ? 'bg-slate-700/30 border-teal-500/30' : 'bg-slate-800'}`}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-slate-500 font-mono">{dateStr}</span>
        <div className="text-right">
            <span className="text-xs text-slate-400 block">{item.settings.wpm} WPM • Group {item.settings.groupSize}</span>
        </div>
      </div>
      
      {item.mode === 'presentation' ? (
         <div className="mb-2">
            <div className="text-xs text-teal-500 uppercase font-bold tracking-wider mb-1">Practice Mode</div>
            <div className="font-mono text-slate-200 break-all bg-slate-900 p-2 rounded tracking-widest">
                {item.targetText}
            </div>
         </div>
      ) : (
         <div>
             <div className="text-xs text-teal-500 uppercase font-bold tracking-wider mb-1">Transcription Result</div>
             <div className="font-mono text-sm bg-slate-900 p-2 rounded overflow-x-auto whitespace-nowrap no-scrollbar">
                 {renderDiff()}
             </div>
             
             {isExpanded && (
                 <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
                     <div className="bg-slate-900/50 p-2 rounded">
                         <span className="text-slate-500 block text-xs uppercase">Target</span>
                         <span className="font-mono text-slate-300 break-all">{item.targetText}</span>
                     </div>
                     <div className="bg-slate-900/50 p-2 rounded">
                         <span className="text-slate-500 block text-xs uppercase">You Typed</span>
                         <span className="font-mono text-yellow-100/80 break-all">{item.userTranscript}</span>
                     </div>
                 </div>
             )}

            <div className="mt-3 pt-2 border-t border-slate-700/50 flex items-center justify-between">
                <span className="text-sm text-slate-400">Accuracy Score:</span>
                <span className={`text-lg font-bold ${item.score >= 8 ? 'text-green-400' : item.score >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {item.score}/10
                </span>
            </div>
         </div>
      )}
    </div>
  );
};

(window as any).HistoryPanel = HistoryPanel;
