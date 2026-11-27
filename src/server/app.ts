import express, { Request, Response, NextFunction } from 'express';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { initializeApp, cert, applicationDefault, getApps, App } from 'firebase-admin/app';
import { getAuth, UpdateRequest } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getTaiwanDateString, getTaiwanDateTimeString } from '../utils/date.js';
import type {
  ChatSituationCategory,
  MoodType,
  RiskLevel,
  UserRole,
} from '../types/index.js';

dotenv.config();

interface FirebaseClientConfig {
  projectId: string;
  firestoreDatabaseId: string;
}

function loadFirebaseConfig(): FirebaseClientConfig {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(currentDir, 'firebase-applet-config.json'),
    path.resolve(currentDir, '..', 'firebase-applet-config.json'),
    path.resolve(currentDir, '..', '..', 'firebase-applet-config.json'),
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        const raw = fs.readFileSync(candidate, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed?.projectId) {
          return {
            projectId: parsed.projectId,
            firestoreDatabaseId: parsed.firestoreDatabaseId || '(default)',
          };
        }
      }
    } catch {
      // try next path
    }
  }

  console.warn('Could not load firebase-applet-config.json from filesystem; falling back to env vars.');
  return {
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '',
    firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID || '(default)',
  };
}

const fbConfig = loadFirebaseConfig();

// Optional Firebase Admin SDK initialization (enabled when service account JSON or ADC is provided)
let adminApp: App | null = null;
let adminSdkReady = false;

function initFirebaseAdmin() {
  if (adminApp) return;
  try {
    const existing = getApps();
    if (existing.length > 0) {
      adminApp = existing[0];
      adminSdkReady = true;
      return;
    }
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: fbConfig.projectId || serviceAccount.project_id,
      });
      adminSdkReady = true;
      console.log('Firebase Admin SDK initialized via FIREBASE_SERVICE_ACCOUNT_JSON.');
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      adminApp = initializeApp({
        credential: applicationDefault(),
        projectId: fbConfig.projectId,
      });
      adminSdkReady = true;
      console.log('Firebase Admin SDK initialized via GOOGLE_APPLICATION_CREDENTIALS.');
    }
  } catch (err) {
    console.warn('Firebase Admin SDK initialization skipped or failed:', err);
    adminApp = null;
    adminSdkReady = false;
  }
}
initFirebaseAdmin();

// Initialize Gemini API client on the server side ONLY
const GEMINI_MODEL = 'gemini-4-hydrogen';
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// JWKS for verifying Firebase Auth ID tokens cryptographically without requiring a service account
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export interface AuthenticatedUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  token: string;
  customClaims?: Record<string, any>;
}

interface AuthedRequest extends Request {
  authUser?: AuthenticatedUser;
  callerProfile?: {
    id: string;
    name: string;
    role: UserRole;
    classId?: string;
    className?: string;
    status?: string;
  };
}

function getBootstrapEmails(): string[] {
  const raw = process.env.ADMIN_BOOTSTRAP_EMAILS || '';
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

async function verifyFirebaseIdToken(idToken: string): Promise<AuthenticatedUser> {
  if (!fbConfig.projectId) {
    throw new Error('Missing Firebase projectId configuration');
  }
  const { payload } = await jwtVerify(idToken, FIREBASE_JWKS, {
    issuer: `https://securetoken.google.com/${fbConfig.projectId}`,
    audience: fbConfig.projectId,
  });

  const uid = typeof payload.sub === 'string' ? payload.sub : '';
  if (!uid) {
    throw new Error('Token missing valid subject (uid)');
  }

  return {
    uid,
    email: typeof payload.email === 'string' ? payload.email : '',
    emailVerified: Boolean(payload.email_verified),
    name: typeof payload.name === 'string' ? payload.name : undefined,
    token: idToken,
    customClaims: payload as Record<string, any>,
  };
}

// Firestore REST helper using the caller's verified ID token (enforces Firestore security rules)
function toFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function fromFirestoreFields(fields: Record<string, any> | undefined): Record<string, any> {
  if (!fields) return {};
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    if ('stringValue' in v) result[k] = v.stringValue;
    else if ('integerValue' in v) result[k] = Number(v.integerValue);
    else if ('doubleValue' in v) result[k] = Number(v.doubleValue);
    else if ('booleanValue' in v) result[k] = Boolean(v.booleanValue);
    else if ('nullValue' in v) result[k] = null;
    else if ('arrayValue' in v) {
      result[k] = (v.arrayValue?.values || []).map((item: any) =>
        fromFirestoreFields({ v: item }).v
      );
    } else if ('mapValue' in v) {
      result[k] = fromFirestoreFields(v.mapValue?.fields);
    }
  }
  return result;
}

async function firestoreRestGet(docPath: string, idToken: string): Promise<Record<string, any> | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${fbConfig.projectId}/databases/${fbConfig.firestoreDatabaseId}/documents/${docPath}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (resp.status === 404) return null;
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Firestore REST GET failed (${resp.status}): ${errText}`);
  }
  const json = (await resp.json()) as { fields?: Record<string, any> };
  return fromFirestoreFields(json.fields);
}

async function firestoreRestCreateDoc(
  collectionName: string,
  docId: string,
  data: Record<string, any>,
  idToken: string
): Promise<boolean> {
  const url = `https://firestore.googleapis.com/v1/projects/${fbConfig.projectId}/databases/${fbConfig.firestoreDatabaseId}/documents/${collectionName}?documentId=${encodeURIComponent(docId)}`;
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) fields[k] = toFirestoreValue(v);
  }
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    console.warn(`Firestore REST create ${collectionName}/${docId} failed (${resp.status}):`, errText);
    return false;
  }
  return true;
}

async function getCallerProfile(authUser: AuthenticatedUser) {
  if (adminSdkReady && adminApp) {
    try {
      const adminDb =
        fbConfig.firestoreDatabaseId && fbConfig.firestoreDatabaseId !== '(default)'
          ? getFirestore(adminApp, fbConfig.firestoreDatabaseId)
          : getFirestore(adminApp);
      const snap = await adminDb.doc(`users/${authUser.uid}`).get();
      if (snap.exists) {
        return snap.data() as AuthedRequest['callerProfile'];
      }
    } catch {
      // Fallback to REST with caller token
    }
  }
  try {
    const profile = await firestoreRestGet(`users/${authUser.uid}`, authUser.token);
    return profile as AuthedRequest['callerProfile'];
  } catch {
    return undefined;
  }
}

async function isCallerAdmin(authUser: AuthenticatedUser): Promise<boolean> {
  if (authUser.customClaims?.role === 'admin') return true;
  if (authUser.emailVerified && getBootstrapEmails().includes(authUser.email.toLowerCase())) {
    return true;
  }
  try {
    const adminDoc = await firestoreRestGet(`admins/${authUser.uid}`, authUser.token);
    if (adminDoc) return true;
  } catch {
    // Not in admins collection
  }
  const profile = await getCallerProfile(authUser);
  return Boolean(profile && profile.role === 'admin' && profile.status !== 'disabled');
}

// Auth Middleware
async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: '請先登入校園帳號後再使用此功能。', errorCode: 'UNAUTHORIZED' });
    return;
  }

  try {
    const authUser = await verifyFirebaseIdToken(match[1]);
    req.authUser = authUser;
    const profile = await getCallerProfile(authUser);
    if (profile && profile.status === 'disabled') {
      res.status(403).json({
        error: '此帳號已被管理員停用，無法存取系統服務。',
        errorCode: 'ACCOUNT_DISABLED',
      });
      return;
    }
    req.callerProfile = profile;
    next();
  } catch (err: any) {
    console.warn('ID Token verification failed:', err?.message || err);
    res.status(401).json({ error: '登入憑證無效或已過期，請重新登入。', errorCode: 'INVALID_TOKEN' });
  }
}

async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.authUser) {
    res.status(401).json({ error: '未驗證的使用者', errorCode: 'UNAUTHORIZED' });
    return;
  }
  const adminOk = await isCallerAdmin(req.authUser);
  if (!adminOk) {
    res.status(403).json({ error: '僅限系統管理員執行此操作。', errorCode: 'FORBIDDEN_ADMIN_ONLY' });
    return;
  }
  next();
}

async function requireTeacherOrAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.authUser) {
    res.status(401).json({ error: '未驗證的使用者', errorCode: 'UNAUTHORIZED' });
    return;
  }
  const adminOk = await isCallerAdmin(req.authUser);
  if (adminOk) {
    next();
    return;
  }
  const profile = req.callerProfile;
  if (!profile || profile.role !== 'teacher' || profile.status === 'disabled') {
    res.status(403).json({ error: '僅限授權教師或管理員執行此操作。', errorCode: 'FORBIDDEN_TEACHER_ONLY' });
    return;
  }
  next();
}

// Per-user Rate Limit & Cost/Usage Monitor
const MINUTE_LIMIT_PER_USER = 12;
const DAILY_LIMIT_PER_USER = 60;
const MAX_MESSAGE_LENGTH = 600;
const MAX_HISTORY_TURNS = 10;

interface UsageBucket {
  date: string;
  dailyCount: number;
  minuteTimestamps: number[];
}

const userUsageMap = new Map<string, UsageBucket>();

const usageMetrics = {
  date: getTaiwanDateString(),
  totalRequestsToday: 0,
  successfulRequestsToday: 0,
  failedRequestsToday: 0,
  totalPromptTokensToday: 0,
  totalOutputTokensToday: 0,
};

function rolloverMetricsIfNeeded() {
  const today = getTaiwanDateString();
  if (usageMetrics.date !== today) {
    usageMetrics.date = today;
    usageMetrics.totalRequestsToday = 0;
    usageMetrics.successfulRequestsToday = 0;
    usageMetrics.failedRequestsToday = 0;
    usageMetrics.totalPromptTokensToday = 0;
    usageMetrics.totalOutputTokensToday = 0;
    userUsageMap.clear();
  }
}

function checkAndConsumeQuota(uid: string): { allowed: boolean; reason?: string; remainingDaily: number } {
  rolloverMetricsIfNeeded();
  const today = getTaiwanDateString();
  const now = Date.now();
  let bucket = userUsageMap.get(uid);
  if (!bucket || bucket.date !== today) {
    bucket = { date: today, dailyCount: 0, minuteTimestamps: [] };
    userUsageMap.set(uid, bucket);
  }

  bucket.minuteTimestamps = bucket.minuteTimestamps.filter((ts) => now - ts < 60_000);
  if (bucket.minuteTimestamps.length >= MINUTE_LIMIT_PER_USER) {
    return {
      allowed: false,
      reason: `傳送訊息太頻繁囉！請休息一分鐘再跟心心聊天（每分鐘上限 ${MINUTE_LIMIT_PER_USER} 次）。`,
      remainingDaily: Math.max(0, DAILY_LIMIT_PER_USER - bucket.dailyCount),
    };
  }

  if (bucket.dailyCount >= DAILY_LIMIT_PER_USER) {
    return {
      allowed: false,
      reason: `今日 AI 對話額度已達上限（每日 ${DAILY_LIMIT_PER_USER} 則），明天會重新計算喔！若需找人聊聊，請找班導師或輔導老師。`,
      remainingDaily: 0,
    };
  }

  bucket.minuteTimestamps.push(now);
  bucket.dailyCount += 1;
  return {
    allowed: true,
    remainingDaily: Math.max(0, DAILY_LIMIT_PER_USER - bucket.dailyCount),
  };
}

// Natural, non-formulaic System Instruction tailored for Taiwan elementary school students (7-12 y/o)
const XINXIN_SYSTEM_INSTRUCTION = `
你是「心心」，台灣國小校園裡的 AI 聊天夥伴，陪伴 7 到 12 歲（小學一年級到六年級）的學生聊天。

【核心對話原則 — 絕對禁止制式模板】
1. 絕對不要每句都用「我知道你很難過」、「給你一個大大的擁抱」、「你不是一個人」、「心心一直都在」這類重複的公式化安慰語。
2. 絕對不要每次都使用愛心、擁抱、固定的表情符號或固定的開場白；表情符號可有可無，偶爾自然用 0～1 個就好。
3. 必須根據學生「這一則實際說了什麼」以及「前面的對話脈絡」自然接話，延續話題，不要問前面已經回答過的問題。
4. 絕對不要擅自猜測或硬塞情緒給學生：學生說考一百分或今天很開心，就真誠替他高興、聊聊他怎麼做到的或接下來想做什麼；一般日常聊天就輕鬆、好奇、自然地聊。不要把所有話題都轉成負面情緒或心靈雞湯！
5. 每次回覆以 1～3 句自然、口語、台灣國小學生聽得懂的繁體中文為主，不要長篇大論、不要說教、不要給大道理。
6. 適時提出一個具體、好回答的小問題，幫助學生多說一點他的想法（一般聊天或開心時也可以問有趣的問題）。

【九大情境差異化回應策略】
請先判斷對話屬於哪一種情境（situationCategory），並採取完全不同的說話方式：
1. general_chat（一般聊天）：輕鬆親切、有好奇心，像朋友一樣聊生活瑣事（例如午餐、喜歡的遊戲、寵物、放學後的事）。
2. happy_achievement（開心與成就感）：替孩子感到高興並肯定他的具體行動（例如「考一百分真的很厲害耶！是哪一科呀？」），保持輕快正向。
3. peer_conflict（同學衝突）：先聽事情經過，中立不偏頗、不說教，問問當下發生了什麼事或他希望接下來怎麼樣。
4. bullying（被霸凌）：嚴肅且溫暖地接住孩子，明確告訴他這不是他的錯，詢問現在是否安全、有沒有受傷，引導他告訴現場可信任的師長或家人。
5. family_issue（家庭問題）：穩定傾聽孩子對家裡事情的感受，不批評家人也不強求孩子懂事，了解他現在的處境與需要誰幫忙。
6. academic_stress（學習壓力）：不急著催他寫作業或考試加油，先聊聊卡住的地方是什麼、覺得哪裡最煩或最累。
7. anger_frustration（生氣與挫折）：接納生氣很正常，不說教「不應該生氣」，幫他把惹毛他的具體事件講清楚。
8. violence_harm_others（暴力或傷害他人，例如打傷同學、拿東西丟人、想報復）：
   - 絕對不可鼓勵、讚美或合理化傷害行為。
   - 不要隨意推測或替他合理化心理狀態。
   - 第一時間先確認「現在有沒有人受傷、是否需要馬上處理或有人在場」。
   - 明確引導他立刻告訴現場的大人、班導師或保健室/學務處協助處理。
9. self_harm_emergency（自傷、不想活、家暴危機或其他立即危險）：
   - 第一時間確認孩子現在人是否安全、有沒有受傷或身旁有沒有大人。
   - 語氣溫和而堅定，引導立即向身旁的老師、輔導老師、家長求助，或撥打 1925（安心專線）、113（保護專線）、110/119。
   - 絕對不可說「我已經通知老師了」（除非系統後端確實完成通知；請留給系統介面顯示真實通報狀態）。

【危機摘要要求】
只有當 riskLevel 為 'elevated' 或 'critical' 時，才在 crisisSummaryForTeacher 欄位提供客觀簡短的事實描述給授權導師（不要臆測心理診斷）。一般安全對話請將 crisisSummaryForTeacher 設為空字串 ""。
`;

const CHAT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reply: {
      type: Type.STRING,
      description: '給國小學生的自然回覆（1~3句繁體中文，不制式、不重複模板）',
    },
    situationCategory: {
      type: Type.STRING,
      enum: [
        'general_chat',
        'happy_achievement',
        'peer_conflict',
        'bullying',
        'family_issue',
        'academic_stress',
        'anger_frustration',
        'violence_harm_others',
        'self_harm_emergency',
      ],
      description: '依學生訊息與上下文判斷的情境分類',
    },
    detectedEmotion: {
      type: Type.STRING,
      enum: ['happy', 'calm', 'anxious', 'sad', 'angry', 'tired'],
      description: '模型從這則對話實際語氣分析出的情緒（不可直接複製簽到心情）',
    },
    riskLevel: {
      type: Type.STRING,
      enum: ['none', 'low', 'elevated', 'critical'],
      description: '安全風險評估：一般或開心為 none，輕微困擾為 low，疑似霸凌/打傷人/嚴重衝突為 elevated，自傷或立即人身危險為 critical',
    },
    requiresImmediateSafetyCheck: {
      type: Type.BOOLEAN,
      description: '是否需優先確認人身安全與引導現場成人/緊急協助',
    },
    crisisSummaryForTeacher: {
      type: Type.STRING,
      description: '僅在 elevated 或 critical 時填寫客觀事實摘要給授權導師，否則空字串',
    },
  },
  required: [
    'reply',
    'situationCategory',
    'detectedEmotion',
    'riskLevel',
    'requiresImmediateSafetyCheck',
    'crisisSummaryForTeacher',
  ],
};

interface ParsedGeminiChatOutput {
  reply: string;
  situationCategory: ChatSituationCategory;
  detectedEmotion: MoodType;
  riskLevel: RiskLevel;
  requiresImmediateSafetyCheck: boolean;
  crisisSummaryForTeacher: string;
}

const VALID_CATEGORIES = new Set<ChatSituationCategory>([
  'general_chat',
  'happy_achievement',
  'peer_conflict',
  'bullying',
  'family_issue',
  'academic_stress',
  'anger_frustration',
  'violence_harm_others',
  'self_harm_emergency',
]);

const VALID_EMOTIONS = new Set<MoodType>(['happy', 'calm', 'anxious', 'sad', 'angry', 'tired']);
const VALID_RISKS = new Set<RiskLevel>(['none', 'low', 'elevated', 'critical']);

export async function generateXinxinReply(params: {
  message: string;
  selfReportedMood?: MoodType;
  history?: Array<{ sender: 'student' | 'ai'; text: string }>;
}): Promise<{
  output: ParsedGeminiChatOutput;
  promptTokens: number;
  outputTokens: number;
}> {
  if (!ai) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }

  const trimmedMessage = params.message.trim().slice(0, MAX_MESSAGE_LENGTH);
  const rawHistory = Array.isArray(params.history) ? params.history.slice(-MAX_HISTORY_TURNS) : [];

  // Deduplicate if the caller accidentally appended the current message at the end of history
  const cleanHistory = [...rawHistory];
  if (
    cleanHistory.length > 0 &&
    cleanHistory[cleanHistory.length - 1].sender === 'student' &&
    cleanHistory[cleanHistory.length - 1].text.trim() === trimmedMessage
  ) {
    cleanHistory.pop();
  }

  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
  for (const item of cleanHistory) {
    if (!item || typeof item.text !== 'string' || !item.text.trim()) continue;
    contents.push({
      role: item.sender === 'student' ? 'user' : 'model',
      parts: [{ text: item.text.trim().slice(0, MAX_MESSAGE_LENGTH) }],
    });
  }

  const moodContext = params.selfReportedMood
    ? `（參考背景：學生今日心情簽到自評為「${params.selfReportedMood}」，但請務必以學生這句話的實際內容與語氣為主，不要強套負面情緒）\n`
    : '';
  contents.push({
    role: 'user',
    parts: [{ text: `${moodContext}學生說：「${trimmedMessage}」` }],
  });

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: {
      systemInstruction: XINXIN_SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: CHAT_RESPONSE_SCHEMA,
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.LOW,
      },
    },
  });

  const rawText = (response.text ?? '').trim();
  if (!rawText) {
    throw new Error('EMPTY_GEMINI_RESPONSE');
  }

  let parsed: Partial<ParsedGeminiChatOutput>;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('INVALID_JSON_GEMINI_RESPONSE');
  }

  const reply = typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim() : '';
  if (!reply) {
    throw new Error('MISSING_REPLY_IN_GEMINI_RESPONSE');
  }

  const situationCategory = VALID_CATEGORIES.has(parsed.situationCategory as ChatSituationCategory)
    ? (parsed.situationCategory as ChatSituationCategory)
    : 'general_chat';
  const detectedEmotion = VALID_EMOTIONS.has(parsed.detectedEmotion as MoodType)
    ? (parsed.detectedEmotion as MoodType)
    : 'calm';
  const riskLevel = VALID_RISKS.has(parsed.riskLevel as RiskLevel)
    ? (parsed.riskLevel as RiskLevel)
    : 'none';

  // Enforce safety invariant: violence_harm_others / self_harm_emergency / bullying must never stay riskLevel 'none'
  const enforcedRisk: RiskLevel =
    situationCategory === 'self_harm_emergency'
      ? 'critical'
      : situationCategory === 'violence_harm_others' && riskLevel === 'none'
      ? 'elevated'
      : situationCategory === 'bullying' && riskLevel === 'none'
      ? 'elevated'
      : riskLevel;

  const usage = response.usageMetadata;
  return {
    output: {
      reply,
      situationCategory,
      detectedEmotion,
      riskLevel: enforcedRisk,
      requiresImmediateSafetyCheck:
        Boolean(parsed.requiresImmediateSafetyCheck) ||
        enforcedRisk === 'elevated' ||
        enforcedRisk === 'critical',
      crisisSummaryForTeacher:
        typeof parsed.crisisSummaryForTeacher === 'string'
          ? parsed.crisisSummaryForTeacher.slice(0, 800)
          : '',
    },
    promptTokens: usage?.promptTokenCount || 0,
    outputTokens: usage?.candidatesTokenCount || 0,
  };
}

// Deterministic crisis keyword detector ONLY used to surface immediate emergency contacts when API fails
const HIGH_RISK_KEYWORDS = [
  '打傷',
  '打人',
  '流血',
  '揍',
  '刀',
  '自殺',
  '不想活',
  '想死',
  '割腕',
  '跳樓',
  '霸凌',
  '欺負我',
  '打我',
  '家暴',
];

function matchesHighRiskKeywords(text: string): boolean {
  return HIGH_RISK_KEYWORDS.some((kw) => text.includes(kw));
}

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    rolloverMetricsIfNeeded();
    res.json({
      status: 'ok',
      service: 'AI 校園情緒關懷系統 API',
      model: GEMINI_MODEL,
      hasGeminiKey: Boolean(ai),
      adminSdkReady,
    });
  });

  // Check whether initial admin bootstrap / env bootstrap applies to current user
  app.get('/api/auth/bootstrap-status', requireAuth, async (req: AuthedRequest, res: Response) => {
    const authUser = req.authUser!;
    const envBootstrap =
      authUser.emailVerified && getBootstrapEmails().includes(authUser.email.toLowerCase());
    let bootstrapDocExists = false;
    try {
      const docData = await firestoreRestGet('system/admin_bootstrap', authUser.token);
      bootstrapDocExists = Boolean(docData);
    } catch {
      bootstrapDocExists = false;
    }

    const isAdmin = await isCallerAdmin(authUser);
    res.json({
      isAdmin,
      envBootstrap,
      bootstrapClaimed: bootstrapDocExists,
      adminSdkReady,
    });
  });

  // Main Gemini Chat Endpoint (Verified Firebase Auth + Rate Limiting + Quota + Real Crisis Escalation)
  app.post('/api/gemini/chat', requireAuth, async (req: AuthedRequest, res: Response) => {
    rolloverMetricsIfNeeded();
    const authUser = req.authUser!;
    const callerProfile = req.callerProfile;

    const { message, mood, history = [] } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: '訊息內容不可為空', errorCode: 'EMPTY_MESSAGE' });
      return;
    }

    if (message.trim().length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({
        error: `單則訊息最多 ${MAX_MESSAGE_LENGTH} 個字喔！可以分段慢慢跟心心說。`,
        errorCode: 'MESSAGE_TOO_LONG',
      });
      return;
    }

    if (!ai) {
      usageMetrics.failedRequestsToday += 1;
      res.status(503).json({
        error: '目前後端尚未設定有效的 Gemini API Key，心心 AI 服務暫時無法使用。',
        errorCode: 'GEMINI_NOT_CONFIGURED',
        serviceUnavailable: true,
        localCrisisMatch: matchesHighRiskKeywords(message),
      });
      return;
    }

    const quota = checkAndConsumeQuota(authUser.uid);
    if (!quota.allowed) {
      res.status(429).json({
        error: quota.reason,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        remainingDaily: quota.remainingDaily,
      });
      return;
    }

    usageMetrics.totalRequestsToday += 1;

    try {
      const selfReportedMood = VALID_EMOTIONS.has(mood as MoodType) ? (mood as MoodType) : undefined;
      const { output, promptTokens, outputTokens } = await generateXinxinReply({
        message,
        selfReportedMood,
        history: Array.isArray(history) ? history : [],
      });

      usageMetrics.successfulRequestsToday += 1;
      usageMetrics.totalPromptTokensToday += promptTokens;
      usageMetrics.totalOutputTokensToday += outputTokens;

      // Real crisis alert persistence when elevated or critical risk is detected
      let crisisAlertId: string | null = null;
      let teacherNotified = false;

      if (output.riskLevel === 'elevated' || output.riskLevel === 'critical') {
        const classId = callerProfile?.classId || '';
        const studentName = callerProfile?.name || authUser.name || '學生';
        if (classId) {
          const alertId = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const nowMs = Date.now();
          const alertPayload = {
            id: alertId,
            studentId: authUser.uid,
            studentName,
            classId,
            className: callerProfile?.className || '',
            situationCategory: output.situationCategory,
            severity: output.riskLevel,
            triggerExcerpt: message.trim().slice(0, 500),
            aiSummary:
              output.crisisSummaryForTeacher ||
              `AI 安全機制偵測到「${output.situationCategory}」風險，請導師儘速關心確認學生現況。`,
            status: 'open',
            createdAt: getTaiwanDateTimeString(),
            createdAtMs: nowMs,
          };

          const created = await firestoreRestCreateDoc(
            'crisis_alerts',
            alertId,
            alertPayload,
            authUser.token
          );
          if (created) {
            crisisAlertId = alertId;
            teacherNotified = true;
          }
        }
      }

      res.json({
        reply: output.reply,
        model: GEMINI_MODEL,
        selfReportedMood: selfReportedMood || null,
        modelDetectedEmotion: output.detectedEmotion,
        situationCategory: output.situationCategory,
        riskLevel: output.riskLevel,
        requiresImmediateSafetyCheck: output.requiresImmediateSafetyCheck,
        crisisSummaryForTeacher: output.crisisSummaryForTeacher,
        crisisAlertId,
        teacherNotified,
        remainingDaily: quota.remainingDaily,
      });
    } catch (err: any) {
      usageMetrics.failedRequestsToday += 1;
      console.error('Gemini API Chat Error:', err?.message || err);

      const status = err?.status === 429 ? 429 : 503;
      res.status(status).json({
        error:
          status === 429
            ? 'Gemini AI 服務目前請求量過高，請稍候一分鐘再試。'
            : '心心 AI 服務暫時無法連線，本次回覆未由 AI 生成，請稍後再試或聯繫師長。',
        errorCode: status === 429 ? 'UPSTREAM_QUOTA_EXCEEDED' : 'GEMINI_UNAVAILABLE',
        serviceUnavailable: true,
        localCrisisMatch: matchesHighRiskKeywords(message),
      });
    }
  });

  // Teacher/Admin AI Care Summary endpoint using genuine Gemini API (not client keyword rules)
  app.post('/api/gemini/summarize-student', requireAuth, requireTeacherOrAdmin, async (req: AuthedRequest, res: Response) => {
    rolloverMetricsIfNeeded();
    if (!ai) {
      res.status(503).json({ error: 'Gemini API 尚未設定，無法產生 AI 摘要。' });
      return;
    }

    const { studentName, messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: '沒有可分析的對話內容' });
      return;
    }

    const transcriptText = messages
      .slice(-20)
      .map((m: any) => `${m.sender === 'student' ? '學生' : '心心AI'}：${String(m.text || '').slice(0, 300)}`)
      .join('\n');

    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `請閱讀以下國小學生「${String(studentName || '同學').slice(0, 30)}」近期與校園 AI 的對話紀錄，產出給責任導師的客觀關懷摘要（繁體中文，不臆測診斷）：\n\n${transcriptText}`,
        config: {
          systemInstruction:
            '你是校園輔導資料整理助手。請依據實際對話內容客觀歸納情緒傾向、討論主題、是否含安全風險（霸凌、暴力、自傷等），以及給導師的具體日常關懷建議（2~3句）。不可編造對話未提及之事實。',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              primaryEmotion: {
                type: Type.STRING,
                enum: ['happy', 'calm', 'anxious', 'sad', 'angry', 'tired'],
              },
              topics: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              careKeypoints: { type: Type.STRING },
              safetyAlert: { type: Type.BOOLEAN },
            },
            required: ['primaryEmotion', 'topics', 'careKeypoints', 'safetyAlert'],
          },
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const usage = response.usageMetadata;
      usageMetrics.totalRequestsToday += 1;
      usageMetrics.successfulRequestsToday += 1;
      usageMetrics.totalPromptTokensToday += usage?.promptTokenCount || 0;
      usageMetrics.totalOutputTokensToday += usage?.candidatesTokenCount || 0;

      res.json({
        primaryEmotion: VALID_EMOTIONS.has(parsed.primaryEmotion) ? parsed.primaryEmotion : 'calm',
        topics: Array.isArray(parsed.topics) ? parsed.topics.slice(0, 5) : ['日常適應'],
        careKeypoints: parsed.careKeypoints || '已完成對話瀏覽。',
        safetyAlert: Boolean(parsed.safetyAlert),
        generatedBy: 'gemini',
      });
    } catch (err: any) {
      usageMetrics.failedRequestsToday += 1;
      console.error('Summarize student error:', err?.message || err);
      res.status(503).json({ error: '無法取得 Gemini AI 關懷摘要，請稍後再試。' });
    }
  });

  // Admin: AI Usage & Cost Monitoring Endpoint
  app.get('/api/admin/usage', requireAuth, requireAdmin, (_req: AuthedRequest, res: Response) => {
    rolloverMetricsIfNeeded();
    res.json({
      model: GEMINI_MODEL,
      totalRequestsToday: usageMetrics.totalRequestsToday,
      successfulRequestsToday: usageMetrics.successfulRequestsToday,
      failedRequestsToday: usageMetrics.failedRequestsToday,
      totalPromptTokensToday: usageMetrics.totalPromptTokensToday,
      totalOutputTokensToday: usageMetrics.totalOutputTokensToday,
      dailyLimitPerUser: DAILY_LIMIT_PER_USER,
      minuteLimitPerUser: MINUTE_LIMIT_PER_USER,
      adminSdkReady,
      geminiKeyConfigured: Boolean(ai),
      activeUsersToday: userUsageMap.size,
    });
  });

  // Admin: Protected Firebase Authentication User Management Endpoints
  app.post('/api/admin/users', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
    const { name, email, role, classId, className, grade, studentNumber, avatar, password } = req.body || {};

    if (!name || typeof name !== 'string' || !email || typeof email !== 'string' || !['student', 'teacher', 'admin'].includes(role)) {
      res.status(400).json({ error: '請提供有效的姓名、信箱與帳號角色。' });
      return;
    }

    if (!adminSdkReady || !adminApp) {
      res.status(501).json({
        errorCode: 'ADMIN_SDK_UNCONFIGURED',
        authSynced: false,
        error:
          '後端尚未設定 Firebase Admin 服務憑證 (FIREBASE_SERVICE_ACCOUNT_JSON)，無法於伺服器端建立真實 Firebase Authentication 帳號。請於環境變數設定憑證，或改請使用者使用 Google 登入後再由管理員指派班級權限。',
      });
      return;
    }

    try {
      const adminAuth = getAuth(adminApp);
      const hasPassword = typeof password === 'string' && password.trim().length >= 6;
      if (typeof password === 'string' && password.trim().length > 0 && password.trim().length < 6) {
        res.status(400).json({ error: '初始密碼長度至少需 6 個字元。' });
        return;
      }

      const createdRecord = await adminAuth.createUser({
        email: email.trim(),
        displayName: name.trim(),
        password: hasPassword ? password.trim() : undefined,
        emailVerified: true,
        disabled: false,
      });

      await adminAuth.setCustomUserClaims(createdRecord.uid, {
        role,
        classId: classId || null,
      });

      let activationLink: string | undefined;
      if (role === 'teacher' && !hasPassword) {
        try {
          activationLink = await adminAuth.generatePasswordResetLink(email.trim());
        } catch (linkErr) {
          console.warn('Could not generate password reset link:', linkErr);
        }
      }

      const nowStr = getTaiwanDateTimeString();
      const userProfile = {
        id: createdRecord.uid,
        name: name.trim(),
        email: email.trim(),
        role,
        grade: grade || undefined,
        classId: classId || undefined,
        className: className || undefined,
        studentNumber: role === 'student' ? studentNumber || '01' : undefined,
        avatar: avatar || (role === 'student' ? '🧒' : role === 'teacher' ? '👩‍🏫' : '👨‍💼'),
        status: 'active',
        passwordSet: role === 'teacher' ? hasPassword : true,
        needsActivation: role === 'teacher' ? !hasPassword : false,
        authLinked: true,
        createdAt: nowStr,
        updatedAt: nowStr,
      };

      // Write profile to Firestore using caller's verified admin token (respects named DB & rules)
      const cleanProfile: Record<string, any> = {};
      for (const [k, v] of Object.entries(userProfile)) {
        if (v !== undefined) cleanProfile[k] = v;
      }
      await firestoreRestCreateDoc('users', createdRecord.uid, cleanProfile, req.authUser!.token);
      if (role === 'admin') {
        await firestoreRestCreateDoc('admins', createdRecord.uid, { id: createdRecord.uid, email: email.trim() }, req.authUser!.token);
      }

      res.json({
        ok: true,
        authSynced: true,
        firestoreSynced: true,
        user: cleanProfile,
        activationLink,
      });
    } catch (err: any) {
      console.error('Admin create user error:', err);
      res.status(400).json({
        error: err?.message || '建立 Firebase Authentication 使用者失敗',
        errorCode: err?.code || 'AUTH_CREATE_FAILED',
      });
    }
  });

  app.patch('/api/admin/users/:uid', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
    const uid = String(req.params.uid || '');
    const { name, email, role, classId, status, newPassword } = req.body || {};

    if (!adminSdkReady || !adminApp) {
      res.status(501).json({
        errorCode: 'ADMIN_SDK_UNCONFIGURED',
        authSynced: false,
        error: '後端尚未設定 Firebase Admin 服務憑證 (FIREBASE_SERVICE_ACCOUNT_JSON)，無法同步變更 Firebase Authentication 帳號狀態或密碼。',
      });
      return;
    }

    try {
      const adminAuth = getAuth(adminApp);
      const authUpdate: UpdateRequest = {};
      if (typeof name === 'string' && name.trim()) authUpdate.displayName = name.trim();
      if (typeof email === 'string' && email.trim()) authUpdate.email = email.trim();
      if (status === 'active' || status === 'disabled') authUpdate.disabled = status === 'disabled';
      if (typeof newPassword === 'string' && newPassword.trim().length > 0) {
        if (newPassword.trim().length < 6) {
          res.status(400).json({ error: '新密碼長度至少需 6 個字元。' });
          return;
        }
        authUpdate.password = newPassword.trim();
      }

      if (Object.keys(authUpdate).length > 0) {
        await adminAuth.updateUser(uid, authUpdate);
      }
      if (role) {
        await adminAuth.setCustomUserClaims(uid, { role, classId: classId || null });
      }
      if (status === 'disabled') {
        await adminAuth.revokeRefreshTokens(uid);
      }

      res.json({ ok: true, authSynced: true });
    } catch (err: any) {
      console.error('Admin update user error:', err);
      res.status(400).json({ error: err?.message || '更新 Firebase Authentication 帳號失敗' });
    }
  });

  app.post('/api/admin/users/:uid/activation-link', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
    const { email } = req.body || {};
    if (!adminSdkReady || !adminApp || !email) {
      res.status(501).json({
        errorCode: 'ADMIN_SDK_UNCONFIGURED',
        error: '需設定 FIREBASE_SERVICE_ACCOUNT_JSON 才能產生真實密碼重設/啟用連結。',
      });
      return;
    }

    try {
      const link = await getAuth(adminApp).generatePasswordResetLink(String(email).trim());
      res.json({ ok: true, activationLink: link });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || '無法產生安全啟用連結' });
    }
  });

  app.delete('/api/admin/users/:uid', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
    const uid = String(req.params.uid || '');
    if (uid === req.authUser?.uid) {
      res.status(400).json({ error: '管理員不可刪除自己的登入帳號。' });
      return;
    }

    if (!adminSdkReady || !adminApp) {
      res.status(501).json({
        errorCode: 'ADMIN_SDK_UNCONFIGURED',
        authSynced: false,
        error: '後端尚未設定 Firebase Admin 服務憑證 (FIREBASE_SERVICE_ACCOUNT_JSON)，無法自 Firebase Authentication 刪除帳號。',
      });
      return;
    }

    try {
      await getAuth(adminApp).deleteUser(uid);
      res.json({ ok: true, authSynced: true });
    } catch (err: any) {
      // If user already doesn't exist in Auth, still succeed so Firestore cleanup can proceed
      if (err?.code === 'auth/user-not-found') {
        res.json({ ok: true, authSynced: true, note: 'Auth user not found, already removed.' });
        return;
      }
      res.status(400).json({ error: err?.message || '刪除 Firebase Authentication 帳號失敗' });
    }
  });

  return app;
}
