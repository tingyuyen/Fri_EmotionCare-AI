import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User } from '../../types';
import { X, CheckCircle, AlertTriangle } from 'lucide-react';

interface CareNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: User | null;
}

export const CareNoteModal: React.FC<CareNoteModalProps> = ({ isOpen, onClose, student }) => {
  const { addCareNote, currentUser } = useApp();
  const [alertLevel, setAlertLevel] = useState<'normal' | 'attention' | 'urgent'>('attention');
  const [content, setContent] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen || !student || !currentUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSaving) return;

    setIsSaving(true);
    setSaveError(null);
    try {
      await addCareNote(student.id, alertLevel, content.trim(), actionTaken.trim() || undefined);
      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
        setContent('');
        setActionTaken('');
        onClose();
      }, 1200);
    } catch (err: any) {
      setSaveError(err?.message || '儲存關懷紀錄失敗，請確認權限或連線狀態。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-teal-100">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-2xl shadow-xs">
            {student.avatar}
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-slate-800">
              撰寫學生關懷紀錄 · {student.name}
            </h3>
            <p className="text-xs text-slate-500">
              {student.className} · 座號 {student.studentNumber || '01'} · 填寫導師：{currentUser.name}
            </p>
          </div>
        </div>

        {isSaved ? (
          <div className="py-12 text-center">
            <CheckCircle className="w-14 h-14 mx-auto text-emerald-500 mb-2 animate-bounce" />
            <h4 className="text-lg font-bold text-slate-800">關懷紀錄已確認儲存！</h4>
            <p className="text-xs text-slate-500 mt-1">輔導紀錄已同步寫入資料庫。</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {saveError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                關懷預警等級判定
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setAlertLevel('normal')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                    alertLevel === 'normal'
                      ? 'bg-sky-50 border-sky-400 text-sky-800 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  🟢 一般觀察 (常態)
                </button>
                <button
                  type="button"
                  onClick={() => setAlertLevel('attention')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                    alertLevel === 'attention'
                      ? 'bg-amber-50 border-amber-400 text-amber-800 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  🟡 需加強關懷
                </button>
                <button
                  type="button"
                  onClick={() => setAlertLevel('urgent')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                    alertLevel === 'urgent'
                      ? 'bg-rose-50 border-rose-400 text-rose-800 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  🔴 高度注意 / 轉介
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                觀察紀錄與問題簡述 <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="例如：自述下課與同學因遊戲規則發生口角，情緒沮喪低落，且連兩日自覺睡眠不足..."
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-xs sm:text-sm text-slate-800 placeholder-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                已採取或預計進行之輔導措施
              </label>
              <input
                type="text"
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
                placeholder="例如：午休時進行 15 分鐘個別晤談，並以聯絡簿知會家長注意..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-xs sm:text-sm text-slate-800 placeholder-slate-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-teal-600/20 transition-all hover:scale-[1.02]"
              >
                {isSaving ? '儲存同步中...' : '儲存關懷筆記'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
