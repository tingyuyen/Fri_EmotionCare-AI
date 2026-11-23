import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import {
  HeartHandshake,
  UserCheck,
  GraduationCap,
  Sparkles,
  Database,
  ChevronDown,
  LogOut,
  RefreshCw,
  LogIn,
  CheckCircle2,
  Cloud,
} from 'lucide-react';

interface NavbarProps {
  onOpenFirebaseGuide: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenFirebaseGuide }) => {
  const {
    currentUser,
    setCurrentUser,
    users,
    resetAllData,
    firebaseUser,
    signInWithGoogle,
    signOutUser,
  } = useApp();

  const [isSwitchOpen, setIsSwitchOpen] = useState(false);

  const students = users.filter((u) => u.role === 'student');
  const teachers = users.filter((u) => u.role === 'teacher');
  const admins = users.filter((u) => u.role === 'admin');

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'student':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 border border-teal-200">
            <GraduationCap className="w-3.5 h-3.5" /> 學生端
          </span>
        );
      case 'teacher':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800 border border-sky-200">
            <UserCheck className="w-3.5 h-3.5" /> 教師端
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
            <Sparkles className="w-3.5 h-3.5" /> 管理員端
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-teal-100 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & System Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
              <HeartHandshake className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg sm:text-xl text-slate-800 tracking-tight">
                  AI 校園情緒關懷系統
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md font-bold border border-emerald-200">
                  <Cloud className="w-3 h-3 text-emerald-600" />
                  Firestore 雲端連線中
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">守護每位孩子的心情陽光 · 支援多校師生雲端同步</p>
            </div>
          </div>

          {/* Right Action Tools & Current Role Selector */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Google Authentication Button */}
            {firebaseUser ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="truncate max-w-[100px] sm:max-w-none">{firebaseUser.displayName || 'Google 帳號'}</span>
                <button
                  onClick={signOutUser}
                  title="登出 Google"
                  className="ml-1 text-slate-400 hover:text-rose-600 p-0.5 rounded"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-2xs transition-all hover:scale-[1.02]"
                title="使用 Google 帳號快速登入"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span className="hidden sm:inline">Google 登入</span>
              </button>
            )}

            {/* Firebase Guide Button */}
            <button
              onClick={onOpenFirebaseGuide}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-xl border border-teal-200 transition-colors"
              title="Firebase 認證與資料庫設定說明"
            >
              <Database className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Firebase 設定狀態</span>
              <span className="md:hidden">雲端</span>
            </button>

            {/* Quick Role Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsSwitchOpen(!isSwitchOpen)}
                className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 rounded-xl border border-slate-200 text-slate-700 transition-all text-xs sm:text-sm font-medium"
              >
                <span className="text-base">{currentUser.avatar}</span>
                <div className="text-left hidden sm:block">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-800">{currentUser.name}</span>
                    {getRoleBadge(currentUser.role)}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {currentUser.className || (currentUser.role === 'admin' ? '系統管理者' : '專任教師')}
                  </div>
                </div>
                <div className="sm:hidden font-bold">{currentUser.name}</div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {isSwitchOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsSwitchOpen(false)} />
                  <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-slate-200/80 p-3 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-2 py-1.5 mb-2 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        切換測試身分 (體驗不同端)
                      </span>
                      <button
                        onClick={() => {
                          resetAllData();
                          setIsSwitchOpen(false);
                        }}
                        className="text-[11px] text-rose-600 hover:text-rose-700 flex items-center gap-1 font-medium"
                      >
                        <RefreshCw className="w-3 h-3" /> 重置雲端資料
                      </button>
                    </div>

                    {/* Students Group */}
                    <div className="mb-2">
                      <div className="text-[11px] font-bold text-teal-700 px-2 py-1 flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5" /> 學生端測試帳號
                      </div>
                      <div className="space-y-1">
                        {students.slice(0, 4).map((s) => (
                          <button
                            key={s.id}
                            onClick={() => {
                              setCurrentUser(s);
                              setIsSwitchOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                              currentUser.id === s.id
                                ? 'bg-teal-50 text-teal-900 font-bold border border-teal-200'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span>{s.avatar}</span>
                              <span>{s.name}</span>
                              <span className="text-[10px] text-slate-400">({s.className})</span>
                            </div>
                            {currentUser.id === s.id && (
                              <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Teachers Group */}
                    <div className="mb-2 pt-2 border-t border-slate-100">
                      <div className="text-[11px] font-bold text-sky-700 px-2 py-1 flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5" /> 教師端測試帳號
                      </div>
                      <div className="space-y-1">
                        {teachers.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              setCurrentUser(t);
                              setIsSwitchOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                              currentUser.id === t.id
                                ? 'bg-sky-50 text-sky-900 font-bold border border-sky-200'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span>{t.avatar}</span>
                              <span>{t.name}</span>
                              <span className="text-[10px] text-slate-400">({t.className} 導師)</span>
                            </div>
                            {currentUser.id === t.id && (
                              <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Admin Group */}
                    <div className="pt-2 border-t border-slate-100">
                      <div className="text-[11px] font-bold text-purple-700 px-2 py-1 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" /> 管理員端帳號
                      </div>
                      <div className="space-y-1">
                        {admins.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => {
                              setCurrentUser(a);
                              setIsSwitchOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                              currentUser.id === a.id
                                ? 'bg-purple-50 text-purple-900 font-bold border border-purple-200'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span>{a.avatar}</span>
                              <span>{a.name}</span>
                              <span className="text-[10px] text-slate-400">(教務/輔導行政)</span>
                            </div>
                            {currentUser.id === a.id && (
                              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
