import { User, SchoolClass, MoodLog, CareNote, ChatMessage } from '../types';

export const INITIAL_CLASSES: SchoolClass[] = [
  {
    id: 'class-302',
    name: '三年二班',
    grade: '三年級',
    teacherId: 'teacher-01',
    teacherName: '陳敏慧 老師',
    studentCount: 1,
  },
];

// Preserved preset accounts: strictly 1 Admin, 1 Teacher, 1 Student
export const INITIAL_USERS: User[] = [
  {
    id: 'admin-01',
    name: '王志強 主任',
    email: 'admin.wang@school.edu.tw',
    role: 'admin',
    avatar: '👨‍💼',
    status: 'active',
    passwordSet: true,
    needsActivation: false,
  },
  {
    id: 'teacher-01',
    name: '陳敏慧 老師',
    email: 'minhui.chen@school.edu.tw',
    role: 'teacher',
    grade: '三年級',
    classId: 'class-302',
    className: '三年二班',
    avatar: '👩‍🏫',
    status: 'active',
    passwordSet: true,
    needsActivation: false,
  },
  {
    id: 'student-302-01',
    name: '林小光',
    email: 'light.lin@student.school.edu.tw',
    role: 'student',
    grade: '三年級',
    classId: 'class-302',
    className: '三年二班',
    studentNumber: '01',
    avatar: '👦',
    status: 'active',
    passwordSet: true,
    needsActivation: false,
  },
];

// IDs of previously seeded mock users/classes/records removed during preset cleanup
export const LEGACY_PRESET_USER_IDS = [
  'teacher-02',
  'student-302-02',
  'student-302-03',
  'student-302-04',
  'student-302-05',
  'student-302-06',
  'student-302-07',
  'student-302-08',
  'student-501-01',
  'student-501-02',
];

export const LEGACY_PRESET_CLASS_IDS = ['class-501', 'class-103'];

export const LEGACY_PRESET_MOOD_LOG_IDS = [
  'log-02',
  'log-03',
  'log-04',
  'log-05',
  'log-06',
  'log-07',
  'log-hist-01',
  'log-hist-02',
  'log-hist-03',
  'log-hist-05',
];

export const LEGACY_PRESET_CARE_NOTE_IDS = ['care-01', 'care-02'];

function getDateString(offsetDays: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().split('T')[0];
}

export const INITIAL_MOOD_LOGS: MoodLog[] = [
  {
    id: 'log-01',
    studentId: 'student-302-01',
    studentName: '林小光',
    classId: 'class-302',
    mood: 'happy',
    score: 5,
    tags: ['體育課', '好朋友'],
    note: '今天體育課投進三分球，大家都有給我拍手！',
    date: getDateString(0),
    createdAt: `${getDateString(0)} 08:15`,
  },
  {
    id: 'log-hist-04',
    studentId: 'student-302-01',
    studentName: '林小光',
    classId: 'class-302',
    mood: 'happy',
    score: 4,
    tags: ['美術課'],
    note: '畫了喜歡的太空船！',
    date: getDateString(1),
    createdAt: `${getDateString(1)} 08:12`,
  },
];

export const INITIAL_CARE_NOTES: CareNote[] = [
  {
    id: 'care-302-01',
    studentId: 'student-302-01',
    studentName: '林小光',
    classId: 'class-302',
    teacherId: 'teacher-01',
    teacherName: '陳敏慧 老師',
    alertLevel: 'normal',
    content: '小光近期在體育課與同儕互動積極，情緒穩定開朗。',
    actionTaken: '課間給予正向肯定，鼓勵持續與同學分享合作經驗。',
    createdAt: `${getDateString(0)} 10:15`,
  },
];

export const INITIAL_CHAT_MESSAGES: Record<string, ChatMessage[]> = {
  'student-302-01': [
    {
      id: 'chat-init-01',
      studentId: 'student-302-01',
      studentName: '林小光',
      classId: 'class-302',
      sender: 'student',
      text: '我今天體育課投進一顆超遠的球，還被大家選成小隊長！',
      timestamp: '08:17',
      createdAt: `${getDateString(0)} 08:17:15`,
    },
    {
      id: 'chat-init-02',
      studentId: 'student-302-01',
      studentName: '林小光',
      classId: 'class-302',
      sender: 'ai',
      text: '聽起來超厲害的耶！進球的時候一定很有成就感吧，當上小隊長你最想帶大家先練什麼呢？',
      emotionTag: 'happy',
      modelDetectedEmotion: 'happy',
      situationCategory: 'happy_achievement',
      riskLevel: 'none',
      aiStatus: 'gemini',
      timestamp: '08:18',
      createdAt: `${getDateString(0)} 08:18:02`,
    },
  ],
};
