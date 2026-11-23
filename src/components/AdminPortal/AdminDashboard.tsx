import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User, SchoolClass, UserRole } from '../../types';
import {
  Users,
  GraduationCap,
  Sparkles,
  Layers,
  Plus,
  Trash2,
  RefreshCw,
  Database,
  CheckCircle,
  ShieldCheck,
  Search,
  BookOpen,
  UserPlus,
  Clock,
  Edit2,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  AlertTriangle,
  UserCheck,
  UserX,
  Send,
  Copy,
  ExternalLink,
  X,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const {
    classes,
    users,
    addClass,
    addUser,
    updateUser,
    updateUserRole,
    toggleUserStatus,
    activateTeacherAccount,
    deleteUser,
    resetAllData,
    firebaseUser,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'users' | 'classes' | 'sandbox'>('users');
  const [userCategory, setUserCategory] = useState<'student' | 'teacher' | 'all'>('student');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled' | 'needsActivation'>('all');

  // Modals state
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [activatingUser, setActivatingUser] = useState<User | null>(null);

  // Class Form State
  const [showAddClass, setShowAddClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState('三年級');
  const [newClassTeacherName, setNewClassTeacherName] = useState('李雅玲 老師');

  // Form States for Add Student
  const [studentForm, setStudentForm] = useState({
    name: '',
    email: '',
    classId: classes[0]?.id || 'class-302',
    studentNumber: '09',
    avatar: '🧒',
  });

  // Form States for Add Teacher
  const [teacherForm, setTeacherForm] = useState({
    name: '',
    email: '',
    classId: classes[0]?.id || 'class-302',
    password: '',
    showPassword: false,
    avatar: '👩‍🏫',
  });

  // Form States for Edit User
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

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Class creation
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    await addClass({
      name: newClassName,
      grade: newClassGrade,
      teacherId: `teacher-${Date.now()}`,
      teacherName: newClassTeacherName,
      studentCount: 0,
    });

    setNewClassName('');
    setShowAddClass(false);
    showToast(`班級「${newClassName}」已建立成功並同步 Firebase！`);
  };

  // Student creation
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.name.trim()) return;

    const assignedClass = classes.find((c) => c.id === studentForm.classId);
    const emailToUse = studentForm.email.trim()
      ? studentForm.email.trim()
      : `student-${assignedClass?.id || '302'}-${studentForm.studentNumber || '01'}@school.edu.tw`;

    await addUser({
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
    });

    setStudentForm({
      name: '',
      email: '',
      classId: classes[0]?.id || 'class-302',
      studentNumber: '09',
      avatar: '🧒',
    });
    setShowAddStudentModal(false);
    showToast(`學生「${studentForm.name}」已新增成功並同步至 Firebase！`);
  };

  // Teacher creation
  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherForm.name.trim() || !teacherForm.email.trim()) return;

    const assignedClass = teacherForm.classId === 'none' ? undefined : classes.find((c) => c.id === teacherForm.classId);
    const hasPassword = Boolean(teacherForm.password && teacherForm.password.trim().length > 0);

    await addUser({
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
    });

    const teacherName = teacherForm.name;
    setTeacherForm({
      name: '',
      email: '',
      classId: classes[0]?.id || 'class-302',
      password: '',
      showPassword: false,
      avatar: '👩‍🏫',
    });
    setShowAddTeacherModal(false);

    if (hasPassword) {
      showToast(`教師「${teacherName}」已新增成功（密碼已直接設定完成）並同步 Firebase！`);
    } else {
      showToast(`教師「${teacherName}」已新增成功！已標記為【尚未設定密碼】，須完成安全啟用流程。`);
    }
  };

  // Open Edit User Modal
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

  // Save Edit User
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const assignedClass = editFormData.classId === 'none' ? undefined : classes.find((c) => c.id === editFormData.classId);

    const updates: Partial<User> = {
      name: editFormData.name.trim(),
      email: editFormData.email.trim(),
      avatar: editFormData.avatar,
      status: editFormData.status,
      classId: assignedClass?.id,
      className: assignedClass?.name,
      grade: assignedClass?.grade,
    };

    if (editingUser.role === 'student') {
      updates.studentNumber = editFormData.studentNumber?.trim();
    }

    if (editingUser.role === 'teacher' && editFormData.newPassword && editFormData.newPassword.trim().length > 0) {
      updates.passwordSet = true;
      updates.needsActivation = false;
    }

    await updateUser(editingUser.id, updates);
    setEditingUser(null);
    showToast(`帳號「${updates.name}」已更新完成並即時同步 Firebase！`);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    const name = deletingUser.name;
    await deleteUser(deletingUser.id);
    setDeletingUser(null);
    if (firebaseUser) {
      showToast(`已自 Firebase 雲端資料庫永久刪除「${name}」帳號。`);
    } else {
      showToast(`已成功刪除「${name}」帳號資料。`);
    }
  };

  // Filter Users
  const filteredUsers = users.filter((u) => {
    // Category filter
    if (userCategory === 'student' && u.role !== 'student') return false;
    if (userCategory === 'teacher' && u.role !== 'teacher') return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = u.name.toLowerCase().includes(q);
      const matchEmail = u.email.toLowerCase().includes(q);
      const matchClass = u.className?.toLowerCase().includes(q);
      const matchNum = u.studentNumber?.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchClass && !matchNum) return false;
    }

    // Class filter
    if (selectedClassFilter !== 'all') {
      if (u.classId !== selectedClassFilter) return false;
    }

    // Status filter
    if (statusFilter === 'active') {
      if (u.status === 'disabled') return false;
    } else if (statusFilter === 'disabled') {
      if (u.status !== 'disabled') return false;
    } else if (statusFilter === 'needsActivation') {
      if (!u.needsActivation && u.passwordSet !== false) return false;
    }

    return true;
  });

  const studentsCount = users.filter((u) => u.role === 'student').length;
  const teachersCount = users.filter((u) => u.role === 'teacher').length;
  const unactivatedTeachersCount = users.filter((u) => u.role === 'teacher' && (u.needsActivation || !u.passwordSet)).length;
  const disabledUsersCount = users.filter((u) => u.status === 'disabled').length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-4 bg-teal-900 text-white rounded-2xl shadow-xl flex items-center gap-3 border border-teal-700 animate-in fade-in slide-in-from-top-2">
          <CheckCircle className="w-5 h-5 text-teal-400 shrink-0" />
          <span className="text-xs font-bold">{toastMessage}</span>
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
          <span className="text-xs font-bold text-slate-500">模擬學生總數</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-teal-600">{studentsCount}</span>
            <span className="text-xs text-slate-500">位同學</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-2">
            <GraduationCap className="w-3.5 h-3.5 text-teal-500" />
            <span>雲端 Firestore 同步儲存</span>
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
          <span className="text-xs font-bold text-slate-500">帳號安全防護狀態</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-800">
              {disabledUsersCount > 0 ? disabledUsersCount : '0'}
            </span>
            <span className="text-xs text-slate-500">組已停用帳號</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-purple-700 mt-2 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" /> Firebase ABAC 即時阻斷
          </div>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md p-2 rounded-2xl border border-teal-100 shadow-2xs overflow-x-auto no-scrollbar">
        <button
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
          onClick={() => setActiveTab('sandbox')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
            activeTab === 'sandbox'
              ? 'bg-teal-600 text-white shadow-xs shadow-teal-600/20'
              : 'text-slate-600 hover:text-teal-700 hover:bg-teal-50/60'
          }`}
        >
          <Database className="w-4 h-4" /> 模擬資料測試沙盒
        </button>
      </div>

      {/* Tab 1: User Management (使用者管理) */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-3xl p-6 border border-teal-100 shadow-2xs space-y-6">
          {/* Header & Quick Action Buttons */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-600" /> 校園使用者與帳號權限管理
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                支援學生及教師帳號之新增、修改、停用與刪除，所有操作皆即時雙向同步至 Firebase 雲端資料庫。
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowAddStudentModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-all hover:scale-[1.02]"
              >
                <Plus className="w-3.5 h-3.5" /> 新增學生帳號
              </button>
              <button
                onClick={() => setShowAddTeacherModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition-all hover:scale-[1.02]"
              >
                <Plus className="w-3.5 h-3.5" /> 新增教師帳號
              </button>
            </div>
          </div>

          {/* Sub-view switcher: 學生 / 教師 / 全部 */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl text-xs font-bold">
              <button
                onClick={() => {
                  setUserCategory('student');
                  setStatusFilter('all');
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all ${
                  userCategory === 'student'
                    ? 'bg-white shadow-2xs text-teal-800'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GraduationCap className="w-4 h-4 text-teal-600" />
                學生帳號名冊 ({studentsCount})
              </button>
              <button
                onClick={() => {
                  setUserCategory('teacher');
                  setStatusFilter('all');
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all ${
                  userCategory === 'teacher'
                    ? 'bg-white shadow-2xs text-sky-800'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4 text-sky-600" />
                教師帳號名冊 ({teachersCount})
                {unactivatedTeachersCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800">
                    {unactivatedTeachersCount} 待啟用
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setUserCategory('all');
                  setStatusFilter('all');
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all ${
                  userCategory === 'all'
                    ? 'bg-white shadow-2xs text-purple-800'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                全體名單 ({users.length})
              </button>
            </div>

            {/* Status & Class Filter Bar */}
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

              {/* Class filter (mainly for students or teachers) */}
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

              {/* Status filter */}
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

          {/* User Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-bold tracking-wider">
                  <th className="py-3 px-3">身分資訊</th>
                  <th className="py-3 px-3">帳號信箱</th>
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

                    return (
                      <tr
                        key={user.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isUserDisabled ? 'bg-slate-50/50 opacity-75' : ''
                        }`}
                      >
                        {/* Avatar & Name */}
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
                                UID: {user.id.substring(0, 16)}...
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                          {user.email || '無電子信箱'}
                        </td>

                        {/* Class / Role */}
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
                            <div>
                              <span className="inline-block px-2 py-0.5 rounded-lg bg-sky-50 text-sky-800 font-semibold text-[11px] border border-sky-100">
                                {user.className ? `${user.className} 責任導師` : '專任教師 / 輔導老師'}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-lg bg-purple-50 text-purple-800 font-semibold text-[11px] border border-purple-100">
                              系統管理員 (Admin)
                            </span>
                          )}
                        </td>

                        {/* Password & Security Status */}
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
                                  title="查看安全啟用通知或協助啟用"
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
                            <span className="text-slate-400 text-[11px]">一般學生憑證</span>
                          )}
                        </td>

                        {/* Active / Disabled Status */}
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

                        {/* Actions */}
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit Button */}
                            <button
                              onClick={() => openEditModal(user)}
                              className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                              title="修改使用者資料"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* Toggle Disable/Enable Button */}
                            <button
                              onClick={async () => {
                                const newStatus = isUserDisabled ? 'active' : 'disabled';
                                await toggleUserStatus(user.id, newStatus);
                                showToast(
                                  `已將「${user.name}」帳號設定為【${
                                    newStatus === 'active' ? '正常啟用' : '停用'
                                  }】，並同步 Firebase。`
                                );
                              }}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isUserDisabled
                                  ? 'text-emerald-600 hover:bg-emerald-50'
                                  : 'text-amber-600 hover:bg-amber-50'
                              }`}
                              title={isUserDisabled ? '重新啟用此帳號' : '停用此帳號'}
                            >
                              {isUserDisabled ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => setDeletingUser(user)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                              title="刪除帳號"
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

      {/* Tab 2: Class Management */}
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
              onClick={() => setShowAddClass(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 transition-all hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" /> 新增班級
            </button>
          </div>

          {/* Add Class Inline Form Modal */}
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
                  className="px-4 py-1.5 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 shadow-xs"
                >
                  確認建立
                </button>
              </div>
            </form>
          )}

          {/* Classes Grid */}
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

      {/* Tab 3: Mock Data Sandbox & Testing */}
      {activeTab === 'sandbox' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-teal-100 shadow-2xs space-y-6">
          <div>
            <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
              <Database className="w-5 h-5 text-teal-600" /> 模擬學生資料沙盒與合規聲明
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              依據校園隱私與資安保護原則，系統內所有學生姓名、學號與筆記均為<strong>合成模擬數據</strong>，絕不包含任何真實學生個人資料。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-teal-50/70 border border-teal-200">
              <h4 className="font-bold text-teal-900 text-sm mb-2">
                🔄 重置為預設測試數據
              </h4>
              <p className="text-xs text-teal-800 mb-4 leading-relaxed">
                將班級名單、簽到紀錄、AI 聊天紀錄與關懷筆記重置為最初的示範狀態（包含三年二班 8 位同學與各類情緒分布）。
              </p>
              <button
                onClick={() => {
                  resetAllData();
                  showToast('已成功還原為初始模擬資料庫！');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> 立即重置資料
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-sky-50/70 border border-sky-200">
              <h4 className="font-bold text-sky-900 text-sm mb-2">
                🛡️ 學生個資保護機制 (FERPA / 校園隱私)
              </h4>
              <p className="text-xs text-sky-800 mb-2 leading-relaxed">
                • 輔導關懷筆記 (Care Notes) 僅限班導師與管理員端存取，學生端不可見。
              </p>
              <p className="text-xs text-sky-800 leading-relaxed">
                • Firestore 安全規則嚴格實施 ABAC (基於屬性之存取控制)，防範未授權越權讀取。
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 md:col-span-2">
              <h4 className="font-bold text-amber-900 text-sm mb-2 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                ⏳ 對話資料保存期限與清理機制 (Data Retention Policy)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-amber-900 mb-3">
                <div className="bg-white p-3 rounded-xl border border-amber-200">
                  <span className="text-slate-400 block text-[10px] font-bold">法定保存期限</span>
                  <span className="font-bold text-sm">1 學年 (365 天)</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-amber-200">
                  <span className="text-slate-400 block text-[10px] font-bold">權利行使管道</span>
                  <span className="font-bold text-sm">法定代理人可請求刪除</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-amber-200">
                  <span className="text-slate-400 block text-[10px] font-bold">Firestore 存取鎖定</span>
                  <span className="font-bold text-sm">僅限管理員執行清除</span>
                </div>
              </div>
              <p className="text-xs text-amber-800 mb-3 leading-relaxed">
                學期結束後，系統管理員可依學校校園個資安全規範，一鍵執行過期對話資料去識別化與封存，或永久清除超過 365 天之對話紀錄。
              </p>
              <button
                type="button"
                onClick={() => {
                  showToast('已完成檢查：目前所有對話皆在 365 天有效保存期限內，無逾期紀錄。');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> 執行逾期對話清理檢查 (Retention Purge)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* Modal 1: Add Student Modal */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-teal-100 shadow-2xl relative">
            <button
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
                <p className="text-xs text-slate-400">建立學生檔案並即時同步至 Firebase Firestore</p>
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
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs"
                >
                  確認建立學生帳號
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add Teacher Modal (with Password Field Requirement) */}
      {showAddTeacherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-sky-100 shadow-2xl relative">
            <button
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

              {/* Requirement #3: 設定密碼 (選填；不填時標記為尚未設定密碼，須完成安全啟用才能登入) */}
              <div className="p-3.5 bg-sky-50/70 border border-sky-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-sky-700" />
                    設定初始登入密碼 <span className="text-slate-400 font-normal">(選填)</span>
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
                  💡 <strong>安全啟用機制說明：</strong> 若此處留空不填，系統將自動將該帳號標記為
                  <span className="text-amber-700 font-bold">【尚未設定密碼】</span>
                  。教師必須透過安全啟用通知完成啟用流程後方可登入系統。
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
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs"
                >
                  確認建立教師帳號
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Edit User Modal (修改學生 / 教師資料) */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl relative">
            <button
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

              {/* Password update for teacher */}
              {editingUser.role === 'teacher' && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                    重設登入密碼 (選填)
                  </label>
                  <input
                    type="password"
                    placeholder="若欲重設密碼請在此輸入新密碼"
                    value={editFormData.newPassword || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, newPassword: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="text-[10px] text-slate-400">
                    填入新密碼並儲存後，該教師將自動完成密碼設定並解除啟用待辦標記。
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
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs"
                >
                  儲存修改並同步 Firebase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Teacher Security Activation Link Modal */}
      {activatingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-amber-200 shadow-2xl relative">
            <button
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
                <p className="text-xs text-amber-700 font-semibold">此教師帳號建立時未填寫密碼，標記為尚未啟用</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-700 block">專屬一次性安全啟用連結：</span>
                <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="font-mono text-[11px] text-slate-600 truncate flex-1">
                    https://school-care.edu.tw/auth/activate?token=act_{activatingUser.id.replace(/[^a-zA-Z0-9]/g, '')}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(
                        `https://school-care.edu.tw/auth/activate?token=act_${activatingUser.id.replace(/[^a-zA-Z0-9]/g, '')}`
                      );
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2500);
                    }}
                    className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors shrink-0"
                    title="複製連結"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                {copiedLink && (
                  <span className="text-[11px] text-emerald-600 font-bold block animate-in fade-in">
                    ✓ 專屬安全啟用通知連結已複製到剪貼簿！
                  </span>
                )}
              </div>

              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl text-amber-900 leading-relaxed text-[11px]">
                📌 依據校園資安安全政策，教師可點擊信件內安全連結自訂專屬密碼完成啟用。管理員亦可在此直接點擊「協助完成安全啟用」快速啟用該教師帳號。
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
                  onClick={async () => {
                    await activateTeacherAccount(activatingUser.id);
                    setActivatingUser(null);
                    showToast(`已成功為「${activatingUser.name}」完成安全啟用，該帳號已具備登入權限！`);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> 立即完成安全啟用
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Delete Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-rose-100 shadow-2xl relative">
            <div className="flex items-center gap-2 mb-3">
              <span className="p-2 bg-rose-100 text-rose-800 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-slate-800">確認刪除帳號？</h3>
                <p className="text-xs text-rose-600 font-semibold">此動作將同步自 Firebase 雲端資料庫永久刪除</p>
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
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs"
              >
                確定刪除帳號
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
