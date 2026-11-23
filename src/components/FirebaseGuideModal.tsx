import React, { useState } from 'react';
import { X, Database, ShieldCheck, Globe, CheckCircle2, Copy, Sparkles, Key, Check } from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';

interface FirebaseGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirebaseGuideModal: React.FC<FirebaseGuideModalProps> = ({ isOpen, onClose }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const firestoreCollections = [
    { name: 'users', desc: '校園使用者 (學生、教師、管理員) 帳號與角色檔案', rbac: '本人可讀改，導師可讀學生，管理員可讀寫' },
    { name: 'classes', desc: '班級名冊與責任導師資料', rbac: '全校已登入者可讀，管理員可維護' },
    { name: 'mood_logs', desc: '學生每日心情簽到與情緒溫度計分數', rbac: '學生本人可讀寫，班導師與管理員可查閱' },
    { name: 'care_notes', desc: '機密教師輔導關懷筆記與處遇措施', rbac: '嚴格限制教師與管理員，學生端不可見' },
    { name: 'chat_messages', desc: '學生與 AI 心靈小夥伴 (心心) 對話歷史', rbac: '學生本人與專任輔導教師可查閱' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-teal-100 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 shadow-xs">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-extrabold text-slate-800">
                Firebase 雲端資料庫與發布狀態
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 flex items-center gap-1">
                <Check className="w-3 h-3" /> 雲端連線運行中
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              專案 ID: <span className="font-mono font-bold text-teal-800">{firebaseConfig.projectId}</span>
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Section 1: Connected Live Firebase Project */}
          <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200">
            <h4 className="text-sm font-bold text-teal-900 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-teal-600" /> Firebase 雲端整合狀態：已成功佈署
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-teal-900 mt-2">
              <div className="bg-white/80 p-2.5 rounded-xl border border-teal-200/80">
                <span className="text-slate-500 block text-[11px]">Firebase 專案</span>
                <span className="font-mono font-bold">{firebaseConfig.projectId}</span>
              </div>
              <div className="bg-white/80 p-2.5 rounded-xl border border-teal-200/80">
                <span className="text-slate-500 block text-[11px]">Firestore 資料庫 ID</span>
                <span className="font-mono font-bold truncate block">{firebaseConfig.firestoreDatabaseId}</span>
              </div>
            </div>
            <p className="text-xs text-teal-800 mt-2 leading-relaxed">
              所有學生的心情簽到、AI「心心」聊天室對話、班級名冊與教師輔導筆記皆直接實時同步至 Firestore 雲端資料庫。
            </p>
          </div>

          {/* Section 2: Firestore Collections Schema */}
          <div>
            <h4 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-teal-600" /> Firestore 集合結構與安全規則 (firestore.rules)
            </h4>
            <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Collection 集合</th>
                    <th className="py-2.5 px-3">資料內容說明</th>
                    <th className="py-2.5 px-3">安全規則權限</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {firestoreCollections.map((col) => (
                    <tr key={col.name} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-mono font-bold text-teal-700">/{col.name}</td>
                      <td className="py-2.5 px-3">{col.desc}</td>
                      <td className="py-2.5 px-3 text-slate-600">{col.rbac}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Live URL & Multi-User Sharing */}
          <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200">
            <h4 className="text-sm font-bold text-sky-900 mb-1 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-sky-600" /> 透過專屬網址發布與多人連線使用
            </h4>
            <p className="text-xs text-sky-800 mb-3 leading-relaxed">
              任何教師或學生只要打開下方公開網址，便可在不同裝置上共同簽到與檢視即時資料：
            </p>
            <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-sky-200">
              <span className="font-mono text-xs text-sky-900 truncate flex-1">
                https://ais-pre-73tghrd4tkqsvyl7mwrvly-778069587729.asia-southeast1.run.app
              </span>
              <button
                onClick={() =>
                  handleCopy(
                    'https://ais-pre-73tghrd4tkqsvyl7mwrvly-778069587729.asia-southeast1.run.app',
                    'url'
                  )
                }
                className="px-3 py-1 bg-sky-100 hover:bg-sky-200 text-sky-800 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shrink-0"
              >
                {copiedKey === 'url' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey === 'url' ? '已複製' : '複製網址'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 transition-all"
          >
            關閉視窗
          </button>
        </div>
      </div>
    </div>
  );
};
