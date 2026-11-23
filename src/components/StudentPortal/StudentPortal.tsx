import React, { useState } from 'react';
import { MoodCheckIn } from './MoodCheckIn';
import { StudentAIChat } from './StudentAIChat';
import { StudentHistory } from './StudentHistory';
import { BreathingExerciseModal } from './BreathingExerciseModal';
import { ParentConsentModal } from './ParentConsentModal';
import { Heart, MessageSquare, Sparkles, Calendar, Wind, FileCheck } from 'lucide-react';

export const StudentPortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'checkin' | 'chat' | 'history'>('checkin');
  const [isBreathingOpen, setIsBreathingOpen] = useState(false);
  const [isConsentOpen, setIsConsentOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Top Tab Bar & Calming Breathing Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white/80 backdrop-blur-md p-2 rounded-2xl border border-teal-100 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('checkin')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
              activeTab === 'checkin'
                ? 'bg-teal-600 text-white shadow-xs shadow-teal-600/20'
                : 'text-slate-600 hover:text-teal-700 hover:bg-teal-50/60'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            今日心情簽到
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
              activeTab === 'chat'
                ? 'bg-teal-600 text-white shadow-xs shadow-teal-600/20'
                : 'text-slate-600 hover:text-teal-700 hover:bg-teal-50/60'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            AI 心靈夥伴 (心心)
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
              activeTab === 'history'
                ? 'bg-teal-600 text-white shadow-xs shadow-teal-600/20'
                : 'text-slate-600 hover:text-teal-700 hover:bg-teal-50/60'
            }`}
          >
            <Calendar className="w-4 h-4" />
            我的心情紀錄
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Privacy & Guardian Consent Link */}
          <button
            onClick={() => setIsConsentOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors border border-slate-200"
            title="查看學生與監護人隱私告知同意書"
          >
            <FileCheck className="w-3.5 h-3.5 text-teal-600" />
            <span className="hidden md:inline">隱私告知同意書</span>
            <span className="md:hidden">同意書</span>
          </button>

          {/* Breathing relaxation tool button */}
          <button
            onClick={() => setIsBreathingOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-400 to-teal-400 hover:from-sky-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-xs transition-all hover:scale-[1.02]"
          >
            <Wind className="w-4 h-4 animate-spin [animation-duration:8s]" />
            <span>吸氣吐氣放鬆操</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div>
        {activeTab === 'checkin' && (
          <MoodCheckIn
            onGoToChat={() => setActiveTab('chat')}
            onOpenBreathing={() => setIsBreathingOpen(true)}
          />
        )}
        {activeTab === 'chat' && (
          <StudentAIChat onOpenBreathing={() => setIsBreathingOpen(true)} />
        )}
        {activeTab === 'history' && <StudentHistory />}
      </div>

      {/* Breathing Exercise Modal */}
      <BreathingExerciseModal
        isOpen={isBreathingOpen}
        onClose={() => setIsBreathingOpen(false)}
      />

      {/* Student & Guardian Consent Modal */}
      <ParentConsentModal
        isOpen={isConsentOpen}
        onClose={() => setIsConsentOpen(false)}
      />
    </div>
  );
};
