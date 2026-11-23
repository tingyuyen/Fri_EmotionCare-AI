import React from 'react';
import { useApp } from '../../context/AppContext';
import { User, MOOD_DEFINITIONS } from '../../types';
import { X, Calendar, PlusCircle, AlertCircle, CheckCircle, Heart, FileText } from 'lucide-react';

interface StudentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: User | null;
  onOpenCareNote: (student: User) => void;
}

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  isOpen,
  onClose,
  student,
  onOpenCareNote,
}) => {
  const { moodLogs, careNotes, todayDate } = useApp();

  if (!isOpen || !student) return null;

  const studentLogs = moodLogs.filter((l) => l.studentId === student.id);
  const studentCareNotes = careNotes.filter((c) => c.studentId === student.id);
  const todayLog = studentLogs.find((l) => l.date === todayDate);

  const getAlertBadge = (level: string) => {
    switch (level) {
      case 'urgent':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            🔴 高度預警
          </span>
        );
      case 'attention':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            🟡 需加強關懷
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
            🟢 常態觀察
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-teal-100 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Student Profile Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-3xl shadow-xs">
              {student.avatar}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-extrabold text-slate-800">{student.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 font-semibold text-slate-600">
                  座號 {student.studentNumber || '01'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {student.className} · 電子信箱: {student.email}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              onClose();
              onOpenCareNote(student);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 transition-all hover:scale-[1.02]"
          >
            <PlusCircle className="w-4 h-4" /> 填寫關懷紀錄
          </button>
        </div>

        {/* Today's Mood Snapshot */}
        <div className="my-6 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
            今日心情簽到快報 ({todayDate})
          </span>
          {todayLog ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{MOOD_DEFINITIONS[todayLog.mood].emoji}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-sm">
                      {MOOD_DEFINITIONS[todayLog.mood].label}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                      情緒指數：{todayLog.score} / 5 分
                    </span>
                  </div>
                  {todayLog.note && (
                    <p className="text-xs text-slate-600 mt-1 italic">
                      「{todayLog.note}」
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {todayLog.tags.map((t) => (
                  <span
                    key={t}
                    className="text-[11px] px-2 py-0.5 bg-white border border-slate-200 rounded-md text-slate-600 font-medium"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              該生今日尚未進行心情簽到，可於早自習或第一節下課提醒填寫。
            </div>
          )}
        </div>

        {/* Teacher Care Notes Log */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-teal-600" /> 教師輔導關懷歷程 ({studentCareNotes.length})
            </h4>
          </div>

          {studentCareNotes.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              目前暫無輔導關懷紀錄
            </p>
          ) : (
            <div className="space-y-3">
              {studentCareNotes.map((note) => (
                <div
                  key={note.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white text-xs space-y-1.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getAlertBadge(note.alertLevel)}
                      <span className="font-bold text-slate-700">{note.teacherName}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">{note.createdAt}</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">
                    <strong>觀察摘要：</strong> {note.content}
                  </p>
                  {note.actionTaken && (
                    <p className="text-teal-800 bg-teal-50/60 p-2 rounded-lg border border-teal-100">
                      <strong>採取措施：</strong> {note.actionTaken}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Past 7 Days Mood Trail */}
        <div>
          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mb-3">
            <Calendar className="w-4 h-4 text-teal-600" /> 近期每日情緒走勢
          </h4>
          <div className="space-y-2">
            {studentLogs.map((log) => {
              const meta = MOOD_DEFINITIONS[log.mood];
              return (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{meta.emoji}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{log.date}</span>
                        <span className={`font-semibold ${meta.textColor}`}>{meta.label}</span>
                      </div>
                      {log.note && <p className="text-slate-500 mt-0.5 line-clamp-1">「{log.note}」</p>}
                    </div>
                  </div>
                  <span className="font-bold text-slate-600 px-2 py-0.5 rounded bg-white border border-slate-200">
                    {log.score} 分
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
