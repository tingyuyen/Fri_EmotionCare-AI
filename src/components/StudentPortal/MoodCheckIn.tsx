import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { MoodType, MOOD_DEFINITIONS } from '../../types';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  CheckCircle2,
  Heart,
  MessageSquare,
  Sun,
  CloudRain,
  CloudSun,
  Zap,
  ArrowRight,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';

const CONTEXT_TAGS = [
  '課業學習 📚',
  '好朋友相處 🤝',
  '家庭生活 🏡',
  '身體健康 🍎',
  '體育運動 ⚽',
  '考試測驗 📝',
  '營養午餐 🍱',
  '睡眠不足 💤',
  '被稱讚了 ⭐',
];

interface MoodCheckInProps {
  onGoToChat: () => void;
  onOpenBreathing: () => void;
}

export const MoodCheckIn: React.FC<MoodCheckInProps> = ({ onGoToChat, onOpenBreathing }) => {
  const { currentUser, moodLogs, todayDate, addMoodLog } = useApp();

  const todayLog = currentUser
    ? moodLogs.find((l) => l.studentId === currentUser.id && l.date === todayDate)
    : undefined;

  const [selectedMood, setSelectedMood] = useState<MoodType>(todayLog?.mood || 'happy');
  const [score, setScore] = useState<number>(todayLog?.score || 4);
  const [selectedTags, setSelectedTags] = useState<string[]>(todayLog?.tags || ['課業學習 📚']);
  const [note, setNote] = useState<string>(todayLog?.note || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(!todayLog);

  // Sync form when todayLog loads asynchronously from Firestore
  useEffect(() => {
    if (todayLog) {
      setSelectedMood(todayLog.mood);
      setScore(todayLog.score);
      setSelectedTags(todayLog.tags || []);
      setNote(todayLog.note || '');
      setIsEditing(false);
    } else {
      setIsEditing(true);
    }
  }, [todayLog?.id, todayLog?.updatedAt]);

  if (!currentUser) return null;

  const handleTagToggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      if (selectedTags.length < 4) {
        setSelectedTags([...selectedTags, tag]);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await addMoodLog(selectedMood, score, selectedTags, note);

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#0d9488', '#10b981', '#38bdf8', '#fbbf24', '#f472b6'],
      });

      setIsEditing(false);
    } catch (err: any) {
      console.error(err);
      setSubmitError(err?.message || '儲存心情紀錄時發生錯誤，請確認網路或重新登入後再試一次。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getThermometerLabel = (s: number) => {
    switch (s) {
      case 1:
        return { label: '雷雨大風暴 (心裡非常難受)', icon: <Zap className="w-4 h-4 text-rose-500" /> };
      case 2:
        return { label: '烏雲微雨 (心情低落沮喪)', icon: <CloudRain className="w-4 h-4 text-indigo-500" /> };
      case 3:
        return { label: '多雲微陰 (普普通通平平)', icon: <CloudSun className="w-4 h-4 text-sky-500" /> };
      case 4:
        return { label: '晴朗微風 (覺得挺不錯的)', icon: <Sun className="w-4 h-4 text-emerald-500" /> };
      case 5:
        return { label: '燦爛大晴天 (超級開心有活力)', icon: <Sun className="w-4 h-4 text-amber-500" /> };
      default:
        return { label: '', icon: null };
    }
  };

  if (todayLog && !isEditing) {
    const meta = MOOD_DEFINITIONS[todayLog.mood];
    return (
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-teal-100/80">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-3xl mb-4 shadow-sm animate-bounce">
            {meta.emoji}
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold mb-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> 今日心情簽到已完成（已同步儲存）！
          </div>
          <h2 className="text-2xl font-black text-slate-800">
            {currentUser.name}，謝謝你今天的分享！
          </h2>
          <p className="text-sm text-slate-600 mt-2">
            你今天的心情天氣是：<span className="font-bold text-teal-700">{meta.label}</span>（溫度指數：{todayLog.score}/5 分）
          </p>

          {todayLog.tags.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {todayLog.tags.map((t) => (
                <span
                  key={t}
                  className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium border border-slate-200"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {todayLog.note && (
            <div className="mt-4 p-4 rounded-2xl bg-teal-50/60 border border-teal-100 text-slate-700 text-sm italic text-left max-w-lg mx-auto">
              <span className="font-bold not-italic text-xs text-teal-700 block mb-1">
                💬 今日的心情小筆記：
              </span>
              「{todayLog.note}」
            </div>
          )}

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onGoToChat}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-bold text-sm shadow-md shadow-teal-500/20 transition-all hover:scale-[1.02]"
            >
              <MessageSquare className="w-4 h-4" />
              跟心心聊聊
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onOpenBreathing}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-sky-50 hover:bg-sky-100 text-sky-800 font-semibold text-sm border border-sky-200 transition-colors"
            >
              <Heart className="w-4 h-4 text-sky-500" />
              做個深呼吸舒緩操
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl text-slate-500 hover:text-slate-700 text-xs font-medium hover:bg-slate-100 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重新修改簽到
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-teal-100/80">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-800 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" /> 每日校園晨間心情問候
          </div>
          <span className="text-xs text-slate-400 font-medium">今天是 {todayDate}</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-800 mt-2 tracking-tight">
          {currentUser.name}，今天的心情是什麼顏色呢？
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          點選最符合你現在感覺的心情小怪獸，不管是開心、生氣或難過，所有的感受都很珍貴喔！
        </p>
      </div>

      {submitError && (
        <div className="mb-6 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-3">
            第一步：選一個你現在的心情卡片 ✨
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {(Object.keys(MOOD_DEFINITIONS) as MoodType[]).map((type) => {
              const meta = MOOD_DEFINITIONS[type];
              const isSelected = selectedMood === type;
              return (
                <button
                  type="button"
                  key={type}
                  onClick={() => setSelectedMood(type)}
                  className={`flex flex-col items-center text-center p-4 rounded-2xl border-2 transition-all duration-200 ${
                    isSelected
                      ? `${meta.bgLight} ${meta.borderColor} ring-3 ring-teal-500/20 scale-105 shadow-md`
                      : 'border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-4xl sm:text-5xl mb-2 filter drop-shadow-sm select-none">
                    {meta.emoji}
                  </span>
                  <span className={`text-sm font-black ${isSelected ? meta.textColor : 'text-slate-700'}`}>
                    {meta.label}
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {meta.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              第二步：量量看你的心情溫度計 🌡️
            </label>
            <div className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-white border border-slate-200 shadow-2xs">
              {getThermometerLabel(score).icon}
              <span className="text-slate-700">
                {score} 分 - {getThermometerLabel(score).label}
              </span>
            </div>
          </div>
          <div className="relative pt-2 pb-1">
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
            />
            <div className="flex justify-between text-[11px] font-bold text-slate-400 mt-2 px-1">
              <span>1 (很低落)</span>
              <span>2 (有點悶)</span>
              <span>3 (平靜)</span>
              <span>4 (挺開心)</span>
              <span>5 (超級棒！)</span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            第三步：這份心情跟什麼事情有關呢？（最多選 4 個標籤）🏷️
          </label>
          <div className="flex flex-wrap gap-2">
            {CONTEXT_TAGS.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  type="button"
                  key={tag}
                  onClick={() => handleTagToggle(tag)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    active
                      ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-teal-200 hover:bg-teal-50/50'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            第四步：心情悄悄話小日記（選填，想寫就寫喔）✏️
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例如：今天考試考得不錯很開心、或是剛才在走廊跌倒膝蓋有點痛..."
            rows={3}
            maxLength={300}
            className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm text-slate-800 placeholder-slate-400 resize-none transition-all"
          />
          <div className="text-right text-[11px] text-slate-400 mt-1">{note.length} / 300 字</div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          {todayLog && (
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              取消修改
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-extrabold text-sm shadow-md shadow-teal-500/20 hover:shadow-lg hover:shadow-teal-500/30 transition-all hover:scale-[1.02] disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <span>雲端同步紀錄中...</span>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>完成今日心情簽到！</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
