import React from 'react';
import { Play, Loader2, Volume2, Pause } from 'lucide-react';
import { PlaybackState, TextSegment } from '../types';

interface SegmentCardProps {
  segment: TextSegment;
  isPlaying: boolean;
  isLoading: boolean;
  onClickPlay: () => void;
  onClickPause: () => void;
}

export const SegmentCard: React.FC<SegmentCardProps> = ({
  segment,
  isPlaying,
  isLoading,
  onClickPlay,
  onClickPause
}) => {
  return (
    <div 
      className={`
        relative group transition-all duration-300 ease-in-out border rounded-xl p-5
        ${isPlaying 
          ? 'bg-blue-50 border-blue-200 shadow-md scale-[1.01] translate-x-1' 
          : 'bg-white border-slate-100 hover:border-blue-100 hover:shadow-sm'
        }
      `}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <p className={`text-lg font-medium leading-relaxed ${isPlaying ? 'text-blue-700' : 'text-slate-700'}`}>
            {segment.original}
          </p>
          <p className="text-slate-500 text-base">
            {segment.translation}
          </p>
        </div>

        <button
          onClick={isPlaying ? onClickPause : onClickPlay}
          disabled={isLoading}
          className={`
            flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0 transition-colors
            ${isPlaying 
              ? 'bg-blue-600 text-white shadow-blue-200 shadow-lg' 
              : 'bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600'
            }
          `}
          aria-label={isPlaying ? "Pause" : "Play segment"}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-5 h-5 fill-current" />
          ) : (
            <Play className="w-5 h-5 fill-current ml-0.5" />
          )}
        </button>
      </div>
      
      {isPlaying && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-xl" />
      )}
    </div>
  );
};
