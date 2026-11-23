import React from 'react';
import { useApp } from '../../context/AppContext';
import { MOOD_DEFINITIONS } from '../../types';
import { Calendar, Sparkles, TrendingUp, Heart } from 'lucide-react';

export const StudentHistory: React.FC = () => {
  const { currentUser, moodLogs } = useApp();

  const userLogs = moodLogs.filter((l) => l.studentId === currentUser.id);

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-teal-100">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-teal-800 text-xs font-semibold mb-1">
            <Calendar className="w-3.5 h-3.5 text-teal-600" /> 心情時光步道
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-800">
            {currentUser.name} 的心情紀錄簿
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            每一天的心情都是成長的足跡，看著自己的情緒變化，越來越懂自己囉！
          </p>
        </div>
      </div>

      {userLogs.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <Heart className="w-10 h-10 mx-auto text-teal-400 mb-2" />
          <p className="text-sm font-bold text-slate-600">目前還沒有心情紀錄喔！</p>
          <p className="text-xs text-slate-400 mt-1">快去完成今天的第一次心情簽到吧 🌱</p>
        </div>
      ) : (
        <div className="space-y-4">
          {userLogs.map((log) => {
            const meta = MOOD_DEFINITIONS[log.mood];
            return (
              <div
                key={log.id}
                className="p-4 sm:p-5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-sm hover:border-teal-200 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 border ${meta.bgLight} ${meta.borderColor}`}
                  >
                    {meta.emoji}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${meta.textColor}`}>
                        {meta.label}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                        {log.score}/5 分
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        {log.date}
                      </span>
                    </div>
                    {log.note && (
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                        「{log.note}」
                      </p>
                    )}
                  </div>
                </div>

                {log.tags && log.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 sm:justify-end">
                    {log.tags.map((t) => (
                      <span
                        key={t}
                        className="px-2.5 py-1 bg-white border border-slate-200 text-slate-600 rounded-lg text-[11px] font-medium"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
