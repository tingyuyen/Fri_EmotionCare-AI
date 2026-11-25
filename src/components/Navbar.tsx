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
  Cloud,
  FlaskConical,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface NavbarProps {
  onOpenFirebaseGuide: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenFirebaseGuide }) => {
  const {
    appMode,
    exitSandboxMode,
    currentUser,
    setSandboxUser,
    users,
    resetSandboxData,
    firebaseUser,
    signOutUser,
    syncStatus,
    lastSyncError,
    clearSyncError,
  } = useApp();

  const [isSwitchOpen, setIsSwitchOpen] = useState(false);

  if (!currentUser) return null;

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
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg sm:text-xl text-slate-800 tracking-tight">
                  AI 校園情緒關懷系統
                </span>
                {appMode === 'sandbox' ? (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md font-bold border border-amber-200">
                    <FlaskConical className="w-3 h-3 text-amber-600" />
                    離線體驗沙盒
                  </span>
                ) : (
                  <span
                    className={`hidden sm:inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-bold border ${
                      syncStatus === 'error'
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : syncStatus === 'syncing'
                        ? 'bg-sky-50 text-sky-800 border-sky-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    {syncStatus === 'error' ? (
                      <AlertCircle className="w-3 h-3 text-rose-600" />
                    ) : syncStatus === 'syncing' ? (
                      <RefreshCw className="w-3 h-3 text-sky-600 animate-spin" />
                    ) : (
                      <Cloud className="w-3 h-3 text-emerald-600" />
                    )}
                    {syncStatus === 'error'
                      ? '雲端寫入異常'
                      : syncStatus === 'syncing'
                      ? '雲端同步中...'
                      : 'Firestore 已連線'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                {appMode === 'sandbox'
                  ? '本機模擬測試環境 · 資料不會寫入正式雲端資料庫'
                  : '守護每位孩子的心情陽光 · 雲端權限防護運行中'}
              </p>
            </div>
          </div>

          {/* Right Action Tools & Authenticated Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Firebase Guide Button */}
            <button
              onClick={onOpenFirebaseGuide}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-xl border border-teal-200 transition-colors"
              title="Firebase 認證與資料庫設定說明"
            >
              <Database className="w-3.5 h-3.5" />
              <span className="hidden md:inline">系統狀態</span>
            </button>

            {appMode === 'cloud' ? (
              /* Real Authenticated User Pill + Sign Out */
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-200 text-xs">
                  <span className="text-base">{currentUser.avatar}</span>
                  <div className="hidden sm:block text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-800">{currentUser.name}</span>
                      {getRoleBadge(currentUser.role)}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {currentUser.className || firebaseUser?.email}
                    </div>
                  </div>
                  <span className="sm:hidden font-bold text-slate-800">{currentUser.name}</span>
                </div>

                <button
                  onClick={signOutUser}
                  title="登出並清除本機工作階段資料"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">登出</span>
                </button>
              </div>
            ) : (
              /* Sandbox Mode Role Switcher Dropdown + Exit Sandbox */
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setIsSwitchOpen(!isSwitchOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-200 text-amber-900 transition-all text-xs font-bold"
                  >
                    <span className="text-base">{currentUser.avatar}</span>
                    <span>{currentUser.name}</span>
                    {getRoleBadge(currentUser.role)}
                    <ChevronDown className="w-4 h-4 text-amber-600" />
                  </button>

                  {isSwitchOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsSwitchOpen(false)} />
                      <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-slate-200/80 p-3 z-50">
                        <div className="px-2 py-1.5 mb-2 border-b border-slate-100 flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-700">
                            沙盒模擬身分切換（僅本機）
                          </span>
                          <button
                            onClick={() => {
                              resetSandboxData();
                              setIsSwitchOpen(false);
                            }}
                            className="text-[11px] text-rose-600 hover:text-rose-700 flex items-center gap-1 font-medium"
                          >
                            <RefreshCw className="w-3 h-3" /> 重置沙盒
                          </button>
                        </div>

                        <div className="mb-2">
                          <div className="text-[11px] font-bold text-teal-700 px-2 py-1">學生模擬帳號</div>
                          <div className="space-y-1">
                            {students.slice(0, 4).map((s) => (
                              <button
                                key={s.id}
                                onClick={() => {
                                  setSandboxUser(s);
                                  setIsSwitchOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs ${
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
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="mb-2 pt-2 border-t border-slate-100">
                          <div className="text-[11px] font-bold text-sky-700 px-2 py-1">教師模擬帳號</div>
                          <div className="space-y-1">
                            {teachers.map((t) => (
                              <button
                                key={t.id}
                                onClick={() => {
                                  setSandboxUser(t);
                                  setIsSwitchOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs ${
                                  currentUser.id === t.id
                                    ? 'bg-sky-50 text-sky-900 font-bold border border-sky-200'
                                    : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span>{t.avatar}</span>
                                  <span>{t.name}</span>
                                  <span className="text-[10px] text-slate-400">({t.className})</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100">
                          <div className="text-[11px] font-bold text-purple-700 px-2 py-1">管理員模擬帳號</div>
                          <div className="space-y-1">
                            {admins.map((a) => (
                              <button
                                key={a.id}
                                onClick={() => {
                                  setSandboxUser(a);
                                  setIsSwitchOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs ${
                                  currentUser.id === a.id
                                    ? 'bg-purple-50 text-purple-900 font-bold border border-purple-200'
                                    : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span>{a.avatar}</span>
                                  <span>{a.name}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={exitSandboxMode}
                  className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors"
                >
                  前往正式登入
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sync Error Alert Bar */}
      {lastSyncError && (
        <div className="bg-rose-50 border-t border-rose-200 px-4 py-2 text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{lastSyncError}</span>
          </div>
          <button onClick={clearSyncError} className="text-rose-600 hover:text-rose-800 font-bold ml-4">
            關閉
          </button>
        </div>
      )}
    </header>
  );
};
