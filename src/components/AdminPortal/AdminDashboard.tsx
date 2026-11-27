import React, { useState, useEffect } from 'react';
import { useApp, AdminMutationResult } from '../../context/AppContext';
import { User, AiUsageSummary } from '../../types';
import { LEGACY_PRESET_USER_IDS } from '../../data/mockData';
import { StudentAIChatViewer } from '../TeacherPortal/StudentAIChatViewer';
import {
  Users,
  GraduationCap,
  Layers,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  ShieldCheck,
  Search,
  Edit2,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  AlertTriangle,
  UserCheck,
  UserX,
  Copy,
  X,
  Activity,
  Link2,
  MessageSquare,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const {
    currentUser,
    classes,
    users,
    addClass,
    addUser,
    updateUser,
    toggleUserStatus,
    activateTeacherAccount,
    generateTeacherActivationLink,
    deleteUser,
    fetchAiUsageSummary,
    cleanupLegacyPresetUsers,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'users' | 'chat_viewer' | 'classes' | 'ai_monitor'>('users');
  const [adminChatClassFilter, setAdminChatClassFilter] = useState<string>('all');
  const [userCategory, setUserCategory] = useState<'all' | 'student' | 'teacher' | 'admin'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled' | 'needsActivation'>('all');

  // Modals state
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [activatingUser, setActivatingUser] = useState<User | null>(null);

  // Explicit Admin SDK unconfigured pre-registration fallback dialog
  const [pendingPreRegPayload, setPendingPreRegPayload] = useState<{
    data: Omit<User, 'id'> & { password?: string };
    reason: string;
  } | null>(null);

  // Real activation link state
  const [realActivationLink, setRealActivationLink] = useState<string | null>(null);
  const [activationLinkError, setActivationLinkError] = useState<string | null>(null);
  const [loadingActivationLink, setLoadingActivationLink] = useState(false);

  // AI usage monitor state
  const [aiUsage, setAiUsage] = useState<AiUsageSummary | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  // Class Form State
  const [showAddClass, setShowAddClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState('三年級');
  const [newClassTeacherName, setNewClassTeacherName] = useState('李雅玲 老師');

  const defaultClassId = classes[0]?.id || '';

  const [studentForm, setStudentForm] = useState({
    name: '',
    email: '',
    classId: defaultClassId,
    studentNumber: '02',
    avatar: '🧒',
  });

  const [teacherForm, setTeacherForm] = useState({
    name: '',
    email: '',
    classId: defaultClassId,
    password: '',
    showPassword: false,
    avatar: '👩‍🏫',
  });

  useEffect(() => {
    if (defaultClassId) {
      setStudentForm((prev) => (prev.classId ? prev : { ...prev, classId: defaultClassId }));
      setTeacherForm((prev) => (prev.classId ? prev : { ...prev, classId: defaultClassId }));
    }
  }, [defaultClassId]);

  const [editFormData, setEditFormData] = useState<{
    name: string;
    email: string;
    classId: string;
    studentNumber?: string;
    avatar: string;
    status: 'active' | 'disabled';
    newPassword?: string;
  }>({
    name: '',
    email: '',
    classId: '',
    studentNumber: '',
    avatar: '🧒',
    status: 'active',
    newPassword: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const loadAiUsage = async () => {
    setLoadingUsage(true);
    try {
      const data = await fetchAiUsageSummary();
      setAiUsage(data);
    } finally {
      setLoadingUsage(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'ai_monitor') {
      loadAiUsage();
    }
  }, [activeTab]);

  // Fetch real activation link when opening Modal 4
  useEffect(() => {
    if (!activatingUser) {
      setRealActivationLink(null);
      setActivationLinkError(null);
      return;
    }
    let cancelled = false;
    setLoadingActivationLink(true);
    setActivationLinkError(null);
    generateTeacherActivationLink(activatingUser.id, activatingUser.email)
      .then((res) => {
        if (cancelled) return;
        if (res.ok && res.activationLink) {
          setRealActivationLink(res.activationLink);
        } else {
          setActivationLinkError(res.error || '無法產生密碼設定連結。');
        }
      })
      .catch((err) => {
        if (!cancelled) setActivationLinkError(err?.message || '查詢啟用連結失敗');
      })
      .finally(() => {
        if (!cancelled) setLoadingActivationLink(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activatingUser?.id]);

  const handleMutationOutcome = (result: AdminMutationResult, successMsg: string) => {
    if (result.warning) {
      showToast(result.warning, 'warning');
    } else {
      showToast(successMsg, 'success');
    }
  };

  // Class creation
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim() || submitting) return;

    setSubmitting(true);
    try {
      await addClass({
        name: newClassName.trim(),
        grade: newClassGrade,
        teacherId: `pending-teacher-${Date.now()}`,
        teacherName: newClassTeacherName.trim(),
        studentCount: 0,
      });

      const createdName = newClassName.trim();
      setNewClassName('');
      setShowAddClass(false);
      showToast(`班級「${createdName}」已建立並確認寫入資料庫！`);
    } catch (err: any) {
      showToast(err?.message || '建立班級失敗，請檢查權限。', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Student creation
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.name.trim() || submitting) return;

    const assignedClass = classes.find((c) => c.id === studentForm.classId);
    const emailToUse = studentForm.email.trim()
      ? studentForm.email.trim()
      : `student-${assignedClass?.id || '302'}-${studentForm.studentNumber || '01'}@school.edu.tw`;

    const payload: Omit<User, 'id'> = {
      name: studentForm.name.trim(),
      email: emailToUse,
      role: 'student',
      grade: assignedClass?.grade || '三年級',
      classId: assignedClass?.id,
      className: assignedClass?.name,
      studentNumber: studentForm.studentNumber || '01',
      avatar: studentForm.avatar,
      status: 'active',
      passwordSet: true,
      needsActivation: false,
    };

    setSubmitting(true);
    try {
      const result = await addUser(payload);
      if (!result.ok && result.errorCode === 'ADMIN_SDK_UNCONFIGURED') {
        setShowAddStudentModal(false);
        setPendingPreRegPayload({
          data: payload,
          reason: result.warning || '後端未配置 Firebase Admin SDK 憑證。',
        });
        return;
      }

      setStudentForm({
        name: '',
        email: '',
        classId: defaultClassId,
        studentNumber: '02',
        avatar: '🧒',
      });
      setShowAddStudentModal(false);
      handleMutationOutcome(result, `學生「${payload.name}」已建立並同步完成！`);
    } catch (err: any) {
      showToast(err?.message || '新增學生帳號失敗', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Teacher creation
  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherForm.name.trim() || !teacherForm.email.trim() || submitting) return;

    const assignedClass =
      teacherForm.classId === 'none' || !teacherForm.classId
        ? undefined
        : classes.find((c) => c.id === teacherForm.classId);
    const hasPassword = Boolean(teacherForm.password && teacherForm.password.trim().length > 0);

    const payload: Omit<User, 'id'> & { password?: string } = {
      name: teacherForm.name.trim(),
      email: teacherForm.email.trim(),
      role: 'teacher',
      grade: assignedClass?.grade,
      classId: assignedClass?.id,
      className: assignedClass?.name,
      avatar: teacherForm.avatar,
      status: 'active',
      passwordSet: hasPassword,
      needsActivation: !hasPassword,
      password: hasPassword ? teacherForm.password.trim() : undefined,
    };

    setSubmitting(true);
    try {
      const result = await addUser(payload);
      if (!result.ok && result.errorCode === 'ADMIN_SDK_UNCONFIGURED') {
        setShowAddTeacherModal(false);
        setPendingPreRegPayload({
          data: payload,
          reason: result.warning || '後端未配置 Firebase Admin SDK 憑證。',
        });
        return;
      }

      const teacherName = payload.name;
      setTeacherForm({
        name: '',
        email: '',
        classId: defaultClassId,
        password: '',
        showPassword: false,
        avatar: '👩‍🏫',
      });
      setShowAddTeacherModal(false);

      if (result.activationLink) {
        showToast(`教師「${teacherName}」已建立（Auth + Firestore 已同步）並已產生重設密碼連結！`);
      } else {
        handleMutationOutcome(
          result,
          hasPassword
            ? `教師「${teacherName}」已新增成功（密碼已設定並同步 Firebase Auth）！`
            : `教師「${teacherName}」已新增！標記為【尚未設定密碼】，須完成安全啟用方可登入。`
        );
      }
    } catch (err: any) {
      showToast(err?.message || '新增教師帳號失敗', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm explicit Firestore-only pre-registration fallback
  const handleConfirmPreRegistration = async () => {
    if (!pendingPreRegPayload || submitting) return;
    setSubmitting(true);
    try {
      const result = await addUser({
        ...pendingPreRegPayload.data,
        firestoreOnlyFallback: true,
      });
      setPendingPreRegPayload(null);
      handleMutationOutcome(result, `已建立「${pendingPreRegPayload.data.name}」Firestore 預備名冊。`);
    } catch (err: any) {
      showToast(err?.message || '寫入 Firestore 預備名冊失敗', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setEditFormData({
      name: user.name,
      email: user.email,
      classId: user.classId || 'none',
      studentNumber: user.studentNumber || '',
      avatar: user.avatar,
      status: user.status || 'active',
      newPassword: '',
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || submitting) return;

    const assignedClass =
      editFormData.classId === 'none' || !editFormData.classId
        ? undefined
        : classes.find((c) => c.id === editFormData.classId);

    const updates: Partial<User> & { newPassword?: string; firestoreOnlyFallback?: boolean } = {
      name: editFormData.name.trim(),
      email: editFormData.email.trim(),
      avatar: editFormData.avatar,
      status: editFormData.status,
      classId: assignedClass?.id,
      className: assignedClass?.name,
      grade: assignedClass?.grade,
      firestoreOnlyFallback: editingUser.authLinked === false,
    };

    if (editingUser.role === 'student') {
      updates.studentNumber = editFormData.studentNumber?.trim();
    }

    if (
      editingUser.role === 'teacher' &&
      editFormData.newPassword &&
      editFormData.newPassword.trim().length > 0
    ) {
      updates.passwordSet = true;
      updates.needsActivation = false;
      updates.newPassword = editFormData.newPassword.trim();
    }

    setSubmitting(true);
    try {
      const result = await updateUser(editingUser.id, updates);
      setEditingUser(null);
      handleMutationOutcome(result, `帳號「${updates.name}」已更新並同步確認！`);
    } catch (err: any) {
      showToast(err?.message || '更新帳號資料失敗', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingUser || submitting) return;
    const target = deletingUser;
    setSubmitting(true);
    try {
      const result = await deleteUser(target.id, target.authLinked === false);
      setDeletingUser(null);
      handleMutationOutcome(result, `已永久刪除「${target.name}」帳號資料。`);
    } catch (err: any) {
      showToast(err?.message || '刪除帳號失敗', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (userCategory === 'student' && u.role !== 'student') return false;
    if (userCategory === 'teacher' && u.role !== 'teacher') return false;
    if (userCategory === 'admin' && u.role !== 'admin') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = u.name.toLowerCase().includes(q);
      const matchEmail = u.email.toLowerCase().includes(q);
      const matchClass = u.className?.toLowerCase().includes(q);
      const matchNum = u.studentNumber?.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchClass && !matchNum) return false;
    }

    if (selectedClassFilter !== 'all' && u.classId !== selectedClassFilter) return false;

    if (statusFilter === 'active' && u.status === 'disabled') return false;
    if (statusFilter === 'disabled' && u.status !== 'disabled') return false;
    if (statusFilter === 'needsActivation' && !u.needsActivation && u.passwordSet !== false) {
      return false;
    }

    return true;
  });

  const studentsCount = users.filter((u) => u.role === 'student').length;
  const teachersCount = users.filter((u) => u.role === 'teacher').length;
  const adminsCount = users.filter((u) => u.role === 'admin').length;
  const unactivatedTeachersCount = users.filter(
    (u) => u.role === 'teacher' && (u.needsActivation || !u.passwordSet)
  ).length;
  const disabledUsersCount = users.filter((u) => u.status === 'disabled').length;

  const legacyUsersPresent = users.filter((u) => LEGACY_PRESET_USER_IDS.includes(u.id));

  if (currentUser?.role !== 'admin') {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-20 right-6 z-50 max-w-md p-4 rounded-2xl shadow-xl flex items-start gap-3 border animate-in fade-in slide-in-from-top-2 ${
            toast.type === 'error'
              ? 'bg-rose-900 text-white border-rose-700'
              : toast.type === 'warning'
              ? 'bg-amber-900 text-white border-amber-700'
              : 'bg-teal-900 text-white border-teal-700'
          }`}
        >
          {toast.type === 'error' || toast.type === 'warning' ? (
            <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
          )}
          <span className="text-xs font-bold leading-relaxed">{toast.message}</span>
        </div>
      )}

      {/* Top Admin Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-teal-100 shadow-2xs">
          <span className="text-xs font-bold text-slate-500">全校班級數</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-800">{classes.length}</span>
            <span className="text-xs text-slate-500">個班級</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-teal-700 mt-2 font-medium">
            <Layers className="w-3.5 h-3.5" /> 涵蓋 1-6 年級
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-teal-100 shadow-2xs">
          <span className="text-xs font-bold text-slate-500">學生總數</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-teal-600">{studentsCount}</span>
            <span className="text-xs text-slate-500">位同學</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-2">
            <GraduationCap className="w-3.5 h-3.5 text-teal-500" />
            <span>雲端 Firestore 即時同步中</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-teal-100 shadow-2xs">
          <span className="text-xs font-bold text-slate-500">教師與導師人數</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-sky-600">{teachersCount}</span>
            <span className="text-xs text-slate-500">位教師</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] mt-2">
            {unactivatedTeachersCount > 0 ? (
              <span className="text-amber-600 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> {unactivatedTeachersCount} 位待安全啟用
              </span>
            ) : (
              <span className="text-sky-600 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> 帳號皆已完成密碼設定
              </span>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-teal-100 shadow-2xs">
          <span className="text-xs font-bold text-slate-500">帳號停用管理</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-800">{disabledUsersCount}</span>
            <span className="text-xs text-slate-500">組已停用帳號</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-purple-700 mt-2 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" /> 停用帳號自動阻斷登入與 API
          </div>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md p-2 rounded-2xl border border-teal-100 shadow-2xs overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
            activeTab === 'users'
              ? 'bg-teal-600 text-white shadow-xs shadow-teal-600/20'
              : 'text-slate-600 hover:text-teal-700 hover:bg-teal-50/60'
          }`}
        >
          <Users className="w-4 h-4" /> 使用者管理 ({users.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('chat_viewer')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
            activeTab === 'chat_viewer'
              ? 'bg-teal-600 text-white shadow-xs shadow-teal-600/20'
              : 'text-slate-600 hover:text-teal-700 hover:bg-teal-50/60'
          }`}
        >
          <MessageSquare className="w-4 h-4" /> 學生 AI 對話紀錄
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('classes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
            activeTab === 'classes'
              ? 'bg-teal-600 text-white shadow-xs shadow-teal-600/20'
              : 'text-slate-600 hover:text-teal-700 hover:bg-teal-50/60'
          }`}
        >
          <Layers className="w-4 h-4" /> 班級管理 ({classes.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ai_monitor')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
            activeTab === 'ai_monitor'
              ? 'bg-teal-600 text-white shadow-xs shadow-teal-600/20'
              : 'text-slate-600 hover:text-teal-700 hover:bg-teal-50/60'
          }`}
        >
          <Activity className="w-4 h-4" /> AI 額度與服務監控
        </button>
      </div>

      {/* Tab 1: User Management */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-3xl p-6 border border-teal-100 shadow-2xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-600" /> 校園使用者與帳號權限管理
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                透過受保護的後端 API 與 Firebase Authentication / Firestore 同步管理帳號生命週期。
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => setShowAddStudentModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-all hover:scale-[1.02]"
              >
                <Plus className="w-3.5 h-3.5" /> 新增學生帳號
              </button>
              <button
                type="button"
                onClick={() => setShowAddTeacherModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition-all hover:scale-[1.02]"
              >
                <Plus className="w-3.5 h-3.5" /> 新增教師帳號
              </button>
            </div>
          </div>

          {legacyUsersPresent.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-amber-900">
                <strong>偵測到 {legacyUsersPresent.length} 筆舊版預設測試帳號：</strong>
                可一鍵清除先前匯入的多餘測試資料，僅保留精簡預設（學生、教師、管理員各 1 位）與真實註冊帳號。
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    const res = await cleanupLegacyPresetUsers();
                    showToast(`已清理 ${res.deletedUsers} 筆舊版預設使用者與 ${res.deletedClasses} 個舊版測試班級！`);
                  } catch (err: any) {
                    showToast(err?.message || '清理舊版預設資料失敗', 'error');
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="shrink-0 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs"
              >
                清理舊版預設測試帳號
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-2xl text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setUserCategory('all');
                  setStatusFilter('all');
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                  userCategory === 'all'
                    ? 'bg-white shadow-2xs text-slate-900'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4 text-slate-700" />
                全部登入端 ({users.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setUserCategory('student');
                  setStatusFilter('all');
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                  userCategory === 'student'
                    ? 'bg-white shadow-2xs text-teal-800'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GraduationCap className="w-4 h-4 text-teal-600" />
                學生端 ({studentsCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setUserCategory('teacher');
                  setStatusFilter('all');
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                  userCategory === 'teacher'
                    ? 'bg-white shadow-2xs text-sky-800'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4 text-sky-600" />
                教師端 ({teachersCount})
                {unactivatedTeachersCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800">
                    {unactivatedTeachersCount} 待啟用
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setUserCategory('admin');
                  setStatusFilter('all');
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                  userCategory === 'admin'
                    ? 'bg-white shadow-2xs text-purple-800'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                管理員端 ({adminsCount})
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="搜尋姓名、座號或信箱..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 w-48 sm:w-56"
                />
              </div>

              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              >
                <option value="all">所有班級</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              >
                <option value="all">全部帳號狀態</option>
                <option value="active">正常使用中 (Active)</option>
                <option value="disabled">已停用 (Disabled)</option>
                {userCategory !== 'student' && (
                  <option value="needsActivation">尚未設定密碼 (需安全啟用)</option>
                )}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-bold tracking-wider">
                  <th className="py-3 px-3">身分資訊</th>
                  <th className="py-3 px-3">帳號信箱與 Auth 綁定</th>
                  <th className="py-3 px-3">所屬班級 / 職務</th>
                  <th className="py-3 px-3">密碼與安全狀態</th>
                  <th className="py-3 px-3">帳號啟用狀態</th>
                  <th className="py-3 px-3 text-right">管理操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      查無符合條件的使用者帳號
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const isUserDisabled = user.status === 'disabled';
                    const isTeacherNeedsActivation =
                      user.role === 'teacher' && (user.needsActivation || user.passwordSet === false);
                    const isSelf = currentUser?.id === user.id;

                    return (
                      <tr
                        key={user.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isUserDisabled ? 'bg-slate-50/50 opacity-75' : ''
                        }`}
                      >
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl shrink-0 p-1 bg-slate-100 rounded-xl">
                              {user.avatar || '👤'}
                            </span>
                            <div>
                              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                {user.name}
                                {user.role === 'student' && user.studentNumber && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-teal-50 text-teal-700 border border-teal-200">
                                    {user.studentNumber} 號
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">
                                UID: {user.id.substring(0, 16)}
                                {user.id.length > 16 ? '...' : ''}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-mono text-[11px] text-slate-600">
                            {user.email || '無電子信箱'}
                          </div>
                          <div className="mt-1">
                            {user.authLinked ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                <Link2 className="w-2.5 h-2.5" /> Auth UID 已綁定
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-medium">
                                僅名冊 / 待登入綁定
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          {user.role === 'student' ? (
                            <div>
                              <span className="inline-block px-2 py-0.5 rounded-lg bg-teal-50 text-teal-800 font-semibold text-[11px] border border-teal-100">
                                {user.className || '未分班'}
                              </span>
                              {user.grade && (
                                <span className="text-[10px] text-slate-400 ml-1.5">({user.grade})</span>
                              )}
                            </div>
                          ) : user.role === 'teacher' ? (
                            <span className="inline-block px-2 py-0.5 rounded-lg bg-sky-50 text-sky-800 font-semibold text-[11px] border border-sky-100">
                              {user.className ? `${user.className} 責任導師` : '專任教師 / 輔導老師'}
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-lg bg-purple-50 text-purple-800 font-semibold text-[11px] border border-purple-100">
                              系統管理員 (Admin)
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          {user.role === 'teacher' ? (
                            isTeacherNeedsActivation ? (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                                  尚未設定密碼
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setActivatingUser(user)}
                                  className="text-[11px] text-sky-600 hover:text-sky-800 hover:underline font-bold"
                                >
                                  安全啟用
                                </button>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle className="w-3 h-3 text-emerald-500" />
                                密碼已設定 (正常)
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400 text-[11px]">標準校園登入</span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          {isUserDisabled ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <UserX className="w-3 h-3 text-rose-500" /> 已停用
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <UserCheck className="w-3 h-3 text-emerald-500" /> 正常使用中
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(user)}
                              className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                              title="修改使用者資料"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              disabled={isSelf}
                              onClick={async () => {
                                const newStatus = isUserDisabled ? 'active' : 'disabled';
                                try {
                                  const res = await toggleUserStatus(user.id, newStatus);
                                  handleMutationOutcome(
                                    res,
                                    `已將「${user.name}」設定為【${
                                      newStatus === 'active' ? '正常啟用' : '停用'
                                    }】！`
                                  );
                                } catch (err: any) {
                                  showToast(err?.message || '變更狀態失敗', 'error');
                                }
                              }}
                              className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 ${
                                isUserDisabled
                                  ? 'text-emerald-600 hover:bg-emerald-50'
                                  : 'text-amber-600 hover:bg-amber-50'
                              }`}
                              title={isSelf ? '不可停用自己的管理員帳號' : isUserDisabled ? '重新啟用此帳號' : '停用此帳號'}
                            >
                              {isUserDisabled ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                            </button>

                            <button
                              type="button"
                              disabled={isSelf}
                              onClick={() => setDeletingUser(user)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30"
                              title={isSelf ? '不可刪除自己的管理員帳號' : '刪除帳號'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Student AI Chat Viewer (Admin School-wide Access) */}
      {activeTab === 'chat_viewer' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-teal-100 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-800">
                全校學生 AI 對話紀錄篩選（管理員端）
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                依系統授權政策，管理員可查閱全校所有班級學生與心心 AI 的談話內容與稽核日誌。
              </p>
            </div>
            <select
              value={adminChatClassFilter}
              onChange={(e) => setAdminChatClassFilter(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs sm:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">全校所有班級</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.grade})
                </option>
              ))}
            </select>
          </div>

          <StudentAIChatViewer selectedClassId={adminChatClassFilter} />
        </div>
      )}

      {/* Tab 3: Class Management */}
      {activeTab === 'classes' && (
        <div className="bg-white rounded-3xl p-6 border border-teal-100 shadow-2xs">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-extrabold text-slate-800">全校班級列表</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                建立與管理各年級班級、指派班級責任導師
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddClass(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 transition-all hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" /> 新增班級
            </button>
          </div>

          {showAddClass && (
            <form
              onSubmit={handleCreateClass}
              className="mb-6 p-4 rounded-2xl bg-teal-50/60 border border-teal-200 animate-in fade-in"
            >
              <h4 className="text-xs font-bold text-teal-900 mb-3">新增班級資訊</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">班級名稱</label>
                  <input
                    type="text"
                    required
                    placeholder="例如: 四年一班"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">所屬年級</label>
                  <select
                    value={newClassGrade}
                    onChange={(e) => setNewClassGrade(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="一年級">一年級</option>
                    <option value="二年級">二年級</option>
                    <option value="三年級">三年級</option>
                    <option value="四年級">四年級</option>
                    <option value="五年級">五年級</option>
                    <option value="六年級">六年級</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">指派導師姓名</label>
                  <input
                    type="text"
                    required
                    placeholder="例如: 林美玲 老師"
                    value={newClassTeacherName}
                    onChange={(e) => setNewClassTeacherName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setShowAddClass(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-200/50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 shadow-xs disabled:opacity-50"
                >
                  {submitting ? '建立中...' : '確認建立'}
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((cls) => {
              const studentsInThisClass = users.filter((u) => u.classId === cls.id && u.role === 'student');
              return (
                <div
                  key={cls.id}
                  className="p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-teal-200 hover:shadow-xs transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-teal-100 text-teal-800">
                      {cls.grade}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">ID: {cls.id}</span>
                  </div>
                  <h4 className="text-lg font-black text-slate-800">{cls.name}</h4>
                  <p className="text-xs text-slate-500 mt-1">責任導師：{cls.teacherName}</p>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      學生總數：<strong className="text-slate-800">{studentsInThisClass.length}</strong> 人
                    </span>
                    <span className="text-teal-700 font-semibold">運行正常</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: AI Usage & Cost Monitor */}
      {activeTab === 'ai_monitor' && (
        <div className="bg-white rounded-3xl p-6 border border-teal-100 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Activity className="w-5 h-5 text-teal-600" />
                Gemini AI 呼叫額度、Token 監控與系統整合狀態
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                即時檢視伺服器端速率限制（Rate Limiting）、每日配額與 Firebase Admin SDK 配置狀況。
              </p>
            </div>
            <button
              type="button"
              onClick={loadAiUsage}
              disabled={loadingUsage}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold border border-teal-200 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingUsage ? 'animate-spin' : ''}`} />
              重新整理監控數據
            </button>
          </div>

          {!aiUsage ? (
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
              {loadingUsage ? '正在載入後端監控資料...' : '無法取得監控數據，請確認管理員憑證有效。'}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-100">
                  <span className="text-slate-500 block font-bold">目前使用模型</span>
                  <span className="text-base font-black text-teal-900 font-mono mt-1 block">
                    {aiUsage.model}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-100">
                  <span className="text-slate-500 block font-bold">今日 API 請求次數</span>
                  <span className="text-xl font-black text-sky-900 mt-1 block">
                    {aiUsage.totalRequestsToday} 次
                  </span>
                  <span className="text-[11px] text-sky-700">
                    成功 {aiUsage.successfulRequestsToday} / 失敗 {aiUsage.failedRequestsToday}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                  <span className="text-slate-500 block font-bold">今日消耗 Tokens</span>
                  <span className="text-xl font-black text-emerald-900 mt-1 block">
                    {(aiUsage.totalPromptTokensToday + aiUsage.totalOutputTokensToday).toLocaleString()}
                  </span>
                  <span className="text-[11px] text-emerald-700">
                    輸入 {aiUsage.totalPromptTokensToday.toLocaleString()} · 輸出 {aiUsage.totalOutputTokensToday.toLocaleString()}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-100">
                  <span className="text-slate-500 block font-bold">單人配額保護</span>
                  <span className="text-xl font-black text-purple-900 mt-1 block">
                    {aiUsage.dailyLimitPerUser} 則/日
                  </span>
                  <span className="text-[11px] text-purple-700">
                    每分鐘上限 {aiUsage.minuteLimitPerUser} 則（今日活躍 {aiUsage.activeUsersToday} 人）
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block">GEMINI_API_KEY 後端狀態</span>
                    <span className="text-[11px] text-slate-500">僅存於伺服器端環境變數，前端絕不暴露</span>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full font-bold ${
                      aiUsage.geminiKeyConfigured
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {aiUsage.geminiKeyConfigured ? '已設定啟用' : '尚未設定'}
                  </span>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block">Firebase Admin SDK 狀態</span>
                    <span className="text-[11px] text-slate-500">
                      需設定 FIREBASE_SERVICE_ACCOUNT_JSON 方可由後端直接建立/停用/刪除 Auth 帳號
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full font-bold ${
                      aiUsage.adminSdkReady
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {aiUsage.adminSdkReady ? 'Admin SDK 就緒' : '尚未配置憑證'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* Modal 1: Add Student */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-teal-100 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowAddStudentModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className="p-2 bg-teal-100 text-teal-800 rounded-xl">
                <GraduationCap className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-slate-800">新增學生帳號</h3>
                <p className="text-xs text-slate-400">建立 Firebase Auth 與 Firestore 學生檔案</p>
              </div>
            </div>

            <form onSubmit={handleCreateStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  學生姓名 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="例如: 謝佳宏"
                  value={studentForm.name}
                  onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    所屬班級 <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={studentForm.classId}
                    onChange={(e) => setStudentForm({ ...studentForm, classId: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.grade})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">座號 / 學號</label>
                  <input
                    type="text"
                    placeholder="例如: 09"
                    value={studentForm.studentNumber}
                    onChange={(e) => setStudentForm({ ...studentForm, studentNumber: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  電子信箱 (選填，留空將依座號自動產生)
                </label>
                <input
                  type="email"
                  placeholder="student@school.edu.tw"
                  value={studentForm.email}
                  onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">代表頭像徽章</label>
                <div className="flex items-center gap-2">
                  {['🧒', '👦', '👧', '🧑', '🎒', '🌟', '🦄', '🦁'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setStudentForm({ ...studentForm, avatar: emoji })}
                      className={`text-xl p-2 rounded-xl transition-all ${
                        studentForm.avatar === emoji
                          ? 'bg-teal-100 ring-2 ring-teal-500 scale-110'
                          : 'bg-slate-100 hover:bg-slate-200'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs"
                >
                  {submitting ? '同步建立中...' : '確認建立學生帳號'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add Teacher */}
      {showAddTeacherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-sky-100 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowAddTeacherModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className="p-2 bg-sky-100 text-sky-800 rounded-xl">
                <Users className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-slate-800">新增教師帳號</h3>
                <p className="text-xs text-slate-400">建立教師檔案與設定班級授權</p>
              </div>
            </div>

            <form onSubmit={handleCreateTeacher} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  教師姓名 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="例如: 林美玲 老師"
                  value={teacherForm.name}
                  onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  公務電子信箱 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="meiling.lin@school.edu.tw"
                  value={teacherForm.email}
                  onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">負責班級</label>
                <select
                  value={teacherForm.classId}
                  onChange={(e) => setTeacherForm({ ...teacherForm, classId: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="none">專任教師 / 無特定指定班級</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.grade})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3.5 bg-sky-50/70 border border-sky-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-sky-700" />
                    設定初始登入密碼 <span className="text-slate-400 font-normal">(選填，至少 6 碼)</span>
                  </label>
                  <span className="text-[10px] text-sky-700 font-medium">允許留空不填</span>
                </div>

                <div className="relative">
                  <input
                    type={teacherForm.showPassword ? 'text' : 'password'}
                    placeholder="留空將標記為尚未設定密碼"
                    value={teacherForm.password}
                    onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
                    className="w-full pr-10 pl-3 py-2 text-xs rounded-xl border border-sky-300 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() => setTeacherForm({ ...teacherForm, showPassword: !teacherForm.showPassword })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {teacherForm.showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <p className="text-[11px] text-sky-800 leading-relaxed">
                  💡 <strong>安全啟用機制說明：</strong> 若留空不填，帳號將標記為
                  <span className="text-amber-700 font-bold">【尚未設定密碼】</span>
                  ，必須完成安全啟用方可進入教師後台。
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">代表頭像徽章</label>
                <div className="flex items-center gap-2">
                  {['👩‍🏫', '👨‍🏫', '👩‍💼', '🧑‍🏫', '📚', '🔬', '🎨', '💼'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setTeacherForm({ ...teacherForm, avatar: emoji })}
                      className={`text-xl p-2 rounded-xl transition-all ${
                        teacherForm.avatar === emoji
                          ? 'bg-sky-100 ring-2 ring-sky-500 scale-110'
                          : 'bg-slate-100 hover:bg-slate-200'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddTeacherModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs"
                >
                  {submitting ? '同步建立中...' : '確認建立教師帳號'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Explicit Pre-registration Choice when Firebase Admin SDK is unconfigured */}
      {pendingPreRegPayload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-amber-200 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-800">
                  無法自動同步建立 Firebase Authentication 帳號
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {pendingPreRegPayload.reason}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
              <p>
                <strong>待建立對象：</strong> {pendingPreRegPayload.data.name}（{pendingPreRegPayload.data.email}）
              </p>
              <p className="text-[11px] text-slate-500">
                若您尚未在伺服器端設定 <code>FIREBASE_SERVICE_ACCOUNT_JSON</code>，您仍可先儲存至 Firestore 預備名冊（標記為 <code>authLinked: false</code>），待環境變數設定完成或請使用者以 Google 登入後綁定。
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingPreRegPayload(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100"
              >
                取消建立
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmPreRegistration}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold"
              >
                {submitting ? '寫入中...' : '仍先建立 Firestore 預備名冊 (authLinked: false)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Edit User */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className="p-2 bg-slate-100 text-slate-800 rounded-xl">
                <Edit2 className="w-5 h-5 text-teal-600" />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-slate-800">
                  修改{editingUser.role === 'student' ? '學生' : editingUser.role === 'teacher' ? '教師' : '管理員'}帳號資料
                </h3>
                <p className="text-xs text-slate-400 font-mono">UID: {editingUser.id}</p>
              </div>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">姓名</label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">電子信箱</label>
                <input
                  type="email"
                  required
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">所屬班級 / 職務</label>
                  <select
                    value={editFormData.classId}
                    onChange={(e) => setEditFormData({ ...editFormData, classId: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="none">無特定班級</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.grade})
                      </option>
                    ))}
                  </select>
                </div>

                {editingUser.role === 'student' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">座號 / 學號</label>
                    <input
                      type="text"
                      value={editFormData.studentNumber || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, studentNumber: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">帳號啟用狀態</label>
                    <select
                      value={editFormData.status}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as any })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="active">正常啟用 (Active)</option>
                      <option value="disabled">已停用 (Disabled)</option>
                    </select>
                  </div>
                )}
              </div>

              {editingUser.role === 'teacher' && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                    重設登入密碼 (選填，至少 6 碼)
                  </label>
                  <input
                    type="password"
                    placeholder="若欲重設密碼請在此輸入新密碼"
                    value={editFormData.newPassword || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, newPassword: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="text-[10px] text-slate-400">
                    若後端已設定 Admin SDK 憑證，將同步更新 Firebase Auth 密碼。
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs"
                >
                  {submitting ? '同步儲存中...' : '儲存修改'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Teacher Security Activation Link */}
      {activatingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-amber-200 shadow-2xl relative">
            <button
              type="button"
              onClick={() => {
                setActivatingUser(null);
                setCopiedLink(false);
              }}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <span className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-slate-800">
                  教師安全啟用流程：{activatingUser.name}
                </h3>
                <p className="text-xs text-amber-700 font-semibold">此教師帳號建立時未設定密碼，需完成安全啟用</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-700 block">Firebase Auth 密碼設定／重設安全連結：</span>
                {loadingActivationLink ? (
                  <p className="text-slate-500">正在向後端請求真實安全啟用連結...</p>
                ) : realActivationLink ? (
                  <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="font-mono text-[11px] text-slate-600 truncate flex-1">
                      {realActivationLink}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(realActivationLink);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2500);
                      }}
                      className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors shrink-0"
                      title="複製連結"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                    {activationLinkError || '尚未產生啟用連結；教師可於登入畫面點擊「忘記密碼」或改用 Google 登入驗證信箱。'}
                  </p>
                )}
                {copiedLink && (
                  <span className="text-[11px] text-emerald-600 font-bold block">
                    ✓ 安全啟用連結已複製到剪貼簿！
                  </span>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActivatingUser(null);
                    setCopiedLink(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100"
                >
                  關閉
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={async () => {
                    setSubmitting(true);
                    try {
                      const res = await activateTeacherAccount(activatingUser.id);
                      setActivatingUser(null);
                      handleMutationOutcome(
                        res,
                        `已確認完成「${activatingUser.name}」安全啟用標記！`
                      );
                    } catch (err: any) {
                      showToast(err?.message || '完成啟用失敗', 'error');
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> 標記完成安全啟用
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Delete Confirmation */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-rose-100 shadow-2xl relative">
            <div className="flex items-center gap-2 mb-3">
              <span className="p-2 bg-rose-100 text-rose-800 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-slate-800">確認刪除帳號？</h3>
                <p className="text-xs text-rose-600 font-semibold">
                  {deletingUser.authLinked
                    ? '此動作將同步刪除 Firebase Authentication 與 Firestore 資料'
                    : '此動作將從 Firestore 永久移除此使用者名冊'}
                </p>
              </div>
            </div>

            <div className="my-4 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-1">
              <p>
                <strong>姓名：</strong> {deletingUser.name}
              </p>
              <p>
                <strong>身分：</strong>{' '}
                {deletingUser.role === 'student'
                  ? '學生'
                  : deletingUser.role === 'teacher'
                  ? '教師'
                  : '管理員'}
              </p>
              <p>
                <strong>信箱：</strong> {deletingUser.email}
              </p>
              {deletingUser.className && (
                <p>
                  <strong>班級：</strong> {deletingUser.className}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100"
              >
                取消
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs"
              >
                {submitting ? '刪除中...' : '確定刪除帳號'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
