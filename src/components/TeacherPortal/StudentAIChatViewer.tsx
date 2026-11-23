import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { User, ChatMessage, MOOD_DEFINITIONS, MoodType } from '../../types';
import { CareNoteModal } from './CareNoteModal';
import {
  MessageSquare,
  Search,
  Calendar,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  UserCheck,
  AlertTriangle,
  Sparkles,
  FileText,
  Clock,
  History,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface StudentAIChatViewerProps {
  selectedClassId: string;
}

export const StudentAIChatViewer: React.FC<StudentAIChatViewerProps> = ({ selectedClassId }) => {
  const {
    currentUser,
    users,
    classes,
    getStudentChatMessages,
    logChatAccess,
    chatAccessLogs,
  } = useApp();

  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];

  // Students in this selected class
  const classStudents = useMemo(() => {
    return users.filter((u) => u.role === 'student' && u.classId === selectedClassId);
  }, [users, selectedClassId]);

  // All students for testing cross-class access denial
  const allStudents = useMemo(() => {
    return users.filter((u) => u.role === 'student');
  }, [users]);

  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    classStudents[0]?.id || ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [activeCareNoteStudent, setActiveCareNoteStudent] = useState<User | null>(null);
  const [accessLoggedFor, setAccessLoggedFor] = useState<string | null>(null);

  // If selected student changes or class changes, ensure selected student is valid
  useEffect(() => {
    if (!classStudents.some((s) => s.id === selectedStudentId) && classStudents.length > 0) {
      setSelectedStudentId(classStudents[0].id);
    }
  }, [classStudents]);

  const selectedStudent = users.find((u) => u.id === selectedStudentId);

  // Check authorization and fetch messages
  const accessResult = selectedStudentId
    ? getStudentChatMessages(selectedStudentId)
    : { allowed: false, messages: [] };

  // Log audit access when viewing an authorized student's chat
  useEffect(() => {
    if (selectedStudent && accessResult.allowed && accessLoggedFor !== selectedStudent.id) {
      logChatAccess(
        selectedStudent.id,
        selectedStudent.name,
        `教師 ${currentUser.name} 查閱 ${selectedStudent.className} ${selectedStudent.name} AI 對話紀錄`
      );
      setAccessLoggedFor(selectedStudent.id);
    }
  }, [selectedStudent, accessResult.allowed, accessLoggedFor]);

  // Filter messages by search and date
  const filteredMessages = useMemo(() => {
    if (!accessResult.allowed) return [];
    return accessResult.messages.filter((msg) => {
      const matchText = msg.text.toLowerCase().includes(searchQuery.toLowerCase());
      const matchDate = selectedDate ? (msg.createdAt || '').startsWith(selectedDate) : true;
      return matchText && matchDate;
    });
  }, [accessResult.messages, searchQuery, selectedDate, accessResult.allowed]);

  // Compute automated Care Summary from conversation
  const chatSummary = useMemo(() => {
    const msgs = accessResult.messages;
    if (!msgs || msgs.length === 0) return null;

    const studentMsgs = msgs.filter((m) => m.sender === 'student');
    const combinedText = studentMsgs.map((m) => m.text).join(' ');

    // Detect emotions and keywords
    const isSad = combinedText.includes('難過') || combinedText.includes('委屈') || combinedText.includes('想哭') || combinedText.includes('吵架');
    const isAnxious = combinedText.includes('考試') || combinedText.includes('緊張') || combinedText.includes('害怕') || combinedText.includes('不及格');
    const isHappy = combinedText.includes('開心') || combinedText.includes('棒') || combinedText.includes('隊長') || combinedText.includes('稱讚');
    const isTired = combinedText.includes('累') || combinedText.includes('想睡') || combinedText.includes('太晚');

    const primaryEmotion: MoodType = isSad
      ? 'sad'
      : isAnxious
      ? 'anxious'
      : isTired
      ? 'tired'
      : isHappy
      ? 'happy'
      : 'calm';

    const topics: string[] = [];
    if (combinedText.includes('吵架') || combinedText.includes('同學') || combinedText.includes('朋友')) topics.push('同儕人際相處');
    if (combinedText.includes('考試') || combinedText.includes('作業') || combinedText.includes('課業') || combinedText.includes('數學')) topics.push('課業學習壓力');
    if (combinedText.includes('體育') || combinedText.includes('球') || combinedText.includes('跑步')) topics.push('運動與校園活動');
    if (combinedText.includes('爸爸') || combinedText.includes('媽媽') || combinedText.includes('家')) topics.push('家庭親子生活');

    let keypoints = '孩子在對話中表達了真實想法，AI 心靈夥伴已提供同理接納與舒緩引導。';
    if (isSad && combinedText.includes('推人')) {
      keypoints = '提及下課遊戲時摔倒被同學誤會推人，內心深感委屈難過，建議導師於中午主動核對情況解開誤會。';
    } else if (isAnxious && combinedText.includes('數學')) {
      keypoints = '考前出現過度自我懷疑與緊張，需適時給予肯定並引導正確看待評量。';
    } else if (isHappy) {
      keypoints = '學生今天自信心充足、被選為隊長或受師長鼓勵，整體適應狀態極佳！';
    }

    return {
      total: msgs.length,
      primaryEmotion,
      topics: topics.length > 0 ? topics : ['生活常態適應'],
      keypoints,
      hasRiskWarning: isSad || isAnxious,
    };
  }, [accessResult.messages]);

  return (
    <div className="space-y-5">
      {/* Top Controls: Class notice, search bar, and Audit Logs Trigger */}
      <div className="bg-white rounded-3xl p-5 border border-teal-100 shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-teal-600" />
              學生 AI 對話紀錄查閱中心
            </h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-bold border border-teal-200">
              {currentClass?.name} 專屬
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            依據校園隱私規範，責任導師僅能查閱<strong>自己負責之班級</strong>學生對話；每次查閱皆受安全稽核日誌完整追蹤。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search keyword */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜尋學生或對話關鍵字..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 border border-transparent focus:border-teal-400 w-44 sm:w-52"
            />
          </div>

          {/* Date filter */}
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
                onClick={() => setSelectedDate('')}
                className="ml-1 text-[11px] text-slate-400 hover:text-slate-600"
              >
                清除
              </button>
            )}
          </div>

          {/* Audit Log Modal Trigger */}
          <button
            onClick={() => setShowAuditModal(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors border border-slate-200"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>查閱稽核日誌 ({chatAccessLogs.length})</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Student Selector & Right Conversation Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Student Selector (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-3xl p-4 border border-teal-100 shadow-2xs">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                本班學生名單 ({classStudents.length} 人)
              </span>
              <span className="text-[11px] text-teal-700 font-semibold">
                導師：{currentUser.name}
              </span>
            </div>

            <div className="space-y-1.5">
              {classStudents.map((student) => {
                const isSelected = student.id === selectedStudentId;
                const studentChatRes = getStudentChatMessages(student.id);
                const count = studentChatRes.messages.length;

                return (
                  <button
                    key={student.id}
                    onClick={() => {
                      setSelectedStudentId(student.id);
                      setAccessLoggedFor(null);
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
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs sm:text-sm">{student.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            座號 {student.studentNumber || '01'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {count > 0 ? `累積 ${count} 則對話紀錄` : '今日暫無對話'}
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
              })}
            </div>
          </div>

          {/* Cross-Class Access Denial Testing Box */}
          <div className="bg-slate-50 rounded-3xl p-4 border border-dashed border-slate-300">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <span>跨班權限阻擋測試沙盒 (安全規則檢驗)</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
              點擊非本班學生（如五年一班同學），驗證 Firestore 安全規則與系統跨班存取阻擋機制：
            </p>
            <div className="space-y-1.5">
              {allStudents
                .filter((s) => s.classId !== selectedClassId)
                .slice(0, 2)
                .map((foreignStudent) => (
                  <button
                    key={foreignStudent.id}
                    onClick={() => setSelectedStudentId(foreignStudent.id)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white border border-rose-200 text-rose-800 hover:bg-rose-50 text-xs font-medium transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span>{foreignStudent.avatar}</span>
                      <span>{foreignStudent.name}</span>
                      <span className="text-[10px] text-slate-400">({foreignStudent.className})</span>
                    </div>
                    <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-md font-bold">
                      測試跨班讀取
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>

        {/* Right Column: Chat Transcript & AI Care Summary (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Permission Denied Banner if cross-class or unauthenticated */}
          {!accessResult.allowed ? (
            <div className="bg-white rounded-3xl p-8 border-2 border-rose-200 text-center shadow-xs">
              <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto mb-3">
                <Lock className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-black text-rose-800 mb-2">
                存取被拒絕 · 跨班隱私防護已生效
              </h4>
              <p className="text-xs text-rose-700 max-w-md mx-auto leading-relaxed">
                {accessResult.error}
              </p>
              <div className="mt-5 p-3 rounded-2xl bg-rose-50/60 max-w-sm mx-auto text-[11px] text-rose-800 text-left border border-rose-100">
                <strong>🛡️ 遵循之資安準則：</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>Firestore 規則強制比對 <code>resource.data.classId == request.auth.token.classId</code></li>
                  <li>教師嚴禁跨越授權邊界查閱其他班級學童對話</li>
                  <li>每次拒絕事件已記錄至系統資安審計日誌</li>
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
                        <ShieldCheck className="w-3.5 h-3.5" /> 導師合法授權查閱
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedStudent?.className} · 座號 {selectedStudent?.studentNumber || '01'} · 查閱導師：{currentUser.name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveCareNoteStudent(selectedStudent || null)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs transition-all hover:scale-[1.02]"
                  >
                    <FileText className="w-4 h-4" /> 轉記輔導關懷筆記
                  </button>
                </div>
              </div>

              {/* AI Emotion & Care Summary Box */}
              {chatSummary && (
                <div className="bg-gradient-to-r from-teal-50/80 via-emerald-50/80 to-sky-50/80 rounded-3xl p-5 border border-teal-200/80 shadow-2xs">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-teal-600" />
                      AI 智能對話與情緒關懷分析摘要
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      分析累積 {chatSummary.total} 則對話
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3 text-xs">
                    <div className="bg-white/80 p-3 rounded-2xl border border-teal-100">
                      <span className="text-slate-400 block text-[10px] font-bold">主導情緒傾向</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-lg">{MOOD_DEFINITIONS[chatSummary.primaryEmotion].emoji}</span>
                        <span className={`font-bold ${MOOD_DEFINITIONS[chatSummary.primaryEmotion].textColor}`}>
                          {MOOD_DEFINITIONS[chatSummary.primaryEmotion].label}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white/80 p-3 rounded-2xl border border-teal-100">
                      <span className="text-slate-400 block text-[10px] font-bold">對話涵蓋主題</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {chatSummary.topics.map((t) => (
                          <span key={t} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white/80 p-3 rounded-2xl border border-teal-100">
                      <span className="text-slate-400 block text-[10px] font-bold">關懷預警指標</span>
                      <div className="mt-1">
                        {chatSummary.hasRiskWarning ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                            需加強身心關懷
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            常態心理適應良好
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-white/90 rounded-2xl border border-teal-100 text-xs text-slate-700 leading-relaxed">
                    <strong className="text-teal-900 block mb-0.5">📌 導師觀察重點與輔導建議：</strong>
                    {chatSummary.keypoints}
                  </div>
                </div>
              )}

              {/* Chat Transcript Feed */}
              <div className="bg-white rounded-3xl p-5 border border-teal-100 shadow-2xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>對話全文已透過 Firestore 安全規則鎖定（防竄改）</span>
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
                      return (
                        <div
                          key={msg.id}
                          className={`flex items-start gap-3 ${
                            isStudent ? 'justify-start' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 shadow-2xs ${
                              isStudent ? 'bg-slate-100' : 'bg-gradient-to-tr from-teal-400 to-emerald-400 text-white'
                            }`}
                          >
                            {isStudent ? selectedStudent?.avatar : '🌱'}
                          </div>

                          <div className="flex-1 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 text-xs">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-bold text-slate-800">
                                {isStudent ? selectedStudent?.name : '心心小光靈 (AI)'}
                              </span>
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
                  教師查閱學生 AI 對話紀錄 · 安全稽核日誌
                </h4>
              </div>
              <button
                onClick={() => setShowAuditModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              為確保學生隱私權益，系統嚴格記錄每一次教師查閱學生對話全文之時間、查閱教師與被查閱對象：
            </p>

            <div className="space-y-2">
              {chatAccessLogs.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">暫無查閱稽核日誌</p>
              ) : (
                chatAccessLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2 font-bold text-slate-800">
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

      {/* Care Note Modal prefilled */}
      <CareNoteModal
        isOpen={Boolean(activeCareNoteStudent)}
        onClose={() => setActiveCareNoteStudent(null)}
        student={activeCareNoteStudent}
      />
    </div>
  );
};
