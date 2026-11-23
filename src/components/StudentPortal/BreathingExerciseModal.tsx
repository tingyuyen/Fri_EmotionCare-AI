import React, { useState, useEffect } from 'react';
import { X, Wind, Heart, Sparkles, Play, Pause } from 'lucide-react';

interface BreathingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Phase = 'inhale' | 'hold' | 'exhale';

export const BreathingExerciseModal: React.FC<BreathingModalProps> = ({ isOpen, onClose }) => {
  const [phase, setPhase] = useState<Phase>('inhale');
  const [countdown, setCountdown] = useState<number>(4);
  const [cycle, setCycle] = useState<number>(1);
  const [isActive, setIsActive] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen || !isActive) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev > 1) return prev - 1;

        // Transition between phases
        if (phase === 'inhale') {
          setPhase('hold');
          return 4;
        } else if (phase === 'hold') {
          setPhase('exhale');
          return 6;
        } else {
          setPhase('inhale');
          setCycle((c) => c + 1);
          return 4;
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, isActive, phase]);

  if (!isOpen) return null;

  const phaseConfig = {
    inhale: {
      title: '深深吸氣 🌸',
      subtitle: '像聞一朵好香的花，肚子慢慢鼓起來～',
      scale: 'scale-125',
      color: 'from-teal-400 to-emerald-300',
      glow: 'shadow-teal-400/40',
    },
    hold: {
      title: '屏住呼吸 💖',
      subtitle: '給自己一個溫柔的安靜擁抱，數 4 秒',
      scale: 'scale-110',
      color: 'from-sky-400 to-indigo-300',
      glow: 'shadow-sky-400/40',
    },
    exhale: {
      title: '緩緩吐氣 🌬️',
      subtitle: '像輕輕吹走一朵蒲公英，把煩惱通通吹走～',
      scale: 'scale-90',
      color: 'from-amber-300 to-rose-300',
      glow: 'shadow-amber-400/40',
    },
  };

  const current = phaseConfig[phase];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-teal-100 text-center overflow-hidden">
        {/* Soft decorative background circles */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-teal-100 rounded-full blur-2xl opacity-60 pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-emerald-100 rounded-full blur-2xl opacity-60 pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" /> 4-4-6 溫和深呼吸舒緩操
          </div>
          <h3 className="text-xl font-extrabold text-slate-800">讓小腦袋與心跳放鬆一下</h3>
          <p className="text-xs text-slate-500 mt-1">完成了 {cycle} 次放鬆循環</p>
        </div>

        {/* Dynamic Expanding/Contracting Breathing Circle */}
        <div className="h-64 flex items-center justify-center relative">
          {/* Outer Pulse Rings */}
          <div
            className={`w-48 h-48 rounded-full bg-gradient-to-tr ${current.color} opacity-20 blur-xl transition-all duration-1000 ${current.scale}`}
          />

          {/* Central Ball */}
          <div
            className={`absolute w-40 h-40 rounded-full bg-gradient-to-tr ${current.color} shadow-2xl ${current.glow} flex flex-col items-center justify-center text-white font-extrabold transition-all duration-1000 ease-in-out ${current.scale}`}
          >
            <Wind className="w-8 h-8 mb-1 animate-pulse" />
            <span className="text-4xl font-black">{countdown}</span>
            <span className="text-xs font-medium tracking-widest uppercase opacity-90">秒</span>
          </div>
        </div>

        {/* Subtitle instructions */}
        <div className="mt-4 mb-6">
          <h4 className="text-lg font-bold text-slate-800 transition-all">{current.title}</h4>
          <p className="text-sm text-slate-600 mt-1">{current.subtitle}</p>
        </div>

        {/* Bottom Control Controls */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setIsActive(!isActive)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
          >
            {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isActive ? '暫停' : '繼續'}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-500/20 transition-all"
          >
            我感覺平靜多了
          </button>
        </div>
      </div>
    </div>
  );
};
