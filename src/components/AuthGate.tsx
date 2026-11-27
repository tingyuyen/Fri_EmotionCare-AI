import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import {
  HeartHandshake,
  ShieldCheck,
  Mail,
  Lock,
  GraduationCap,
  Sparkles,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  RefreshCw,
  UserCheck,
  UserPlus,
} from 'lucide-react';

const PENDING_ROLE_KEY = 'pending_registration_role';

export const AuthGate: React.FC = () => {
  const {
    firebaseUser,
    authLoading,
    profileLoading,
    currentUser,
    bootstrapStatus,
    accountBlockedReason,
    classes,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resendVerificationEmail,
    sendResetPasswordEmail,
    claimInitialAdmin,
    completeFirstLoginSetup,
    signOutUser,
  } = useApp();

  const [loginTab, setLoginTab] = useState<'google' | 'email'>('google');
  const [emailMode, setEmailMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selected role during registration / onboarding (teacher | student | admin)
  const [selectedRole, setSelectedRole] = useState<UserRole>(() => {
    try {
      const saved = sessionStorage.getItem(PENDING_ROLE_KEY);
      if (saved === 'student' || saved === 'teacher' || saved === 'admin') {
        return saved;
      }
    } catch {
      // ignore storage errors
    }
    return 'student';
  });

  // First-login onboarding fields
  const [profileName, setProfileName] = useState(firebaseUser?.displayName || '');
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || 'class-302');
  const [studentNumber, setStudentNumber] = useState('01');

  useEffect(() => {
    if (firebaseUser?.displayName && !profileName) {
      setProfileName(firebaseUser.displayName);
    }
  }, [firebaseUser?.displayName, profileName]);

  useEffect(() => {
    if (classes.length > 0 && !classes.some((c) => c.id === selectedClassId)) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  const handleSelectRole = (role: UserRole) => {
    setSelectedRole(role);
    setAuthError(null);
    try {
      sessionStorage.setItem(PENDING_ROLE_KEY, role);
    } catch {
      // ignore
    }
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-slate-50 to-emerald-50 flex flex-col items-center justify-center p-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-teal-500/20 mb-4 animate-pulse">
          <HeartHandshake className="w-7 h-7" />
        </div>
        <p className="text-sm font-bold text-slate-700">正在安全驗證校園身分與雲端權限...</p>
        <p className="text-xs text-slate-400 mt-1">請稍候，系統正等待 Firebase Authentication 回應</p>
      </div>
    );
  }

  // Case 1: User account is disabled
  if (firebaseUser && accountBlockedReason) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-rose-200 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-slate-800">帳號暫時無法存取</h2>
          <p className="text-xs text-rose-700 leading-relaxed bg-rose-50 p-3.5 rounded-2xl border border-rose-100">
            {accountBlockedReason}
          </p>
          <button
            type="button"
            onClick={signOutUser}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> 登出並切換帳號
          </button>
        </div>
      </div>
    );
  }

  // Case 2: Teacher account needs security activation / password setup
  if (firebaseUser && currentUser?.role === 'teacher' && currentUser.needsActivation) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-amber-200 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <KeyRound className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-slate-800">教師帳號尚未完成安全啟用</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            您的教師帳號建立時尚未設定登入密碼，依校園資安規範須完成安全啟用後方可存取班級資料。請點擊下方按鈕寄送密碼設定信，或聯繫管理員協助啟用。
          </p>
          {authMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold">
              {authMessage}
            </div>
          )}
          {authError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold">
              {authError}
            </div>
          )}
          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  setAuthError(null);
                  await sendResetPasswordEmail(firebaseUser.email || currentUser.email);
                  setAuthMessage('已寄出安全密碼設定信件至您的公務信箱，完成設定後請重新登入。');
                } catch (err: any) {
                  setAuthError(err?.message || '無法寄出設定信，請聯繫系統管理員。');
                }
              }}
              className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
            >
              寄送安全啟用 / 設定密碼信件
            </button>
            <button
              type="button"
              onClick={signOutUser}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" /> 登出
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Case 3: Signed in via Email/Password but email is not verified yet
  if (firebaseUser && !firebaseUser.emailVerified) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-amber-200 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <Mail className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-slate-800">請先完成電子信箱驗證</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            為確保校園資料庫安全規則保護，您的帳號（<span className="font-mono font-bold">{firebaseUser.email}</span>）須完成信箱驗證才能繼續設定「{selectedRole === 'teacher' ? '老師端' : selectedRole === 'admin' ? '管理員端' : '學生端'}」檔案並進入系統。
          </p>
          {authMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold">
              {authMessage}
            </div>
          )}
          {authError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold">
              {authError}
            </div>
          )}
          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  setAuthError(null);
                  await resendVerificationEmail();
                  setAuthMessage('驗證信已寄出！請至信箱點擊驗證連結後，再點擊「我已驗證，重新檢查」。');
                } catch (err: any) {
                  setAuthError(err?.message || '寄送失敗，請稍後再試');
                }
              }}
              className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold"
            >
              寄送 / 重寄驗證信
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await firebaseUser.reload();
                } catch {
                  // ignore
                }
                window.location.reload();
              }}
              className="w-full py-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-bold flex items-center justify-center gap-1.5 border border-sky-200"
            >
              <RefreshCw className="w-3.5 h-3.5" /> 我已驗證，重新檢查
            </button>
            <button
              type="button"
              onClick={signOutUser}
              className="w-full py-2 rounded-xl text-slate-500 hover:bg-slate-100 text-xs font-semibold"
            >
              登出
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Case 4: Authenticated with Firebase, no user profile doc in Firestore yet -> 3-Role Onboarding
  if (firebaseUser && !currentUser) {
    const canClaimInitialAdmin = !bootstrapStatus?.bootstrapClaimed || Boolean(bootstrapStatus?.envBootstrap);
    const availableClasses =
      classes.length > 0
        ? classes
        : [{ id: 'class-302', name: '三年二班（預設起始班級）', grade: '三年級' }];

    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-slate-50 to-emerald-50 flex items-center justify-center p-4">
        <div className="max-w-xl w-full bg-white rounded-3xl p-6 sm:p-8 border border-teal-100 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800">選擇註冊身分並完成初始設定</h2>
                <p className="text-xs text-slate-500 font-mono">{firebaseUser.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={signOutUser}
              className="text-xs text-slate-400 hover:text-rose-600 font-semibold flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" /> 登出
            </button>
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold">
              {authError}
            </div>
          )}

          {/* 3-Role Selector: 學生端 / 老師端 / 管理員端 */}
          <div className="space-y-2">
            <label className="block text-xs font-extrabold text-slate-700">
              第一步：請選擇您要註冊進入的系統身分
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleSelectRole('student')}
                className={`p-3 rounded-2xl border-2 text-left transition-all ${
                  selectedRole === 'student'
                    ? 'border-teal-500 bg-teal-50/90 text-teal-950 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-teal-200 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-1.5 font-extrabold text-xs">
                  <GraduationCap className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>學生端</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  心情簽到與心心 AI 聊天
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectRole('teacher')}
                className={`p-3 rounded-2xl border-2 text-left transition-all ${
                  selectedRole === 'teacher'
                    ? 'border-sky-500 bg-sky-50/90 text-sky-950 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-sky-200 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-1.5 font-extrabold text-xs">
                  <UserCheck className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>老師端</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  班級關懷與 AI 對話查閱
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectRole('admin')}
                className={`p-3 rounded-2xl border-2 text-left transition-all ${
                  selectedRole === 'admin'
                    ? 'border-purple-500 bg-purple-50/90 text-purple-950 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-purple-200 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-1.5 font-extrabold text-xs">
                  <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>管理員端</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  全校帳號與對話總覽管理
                </p>
              </button>
            </div>
          </div>

          {/* Role-Specific Onboarding Forms */}
          {selectedRole === 'admin' ? (
            <div className="p-5 rounded-2xl bg-purple-50 border border-purple-200 space-y-3">
              <div className="flex items-center gap-2 text-purple-900 font-extrabold text-sm">
                <ShieldCheck className="w-5 h-5 text-purple-600" />
                管理員端註冊啟用
              </div>

              {canClaimInitialAdmin ? (
                <>
                  <p className="text-xs text-purple-800 leading-relaxed">
                    目前系統尚未鎖定首位管理員。您可立即以「管理員端」身分註冊並啟用全校最高管理權限（可新增/修改/刪除學生與教師帳號，並查閱學生與 AI 的對話紀錄）。
                  </p>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={async () => {
                      setIsSubmitting(true);
                      setAuthError(null);
                      try {
                        await claimInitialAdmin();
                        try {
                          sessionStorage.removeItem(PENDING_ROLE_KEY);
                        } catch {
                          // ignore
                        }
                      } catch (err: any) {
                        setAuthError(err?.message || '無法啟用管理員權限，請確認已完成信箱驗證。');
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs"
                  >
                    {isSubmitting ? '正在設定管理員...' : '以「管理員端」完成註冊並進入系統'}
                  </button>
                </>
              ) : (
                <div className="p-3.5 rounded-xl bg-white border border-purple-200 text-xs text-slate-700 space-y-2 leading-relaxed">
                  <p className="font-bold text-rose-700">
                    系統已設有管理員，無法由新帳號直接自行升級為管理員。
                  </p>
                  <p>
                    為保護學生隱私與帳號管理安全，新管理員須由現任管理員於後台「使用者管理」中變更角色授權；您可先選擇「老師端」或「學生端」完成註冊。
                  </p>
                </div>
              )}
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSubmitting(true);
                setAuthError(null);
                try {
                  await completeFirstLoginSetup({
                    role: selectedRole === 'teacher' ? 'teacher' : 'student',
                    name:
                      profileName ||
                      firebaseUser.displayName ||
                      (selectedRole === 'teacher' ? '新進教師' : '新同學'),
                    classId: selectedClassId || availableClasses[0].id,
                    studentNumber: selectedRole === 'student' ? studentNumber : undefined,
                  });
                  try {
                    sessionStorage.removeItem(PENDING_ROLE_KEY);
                  } catch {
                    // ignore
                  }
                } catch (err: any) {
                  setAuthError(err?.message || '無法建立校園個人檔案，請稍後再試。');
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="space-y-4 pt-3 border-t border-slate-100"
            >
              <h3 className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                {selectedRole === 'teacher' ? (
                  <>
                    <UserCheck className="w-4 h-4 text-sky-600" />
                    填寫老師端個人與負責班級資料
                  </>
                ) : (
                  <>
                    <GraduationCap className="w-4 h-4 text-teal-600" />
                    填寫學生端個人與所屬班級資料
                  </>
                )}
              </h3>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  {selectedRole === 'teacher' ? '教師姓名' : '學生姓名'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={selectedRole === 'teacher' ? '例如：陳老師' : '請輸入姓名'}
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className={selectedRole === 'student' ? 'grid grid-cols-2 gap-3' : ''}>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    {selectedRole === 'teacher' ? '負責班級' : '所屬班級'}
                  </label>
                  <select
                    value={selectedClassId || availableClasses[0].id}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {availableClasses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.grade})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedRole === 'student' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">座號</label>
                    <input
                      type="text"
                      required
                      value={studentNumber}
                      onChange={(e) => setStudentNumber(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                {selectedRole === 'teacher'
                  ? '註冊為老師端後，您可以查看負責班級學生的心情紀錄與 AI 對話內容；如需修改或刪除現有學生／教師帳號，僅限管理員操作。'
                  : '註冊為學生端後，您可以進行每日心情簽到並與心心 AI 聊天；依校園關懷政策，授權導師與管理員可查閱您的 AI 對話內容。'}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-2.5 rounded-xl disabled:opacity-40 text-white text-xs font-bold shadow-sm ${
                  selectedRole === 'teacher'
                    ? 'bg-sky-600 hover:bg-sky-700'
                    : 'bg-teal-600 hover:bg-teal-700'
                }`}
              >
                {isSubmitting
                  ? '正在建立資料...'
                  : selectedRole === 'teacher'
                  ? '以「老師端」完成註冊並進入系統'
                  : '以「學生端」完成註冊並進入系統'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Case 5: Not signed in -> Main Login & Registration Screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-slate-50 to-emerald-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-5">
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-teal-100 shadow-xl space-y-6">
          <div className="text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-white shadow-md shadow-teal-500/20 mb-3">
              <HeartHandshake className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-slate-800">AI 校園情緒關懷系統</h1>
            <p className="text-xs text-slate-500 mt-1">
              請登入或註冊校園帳號；首次使用時可選擇「學生端」、「老師端」或「管理員端」
            </p>
          </div>

          {/* Login Method Switcher */}
          <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setLoginTab('google');
                setAuthError(null);
              }}
              className={`py-2 rounded-lg transition-all ${
                loginTab === 'google' ? 'bg-white text-teal-800 shadow-2xs' : 'text-slate-500'
              }`}
            >
              Google 快速登入 / 註冊
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginTab('email');
                setAuthError(null);
              }}
              className={`py-2 rounded-lg transition-all ${
                loginTab === 'email' ? 'bg-white text-teal-800 shadow-2xs' : 'text-slate-500'
              }`}
            >
              信箱登入 / 註冊
            </button>
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold">
              {authError}
            </div>
          )}
          {authMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> {authMessage}
            </div>
          )}

          {loginTab === 'google' ? (
            <div className="space-y-4">
              {/* Role preview selector before Google sign-in */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600">
                  首次註冊身分預選（學生端／老師端／管理員端）
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'student' as UserRole, label: '學生端', icon: GraduationCap, active: 'border-teal-500 bg-teal-50 text-teal-800' },
                    { id: 'teacher' as UserRole, label: '老師端', icon: UserCheck, active: 'border-sky-500 bg-sky-50 text-sky-800' },
                    { id: 'admin' as UserRole, label: '管理員端', icon: ShieldCheck, active: 'border-purple-500 bg-purple-50 text-purple-800' },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = selectedRole === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectRole(item.id)}
                        className={`py-2 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                          isSelected
                            ? item.active
                            : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={async () => {
                  setIsSubmitting(true);
                  setAuthError(null);
                  try {
                    await signInWithGoogle();
                  } catch (err: any) {
                    setAuthError(err?.message || 'Google 登入已取消或發生錯誤');
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-teal-400 text-slate-800 font-bold text-sm shadow-xs transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                {isSubmitting ? '正在開啟 Google 驗證...' : '使用 Google 帳號登入／註冊'}
              </button>
              <p className="text-[11px] text-slate-400 text-center">
                已註冊帳號將自動依原有身分進入；新帳號可選擇學生端、老師端或管理員端
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setEmailMode('login');
                    setAuthError(null);
                    setAuthMessage(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg border transition-all ${
                    emailMode === 'login'
                      ? 'bg-teal-50 border-teal-300 text-teal-800'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  登入現有帳號
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailMode('register');
                    setAuthError(null);
                    setAuthMessage(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1 ${
                    emailMode === 'register'
                      ? 'bg-teal-50 border-teal-300 text-teal-800'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" /> 註冊新帳號
                </button>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setIsSubmitting(true);
                  setAuthError(null);
                  setAuthMessage(null);
                  try {
                    if (emailMode === 'register') {
                      if (password.length < 6) {
                        setAuthError('密碼長度至少須 6 個字元。');
                        setIsSubmitting(false);
                        return;
                      }
                      if (password !== confirmPassword) {
                        setAuthError('兩次輸入的密碼不一致，請重新確認。');
                        setIsSubmitting(false);
                        return;
                      }
                      await signUpWithEmail(email, password);
                      setAuthMessage('帳號已建立並寄出驗證信！請先至信箱完成驗證後繼續設定個人資料。');
                    } else {
                      await signInWithEmail(email, password);
                    }
                  } catch (err: any) {
                    if (emailMode === 'register') {
                      setAuthError(
                        err?.code === 'auth/email-already-in-use'
                          ? '此電子信箱已被註冊，請改用「登入現有帳號」或 Google 登入。'
                          : err?.message || '註冊帳號失敗，請確認信箱格式與密碼長度（至少 6 碼）。'
                      );
                    } else {
                      setAuthError('信箱或密碼不正確，或此帳號尚未完成密碼設定。');
                    }
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className="space-y-3"
              >
                {emailMode === 'register' && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-600">
                      選擇註冊端別 <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'student' as UserRole, label: '學生端', icon: GraduationCap, active: 'border-teal-500 bg-teal-50 text-teal-800' },
                        { id: 'teacher' as UserRole, label: '老師端', icon: UserCheck, active: 'border-sky-500 bg-sky-50 text-sky-800' },
                        { id: 'admin' as UserRole, label: '管理員端', icon: ShieldCheck, active: 'border-purple-500 bg-purple-50 text-purple-800' },
                      ].map((item) => {
                        const Icon = item.icon;
                        const isSelected = selectedRole === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelectRole(item.id)}
                            className={`py-2 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                              isSelected
                                ? item.active
                                : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">電子信箱</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@school.edu.tw"
                      className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    {emailMode === 'register' ? '設定密碼（至少 6 碼）' : '登入密碼'}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="請輸入密碼"
                      className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                {emailMode === 'register' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">確認密碼</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="請再次輸入密碼"
                        className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm"
                >
                  {isSubmitting
                    ? '處理中...'
                    : emailMode === 'register'
                    ? `註冊「${selectedRole === 'teacher' ? '老師端' : selectedRole === 'admin' ? '管理員端' : '學生端'}」帳號`
                    : '登入系統'}
                </button>

                {emailMode === 'login' && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!email.trim()) {
                        setAuthError('請先輸入電子信箱，再點擊忘記密碼或啟用設定。');
                        return;
                      }
                      try {
                        setAuthError(null);
                        await sendResetPasswordEmail(email);
                        setAuthMessage('已寄送密碼設定 / 重設信件至您的信箱！');
                      } catch (err: any) {
                        setAuthError(err?.message || '無法寄出重設密碼信件');
                      }
                    }}
                    className="w-full text-[11px] text-teal-700 hover:underline font-semibold pt-1"
                  >
                    忘記密碼 / 首次設定教師密碼？
                  </button>
                )}
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
