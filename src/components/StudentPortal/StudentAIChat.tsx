import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Send,
  Heart,
  ShieldAlert,
  PhoneCall,
  AlertTriangle,
  CheckCircle2,
  X,
  Info,
  Plus,
  MessageSquare,
} from 'lucide-react';
import { MOOD_DEFINITIONS, SITUATION_LABELS } from '../../types';

interface StudentAIChatProps {
  onOpenBreathing: () => void;
}

const MAX_MESSAGE_LENGTH = 600;

const QUICK_CHIPS = [
  { label: '🎉 今天發生了好開心的事！', text: '心心，我今天考試考了一百分，超級開心的！' },
  { label: '💬 想隨便找人聊聊天', text: '心心，我今天下課跟朋友玩躲避球，差點接到超難的球，你想聽嗎？' },
  { label: '📚 作業好多有點不想寫', text: '心心，今天的國語跟數學作業好多喔，寫到有點煩，不想寫了...' },
  { label: '😢 和同學吵架心裡悶悶的', text: '心心，我今天和好朋友吵架了，他都不理我，我覺得有點難過。' },
  { label: '🌬️ 請帶我做一次深呼吸', text: '心心，我覺得心裡有點緊緊的，你可以陪我做深呼吸嗎？' },
];

export const StudentAIChat: React.FC<StudentAIChatProps> = ({ onOpenBreathing }) => {
  const {
    currentUser,
    chatSessions,
    activeSessionId,
    chatHistory,
    sendChatMessage,
    startNewChatSession,
    selectChatSession,
    isAiTyping,
    moodLogs,
    todayDate,
    lastChatError,
    clearChatError,
  } = useApp();
  const [inputText, setInputText] = useState('');
  const [showCrisisHelp, setShowCrisisHelp] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const todayLog = currentUser
    ? moodLogs.find((l) => l.studentId === currentUser.id && l.date === todayDate)
    : undefined;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isAiTyping]);

  if (!currentUser) return null;

  const handleSend = async (textToSend?: string) => {
    const raw = textToSend ?? inputText;
    const trimmed = raw.trim();
    if (!trimmed || isAiTyping || trimmed.length > MAX_MESSAGE_LENGTH) return;

    if (!textToSend) {
      setInputText('');
    }
    clearChatError();
    await sendChatMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isOverLimit = inputText.length > MAX_MESSAGE_LENGTH;

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-teal-100 flex flex-col h-[680px] overflow-hidden">
      {/* Chatroom Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-sky-500/10 border-b border-teal-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-400 to-emerald-400 flex items-center justify-center text-2xl shadow-md shadow-teal-500/20">
              🌱
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-white" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-slate-800 text-base">心心 AI 聊天夥伴</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                自然對話生成式 AI
              </span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              隨時聽你分享日常與心情
              {todayLog && (
                <span className="ml-1 px-1.5 py-0.5 rounded bg-white border border-teal-100 text-[10px] text-teal-700 font-semibold">
                  今日自評：{MOOD_DEFINITIONS[todayLog.mood].emoji} {MOOD_DEFINITIONS[todayLog.mood].label}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Safety & Breathing actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isAiTyping || chatHistory.length === 0}
            onClick={() => startNewChatSession()}
            title="開啟一個全新的獨立對話，不混用先前話題紀錄"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 disabled:opacity-40 text-teal-800 rounded-xl text-xs font-bold border border-teal-200 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-teal-600" />
            <span>新對話</span>
          </button>
          <button
            type="button"
            onClick={onOpenBreathing}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded-xl text-xs font-bold border border-sky-200 transition-colors"
          >
            <Heart className="w-3.5 h-3.5 text-sky-500" /> 放鬆深呼吸
          </button>
          <button
            type="button"
            onClick={() => setShowCrisisHelp(!showCrisisHelp)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold border border-rose-200 transition-colors"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            <span className="hidden sm:inline">求助專線與資源</span>
            <span className="sm:hidden">求助</span>
          </button>
        </div>
      </div>

      {/* Session Switcher Strip (isolated per student & session, restored from Firebase) */}
      {(() => {
        const mySessions = chatSessions.filter((s) => s.studentId === currentUser.id);
        if (mySessions.length === 0) return null;
        const activeInList = mySessions.some((s) => s.id === activeSessionId);
        return (
          <div className="px-6 py-2 bg-slate-50/90 border-b border-slate-200/70 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span className="font-bold text-slate-600 shrink-0">目前對話紀錄：</span>
              <select
                value={activeSessionId || mySessions[0].id}
                onChange={(e) => selectChatSession(e.target.value)}
                disabled={isAiTyping}
                className="max-w-[240px] sm:max-w-xs px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium text-xs focus:outline-none focus:border-teal-500 truncate"
              >
                {!activeInList && activeSessionId && (
                  <option value={activeSessionId}>（新對話｜尚未傳送訊息）</option>
                )}
                {mySessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}（{s.updatedAt.slice(5, 16)}）
                  </option>
                ))}
              </select>
            </div>
            <span className="text-[11px] text-slate-500">
              已同步雲端上下文記憶（共 {chatHistory.length} 則訊息）
            </span>
          </div>
        );
      })()}

      {/* School Privacy & Care Policy Disclosure Banner */}
      <div className="px-6 py-2 bg-amber-50/80 border-b border-amber-200/80 text-[11px] text-amber-900 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 leading-snug">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>校園關懷與隱私告知：</strong>
            為維護校園安全與提供協助，依學校輔導政策，經授權之責任導師可查閱你的對話紀錄，這裡並非完全保密喔！
          </span>
        </div>
      </div>

      {/* Optional Crisis Support Card */}
      {showCrisisHelp && (
        <div className="px-6 py-3 bg-rose-50/90 border-b border-rose-200 text-xs text-rose-900">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="font-bold flex items-center gap-1 text-rose-800">
                <PhoneCall className="w-4 h-4 text-rose-600" /> 緊急安全與安心求助資源：
              </p>
              <p>• 立即向身邊的班導師、學務處、保健室或輔導室（分機 213、215）求助</p>
              <p>
                • 緊急報案／救護：<strong>110</strong>（警察局）／ <strong>119</strong>（救護車）／{' '}
                <strong>113</strong>（24小時保護專線）
              </p>
              <p>
                • 衛福部 24 小時安心專線：直撥 <strong>1925</strong> · 兒福聯盟諮詢：<strong>0800-003-123</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCrisisHelp(false)}
              className="text-rose-500 hover:text-rose-700 font-bold ml-2 text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Explicit Service Error Banner (never masks errors as AI replies) */}
      {lastChatError && (
        <div className="px-5 py-2.5 bg-rose-50 border-b border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{lastChatError}</span>
          </div>
          <button
            type="button"
            onClick={clearChatError}
            className="p-1 text-rose-500 hover:text-rose-700 rounded-lg"
            title="關閉通知"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/40">
        {chatHistory.length === 0 && (
          <div className="text-center py-10 px-4">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-teal-100/70 flex items-center justify-center text-3xl">
              🌱
            </div>
            <h4 className="font-bold text-slate-700 text-sm">
              嗨，{currentUser.name}！我是「心心」
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
              不管今天發生了開心的事、無聊的小事，或是有什麼煩惱想聊聊，都可以直接跟我說喔！
            </p>
          </div>
        )}

        {chatHistory.map((msg) => {
          const isStudent = msg.sender === 'student';
          const isErrorNotice = msg.aiStatus === 'error_notice';
          const isSafetyFallback = msg.aiStatus === 'safety_fallback';
          const isHighRisk =
            msg.riskLevel === 'elevated' || msg.riskLevel === 'critical' || isSafetyFallback;
          const detectedMeta = msg.modelDetectedEmotion
            ? MOOD_DEFINITIONS[msg.modelDetectedEmotion]
            : null;
          const situationLabel = msg.situationCategory
            ? SITUATION_LABELS[msg.situationCategory]
            : null;

          if (!isStudent && isErrorNotice) {
            return (
              <div key={msg.id} className="flex justify-center">
                <div className="max-w-lg w-full bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-xs text-amber-900 shadow-2xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800 mb-1">
                    <Info className="w-3.5 h-3.5 text-amber-600" />
                    系統服務通知（非心心 AI 生成）
                    <span className="ml-auto font-mono text-[10px] text-amber-600">{msg.timestamp}</span>
                  </div>
                  <p className="leading-relaxed">{msg.text}</p>
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="space-y-2">
              <div className={`flex items-end gap-2.5 ${isStudent ? 'justify-end' : 'justify-start'}`}>
                {!isStudent && (
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center text-base shadow-xs text-white shrink-0 ${
                      isHighRisk
                        ? 'bg-gradient-to-tr from-rose-500 to-amber-500'
                        : 'bg-gradient-to-tr from-teal-400 to-emerald-400'
                    }`}
                  >
                    {isHighRisk ? '🛡️' : '🌱'}
                  </div>
                )}

                <div
                  className={`max-w-[82%] sm:max-w-md px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    isStudent
                      ? 'bg-teal-600 text-white rounded-br-xs shadow-xs shadow-teal-600/10 font-medium'
                      : isSafetyFallback
                      ? 'bg-rose-50 text-rose-950 rounded-bl-xs shadow-xs border-2 border-rose-300'
                      : isHighRisk
                      ? 'bg-white text-slate-800 rounded-bl-xs shadow-xs border-2 border-rose-200'
                      : 'bg-white text-slate-800 rounded-bl-xs shadow-xs border border-slate-200/80'
                  }`}
                >
                  {!isStudent && isSafetyFallback && (
                    <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-rose-200 text-[11px] font-bold text-rose-800">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>系統安全防護提示（非心心 AI 生成回覆）</span>
                    </div>
                  )}

                  {!isStudent && (situationLabel || detectedMeta) && (
                    <div className="flex flex-wrap items-center gap-1.5 mb-2 pb-1.5 border-b border-slate-100">
                      {situationLabel && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          {situationLabel}
                        </span>
                      )}
                      {detectedMeta && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${detectedMeta.bgLight} ${detectedMeta.textColor}`}
                        >
                          {detectedMeta.emoji} 對話語氣：{detectedMeta.label}
                        </span>
                      )}
                    </div>
                  )}

                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  <div
                    className={`text-[10px] mt-1.5 flex items-center justify-end gap-2 ${
                      isStudent ? 'text-teal-200' : 'text-slate-400'
                    }`}
                  >
                    <span>{msg.timestamp}</span>
                  </div>
                </div>

                {isStudent && (
                  <div className="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center text-base shrink-0">
                    {currentUser.avatar}
                  </div>
                )}
              </div>

              {/* Emergency Safety Card & Truthful Teacher Notification Status for Elevated/Critical messages */}
              {!isStudent && isHighRisk && (
                <div className="ml-10 max-w-md rounded-2xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-950 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-rose-800 flex items-center gap-1.5">
                      <PhoneCall className="w-3.5 h-3.5 text-rose-600" />
                      安全提醒與即時求助專線
                    </span>
                    {msg.teacherNotified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                        <CheckCircle2 className="w-3 h-3" /> 已寫入教師緊急預警通報
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold">
                        <AlertTriangle className="w-3 h-3" /> 尚未自動送達，請立即親自向現場師長求助
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed text-rose-900">
                    請先確認你和身邊的人是否安全、有沒有受傷；若需要協助請馬上告訴現場的班導師、輔導老師、家長，或撥打{' '}
                    <strong>110 / 119 / 113 / 1925</strong>。
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {/* AI Typing Indicator */}
        {isAiTyping && (
          <div className="flex items-end gap-2.5 justify-start">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-400 to-emerald-400 flex items-center justify-center text-base shadow-xs text-white shrink-0">
              🌱
            </div>
            <div className="bg-white border border-slate-200/80 rounded-2xl rounded-bl-xs px-4 py-3 shadow-xs flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">心心正在閱讀並回覆中...</span>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Question Chips */}
      <div className="px-4 py-2 bg-slate-50/80 border-t border-slate-100 overflow-x-auto flex gap-2 no-scrollbar">
        {QUICK_CHIPS.map((chip, idx) => (
          <button
            key={idx}
            type="button"
            disabled={isAiTyping}
            onClick={() => handleSend(chip.text)}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-800 border border-slate-200 hover:border-teal-300 text-xs font-medium transition-colors shadow-2xs disabled:opacity-50"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Input Form with Character Cap */}
      <div className="p-3 sm:p-4 bg-white border-t border-teal-100 space-y-1.5">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            maxLength={MAX_MESSAGE_LENGTH}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="把你想對心心說的話打在這裡喔（最多 600 字）..."
            disabled={isAiTyping}
            className="flex-1 px-4 py-3 bg-slate-100/80 rounded-2xl border border-transparent focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!inputText.trim() || isAiTyping || isOverLimit}
            className="p-3 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white shadow-md shadow-teal-600/20 transition-all hover:scale-105"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center justify-between px-1 text-[10px]">
          <span className="text-slate-400">
            支援自然對話與上下文記憶，放心表達你的想法
          </span>
          <span className={inputText.length >= MAX_MESSAGE_LENGTH - 50 ? 'text-amber-600 font-bold' : 'text-slate-400'}>
            {inputText.length} / {MAX_MESSAGE_LENGTH} 字
          </span>
        </div>
      </div>
    </div>
  );
};
