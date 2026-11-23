import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { StudentPortal } from './components/StudentPortal/StudentPortal';
import { TeacherDashboard } from './components/TeacherPortal/TeacherDashboard';
import { AdminDashboard } from './components/AdminPortal/AdminDashboard';
import { FirebaseGuideModal } from './components/FirebaseGuideModal';
import {
  GraduationCap,
  UserCheck,
  Sparkles,
  Heart,
  Shield,
  HelpCircle,
  PhoneCall,
  Info,
} from 'lucide-react';

const MainLayout: React.FC = () => {
  const { currentUser, setCurrentUser, users } = useApp();
  const [isFirebaseGuideOpen, setIsFirebaseGuideOpen] = useState(false);

  // Quick switch helpers
  const student = users.find((u) => u.role === 'student') || users[0];
  const teacher = users.find((u) => u.role === 'teacher') || users[0];
  const admin = users.find((u) => u.role === 'admin') || users[0];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Top Navbar */}
      <Navbar onOpenFirebaseGuide={() => setIsFirebaseGuideOpen(true)} />

      {/* Role Navigation Bar for Instant Preview Testing */}
      <section className="bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-700 text-white shadow-sm py-3 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs bg-white/20 backdrop-blur-xs px-2.5 py-1 rounded-full font-bold text-white flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-teal-200" /> 系統預覽測試模式
            </span>
            <span className="text-xs text-teal-100 hidden md:inline">
              點擊右側按鈕可立即切換為不同身重視角：
            </span>
          </div>

          {/* Quick Role Tab Buttons */}
          <div className="flex items-center gap-1.5 bg-black/15 p-1 rounded-xl backdrop-blur-xs text-xs font-bold">
            <button
              onClick={() => setCurrentUser(student)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                currentUser.role === 'student'
                  ? 'bg-white text-teal-900 shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" /> 學生端體驗
            </button>
            <button
              onClick={() => setCurrentUser(teacher)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                currentUser.role === 'teacher'
                  ? 'bg-white text-teal-900 shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" /> 教師端 Dashboard
            </button>
            <button
              onClick={() => setCurrentUser(admin)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                currentUser.role === 'admin'
                  ? 'bg-white text-teal-900 shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> 管理員端
            </button>
          </div>
        </div>
      </section>

      {/* Main View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {currentUser.role === 'student' && <StudentPortal />}
        {currentUser.role === 'teacher' && <TeacherDashboard />}
        {currentUser.role === 'admin' && <AdminDashboard />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-teal-100/80 py-6 mt-12 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-teal-500 flex items-center justify-center text-white text-xs font-bold">
              AI
            </div>
            <span className="font-bold text-slate-700">AI 校園情緒關懷系統</span>
            <span className="text-slate-400">· 守護孩子身心健康</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-teal-600" />
              符合國小社會情緒學習 (SEL) 輔導原則
            </span>
            <span className="flex items-center gap-1">
              <PhoneCall className="w-3.5 h-3.5 text-rose-500" />
              教育部校園安心專線 1925
            </span>
            <button
              onClick={() => setIsFirebaseGuideOpen(true)}
              className="text-teal-700 hover:underline font-semibold"
            >
              Firebase 設定與發布指南
            </button>
          </div>
        </div>
      </footer>

      {/* Firebase & Cloud Deployment Guide Modal */}
      <FirebaseGuideModal
        isOpen={isFirebaseGuideOpen}
        onClose={() => setIsFirebaseGuideOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
