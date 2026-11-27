import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  User,
  MOOD_DEFINITIONS,
  MoodType,
  SITUATION_LABELS,
} from '../../types';
import { CareNoteModal } from './CareNoteModal';
import {
  MessageSquare,
  Search,
  Calendar,
  ShieldAlert,
  ShieldCheck,
  Lock,
  AlertTriangle,
  Sparkles,
  FileText,
  History,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

interface StudentAIChatViewerProps {
  selectedClassId: string;
}

interface GeminiCareSummaryResult {
  primaryEmotion: MoodType;
  topics: string[];
  careKeypoints: string;
  safetyAlert: boolean;
  generatedBy?: string;
}

export const StudentAIChatViewer: React.FC<StudentAIChatViewerProps> = ({ selectedClassId }) => {
  const {
    currentUser,
    firebaseUser,
    users,
    classes,
    getStudentChatMessages,
    logChatAccess,
    chatAccessLogs,
  } = useApp();

  const isAdmin = currentUser?.role === 'admin';
  const isAllClasses = isAdmin && selectedClassId === 'all';
  const currentClass = isAllClasses
    ? undefined
    : classes.find((c) => c.id === selectedClassId) || classes[0];

  const allStudents = useMemo(() => {
    return users.filter((u) => u.role === 'student');
  }, [users]);

  const classStudents = useMemo(() => {
    if (isAllClasses) return allStudents;
    return users.filter((u) => u.role === 'student' && u.classId === selectedClassId);
  }, [users, allStudents, isAllClasses, selectedClassId]);

  const [studentSearch, setStudentSearch] = useState('');
  const visibleStudents = useMemo(() => {
    if (!studentSearch.trim()) return classStudents;
    const q = studentSearch.trim().toLowerCase();
    return classStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.studentNumber || '').toLowerCase().includes(q) ||
        (s.className || '').toLowerCase().includes(q)
    );
  }, [classStudents, studentSearch]);

  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    classStudents[0]?.id || ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [activeCareNoteStudent, setActiveCareNoteStudent] = useState<User | null>(null);
  const [accessLoggedFor, setAccessLoggedFor] = useState<string | null>(null);

  // Genuine Gemini Care Summary cache keyed by studentId
  const [summariesByStudent, setSummariesByStudent] = useState<Record<string, GeminiCareSummaryResult>>({});
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    if (!classStudents.some((s) => s.id === selectedStudentId) && classStudents.length > 0) {
      setSelectedStudentId(classStudents[0].id);
      setSummaryError(null);
    }
  }, [classStudents, selectedStudentId]);

  const selectedStudent = users.find((u) => u.id === selectedStudentId);

  const accessResult = selectedStudentId
    ? getStudentChatMessages(selectedStudentId)
    : { allowed: false, messages: [] };

  useEffect(() => {
    if (selectedStudent && accessResult.allowed && accessLoggedFor !== selectedStudent.id && currentUser) {
      setAccessLoggedFor(selectedStudent.id);
      logChatAccess(
        selectedStudent.id,
        selectedStudent.name,
        `${isAdmin ? '管理員' : '教師'} ${currentUser.name} 查閱 ${selectedStudent.className || selectedClassId} ${selectedStudent.name} AI 對話紀錄`
      ).catch((e) => console.warn('Failed to log chat access:', e));
    }
  }, [selectedStudent, accessResult.allowed, accessLoggedFor, currentUser, logChatAccess, selectedClassId, isAdmin]);

  const filteredMessages = useMemo(() => {
    if (!accessResult.allowed) return [];
    return accessResult.messages.filter((msg) => {
      const matchText = msg.text.toLowerCase().includes(searchQuery.toLowerCase());
      const matchDate = selectedDate ? (msg.createdAt || '').startsWith(selectedDate) : true;
      return matchText && matchDate;
    });
  }, [accessResult.messages, searchQuery, selectedDate, accessResult.allowed]);

  // Factual statistics directly derived from persisted message metadata (no fake heuristic narrative)
  const factualStats = useMemo(() => {
    const msgs = accessResult.messages;
    if (!msgs || msgs.length === 0) return null;
    const aiMsgs = msgs.filter((m) => m.sender === 'ai' && m.aiStatus !== 'error_notice');
    const latestAi = aiMsgs[aiMsgs.length - 1];
    const hasHighRisk = msgs.some(
      (m) => m.riskLevel === 'elevated' || m.riskLevel === 'critical' || m.aiStatus === 'safety_fallback'
    );
    return {
      total: msgs.length,
      latestEmotion: latestAi?.modelDetectedEmotion || latestAi?.emotionTag || 'calm',
      latestCategory: latestAi?.situationCategory,
      hasHighRisk,
    };
  }, [accessResult.messages]);

  if (!currentUser) return null;

  const currentSummary = selectedStudentId ? summariesByStudent[selectedStudentId] : undefined;

  const handleGenerateGeminiSummary = async () => {
    if (!selectedStudent || !accessResult.allowed || accessResult.messages.length === 0) return;

    if (!firebaseUser) {
      setSummaryError('請先登入 Firebase 帳號後再呼叫受保護的伺服器端 Gemini 摘要 API。');
      return;
    }

    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      const resp = await fetch('/api/gemini/summarize-student', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          studentName: selectedStudent.name,
          messages: accessResult.messages.slice(-20).map((m) => ({
            sender: m.sender,
            text: m.text,
          })),
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data?.error || '無法產生 Gemini AI 關懷摘要');
      }
      setSummariesByStudent((prev) => ({
        ...prev,
        [selectedStudent.id]: data as GeminiCareSummaryResult,
      }));
    } catch (err: any) {
      setSummaryError(err?.message || '產生 AI 摘要時發生連線錯誤，請稍後再試。');
    } finally {
      setSummaryLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Controls */}
      <div className="bg-white rounded-3xl p-5 border border-teal-100 shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-teal-600" />
              學生 AI 對話紀錄查閱中心
            </h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-bold border border-teal-200">
              {isAllClasses ? '全校學生總覽（管理員權限）' : `${currentClass?.name || '本班'} 專屬`}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isAdmin
              ? '管理員具備全校學生情緒與 AI 對話查閱授權；每次查閱皆寫入 Firestore 稽核日誌。'
              : '依據校園隱私規範，責任導師僅能查閱自己負責之班級學生對話；每次查閱皆寫入 Firestore 稽核日誌。'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜尋對話關鍵字..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 border border-transparent focus:border-teal-400 w-44 sm:w-52"
            />
          </div>

          <div className="relative flex items-center">
            <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 text-xs text-slate-700 focus:bg-white focus:outline-none border border-transparent"
              title="依日期篩選對話"
            />
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate('')}
                className="ml-1 text-[11px] text-slate-400 hover:text-slate-600"
              >
                清除
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowAuditModal(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors border border-slate-200"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>查閱稽核日誌 ({chatAccessLogs.length})</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Student Selector */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-3xl p-4 border border-teal-100 shadow-2xs">
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {isAllClasses ? `全校學生名單 (${classStudents.length} 人)` : `本班學生名單 (${classStudents.length} 人)`}
              </span>
              <span className="text-[11px] text-teal-700 font-semibold">
                {isAdmin ? `管理員：${currentUser.name}` : `導師：${currentUser.name}`}
              </span>
            </div>

            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="搜尋學生姓名或座號..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>

            <div className="space-y-1.5">
              {visibleStudents.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">查無符合條件的學生名單</p>
              ) : (
                visibleStudents.map((student) => {
                  const isSelected = student.id === selectedStudentId;
                  const studentChatRes = getStudentChatMessages(student.id);
                  const count = studentChatRes.messages.length;

                  return (
                    <button
                      type="button"
                      key={student.id}
                      onClick={() => {
                        setSelectedStudentId(student.id);
                        setAccessLoggedFor(null);
                        setSummaryError(null);
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all ${
                        isSelected
                          ? 'bg-teal-50 border-2 border-teal-500 text-teal-900 shadow-xs'
                          : 'bg-slate-50/70 hover:bg-slate-100 border border-transparent text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{student.avatar}</span>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs sm:text-sm">{student.name}</span>
                            {isAllClasses && student.className && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-semibold">
                                {student.className}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 font-mono">
                              座號 {student.studentNumber || '01'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {count > 0 ? `累積 ${count} 則對話紀錄` : '目前暫無對話'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        {count > 0 ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-teal-200 text-teal-700">
                            可查閱
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">無紀錄</span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Least-privilege Isolation Info */}
          <div className="bg-slate-50 rounded-3xl p-4 border border-dashed border-slate-300">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <span>{isAdmin ? '管理員全校授權監督狀態' : '跨班權限隔離保護狀態'}</span>
            </div>
            {isAdmin ? (
              <p className="text-[11px] text-slate-600 leading-relaxed">
                您目前以<strong>管理員身分</strong>檢視學生與 AI 的對話紀錄，具全校班級查閱權限；一般教師端仍嚴格受限於所負責之班級。
              </p>
            ) : (
              <div className="text-[11px] text-slate-600 leading-relaxed space-y-1.5">
                <p>
                  系統已啟用最小權限查詢（<code>where(&apos;classId&apos;, &apos;==&apos;, classId)</code>），非本班學生資料不會載入至前端記憶體。
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedStudentId('unauthorized-foreign-student')}
                  className="w-full py-2 px-3 rounded-xl bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold transition-colors"
                >
                  驗證越權 ID 讀取阻擋
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Chat Transcript & Gemini AI Summary */}
        <div className="lg:col-span-8 space-y-4">
          {!accessResult.allowed ? (
            <div className="bg-white rounded-3xl p-8 border-2 border-rose-200 text-center shadow-xs">
              <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto mb-3">
                <Lock className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-black text-rose-800 mb-2">
                存取被拒絕 · 跨班隱私防護已生效
              </h4>
              <p className="text-xs text-rose-700 max-w-md mx-auto leading-relaxed">
                {accessResult.error || '請選擇左側本班學生以查閱對話紀錄。'}
              </p>
              <div className="mt-5 p-3 rounded-2xl bg-rose-50/60 max-w-sm mx-auto text-[11px] text-rose-800 text-left border border-rose-100">
                <strong>🛡️ 遵循之資安準則：</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>Firestore 規則強制比對導師負責班級與目標學生之 classId</li>
                  <li>教師嚴禁跨越授權邊界查閱其他班級學童對話</li>
                </ul>
              </div>
            </div>
          ) : (
            <>
              {/* Authorized Header Card */}
              <div className="bg-white rounded-3xl p-5 border border-teal-100 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedStudent?.avatar}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-extrabold text-slate-800">
                        {selectedStudent?.name} 的 AI 對話紀錄
                      </h4>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> {isAdmin ? '管理員授權查閱' : '導師合法授權查閱'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedStudent?.className || '未分班'} · 座號 {selectedStudent?.studentNumber || '01'} · 查閱人員：{currentUser.name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveCareNoteStudent(selectedStudent || null)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs transition-all hover:scale-[1.02]"
                  >
                    <FileText className="w-4 h-4" /> 轉記輔導關懷筆記
                  </button>
                </div>
              </div>

              {/* Genuine Gemini AI Care Summary Card */}
              {factualStats && (
                <div className="bg-gradient-to-r from-teal-50/80 via-emerald-50/80 to-sky-50/80 rounded-3xl p-5 border border-teal-200/80 shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-teal-600" />
                      AI 對話脈絡與教師關懷摘要（由後端 Gemini API 即時分析）
                    </span>
                    <button
                      type="button"
                      disabled={summaryLoading}
                      onClick={handleGenerateGeminiSummary}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${summaryLoading ? 'animate-spin' : ''}`} />
                      {summaryLoading
                        ? 'Gemini 分析中...'
                        : currentSummary
                        ? '重新生成 Gemini 摘要'
                        : '使用 Gemini 生成教師關懷摘要'}
                    </button>
                  </div>

                  {summaryError && (
                    <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{summaryError}</span>
                    </div>
                  )}

                  {currentSummary ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="bg-white/85 p-3 rounded-2xl border border-teal-100">
                          <span className="text-slate-400 block text-[10px] font-bold">Gemini 分析主導情緒</span>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-lg">
                              {MOOD_DEFINITIONS[currentSummary.primaryEmotion]?.emoji || '😌'}
                            </span>
                            <span
                              className={`font-bold ${
                                MOOD_DEFINITIONS[currentSummary.primaryEmotion]?.textColor || 'text-slate-700'
                              }`}
                            >
                              {MOOD_DEFINITIONS[currentSummary.primaryEmotion]?.label || currentSummary.primaryEmotion}
                            </span>
                          </div>
                        </div>

                        <div className="bg-white/85 p-3 rounded-2xl border border-teal-100">
                          <span className="text-slate-400 block text-[10px] font-bold">對話涵蓋主題</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {currentSummary.topics.map((t) => (
                              <span
                                key={t}
                                className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="bg-white/85 p-3 rounded-2xl border border-teal-100">
                          <span className="text-slate-400 block text-[10px] font-bold">安全風險指標</span>
                          <div className="mt-1">
                            {currentSummary.safetyAlert || factualStats.hasHighRisk ? (
                              <span className="inline-flex items-center gap-1 text-rose-700 font-bold">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                                需加強身心關懷與安全確認
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                對話暫無重大安全預警
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-white/90 rounded-2xl border border-teal-100 text-xs text-slate-700 leading-relaxed">
                        <strong className="text-teal-900 block mb-0.5">📌 導師關懷重點（Gemini 整理）：</strong>
                        {currentSummary.careKeypoints}
                      </div>
                    </>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="bg-white/80 p-3 rounded-2xl border border-teal-100">
                        <span className="text-slate-400 block text-[10px] font-bold">最近一則對話模型偵測語氣</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-lg">
                            {MOOD_DEFINITIONS[factualStats.latestEmotion]?.emoji || '😌'}
                          </span>
                          <span className="font-bold text-slate-700">
                            {MOOD_DEFINITIONS[factualStats.latestEmotion]?.label || '平靜安心'}
                          </span>
                        </div>
                      </div>
                      <div className="bg-white/80 p-3 rounded-2xl border border-teal-100">
                        <span className="text-slate-400 block text-[10px] font-bold">最近情境分類</span>
                        <p className="font-bold text-slate-700 mt-1">
                          {factualStats.latestCategory
                            ? SITUATION_LABELS[factualStats.latestCategory]
                            : '尚無情境標籤'}
                        </p>
                      </div>
                      <div className="bg-white/80 p-3 rounded-2xl border border-teal-100">
                        <span className="text-slate-400 block text-[10px] font-bold">紀錄風險標記</span>
                        <p className="mt-1 font-bold">
                          {factualStats.hasHighRisk ? (
                            <span className="text-rose-700">含高風險或求助訊息（{factualStats.total} 則）</span>
                          ) : (
                            <span className="text-emerald-700">一般常態對話（共 {factualStats.total} 則）</span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Chat Transcript Feed */}
              <div className="bg-white rounded-3xl p-5 border border-teal-100 shadow-2xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>對話全文已透過 Firestore 安全規則鎖定（不可修改或竄改）</span>
                  </div>
                  <span>共 {filteredMessages.length} 則符合訊息</span>
                </div>

                {filteredMessages.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    目前暫無符合條件的對話紀錄
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                    {filteredMessages.map((msg) => {
                      const isStudent = msg.sender === 'student';
                      const isErrorNotice = msg.aiStatus === 'error_notice';
                      const isSafetyFallback = msg.aiStatus === 'safety_fallback';
                      const detectedMeta = msg.modelDetectedEmotion
                        ? MOOD_DEFINITIONS[msg.modelDetectedEmotion]
                        : null;

                      return (
                        <div key={msg.id} className="flex items-start gap-3">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 shadow-2xs ${
                              isStudent
                                ? 'bg-slate-100'
                                : isErrorNotice
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gradient-to-tr from-teal-400 to-emerald-400 text-white'
                            }`}
                          >
                            {isStudent ? selectedStudent?.avatar : isErrorNotice ? '⚠️' : '🌱'}
                          </div>

                          <div
                            className={`flex-1 p-3.5 rounded-2xl border text-xs ${
                              isErrorNotice
                                ? 'bg-amber-50/70 border-amber-200'
                                : isSafetyFallback || msg.riskLevel === 'critical' || msg.riskLevel === 'elevated'
                                ? 'bg-rose-50/50 border-rose-200'
                                : 'bg-slate-50/80 border-slate-200/80'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-800">
                                  {isStudent
                                    ? selectedStudent?.name
                                    : isErrorNotice
                                    ? '系統服務提示（非 AI 回覆）'
                                    : '心心 AI'}
                                </span>
                                {msg.situationCategory && (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-semibold">
                                    {SITUATION_LABELS[msg.situationCategory]}
                                  </span>
                                )}
                                {detectedMeta && (
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded font-semibold ${detectedMeta.bgLight} ${detectedMeta.textColor}`}
                                  >
                                    {detectedMeta.emoji} 偵測：{detectedMeta.label}
                                  </span>
                                )}
                                {msg.teacherNotified && (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                                    已觸發緊急通報
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {msg.createdAt || msg.timestamp}
                              </span>
                            </div>
                            <p className="text-slate-700 leading-relaxed text-sm whitespace-pre-wrap">
                              {msg.text}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Audit Log Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-teal-100 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-teal-600" />
                <h4 className="text-base font-extrabold text-slate-800">
                  教師查閱學生 AI 對話紀錄 · Firestore 稽核日誌
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              為確保學生隱私權益，系統將每次教師查閱學生對話之時間、查閱者與對象寫入 <code>chat_access_logs</code> 集合（不可竄改刪除）：
            </p>

            <div className="space-y-2">
              {chatAccessLogs.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">暫無查閱稽核日誌</p>
              ) : (
                chatAccessLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 font-bold text-slate-800 flex-wrap">
                        <span>👩‍🏫 {log.teacherName}</span>
                        <span className="text-slate-400">查閱了</span>
                        <span className="text-teal-700 font-extrabold">{log.studentName}</span>
                        <span className="text-[10px] text-slate-400">({log.classId})</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{log.purpose}</p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      {log.timestamp}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <CareNoteModal
        isOpen={Boolean(activeCareNoteStudent)}
        onClose={() => setActiveCareNoteStudent(null)}
        student={activeCareNoteStudent}
      />
    </div>
  );
};
