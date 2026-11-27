import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { AuthGate } from './components/AuthGate';
import { StudentPortal } from './components/StudentPortal/StudentPortal';
import { TeacherDashboard } from './components/TeacherPortal/TeacherDashboard';
import { AdminDashboard } from './components/AdminPortal/AdminDashboard';
import { FirebaseGuideModal } from './components/FirebaseGuideModal';
import { Shield, PhoneCall } from 'lucide-react';

const MainLayout: React.FC = () => {
  const {
    currentUser,
    firebaseUser,
    authLoading,
    profileLoading,
    accountBlockedReason,
  } = useApp();
  const [isFirebaseGuideOpen, setIsFirebaseGuideOpen] = useState(false);

  // Enforce AuthGate whenever not fully authenticated, verified, and onboarded
  const needsAuthGate =
    authLoading ||
    profileLoading ||
    !firebaseUser ||
    !firebaseUser.emailVerified ||
    !currentUser ||
    Boolean(accountBlockedReason) ||
    (currentUser.role === 'teacher' && Boolean(currentUser.needsActivation));

  if (needsAuthGate || !currentUser) {
    return <AuthGate />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Top Navbar */}
      <Navbar onOpenFirebaseGuide={() => setIsFirebaseGuideOpen(true)} />

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
              衛福部安心專線 1925 · 保護專線 113
            </span>
            <button
              onClick={() => setIsFirebaseGuideOpen(true)}
              className="text-teal-700 hover:underline font-semibold"
            >
              Firebase 與系統架構說明
            </button>
          </div>
        </div>
      </footer>

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
