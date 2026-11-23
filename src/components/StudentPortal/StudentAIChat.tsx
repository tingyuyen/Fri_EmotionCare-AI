import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Send, Sparkles, Heart, Bot, HelpCircle, ShieldAlert, PhoneCall, RefreshCw, Smile } from 'lucide-react';
import { MOOD_DEFINITIONS } from '../../types';

interface StudentAIChatProps {
  onOpenBreathing: () => void;
}

const QUICK_CHIPS = [
  { label: '😢 和同學吵架了，心裡好難過', text: '心心，我今天和好朋友因為玩遊戲吵架了，對方不理我，我心裡好難過好委屈...' },
  { label: '😰 要考數學了，心跳好快好緊張', text: '心心，等一下要考數學單元測驗，我好害怕會考不好被罵，心跳跳得好快...' },
  { label: '🌸 今天遇到了很開心的事情！', text: '心心！我今天被老師稱讚字寫得很漂亮，還拿到了熱心助人的榮譽貼紙，超開心的！' },
  { label: '🥱 上課一直打哈欠好想睡覺', text: '心心，我昨天晚上太晚睡了，現在眼睛好酸好想睡覺，提不起精神...' },
  { label: '🌬️ 請帶我做一次深呼吸練習', text: '心心，我覺得心裡有點悶悶緊緊的，你可以教我怎麼深呼吸放鬆嗎？' },
];

export const StudentAIChat: React.FC<StudentAIChatProps> = ({ onOpenBreathing }) => {
  const { currentUser, chatHistory, sendChatMessage, isAiTyping, moodLogs, todayDate } = useApp();
  const [inputText, setInputText] = useState('');
  const [showCrisisHelp, setShowCrisisHelp] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const todayLog = moodLogs.find((l) => l.studentId === currentUser.id && l.date === todayDate);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isAiTyping]);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || isAiTyping) return;

    if (!textToSend) {
      setInputText('');
    }

    await sendChatMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-teal-100 flex flex-col h-[650px] overflow-hidden">
      {/* Chatroom Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-sky-500/10 border-b border-teal-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-400 to-emerald-400 flex items-center justify-center text-2xl shadow-md shadow-teal-500/20 animate-pulse">
              🌱
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-slate-800 text-base">心心小光靈</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                AI 心靈陪伴夥伴
              </span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              隨時在線傾聽 · 溫暖陪伴守護中
            </p>
          </div>
        </div>

        {/* Safety & Breathing actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenBreathing}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded-xl text-xs font-bold border border-sky-200 transition-colors"
          >
            <Heart className="w-3.5 h-3.5 text-sky-500" /> 放鬆深呼吸
          </button>
          <button
            onClick={() => setShowCrisisHelp(!showCrisisHelp)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold border border-rose-200 transition-colors"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            <span className="hidden sm:inline">求助專線與資源</span>
            <span className="sm:hidden">求助</span>
          </button>
        </div>
      </div>

      {/* School Privacy & Care Policy Disclosure Banner (Mandatory SEL transparency) */}
      <div className="px-6 py-2 bg-amber-50/80 border-b border-amber-200/80 text-[11px] text-amber-900 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 leading-snug">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>校園關懷與隱私告知：</strong>
            為維護校園身心安全，依學校輔導政策，經授權之責任導師可查閱對話歷程以提供及時關懷與輔導協助，對話並非完全保密喔！
          </span>
        </div>
      </div>

      {/* Optional Crisis Support Card */}
      {showCrisisHelp && (
        <div className="px-6 py-3 bg-rose-50/90 border-b border-rose-200 text-xs text-rose-900 animate-in slide-in-from-top-2">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="font-bold flex items-center gap-1 text-rose-800">
                <PhoneCall className="w-4 h-4 text-rose-600" /> 校園與安心求助資源：
              </p>
              <p>• 學校專任輔導處：分機 213、215（輔導老師隨時為你敞開大門）</p>
              <p>• 衛福部 24 小時安心專線：直撥 <strong>1925</strong>（依舊愛我，免費心理諮詢）</p>
              <p>• 兒童福利聯盟諮詢專線：<strong>0800-003-123</strong></p>
            </div>
            <button
              onClick={() => setShowCrisisHelp(false)}
              className="text-rose-500 hover:text-rose-700 font-bold ml-2 text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/40">
        {/* Welcome message if empty */}
        {chatHistory.length === 0 && (
          <div className="text-center py-10 px-4">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-teal-100/70 flex items-center justify-center text-3xl">
              🌱
            </div>
            <h4 className="font-bold text-slate-700 text-sm">
              嗨，{currentUser.name}！我是你的心靈小夥伴「心心」
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              今天在學校遇到了什麼特別的事嗎？或是心裡有什麼小秘密想聊聊？心心隨時都在這裡陪著你喔！
            </p>
          </div>
        )}

        {chatHistory.map((msg) => {
          const isStudent = msg.sender === 'student';
          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2.5 ${isStudent ? 'justify-end' : 'justify-start'}`}
            >
              {!isStudent && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-400 to-emerald-400 flex items-center justify-center text-base shadow-xs text-white shrink-0">
                  🌱
                </div>
              )}
              <div
                className={`max-w-[80%] sm:max-w-md px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  isStudent
                    ? 'bg-teal-600 text-white rounded-br-xs shadow-xs shadow-teal-600/10 font-medium'
                    : 'bg-white text-slate-800 rounded-bl-xs shadow-xs border border-slate-200/80'
                }`}
              >
                {msg.text}
                <div
                  className={`text-[10px] mt-1 text-right ${
                    isStudent ? 'text-teal-200' : 'text-slate-400'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
              {isStudent && (
                <div className="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center text-base shrink-0">
                  {currentUser.avatar}
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
              <span className="text-xs text-slate-500 font-medium">心心正在溫柔想悄悄話...</span>
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

      {/* Suggested Quick Question Chips for Kids */}
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

      {/* Input Form */}
      <div className="p-3 sm:p-4 bg-white border-t border-teal-100 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="把你想對心心說的話打在這裡喔..."
          disabled={isAiTyping}
          className="flex-1 px-4 py-3 bg-slate-100/80 rounded-2xl border border-transparent focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
        />
        <button
          onClick={() => handleSend()}
          disabled={!inputText.trim() || isAiTyping}
          className="p-3 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white shadow-md shadow-teal-600/20 transition-all hover:scale-105"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
