export type UserRole = 'student' | 'teacher' | 'admin';
export type AccountStatus = 'active' | 'disabled';

export type MoodType = 'happy' | 'calm' | 'anxious' | 'sad' | 'angry' | 'tired';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  grade?: string;
  classId?: string;
  className?: string;
  studentNumber?: string;
  avatar: string;
  status?: AccountStatus; // 'active' | 'disabled' (預設為 active)
  passwordSet?: boolean; // 密碼是否已完成設定
  needsActivation?: boolean; // 若教師未填密碼，標記需完成安全啟用流程
  createdAt?: string;
  updatedAt?: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  grade: string;
  teacherId: string;
  teacherName: string;
  studentCount: number;
}

export interface MoodLog {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  mood: MoodType;
  score: number; // 1 to 5
  tags: string[];
  note?: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

export interface CareNote {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  teacherId: string;
  teacherName: string;
  alertLevel: 'normal' | 'attention' | 'urgent';
  content: string;
  actionTaken?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  studentId: string;
  studentName?: string;
  classId?: string;
  sender: 'student' | 'ai';
  text: string;
  emotionTag?: MoodType;
  timestamp: string; // HH:mm or ISO
  createdAt?: string; // YYYY-MM-DD HH:mm:ss
}

export interface ChatAccessLog {
  id: string;
  teacherId: string;
  teacherName: string;
  studentId: string;
  studentName: string;
  classId: string;
  timestamp: string;
  purpose: string;
}

export interface StudentChatSummary {
  studentId: string;
  studentName: string;
  totalMessages: number;
  lastActive: string;
  primaryEmotion: MoodType;
  topics: string[];
  careKeypoints: string;
  safetyAlert: boolean;
}

export interface MoodMeta {
  type: MoodType;
  label: string;
  emoji: string;
  color: string;
  bgLight: string;
  borderColor: string;
  textColor: string;
  description: string;
}

export const MOOD_DEFINITIONS: Record<MoodType, MoodMeta> = {
  happy: {
    type: 'happy',
    label: '開心喜悅',
    emoji: '😊',
    color: '#10b981', // emerald
    bgLight: 'bg-emerald-50',
    borderColor: 'border-emerald-300',
    textColor: 'text-emerald-700',
    description: '今天充滿活力，遇到許多好事！',
  },
  calm: {
    type: 'calm',
    label: '平靜安心',
    emoji: '😌',
    color: '#0ea5e9', // sky
    bgLight: 'bg-sky-50',
    borderColor: 'border-sky-300',
    textColor: 'text-sky-700',
    description: '心裡很安定放鬆，感覺很自在。',
  },
  anxious: {
    type: 'anxious',
    label: '焦慮緊張',
    emoji: '😰',
    color: '#f59e0b', // amber
    bgLight: 'bg-amber-50',
    borderColor: 'border-amber-300',
    textColor: 'text-amber-700',
    description: '心跳有點快，擔心某些事情會發生。',
  },
  sad: {
    type: 'sad',
    label: '難過沮喪',
    emoji: '😢',
    color: '#6366f1', // indigo
    bgLight: 'bg-indigo-50',
    borderColor: 'border-indigo-300',
    textColor: 'text-indigo-700',
    description: '心裡酸酸重重的，提不起精神。',
  },
  angry: {
    type: 'angry',
    label: '生氣不滿',
    emoji: '😡',
    color: '#f43f5e', // rose
    bgLight: 'bg-rose-50',
    borderColor: 'border-rose-300',
    textColor: 'text-rose-700',
    description: '覺得很不公平或很煩躁，拳頭緊握。',
  },
  tired: {
    type: 'tired',
    label: '疲倦想睡',
    emoji: '🥱',
    color: '#8b5cf6', // purple
    bgLight: 'bg-purple-50',
    borderColor: 'border-purple-300',
    textColor: 'text-purple-700',
    description: '電力快用完了，好想趴著休息一下。',
  },
};
