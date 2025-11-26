import React, { useState, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { SegmentCard } from './components/SegmentCard';
import { analyzeText, generateSpeech } from './services/geminiService';
import { SegmentResponse, TextSegment, PlaybackState } from './types';
import { Sparkles, Loader2, PlayCircle, StopCircle, Trash2, Mic2, Globe2, Copy, Check } from 'lucide-react';

const SAMPLE_TEXT = `Reading is essential for those who seek to rise above the ordinary. We must not permit our minds to become lazy. Knowledge is power.`;

const VOICES = [
  { name: 'Kore', label: 'Kore (Female, Balanced)' },
  { name: 'Puck', label: 'Puck (Male, Natural)' },
  { name: 'Charon', label: 'Charon (Male, Deep)' },
  { name: 'Fenrir', label: 'Fenrir (Male, Energetic)' },
  { name: 'Zephyr', label: 'Zephyr (Female, Soft)' },
];

const LANGUAGES = [
  { name: 'Chinese (Simplified)', label: 'Chinese (Simplified)' },
  { name: 'Chinese (Traditional)', label: 'Chinese (Traditional)' },
  { name: 'Spanish', label: 'Spanish' },
  { name: 'French', label: 'French' },
  { name: 'German', label: 'German' },
  { name: 'Japanese', label: 'Japanese' },
  { name: 'Korean', label: 'Korean' },
  { name: 'Portuguese', label: 'Portuguese' },
  { name: 'Russian', label: 'Russian' },
  { name: 'Italian', label: 'Italian' },
];

// Helper: Decode Base64 to Uint8Array
function decodeBase64(base64: string) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper: Convert PCM (Int16) to AudioBuffer
// Gemini Flash TTS typically returns 24kHz mono PCM 16-bit
async function decodeAudioData(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
  const sampleRate = 24000;
  const numChannels = 1;
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
    // Convert 16-bit int to float [-1, 1]
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}

const App: React.FC = () => {
  const [inputText, setInputText] = useState<string>("");
  const [segments, setSegments] = useState<TextSegment[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>(PlaybackState.IDLE);
  const [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null);
  
  const [selectedVoice, setSelectedVoice] = useState<string>('Kore');
  const [targetLanguage, setTargetLanguage] = useState<string>('Chinese (Simplified)');
  const [isCopied, setIsCopied] = useState(false);
  
  // Cache audio base64 strings (PCM data) to avoid re-fetching
  const [audioCache, setAudioCache] = useState<Record<string, string>>({});

  // Audio Context Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Stop playback safely
  const stopPlayback = () => {
    if (activeSourceRef.current) {
      try {
        // Remove onended to prevent triggering next segment logic
        activeSourceRef.current.onended = null;
        activeSourceRef.current.stop();
      } catch (e) {
        // Ignore errors if already stopped
      }
      activeSourceRef.current = null;
    }
    setPlayingSegmentId(null);
    setPlaybackState(PlaybackState.IDLE);
  };

  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });
    }
    // Resume if suspended (browser policy)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const playPcmData = async (base64Data: string, onEnded: () => void) => {
    const ctx = initAudioContext();
    
    // Stop any currently playing audio
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.onended = null;
        activeSourceRef.current.stop();
      } catch (e) {}
    }

    try {
      const bytes = decodeBase64(base64Data);
      const buffer = await decodeAudioData(bytes, ctx);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      
      source.onended = () => {
        activeSourceRef.current = null;
        onEnded();
      };
      
      activeSourceRef.current = source;
      source.start();
    } catch (err) {
      console.error("Error decoding or playing PCM:", err);
      onEnded(); // Skip if error
    }
  };

  const handleProcess = async () => {
    if (!inputText.trim()) return;
    
    // Stop any existing playback
    stopPlayback();
    
    setIsProcessing(true);
    setSegments([]);
    setAudioCache({}); // Clear cache for new text
    
    try {
      const result: SegmentResponse = await analyzeText(inputText, targetLanguage);
      setSegments(result.segments);
    } catch (error) {
      console.error(error);
      alert("Failed to process text. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const playSegment = async (segment: TextSegment, autoPlayNext: boolean = false) => {
    setPlayingSegmentId(segment.id);

    try {
      // Check cache first
      let pcmBase64 = audioCache[segment.id];

      // If not in cache, fetch it
      if (!pcmBase64) {
        setPlaybackState(PlaybackState.LOADING_AUDIO);
        pcmBase64 = await generateSpeech(segment.original, selectedVoice);
        
        // Update cache
        setAudioCache(prev => ({
          ...prev,
          [segment.id]: pcmBase64
        }));
      }

      setPlaybackState(PlaybackState.PLAYING);
      
      // Play the PCM data
      await playPcmData(pcmBase64, () => {
        // On Ended
        if (autoPlayNext) {
          playNextSegment(segment.id);
        } else {
          setPlayingSegmentId(null);
          setPlaybackState(PlaybackState.IDLE);
        }
      });
      
    } catch (error) {
      console.error("Audio playback error", error);
      setPlaybackState(PlaybackState.IDLE);
      setPlayingSegmentId(null);
    }
  };

  const playNextSegment = (currentId: string) => {
    const currentIndex = segments.findIndex(s => s.id === currentId);
    if (currentIndex >= 0 && currentIndex < segments.length - 1) {
      const nextSegment = segments[currentIndex + 1];
      playSegment(nextSegment, true);
    } else {
      setPlaybackState(PlaybackState.IDLE);
      setPlayingSegmentId(null);
    }
  };

  const handlePlayPause = (segment: TextSegment) => {
    // If clicking the currently playing segment, stop it
    if (playingSegmentId === segment.id && playbackState === PlaybackState.PLAYING) {
      stopPlayback();
    } else {
      // Play specific segment (do not auto-play next unless using "Play All")
      playSegment(segment, false);
    }
  };

  const handlePlayAll = () => {
    if (segments.length > 0) {
      // Start from the first one, enabling auto-play-next chain
      playSegment(segments[0], true);
    }
  };

  const handleClear = () => {
    stopPlayback();
    setInputText("");
    setSegments([]);
    setAudioCache({});
  };

  const handleCopy = () => {
    if (segments.length === 0) return;
    
    const textToCopy = segments.map(s => `${s.original}\n${s.translation}`).join('\n\n');
    navigator.clipboard.writeText(textToCopy).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  // When voice changes, we should probably clear cache so we don't play old voice
  useEffect(() => {
    setAudioCache({});
    stopPlayback();
  }, [selectedVoice]);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <Header />

        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 overflow-hidden border border-slate-100">
          <div className="p-6 space-y-4">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste or type the text you want to learn here..."
              className="w-full min-h-[160px] p-4 text-lg bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y transition-shadow placeholder:text-slate-400 text-slate-800"
            />
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-2">
               <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                 {inputText ? (
                    <button 
                      onClick={handleClear}
                      className="text-slate-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-slate-100"
                      title="Clear text"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                 ) : (
                   <button
                    onClick={() => setInputText(SAMPLE_TEXT)}
                    className="text-sm text-blue-600 hover:underline px-2 py-2 whitespace-nowrap"
                   >
                     Try Sample Text
                   </button>
                 )}
                 
                 {/* Language Selector */}
                 <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 hover:border-slate-300 transition-colors">
                    <Globe2 className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
                    <select 
                      value={targetLanguage}
                      onChange={(e) => setTargetLanguage(e.target.value)}
                      className="bg-transparent border-none outline-none text-sm text-slate-700 w-[140px] appearance-none cursor-pointer truncate"
                      title="Translation Language"
                    >
                      {LANGUAGES.map(lang => (
                        <option key={lang.name} value={lang.name}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                 </div>

                 {/* Voice Selector */}
                 <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 hover:border-slate-300 transition-colors">
                    <Mic2 className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
                    <select 
                      value={selectedVoice}
                      onChange={(e) => setSelectedVoice(e.target.value)}
                      className="bg-transparent border-none outline-none text-sm text-slate-700 w-[140px] appearance-none cursor-pointer truncate"
                      title="Voice"
                    >
                      {VOICES.map(voice => (
                        <option key={voice.name} value={voice.name}>
                          {voice.label}
                        </option>
                      ))}
                    </select>
                 </div>
               </div>

              <button
                onClick={handleProcess}
                disabled={isProcessing || !inputText.trim()}
                className={`
                  w-full md:w-auto flex items-center justify-center space-x-2 px-8 py-3 rounded-lg font-semibold text-white shadow-lg shadow-blue-200 transition-all transform active:scale-95 flex-shrink-0
                  ${isProcessing || !inputText.trim()
                    ? 'bg-slate-300 cursor-not-allowed shadow-none' 
                    : 'bg-blue-500 hover:bg-blue-600 hover:shadow-blue-300'
                  }
                `}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Start Analysis</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Results Section */}
        {segments.length > 0 && (
          <div className="mt-8 animate-fade-in-up">
            <div className="flex items-center justify-between mb-6 px-2">
               <h2 className="text-slate-400 text-sm font-medium uppercase tracking-wider">
                 {segments.length} Segments • {targetLanguage}
               </h2>
               <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center space-x-1.5 px-4 py-2 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors text-sm font-medium border border-slate-200"
                    title="Copy all content"
                  >
                    {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{isCopied ? 'Copied!' : 'Copy'}</span>
                  </button>

                 {playingSegmentId && playbackState !== PlaybackState.IDLE ? (
                   <button 
                    onClick={stopPlayback}
                    className="flex items-center space-x-1.5 px-4 py-2 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-sm font-medium border border-red-100"
                   >
                     <StopCircle className="w-4 h-4" />
                     <span>Stop</span>
                   </button>
                 ) : (
                   <button 
                    onClick={handlePlayAll}
                    className="flex items-center space-x-1.5 px-4 py-2 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-sm font-medium border border-blue-100"
                   >
                     <PlayCircle className="w-4 h-4" />
                     <span>Read All</span>
                   </button>
                 )}
               </div>
            </div>

            <div className="space-y-4">
              {segments.map((segment) => (
                <SegmentCard
                  key={segment.id}
                  segment={segment}
                  isPlaying={playingSegmentId === segment.id}
                  isLoading={playingSegmentId === segment.id && playbackState === PlaybackState.LOADING_AUDIO}
                  onClickPlay={() => handlePlayPause(segment)}
                  onClickPause={() => handlePlayPause(segment)}
                />
              ))}
            </div>
            
            <div className="mt-12 text-center text-slate-400 text-sm pb-8">
              <p>Click play on any card to listen to individual segments.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;