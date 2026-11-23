import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User, SchoolClass, MoodType, MOOD_DEFINITIONS } from '../../types';
import { CareNoteModal } from './CareNoteModal';
import { StudentDetailModal } from './StudentDetailModal';
import { StudentAIChatViewer } from './StudentAIChatViewer';
import {
  Users,
  AlertTriangle,
  TrendingUp,
  Smile,
  CheckCircle,
  Clock,
  Search,
  Filter,
  Eye,
  PlusCircle,
  FileDown,
  ChevronRight,
  ShieldAlert,
  MessageSquare,
  BarChart3,
} from 'lucide-react';

export const TeacherDashboard: React.FC = () => {
  const { classes, users, moodLogs, careNotes, todayDate, currentUser } = useApp();

  // Active tab inside Teacher Portal
  const [teacherTab, setTeacherTab] = useState<'overview' | 'chat_viewer'>('overview');

  // Active selected class, defaults to current teacher's class or the first class
  const [selectedClassId, setSelectedClassId] = useState<string>(
    currentUser.classId || classes[0]?.id || 'class-302'
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'checked' | 'unchecked' | 'alert'>('all');

  // Modals state
  const [activeStudentForDetail, setActiveStudentForDetail] = useState<User | null>(null);
  const [activeStudentForCareNote, setActiveStudentForCareNote] = useState<User | null>(null);
  const [showExportSuccess, setShowExportSuccess] = useState(false);

  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];
  const classStudents = users.filter((u) => u.role === 'student' && u.classId === selectedClassId);

  // Today's logs for this class
  const classTodayLogs = moodLogs.filter(
    (l) => l.classId === selectedClassId && l.date === todayDate
  );

  // Map studentId -> today's log
  const todayLogMap = new Map<string, (typeof moodLogs)[0]>();
  classTodayLogs.forEach((l) => todayLogMap.set(l.studentId, l));

  // Compute metrics
  const totalCount = classStudents.length;
  const checkedInCount = classTodayLogs.length;
  const checkInRate = totalCount > 0 ? Math.round((checkedInCount / totalCount) * 100) : 0;

  const totalScore = classTodayLogs.reduce((acc, l) => acc + l.score, 0);
  const averageScore = checkedInCount > 0 ? (totalScore / checkedInCount).toFixed(1) : '0';

  // Attention alerts: students who checked in with score <= 2, or mood is sad/angry/anxious
  const alertStudents = classStudents.filter((s) => {
    const log = todayLogMap.get(s.id);
    if (!log) return false;
    return log.score <= 2 || ['sad', 'angry', 'anxious'].includes(log.mood);
  });

  const happyCalmCount = classTodayLogs.filter((l) => ['happy', 'calm'].includes(l.mood)).length;
  const positiveRate = checkedInCount > 0 ? Math.round((happyCalmCount / checkedInCount) * 100) : 0;

  // Mood counts for distribution
  const moodDistribution: Record<MoodType, number> = {
    happy: 0,
    calm: 0,
    anxious: 0,
    sad: 0,
    angry: 0,
    tired: 0,
  };
  classTodayLogs.forEach((l) => {
    if (moodDistribution[l.mood] !== undefined) {
      moodDistribution[l.mood] += 1;
    }
  });

  // Filter students for the table/grid
  const filteredStudents = classStudents.filter((student) => {
    const matchesSearch =
      student.name.includes(searchQuery) ||
      (student.studentNumber && student.studentNumber.includes(searchQuery));
    if (!matchesSearch) return false;

    const hasCheckedIn = todayLogMap.has(student.id);
    const isAlert = alertStudents.some((s) => s.id === student.id);

    if (filterStatus === 'checked') return hasCheckedIn;
    if (filterStatus === 'unchecked') return !hasCheckedIn;
    if (filterStatus === 'alert') return isAlert;
    return true;
  });

  const handleExportReport = () => {
    setShowExportSuccess(true);
    setTimeout(() => setShowExportSuccess(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Header with Class Selector & Quick Export */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/80 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-teal-100 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-800">
              {currentClass?.name || '班級'} · 學生情緒關懷 Dashboard
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-bold border border-teal-200">
              導師：{currentClass?.teacherName}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            即時掌握全班身心適應動態，及早發現情緒低落、給予溫暖關懷輔導。
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Class Switcher */}
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs sm:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.grade})
              </option>
            ))}
          </select>

          {/* Export Report Preview */}
          <button
            onClick={handleExportReport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition-colors"
          >
            <FileDown className="w-4 h-4 text-slate-500" />
            <span>匯出關懷報表</span>
          </button>
        </div>
      </div>

      {/* Export Toast Notification */}
      {showExportSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          班級情緒關懷分析報告 (PDF/CSV 格式) 已生成並準備下載！
        </div>
      )}

      {/* Teacher Subtab Navigation */}
      <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md p-1.5 rounded-2xl border border-teal-100 shadow-2xs">
        <button
          onClick={() => setTeacherTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            teacherTab === 'overview'
              ? 'bg-teal-600 text-white shadow-xs shadow-teal-600/20'
              : 'text-slate-600 hover:text-teal-700 hover:bg-teal-50/60'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          班級情緒統計與名冊
        </button>
        <button
          onClick={() => setTeacherTab('chat_viewer')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            teacherTab === 'chat_viewer'
              ? 'bg-teal-600 text-white shadow-xs shadow-teal-600/20'
              : 'text-slate-600 hover:text-teal-700 hover:bg-teal-50/60'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          學生 AI 對話紀錄查閱
        </button>
      </div>

      {teacherTab === 'overview' ? (
        <>
          {/* Metric KPI Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Check-in completion */}
        <div className="bg-white p-5 rounded-3xl border border-teal-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">今日心情簽到率</span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-800">
              {checkInRate}%
            </span>
            <span className="text-xs text-slate-500 font-semibold">
              ({checkedInCount}/{totalCount} 人)
            </span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-teal-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${checkInRate}%` }}
            />
          </div>
        </div>

        {/* Card 2: Average Score */}
        <div className="bg-white p-5 rounded-3xl border border-teal-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">班級平均情緒指數</span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-800">
              {averageScore}
            </span>
            <span className="text-xs text-slate-500 font-semibold">/ 5.0 分</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            {Number(averageScore) >= 3.5 ? '整體情緒晴朗安定' : '建議導師晨光時間多予關懷'}
          </p>
        </div>

        {/* Card 3: Attention Alerts */}
        <div className="bg-white p-5 rounded-3xl border border-teal-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">特別關注預警雷達</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-amber-600">
              {alertStudents.length}
            </span>
            <span className="text-xs text-slate-500 font-semibold">位學生需關懷</span>
          </div>
          <p className="text-[11px] text-amber-600 font-medium mt-2">
            包含連續難過、生氣或低於2分者
          </p>
        </div>

        {/* Card 4: Positive Mood ratio */}
        <div className="bg-white p-5 rounded-3xl border border-teal-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">好心情陽光佔比</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Smile className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600">
              {positiveRate}%
            </span>
            <span className="text-xs text-slate-500 font-semibold">開心/平靜</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            共 {happyCalmCount} 位同學感到安心自在
          </p>
        </div>
      </div>

      {/* Emotion Spectrum & Distribution Breakdown */}
      <div className="bg-white rounded-3xl p-6 border border-teal-100 shadow-2xs">
        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span>📊 今日班級全體情緒光譜分布</span>
          <span className="text-xs font-normal text-slate-400">
            (共 {checkedInCount} 筆簽到數據)
          </span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {(Object.keys(MOOD_DEFINITIONS) as MoodType[]).map((type) => {
            const meta = MOOD_DEFINITIONS[type];
            const count = moodDistribution[type];
            const pct = checkedInCount > 0 ? Math.round((count / checkedInCount) * 100) : 0;
            return (
              <div
                key={type}
                className={`p-3.5 rounded-2xl border ${meta.bgLight} ${meta.borderColor} flex flex-col justify-between`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{meta.emoji}</span>
                  <span className="text-xs font-black text-slate-700">{count} 人</span>
                </div>
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className={meta.textColor}>{meta.label}</span>
                    <span className="text-slate-500">{pct}%</span>
                  </div>
                  <div className="w-full bg-white/80 h-1.5 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: meta.color }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Attention Alerts Section */}
      {alertStudents.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-3xl p-5 sm:p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600 animate-pulse" />
              <h3 className="font-extrabold text-amber-900 text-sm sm:text-base">
                關懷預警雷達 · 建議今日導師主動關心 ({alertStudents.length} 位)
              </h3>
            </div>
            <span className="text-xs text-amber-700 font-semibold hidden sm:inline">
              點擊可立即撰寫關懷紀錄或查看個人細節
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {alertStudents.map((student) => {
              const log = todayLogMap.get(student.id)!;
              const meta = MOOD_DEFINITIONS[log.mood];
              return (
                <div
                  key={student.id}
                  className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{student.avatar}</span>
                        <div>
                          <span className="font-bold text-slate-800 text-sm">{student.name}</span>
                          <span className="text-[11px] text-slate-400 ml-1">
                            (座號 {student.studentNumber || '01'})
                          </span>
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${meta.bgLight} ${meta.textColor}`}>
                        {meta.emoji} {meta.label} ({log.score}分)
                      </span>
                    </div>

                    {log.note && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 italic line-clamp-2">
                        「{log.note}」
                      </p>
                    )}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => setActiveStudentForDetail(student)}
                      className="text-xs font-semibold text-slate-600 hover:text-teal-700 flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> 查看詳情
                    </button>
                    <button
                      onClick={() => setActiveStudentForCareNote(student)}
                      className="text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200 transition-colors flex items-center gap-1"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> 記關懷筆記
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Class Students Roster & Mood Table */}
      <div className="bg-white rounded-3xl p-6 border border-teal-100 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h3 className="text-base font-extrabold text-slate-800">
              {currentClass?.name} 學生全體簽到名冊
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              依座號順序排列，點擊任一同學可檢視歷史心情報告
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="搜尋姓名或座號..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 border border-transparent focus:border-teal-400"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  filterStatus === 'all' ? 'bg-white shadow-2xs text-teal-800' : 'text-slate-600'
                }`}
              >
                全部 ({classStudents.length})
              </button>
              <button
                onClick={() => setFilterStatus('checked')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  filterStatus === 'checked' ? 'bg-white shadow-2xs text-teal-800' : 'text-slate-600'
                }`}
              >
                已簽到 ({checkedInCount})
              </button>
              <button
                onClick={() => setFilterStatus('unchecked')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  filterStatus === 'unchecked' ? 'bg-white shadow-2xs text-teal-800' : 'text-slate-600'
                }`}
              >
                未簽到 ({totalCount - checkedInCount})
              </button>
              <button
                onClick={() => setFilterStatus('alert')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  filterStatus === 'alert' ? 'bg-white shadow-2xs text-amber-800 font-bold' : 'text-slate-600'
                }`}
              >
                預警 ({alertStudents.length})
              </button>
            </div>
          </div>
        </div>

        {/* Student Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3 px-3">座號</th>
                <th className="py-3 px-3">學生姓名</th>
                <th className="py-3 px-3">今日心情狀態</th>
                <th className="py-3 px-3">溫度計分數</th>
                <th className="py-3 px-3">自述心情筆記</th>
                <th className="py-3 px-3">簽到時間</th>
                <th className="py-3 px-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map((student) => {
                const log = todayLogMap.get(student.id);
                const meta = log ? MOOD_DEFINITIONS[log.mood] : null;

                return (
                  <tr
                    key={student.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    onClick={() => setActiveStudentForDetail(student)}
                  >
                    <td className="py-3 px-3 font-mono font-bold text-slate-500">
                      {student.studentNumber || '01'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{student.avatar}</span>
                        <span className="font-bold text-slate-800 group-hover:text-teal-700">
                          {student.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      {meta ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${meta.bgLight} ${meta.textColor}`}
                        >
                          <span>{meta.emoji}</span>
                          <span>{meta.label}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-400">
                          <Clock className="w-3 h-3" /> 尚未簽到
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {log ? (
                        <div className="flex items-center gap-1.5 font-bold">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              log.score >= 4
                                ? 'bg-emerald-500'
                                : log.score >= 3
                                ? 'bg-sky-500'
                                : 'bg-amber-500'
                            }`}
                          />
                          <span className="text-slate-700">{log.score} / 5 分</span>
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 max-w-xs truncate text-slate-600">
                      {log?.note ? (
                        <span>「{log.note}」</span>
                      ) : (
                        <span className="text-slate-300">無備註</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-[11px]">
                      {log?.createdAt ? log.createdAt.split(' ')[1] : '-'}
                    </td>
                    <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setActiveStudentForDetail(student)}
                          className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded-lg transition-colors"
                          title="查看個人情緒紀錄"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setActiveStudentForCareNote(student)}
                          className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                          title="填寫關懷筆記"
                        >
                          <PlusCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
        </>
      ) : (
        <StudentAIChatViewer selectedClassId={selectedClassId} />
      )}

      {/* Student Detail Modal */}
      <StudentDetailModal
        isOpen={Boolean(activeStudentForDetail)}
        onClose={() => setActiveStudentForDetail(null)}
        student={activeStudentForDetail}
        onOpenCareNote={(student) => setActiveStudentForCareNote(student)}
      />

      {/* Care Note Modal */}
      <CareNoteModal
        isOpen={Boolean(activeStudentForCareNote)}
        onClose={() => setActiveStudentForCareNote(null)}
        student={activeStudentForCareNote}
      />
    </div>
  );
};
