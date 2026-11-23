import React, { useState, useEffect } from 'react';
import { ShieldCheck, FileText, CheckCircle2, AlertCircle, X, Download, UserCheck } from 'lucide-react';

interface ParentConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ParentConsentModal: React.FC<ParentConsentModalProps> = ({ isOpen, onClose }) => {
  const [hasAgreed, setHasAgreed] = useState<boolean>(() => {
    return localStorage.getItem('parent_sel_consent_agreed') === 'true';
  });
  const [signedName, setSignedName] = useState<string>('法定代理人 / 監護人家長');

  if (!isOpen) return null;

  const handleAgree = () => {
    localStorage.setItem('parent_sel_consent_agreed', 'true');
    setHasAgreed(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-teal-100 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 shadow-xs">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-slate-800">
              校園情緒關懷與 AI 對話系統 · 學生及監護人告知暨同意書
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              依據校園學生心理健康關懷準則及個人資料保護規範制定
            </p>
          </div>
        </div>

        {/* Policy Content */}
        <div className="space-y-4 text-xs text-slate-600 leading-relaxed bg-slate-50 p-5 rounded-2xl border border-slate-200">
          <div>
            <h4 className="font-bold text-slate-800 text-sm mb-1">一、服務目的與輔導意旨</h4>
            <p>
              本系統由學校輔導處及各班責任導師協同推動，旨在透過社會情緒學習（SEL）與溫暖的 AI 心靈小夥伴「心心」，陪伴學童學習情緒覺察、命名與自我調節，並及早發現需要關懷的孩子。
            </p>
          </div>

          <div>
            <h4 className="font-bold text-slate-800 text-sm mb-1">二、對話紀錄與隱私透明度告知（非絕對保密）</h4>
            <p>
              為確保學童之人身安全、身心健康及防範校園霸凌或危機情事，本系統之對話<strong>並非對校方完全保密</strong>。經學校核准授權之<strong>班級責任導師與專任輔導教師</strong>，於評估有情緒低落或身心適應輔導需求時，得依法依規查閱對話紀錄與 AI 摘要。所有查閱行為均受系統安全稽核日誌記錄。
            </p>
          </div>

          <div>
            <h4 className="font-bold text-slate-800 text-sm mb-1">三、資料儲存與保存期限機制</h4>
            <p>
              1. 對話與簽到紀錄全數加密儲存於 Google Cloud / Firebase Firestore 安全資料庫。<br />
              2. 系統設定明確保存期限為<strong>一學年（365天）</strong>，期滿後由系統管理員依法進行過期封存或清除。<br />
              3. 家長或監護人得依個人資料保護法，隨時向學校輔導處申請查閱或刪除學童個人紀錄。
            </p>
          </div>

          <div>
            <h4 className="font-bold text-slate-800 text-sm mb-1">四、法定危機通報義務</h4>
            <p>
              若學童透露家庭暴力、性平事件、自我傷害或危害他人之重大危險，AI 將立即提示求助管道，學校師長將依法啟動校園通報與輔導機制介入協助。
            </p>
          </div>
        </div>

        {/* Signature & Consent Action */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-teal-600" />
            <span className="text-xs font-bold text-slate-700">
              簽署狀態：{hasAgreed ? '已完成家長告知同意' : '尚未確認'}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100"
            >
              稍後再說
            </button>
            <button
              onClick={handleAgree}
              className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 transition-all hover:scale-[1.02]"
            >
              {hasAgreed ? '我已詳閱並再次確認' : '我已詳閱並同意告知書內容'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
