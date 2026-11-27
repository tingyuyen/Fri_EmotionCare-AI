export type UserRole = 'student' | 'teacher' | 'admin';
export type AccountStatus = 'active' | 'disabled';

export type MoodType = 'happy' | 'calm' | 'anxious' | 'sad' | 'angry' | 'tired';

export type ChatSituationCategory =
  | 'general_chat'
  | 'happy_achievement'
  | 'peer_conflict'
  | 'bullying'
  | 'family_issue'
  | 'academic_stress'
  | 'anger_frustration'
  | 'violence_harm_others'
  | 'self_harm_emergency';

export type RiskLevel = 'none' | 'low' | 'elevated' | 'critical';

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
  status?: AccountStatus;
  passwordSet?: boolean;
  needsActivation?: boolean;
  authLinked?: boolean;
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
  date: string; // YYYY-MM-DD (Asia/Taipei)
  createdAt: string;
  updatedAt?: string;
  createdAtMs?: number;
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
  createdAtMs?: number;
}

export interface ChatSession {
  id: string;
  studentId: string;
  studentName?: string;
  classId: string;
  title: string;
  rollingSummary?: string;
  summarizedUpToMs?: number;
  highestRiskLevel?: RiskLevel;
  unresolvedHighRisk?: boolean;
  unresolvedEvents?: string[];
  lastEmotion?: MoodType;
  lastSituationCategory?: ChatSituationCategory;
  messageCount?: number;
  createdAt: string;
  updatedAt: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface ChatMessage {
  id: string;
  sessionId?: string;
  studentId: string;
  studentName?: string;
  classId?: string;
  sender: 'student' | 'ai';
  text: string;
  selfReportedMood?: MoodType;
  modelDetectedEmotion?: MoodType;
  emotionTag?: MoodType; // Legacy / display alias
  situationCategory?: ChatSituationCategory;
  riskLevel?: RiskLevel;
  hasContradictionOrFollowUp?: boolean;
  unresolvedHighRisk?: boolean;
  aiStatus?: 'gemini' | 'error_notice' | 'safety_fallback';
  teacherNotified?: boolean;
  timestamp: string; // HH:mm (Asia/Taipei)
  createdAt?: string; // YYYY-MM-DD HH:mm:ss (Asia/Taipei)
  createdAtMs?: number;
}

export interface CrisisAlert {
  id: string;
  sessionId?: string;
  studentId: string;
  studentName: string;
  classId: string;
  className?: string;
  situationCategory: ChatSituationCategory;
  severity: 'elevated' | 'critical';
  triggerExcerpt: string;
  aiSummary: string;
  status: 'open' | 'acknowledged' | 'resolved';
  acknowledgedBy?: string;
  acknowledgedByName?: string;
  acknowledgedAt?: string;
  resolutionNote?: string;
  createdAt: string;
  createdAtMs: number;
}

export interface ChatAccessLog {
  id: string;
  teacherId: string;
  teacherName: string;
  studentId: string;
  studentName: string;
  classId: string;
  timestamp: string;
  createdAtMs?: number;
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
  generatedBy?: 'gemini' | 'heuristic';
}

export interface AiUsageSummary {
  model: string;
  totalRequestsToday: number;
  successfulRequestsToday: number;
  failedRequestsToday: number;
  totalPromptTokensToday: number;
  totalOutputTokensToday: number;
  dailyLimitPerUser: number;
  minuteLimitPerUser: number;
  adminSdkReady: boolean;
  geminiKeyConfigured: boolean;
  activeUsersToday: number;
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
    color: '#10b981',
    bgLight: 'bg-emerald-50',
    borderColor: 'border-emerald-300',
    textColor: 'text-emerald-700',
    description: '今天充滿活力，遇到許多好事！',
  },
  calm: {
    type: 'calm',
    label: '平靜安心',
    emoji: '😌',
    color: '#0ea5e9',
    bgLight: 'bg-sky-50',
    borderColor: 'border-sky-300',
    textColor: 'text-sky-700',
    description: '心裡很安定放鬆，感覺很自在。',
  },
  anxious: {
    type: 'anxious',
    label: '焦慮緊張',
    emoji: '😰',
    color: '#f59e0b',
    bgLight: 'bg-amber-50',
    borderColor: 'border-amber-300',
    textColor: 'text-amber-700',
    description: '心跳有點快，擔心某些事情會發生。',
  },
  sad: {
    type: 'sad',
    label: '難過沮喪',
    emoji: '😢',
    color: '#6366f1',
    bgLight: 'bg-indigo-50',
    borderColor: 'border-indigo-300',
    textColor: 'text-indigo-700',
    description: '心裡酸酸重重的，提不起精神。',
  },
  angry: {
    type: 'angry',
    label: '生氣不滿',
    emoji: '😡',
    color: '#f43f5e',
    bgLight: 'bg-rose-50',
    borderColor: 'border-rose-300',
    textColor: 'text-rose-700',
    description: '覺得很不公平或很煩躁，拳頭緊握。',
  },
  tired: {
    type: 'tired',
    label: '疲倦想睡',
    emoji: '🥱',
    color: '#8b5cf6',
    bgLight: 'bg-purple-50',
    borderColor: 'border-purple-300',
    textColor: 'text-purple-700',
    description: '電力快用完了，好想趴著休息一下。',
  },
};

export const SITUATION_LABELS: Record<ChatSituationCategory, string> = {
  general_chat: '一般日常聊天',
  happy_achievement: '開心與成就感',
  peer_conflict: '同學衝突',
  bullying: '疑似被霸凌',
  family_issue: '家庭生活困擾',
  academic_stress: '課業學習壓力',
  anger_frustration: '生氣與挫折',
  violence_harm_others: '暴力或傷害他人',
  self_harm_emergency: '自傷或緊急危險',
};
