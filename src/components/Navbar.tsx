import React from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import {
  HeartHandshake,
  UserCheck,
  GraduationCap,
  Sparkles,
  Database,
  LogOut,
  RefreshCw,
  Cloud,
  AlertCircle,
} from 'lucide-react';

interface NavbarProps {
  onOpenFirebaseGuide: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenFirebaseGuide }) => {
  const {
    currentUser,
    firebaseUser,
    signOutUser,
    syncStatus,
    lastSyncError,
    clearSyncError,
  } = useApp();

  if (!currentUser) return null;

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
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                守護每位孩子的心情陽光 · 雲端權限防護運行中
              </p>
            </div>
          </div>

          {/* Right Action Tools & Authenticated Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onOpenFirebaseGuide}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-xl border border-teal-200 transition-colors"
              title="Firebase 認證與資料庫設定說明"
            >
              <Database className="w-3.5 h-3.5" />
              <span className="hidden md:inline">系統狀態</span>
            </button>

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
