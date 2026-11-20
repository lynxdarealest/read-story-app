import React from 'react';
import {
  Play,
  Pause,
  Square,
  SkipForward,
  SkipBack,
  Volume2,
  Clock,
  Settings,
  X,
  Gauge
} from 'lucide-react';
import { ttsService, TTSState } from '../services/tts';

interface ReaderTTSBarProps {
  isOpen: boolean;
  onClose: () => void;
  chapterTitle: string;
}

export const ReaderTTSBar: React.FC<ReaderTTSBarProps> = ({
  isOpen,
  onClose,
  chapterTitle,
}) => {
  const [ttsState, setTtsState] = React.useState<TTSState>(ttsService.getState());
  const [voices, setVoices] = React.useState<SpeechSynthesisVoice[]>([]);
  const [showVoiceMenu, setShowVoiceMenu] = React.useState(false);
  const [showTimerMenu, setShowTimerMenu] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = ttsService.subscribe((state) => {
      setTtsState(state);
    });

    const updateVoices = () => {
      const v = ttsService.getAvailableVoices();
      setVoices(v);
    };

    updateVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      unsubscribe();
    };
  }, []);

  if (!isOpen) return null;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-neutral-900/95 backdrop-blur-md border border-neutral-700 shadow-2xl rounded-2xl px-4 py-2.5 flex items-center space-x-3 select-none text-xs text-neutral-200 animate-in slide-in-from-bottom duration-200">
      {/* Voice / Playing info */}
      <div className="flex items-center space-x-2 border-r border-neutral-800 pr-3 max-w-[160px] truncate">
        <Volume2 className={`w-4 h-4 shrink-0 ${ttsState.isPlaying && !ttsState.isPaused ? 'text-amber-500 animate-pulse' : 'text-neutral-400'}`} />
        <div className="min-w-0">
          <div className="font-semibold text-[11px] truncate text-neutral-200">
            {chapterTitle}
          </div>
          <div className="text-[10px] text-neutral-400 font-mono">
            Câu {ttsState.currentSentenceIndex + 1}/{ttsState.totalSentences || 1}
          </div>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center space-x-1.5">
        <button
          onClick={() => ttsService.prevSentence()}
          className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors cursor-pointer"
          title="Câu trước"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>

        {ttsState.isPlaying && !ttsState.isPaused ? (
          <button
            onClick={() => ttsService.pause()}
            className="p-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl shadow transition-colors cursor-pointer"
            title="Tạm dừng"
          >
            <Pause className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => {
              if (ttsState.isPaused) {
                ttsService.resume();
              } else {
                ttsService.play();
              }
            }}
            className="p-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl shadow transition-colors cursor-pointer"
            title="Đọc tiếp"
          >
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </button>
        )}

        <button
          onClick={() => ttsService.nextSentence()}
          className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors cursor-pointer"
          title="Câu tiếp theo"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => ttsService.stop()}
          className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
          title="Dừng hẳn"
        >
          <Square className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Speed rate pills */}
      <div className="flex items-center space-x-1 border-l border-neutral-800 pl-3">
        <Gauge className="w-3.5 h-3.5 text-neutral-500 mr-0.5" />
        {[0.75, 1.0, 1.25, 1.5].map((rate) => (
          <button
            key={rate}
            onClick={() => ttsService.setRate(rate)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
              ttsState.rate === rate
                ? 'bg-amber-600/30 text-amber-400 font-bold border border-amber-500/40'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            {rate}x
          </button>
        ))}
      </div>

      {/* Sleep Timer */}
      <div className="relative border-l border-neutral-800 pl-2">
        <button
          onClick={() => setShowTimerMenu(!showTimerMenu)}
          className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-[11px] transition-colors cursor-pointer ${
            ttsState.sleepTimerRemainingSeconds
              ? 'bg-amber-500/20 text-amber-400 font-mono font-bold'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
          title="Hẹn giờ tắt giọng đọc"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>
            {ttsState.sleepTimerRemainingSeconds
              ? formatTimer(ttsState.sleepTimerRemainingSeconds)
              : 'Hẹn giờ'}
          </span>
        </button>

        {showTimerMenu && (
          <div className="absolute bottom-full mb-2 left-0 w-36 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl py-1 text-xs z-50">
            <div className="px-3 py-1 text-[10px] uppercase font-bold text-neutral-500">
              Hẹn giờ tắt
            </div>
            {[
              { label: 'Tắt hẹn giờ', val: null },
              { label: '15 phút', val: 15 },
              { label: '30 phút', val: 30 },
              { label: '45 phút', val: 45 },
              { label: '60 phút', val: 60 },
            ].map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  ttsService.setSleepTimer(item.val);
                  setShowTimerMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 text-neutral-200"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Voice Selector */}
      <div className="relative">
        <button
          onClick={() => setShowVoiceMenu(!showVoiceMenu)}
          className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors cursor-pointer"
          title="Chọn giọng đọc"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        {showVoiceMenu && (
          <div className="absolute bottom-full mb-2 right-0 w-56 max-h-56 overflow-y-auto bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl py-1 text-xs z-50">
            <div className="px-3 py-1 text-[10px] uppercase font-bold text-neutral-500">
              Giọng đọc hệ thống
            </div>
            {voices.map((v) => {
              const isVi = v.lang.toLowerCase().startsWith('vi');
              const isSelected = v.voiceURI === ttsState.selectedVoiceURI;
              return (
                <button
                  key={v.voiceURI}
                  onClick={() => {
                    ttsService.setVoice(v.voiceURI);
                    setShowVoiceMenu(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 hover:bg-neutral-800 truncate flex items-center justify-between ${
                    isSelected ? 'text-amber-400 font-semibold' : 'text-neutral-300'
                  }`}
                >
                  <span className="truncate">{v.name}</span>
                  {isVi && (
                    <span className="text-[9px] px-1 py-0.2 bg-amber-500/20 text-amber-300 rounded font-mono ml-1">
                      VI
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={() => {
          ttsService.stop();
          onClose();
        }}
        className="p-1 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors cursor-pointer"
        title="Đóng thanh đọc"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
