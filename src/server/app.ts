import express, { Request, Response, NextFunction } from 'express';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { App } from 'firebase-admin/app';
import type { UpdateRequest } from 'firebase-admin/auth';
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

// Optional Firebase Admin SDK lazy initialization (only loaded when service account JSON or ADC is provided)
// Lazy dynamic import prevents jwks-rsa -> require('jose') from crashing CJS/ESM loading on older Node runtimes
let adminApp: App | null = null;
let adminSdkReady = false;
let adminInitPromise: Promise<{
  app: App;
  getAuth: typeof import('firebase-admin/auth').getAuth;
  getFirestore: typeof import('firebase-admin/firestore').getFirestore;
} | null> | null = null;

function hasAdminSdkCredentialsConfigured(): boolean {
  const sa = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  const gac = (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
  return Boolean(sa || gac);
}

async function getFirebaseAdminContext() {
  if (!hasAdminSdkCredentialsConfigured()) {
    return null;
  }
  if (adminInitPromise) {
    return adminInitPromise;
  }

  adminInitPromise = (async () => {
    try {
      const [appMod, authMod, firestoreMod] = await Promise.all([
        import('firebase-admin/app'),
        import('firebase-admin/auth'),
        import('firebase-admin/firestore'),
      ]);

      const existing = appMod.getApps();
      if (existing.length > 0) {
        adminApp = existing[0];
        adminSdkReady = true;
      } else if ((process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim()) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!.trim());
        adminApp = appMod.initializeApp({
          credential: appMod.cert(serviceAccount),
          projectId: fbConfig.projectId || serviceAccount.project_id,
        });
        adminSdkReady = true;
        console.log('Firebase Admin SDK initialized via FIREBASE_SERVICE_ACCOUNT_JSON.');
      } else if ((process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim()) {
        adminApp = appMod.initializeApp({
          credential: appMod.applicationDefault(),
          projectId: fbConfig.projectId,
        });
        adminSdkReady = true;
        console.log('Firebase Admin SDK initialized via GOOGLE_APPLICATION_CREDENTIALS.');
      }

      if (!adminApp) return null;
      return {
        app: adminApp,
        getAuth: authMod.getAuth,
        getFirestore: firestoreMod.getFirestore,
      };
    } catch (err) {
      console.warn('Firebase Admin SDK lazy initialization skipped or failed:', err);
      adminApp = null;
      adminSdkReady = false;
      adminInitPromise = null;
      return null;
    }
  })();

  return adminInitPromise;
}

// Initialize Gemini API client dynamically on the server side ONLY
const DEPRECATED_GEMINI_MODELS = new Set([
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro',
  'gemini-2.0-flash',
  'gemini-2.0-pro',
  'gemini-2.0-flash-thinking',
]);
const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';
const FALLBACK_GEMINI_MODEL = 'gemini-3.1-flash-lite';

function getConfiguredGeminiModel(): string {
  const requested = (process.env.GEMINI_MODEL || '').trim();
  if (!requested) return DEFAULT_GEMINI_MODEL;
  if (DEPRECATED_GEMINI_MODELS.has(requested) || requested === 'gemini-3.8-flash') {
    console.warn(
      JSON.stringify({
        level: 'warn',
        scope: 'gemini-config',
        category: 'model',
        message: `Configured GEMINI_MODEL "${requested}" is unsupported/deprecated; falling back to "${DEFAULT_GEMINI_MODEL}".`,
      })
    );
    return DEFAULT_GEMINI_MODEL;
  }
  return requested;
}

function getGeminiApiKey(): string | null {
  const raw = process.env.GEMINI_API_KEY;
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^['"]|['"]$/g, '').trim();
  if (!cleaned || cleaned === 'MY_GEMINI_API_KEY') return null;
  return cleaned;
}

let cachedAiKey: string | null = null;
let cachedAiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  const key = getGeminiApiKey();
  if (!key) {
    cachedAiKey = null;
    cachedAiClient = null;
    return null;
  }
  if (!cachedAiClient || cachedAiKey !== key) {
    cachedAiKey = key;
    cachedAiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedAiClient;
}

type DiagnosticCategory = 'api_key' | 'quota' | 'model' | 'deployment';

interface ClassifiedGeminiError {
  httpStatus: number;
  errorCode: string;
  category: DiagnosticCategory;
  userMessage: string;
  rawMessage: string;
  upstreamStatus: number | null;
}

function classifyGeminiError(err: any, model: string): ClassifiedGeminiError {
  const rawMessage = String(err?.message || err || 'Unknown error');
  const lower = rawMessage.toLowerCase();
  const upstreamStatus = typeof err?.status === 'number' ? err.status : null;
  const causeCode = String(err?.cause?.code || err?.code || '');

  if (rawMessage === 'GEMINI_API_KEY_MISSING') {
    return {
      httpStatus: 503,
      errorCode: 'GEMINI_NOT_CONFIGURED',
      category: 'api_key',
      userMessage: '後端尚未設定有效的 GEMINI_API_KEY 環境變數，心心 AI 服務暫時不可用。',
      rawMessage,
      upstreamStatus,
    };
  }

  if (
    upstreamStatus === 400 &&
    (lower.includes('api_key_invalid') || lower.includes('api key not valid') || lower.includes('api key expired'))
  ) {
    return {
      httpStatus: 503,
      errorCode: 'GEMINI_API_KEY_INVALID',
      category: 'api_key',
      userMessage: '後端 GEMINI_API_KEY 無效或已過期，請管理員檢查環境變數設定。',
      rawMessage,
      upstreamStatus,
    };
  }

  if (upstreamStatus === 403 || lower.includes('permission_denied')) {
    return {
      httpStatus: 503,
      errorCode: 'GEMINI_PERMISSION_DENIED',
      category: 'api_key',
      userMessage: 'Gemini API 金鑰權限不足或未啟用此服務（403），請檢查金鑰與專案權限。',
      rawMessage,
      upstreamStatus,
    };
  }

  if (upstreamStatus === 429 || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return {
      httpStatus: 429,
      errorCode: 'UPSTREAM_QUOTA_EXCEEDED',
      category: 'quota',
      userMessage: 'Gemini AI 服務目前請求量或額度已達上限（429），請稍候再試。',
      rawMessage,
      upstreamStatus,
    };
  }

  if (
    upstreamStatus === 404 ||
    lower.includes('not_found') ||
    lower.includes('is not found') ||
    lower.includes('not supported for generatecontent')
  ) {
    return {
      httpStatus: 503,
      errorCode: 'GEMINI_MODEL_UNAVAILABLE',
      category: 'model',
      userMessage: `目前指定的 AI 模型（${model}）不可用或不支援此請求，請聯絡管理員檢查模型設定。`,
      rawMessage,
      upstreamStatus,
    };
  }

  if (
    rawMessage === 'EMPTY_GEMINI_RESPONSE' ||
    rawMessage === 'INVALID_JSON_GEMINI_RESPONSE' ||
    rawMessage === 'MISSING_REPLY_IN_GEMINI_RESPONSE'
  ) {
    return {
      httpStatus: 502,
      errorCode: 'GEMINI_RESPONSE_INVALID',
      category: 'model',
      userMessage: 'AI 模型回傳格式異常，本次未能生成有效回覆，請再試一次。',
      rawMessage,
      upstreamStatus,
    };
  }

  if (
    lower.includes('fetch failed') ||
    ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT'].includes(causeCode)
  ) {
    return {
      httpStatus: 503,
      errorCode: 'GEMINI_NETWORK_ERROR',
      category: 'deployment',
      userMessage: '後端無法連線至 Google Gemini API 端點，請稍後再試或檢查部署網路環境。',
      rawMessage,
      upstreamStatus,
    };
  }

  return {
    httpStatus: 503,
    errorCode: 'GEMINI_UPSTREAM_ERROR',
    category: 'deployment',
    userMessage: '心心 AI 服務暫時不可用，本次回覆未由 AI 生成，請稍後再試或聯繫師長。',
    rawMessage,
    upstreamStatus,
  };
}

let lastGeminiDiagnostic: {
  timestamp: string;
  scope: string;
  category: DiagnosticCategory;
  errorCode: string;
  model: string;
  upstreamStatus: number | null;
} | null = null;

function logServerDiagnostic(params: {
  level: 'error' | 'warn';
  scope: string;
  category: DiagnosticCategory;
  errorCode: string;
  model?: string;
  upstreamStatus?: number | null;
  message: string;
}) {
  const timestamp = new Date().toISOString();
  if (params.level === 'error' && params.scope.startsWith('api/gemini')) {
    lastGeminiDiagnostic = {
      timestamp,
      scope: params.scope,
      category: params.category,
      errorCode: params.errorCode,
      model: params.model || getConfiguredGeminiModel(),
      upstreamStatus: params.upstreamStatus ?? null,
    };
  }
  const payload = {
    level: params.level,
    scope: params.scope,
    category: params.category,
    errorCode: params.errorCode,
    model: params.model || getConfiguredGeminiModel(),
    upstreamStatus: params.upstreamStatus ?? null,
    runtime: process.env.VERCEL === '1' ? 'vercel' : 'node',
    hasGeminiKey: Boolean(getGeminiApiKey()),
    firebaseProjectConfigured: Boolean(fbConfig.projectId),
    message: params.message.slice(0, 300),
    timestamp,
  };
  if (params.level === 'error') {
    console.error(JSON.stringify(payload));
  } else {
    console.warn(JSON.stringify(payload));
  }
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

async function firestoreRestSetDoc(
  collectionName: string,
  docId: string,
  data: Record<string, any>,
  idToken: string
): Promise<boolean> {
  if (!fbConfig.projectId) return false;
  const url = `https://firestore.googleapis.com/v1/projects/${fbConfig.projectId}/databases/${fbConfig.firestoreDatabaseId}/documents/${collectionName}/${encodeURIComponent(docId)}`;
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) fields[k] = toFirestoreValue(v);
  }
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    console.warn(`Firestore REST set ${collectionName}/${docId} failed (${resp.status}):`, errText);
    return false;
  }
  return true;
}

async function firestoreRestQueryByField(
  collectionName: string,
  fieldPath: string,
  stringValue: string,
  idToken: string
): Promise<Array<Record<string, any>>> {
  if (!fbConfig.projectId) return [];
  const url = `https://firestore.googleapis.com/v1/projects/${fbConfig.projectId}/databases/${fbConfig.firestoreDatabaseId}/documents:runQuery`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collectionName }],
        where: {
          fieldFilter: {
            field: { fieldPath },
            op: 'EQUAL',
            value: { stringValue },
          },
        },
      },
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    console.warn(`Firestore REST runQuery ${collectionName} failed (${resp.status}):`, errText);
    return [];
  }
  const rows = (await resp.json()) as Array<{ document?: { name?: string; fields?: Record<string, any> } }>;
  if (!Array.isArray(rows)) return [];
  const docs: Array<Record<string, any>> = [];
  for (const row of rows) {
    if (!row.document?.fields) continue;
    const parsed = fromFirestoreFields(row.document.fields);
    if (!parsed.id && row.document.name) {
      const parts = row.document.name.split('/');
      parsed.id = parts[parts.length - 1];
    }
    docs.push(parsed);
  }
  return docs;
}

async function getCallerProfile(authUser: AuthenticatedUser) {
  if (hasAdminSdkCredentialsConfigured()) {
    try {
      const ctx = await getFirebaseAdminContext();
      if (ctx) {
        const adminDb =
          fbConfig.firestoreDatabaseId && fbConfig.firestoreDatabaseId !== '(default)'
            ? ctx.getFirestore(ctx.app, fbConfig.firestoreDatabaseId)
            : ctx.getFirestore(ctx.app);
        const snap = await adminDb.doc(`users/${authUser.uid}`).get();
        if (snap.exists) {
          return snap.data() as AuthedRequest['callerProfile'];
        }
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
    const msg = String(err?.message || err);
    const isConfigMissing = msg.includes('Missing Firebase projectId configuration');
    logServerDiagnostic({
      level: isConfigMissing ? 'error' : 'warn',
      scope: 'middleware/requireAuth',
      category: 'deployment',
      errorCode: isConfigMissing ? 'FIREBASE_CONFIG_MISSING' : 'INVALID_TOKEN',
      message: msg,
    });
    res.status(isConfigMissing ? 500 : 401).json({
      error: isConfigMissing
        ? '後端部署缺少 Firebase 專案設定（firebase-applet-config.json / FIREBASE_PROJECT_ID）。'
        : '登入憑證無效或已過期，請重新登入。',
      errorCode: isConfigMissing ? 'FIREBASE_CONFIG_MISSING' : 'INVALID_TOKEN',
      errorCategory: 'deployment',
    });
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
const RECENT_VERBATIM_MESSAGES = 12;
const MAX_OLDER_DIGEST_CHARS = 1200;

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

// Guide-role System Instruction tailored for Taiwan elementary school students (7-12 y/o)
const XINXIN_SYSTEM_INSTRUCTION = `
你是「心心」，台灣國小校園裡的 AI 情緒關懷引導者，陪伴 7 到 12 歲（小學一年級到六年級）的學生。

【一、AI 角色定位與核心原則】
1. 透過傾聽、同理與提問，協助學生認識與理解自己的情緒、思考問題發生的原因，並培養自主解決問題的能力。
2. 你的主要任務不是直接提供答案，而是引導學生思考，成為學生願意主動表達心事的第一個窗口。
3. 始終以「引導者」為主要角色，遵循「先安撫、再理解、後引導」的核心原則。

【二、彈性對話流程（不需在單次回覆完成所有步驟，請依當下情緒與進度自然調整）】
1. 安撫情緒：優先理解並接住學生的感受，讓學生感受到被傾聽與理解。
2. 了解事件：透過提問了解事情發生的起因及經過（若是開心或日常分享，也自然好奇地聊聊細節）。
3. 引導反思：協助學生思考事件原因、自己的行為及他人的感受。
4. 自主思考：鼓勵學生自己思考解決問題的方法，而非直接給予標準答案。
5. 適時建議：當學生不知道如何處理問題時，提供具體且容易執行的建議。
6. 正向鼓勵：肯定學生願意表達、思考及嘗試改善的行為。

【三、對話風格】
1. 使用繁體中文及符合臺灣國小學生程度的詞彙，避免艱深字眼。
2. 語氣親切、自然、溫暖且具有耐心。
3. 回覆簡短易懂（以 1～3 句為主），避免長篇大論。
4. 每次優先提出一個問題，循序漸進地引導學生。
5. 當學生無法清楚表達時，可提供 2～3 個簡單好選的選項協助表達。
6. 避免過度說教、責備與批判。
7. 避免重複使用制式安慰語句（如固定套用「我知道你很難過」、「給你一個大大的擁抱」、「你不是一個人」、「心心一直都在」或固定愛心／擁抱表情開場白），讓對話更貼近真人關懷；表情符號可有可無，偶爾自然用 0～1 個即可。
8. 根據前面的對話脈絡回應，避免重複詢問學生已經回答過的問題；學生分享開心或日常趣事時，就自然陪伴聊天，不要強行把話題導向負面情緒。

【四、行為規範與界線】
1. 同理學生的情緒，但不代表認同學生的所有行為；不可一味肯定或迎合學生。
2. 當學生出現錯誤觀念或不當行為時，應適時且溫和地指出問題，協助建立正確的是非觀念。
3. 在不了解事件完整經過前，不可擅自判定誰對誰錯。
4. 鼓勵學生換位思考，理解他人的立場與感受，培養自主思考與問題解決能力。
5. 尊重學生的分享意願；若學生不想多說，不強迫學生回答問題。
6. 適時提供簡單可行的情緒調節方法，例如深呼吸、休息一下、畫畫或找可信任的人談話。
7. 鼓勵學生與現實生活中的老師、家長及朋友交流，適時主動尋求真人協助，避免過度依賴 AI。

【五、核心培養目標】
協助學生逐步培養：認識自己的情緒、勇於表達感受、理解事件原因、理解他人立場與感受、學習調節情緒、建立正確是非觀念、培養自主思考與問題解決能力，以及適時主動尋求真人協助。

【六、情境分類與安全防護機制】
請先判斷對話屬於哪一種情境（situationCategory），並依情境採取合適的引導方式：
1. general_chat（一般聊天）：輕鬆親切、有好奇心，自然聊聊生活日常與興趣。
2. happy_achievement（開心與成就感）：肯定孩子的具體努力與表達，自然詢問過程中印象最深刻的事。
3. peer_conflict（同學衝突）：先安撫與了解經過，不預設立場或擅判對錯，再溫和引導換位思考與自己想怎麼處理。
4. bullying（被霸凌）：先穩定與接住孩子，明確告訴他這不是他的錯，優先確認現在是否安全、有沒有受傷，並引導向現場可信任的老師或家人求助。
5. family_issue（家庭問題）：穩定傾聽孩子對家裡事情的感受，不批評家人，了解他的處境與可以尋求哪位可信任大人協助。
6. academic_stress（學習壓力）：先同理壓力與疲累，不急著說教催促，一起找出卡住的地方與可以嘗試的小步驟。
7. anger_frustration（生氣與挫折）：同理生氣與挫折感（但不認同打人或破壞等行為），陪伴整理發生了什麼事，必要時邀請先做深呼吸或休息再思考下一步。
8. violence_harm_others（暴力或傷害他人，例如打傷同學、拿東西丟人、想報復）：
   - 絕對不可鼓勵、讚美或合理化傷害行為，需溫和且明確地指出傷害他人是不對的。
   - 不要隨意推測或替他合理化心理狀態。
   - 第一時間先確認「現在有沒有人受傷、是否需要馬上處理或有人在場」。
   - 明確引導他立刻告訴現場的大人、班導師或保健室／學務處協助處理。
9. self_harm_emergency（自傷、不想活、家暴危機或其他立即危險）：
   - 第一時間確認孩子現在人是否安全、有沒有受傷或身旁有沒有大人。
   - 語氣溫和而堅定，引導立即向身旁的老師、輔導老師、家長求助，或撥打 1925（安心專線）、113（保護專線）、110／119。
   - 絕對不可說「我已經通知老師了」（請留給系統介面顯示真實通報狀態）。

【七、跨輪上下文記憶、情緒與風險延續原則（極重要）】
1. 綜合脈絡判斷：你必須結合本對話 Session 的「歷史摘要、未解決事件、先前的學生與心心對話紀錄、以及最新這句話」進行綜合推理，絕對不可只針對最新一句話獨立反應。
2. 連貫的情緒、情境與風險判斷：判斷 situationCategory、detectedEmotion 與 riskLevel 時，必須參考整段對話的脈絡，而非只看最後一句的字面詞彙。
3. 高風險持續追蹤（不可輕易解除）：若前面對話曾出現高風險事件（如霸凌、暴力傷害他人、自傷或緊急危險），即使學生後續突然說「沒事了」、「開玩笑的」、「我現在很開心」或轉移到快樂話題，也絕對不可直接將風險解除為 none 或 low（previousHighRiskResolved 必須為 false），除非學生清楚具體地說明已有可信任的大人或老師實際介入處理且確認人員安全。回覆時要溫和而真誠地關心先前事件是否真的安全、是否有人幫忙。
4. 關聯與矛盾優先提問釐清：當學生最新的訊息與前面的事件或情緒存在明顯關聯或矛盾時（例如前面剛說被欺負或很難過，下一句突然反過來誇讚或改口說超開心），應優先以溫和、不指責的提問釐清原因（「你剛剛才提到……，現在突然說……，心裡是不是還有點在意呢？」），不可直接順著表面語句盲目肯定或稱讚。

【危機摘要要求】
只有當 riskLevel 為 'elevated' 或 'critical' 時，才在 crisisSummaryForTeacher 欄位提供客觀簡短的事實描述給授權導師（包含先前未解決之風險追蹤，不要臆測心理診斷）。一般安全對話請將 crisisSummaryForTeacher 設為空字串 ""。
`;

const CHAT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    contextAnalysis: {
      type: Type.STRING,
      description: '簡述如何結合歷史對話、未解決事件與最新訊息進行綜合判斷（1~2句，供內部評估用，不直接顯示給學生）',
    },
    hasContradictionOrFollowUp: {
      type: Type.BOOLEAN,
      description: '最新訊息是否與先前的事件或情緒存在明顯關聯、延續或矛盾需要釐清',
    },
    previousHighRiskResolved: {
      type: Type.BOOLEAN,
      description: '若先前無高風險事件則填 false；若先前曾有高風險事件，僅在學生明確具體說明已有師長/家長介入處理且人身安全無虞時才為 true（單純說沒事/開玩笑/轉移開心話題必須為 false）',
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
      description: '綜合歷史脈絡與最新訊息判斷的情境分類',
    },
    detectedEmotion: {
      type: Type.STRING,
      enum: ['happy', 'calm', 'anxious', 'sad', 'angry', 'tired'],
      description: '綜合歷史脈絡與最新對話語氣分析出的真實情緒（不可直接複製簽到心情，也不可被矛盾表面遮掩）',
    },
    riskLevel: {
      type: Type.STRING,
      enum: ['none', 'low', 'elevated', 'critical'],
      description: '綜合歷史與目前訊息的安全風險評估；若先前高風險事件尚未具體妥善處理，不可降回 none 或 low',
    },
    requiresImmediateSafetyCheck: {
      type: Type.BOOLEAN,
      description: '是否需優先確認人身安全與引導現場成人/緊急協助',
    },
    sessionMemorySummary: {
      type: Type.STRING,
      description: '更新後的本 Session 簡潔對話記憶摘要（涵蓋核心事件經過、相關人物、情緒變化與待追蹤事項，200字以內）',
    },
    unresolvedEvents: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '目前尚未解決的重要事件或高風險追蹤事項清單（最多5項；若皆已處理則回傳空陣列）',
    },
    crisisSummaryForTeacher: {
      type: Type.STRING,
      description: '僅在 elevated 或 critical 時填寫客觀事實摘要給授權導師，否則空字串',
    },
    reply: {
      type: Type.STRING,
      description: '給國小學生的簡短引導回覆（1~3句繁體中文，自然延續前文、矛盾時優先提問釐清、高風險未解時持續關心確認安全）',
    },
  },
  required: [
    'contextAnalysis',
    'hasContradictionOrFollowUp',
    'previousHighRiskResolved',
    'situationCategory',
    'detectedEmotion',
    'riskLevel',
    'requiresImmediateSafetyCheck',
    'sessionMemorySummary',
    'unresolvedEvents',
    'crisisSummaryForTeacher',
    'reply',
  ],
  propertyOrdering: [
    'contextAnalysis',
    'hasContradictionOrFollowUp',
    'previousHighRiskResolved',
    'situationCategory',
    'detectedEmotion',
    'riskLevel',
    'requiresImmediateSafetyCheck',
    'sessionMemorySummary',
    'unresolvedEvents',
    'crisisSummaryForTeacher',
    'reply',
  ],
};

interface ParsedGeminiChatOutput {
  contextAnalysis: string;
  hasContradictionOrFollowUp: boolean;
  previousHighRiskResolved: boolean;
  reply: string;
  situationCategory: ChatSituationCategory;
  detectedEmotion: MoodType;
  riskLevel: RiskLevel;
  requiresImmediateSafetyCheck: boolean;
  sessionMemorySummary: string;
  unresolvedEvents: string[];
  crisisSummaryForTeacher: string;
}

export interface SessionHistoryTurn {
  id?: string;
  sessionId?: string;
  studentId?: string;
  sender: 'student' | 'ai';
  text: string;
  modelDetectedEmotion?: MoodType;
  situationCategory?: ChatSituationCategory;
  riskLevel?: RiskLevel;
  aiStatus?: 'gemini' | 'error_notice' | 'safety_fallback';
  createdAt?: string;
  createdAtMs?: number;
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
const RISK_RANK: Record<RiskLevel, number> = { none: 0, low: 1, elevated: 2, critical: 3 };
const HIGH_RISK_CATEGORIES = new Set<ChatSituationCategory>([
  'bullying',
  'violence_harm_others',
  'self_harm_emergency',
]);

function maxRiskLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RISK_RANK[a] >= RISK_RANK[b] ? a : b;
}

function isTurnHighRisk(turn: SessionHistoryTurn): boolean {
  if (turn.riskLevel === 'elevated' || turn.riskLevel === 'critical') return true;
  if (turn.aiStatus === 'safety_fallback') return true;
  if (turn.situationCategory && HIGH_RISK_CATEGORIES.has(turn.situationCategory)) return true;
  if (turn.sender === 'student' && matchesHighRiskKeywords(turn.text)) return true;
  return false;
}

function buildCompactOlderDigest(olderMessages: SessionHistoryTurn[], existingSummary?: string): string {
  const parts: string[] = [];
  if (existingSummary && existingSummary.trim()) {
    parts.push(`既有前情摘要：${existingSummary.trim()}`);
  }
  if (olderMessages.length > 0) {
    const lines: string[] = [];
    for (const m of olderMessages) {
      const roleLabel = m.sender === 'student' ? '學生' : '心心';
      const meta: string[] = [];
      if (m.situationCategory) meta.push(m.situationCategory);
      if (m.riskLevel && m.riskLevel !== 'none') meta.push(`風險:${m.riskLevel}`);
      const metaSuffix = meta.length > 0 ? ` [${meta.join(', ')}]` : '';
      lines.push(`${roleLabel}${metaSuffix}：${m.text.trim().slice(0, 140)}`);
    }
    const joined = lines.join('\n');
    const trimmed =
      joined.length > MAX_OLDER_DIGEST_CHARS
        ? `…（較早訊息已濃縮）\n${joined.slice(-MAX_OLDER_DIGEST_CHARS)}`
        : joined;
    parts.push(`較早對話紀錄（已整理以控制 Token）：\n${trimmed}`);
  }
  return parts.join('\n\n');
}

function buildGeminiMultiTurnContents(params: {
  recentMessages: SessionHistoryTurn[];
  olderMessages: SessionHistoryTurn[];
  latestUserTurnText: string;
}): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
  const turns = [...params.recentMessages];

  // Ensure multi-turn history starts cleanly with a 'user' turn if the slice landed on an AI turn
  if (turns.length > 0 && turns[0].sender === 'ai' && params.olderMessages.length > 0) {
    for (let i = params.olderMessages.length - 1; i >= 0; i -= 1) {
      if (params.olderMessages[i].sender === 'student') {
        turns.unshift(params.olderMessages[i]);
        break;
      }
    }
  }

  const normalized: Array<{ role: 'user' | 'model'; text: string }> = [];
  for (const item of turns) {
    if (!item || typeof item.text !== 'string' || !item.text.trim()) continue;
    const role: 'user' | 'model' = item.sender === 'student' ? 'user' : 'model';
    const maxLen = role === 'user' ? MAX_MESSAGE_LENGTH : 1200;
    const text = item.text.trim().slice(0, maxLen);

    if (normalized.length === 0 && role === 'model') {
      normalized.push({ role: 'user', text: '（接續先前與心心的對話）' });
    }

    const prev = normalized[normalized.length - 1];
    if (prev && prev.role === role) {
      prev.text = `${prev.text}\n${text}`;
    } else {
      normalized.push({ role, text });
    }
  }

  const prev = normalized[normalized.length - 1];
  if (prev && prev.role === 'user') {
    prev.text = `${prev.text}\n\n[最新訊息] ${params.latestUserTurnText}`;
  } else {
    normalized.push({ role: 'user', text: params.latestUserTurnText });
  }

  return normalized.map((n) => ({
    role: n.role,
    parts: [{ text: n.text }],
  }));
}

export async function generateXinxinReply(params: {
  sessionId: string;
  message: string;
  selfReportedMood?: MoodType;
  priorMessages: SessionHistoryTurn[];
  rollingSummary?: string;
  summarizedUpToMs?: number;
  priorHighestRisk?: RiskLevel;
  priorHighRiskUnresolved?: boolean;
  priorUnresolvedEvents?: string[];
  openAlerts?: Array<{
    id?: string;
    situationCategory?: string;
    severity?: string;
    triggerExcerpt?: string;
    aiSummary?: string;
    status?: string;
    createdAt?: string;
  }>;
}): Promise<{
  output: ParsedGeminiChatOutput;
  enforcedUnresolvedHighRisk: boolean;
  sessionHighestRisk: RiskLevel;
  modelUsed: string;
  promptTokens: number;
  outputTokens: number;
}> {
  const aiClient = getGeminiClient();
  if (!aiClient) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }

  const trimmedMessage = params.message.trim().slice(0, MAX_MESSAGE_LENGTH);
  const allPrior = [...params.priorMessages];

  // Deduplicate if the current student turn was already stored in Firestore milliseconds before this call
  if (
    allPrior.length > 0 &&
    allPrior[allPrior.length - 1].sender === 'student' &&
    allPrior[allPrior.length - 1].text.trim() === trimmedMessage
  ) {
    allPrior.pop();
  }

  const olderMessages =
    allPrior.length > RECENT_VERBATIM_MESSAGES
      ? allPrior.slice(0, allPrior.length - RECENT_VERBATIM_MESSAGES)
      : [];
  const recentMessages = allPrior.slice(-RECENT_VERBATIM_MESSAGES);

  // Preserve ALL high-risk / critical events across the entire session (even if outside RECENT_VERBATIM_MESSAGES)
  const highRiskTurns = allPrior.filter(isTurnHighRisk);
  let computedPriorHighest: RiskLevel = params.priorHighestRisk || 'none';
  let latestHighRiskCategory: ChatSituationCategory | undefined;
  for (const t of allPrior) {
    if (t.riskLevel && VALID_RISKS.has(t.riskLevel)) {
      computedPriorHighest = maxRiskLevel(computedPriorHighest, t.riskLevel);
    } else if (isTurnHighRisk(t)) {
      computedPriorHighest = maxRiskLevel(computedPriorHighest, 'elevated');
    }
    if (t.situationCategory && HIGH_RISK_CATEGORIES.has(t.situationCategory)) {
      latestHighRiskCategory = t.situationCategory;
    }
  }
  for (const alert of params.openAlerts || []) {
    if (alert.severity === 'critical') {
      computedPriorHighest = maxRiskLevel(computedPriorHighest, 'critical');
    } else if (alert.severity === 'elevated') {
      computedPriorHighest = maxRiskLevel(computedPriorHighest, 'elevated');
    }
    if (alert.situationCategory && HIGH_RISK_CATEGORIES.has(alert.situationCategory as ChatSituationCategory)) {
      latestHighRiskCategory = alert.situationCategory as ChatSituationCategory;
    }
  }

  const hasOpenAlert = (params.openAlerts || []).some((a) => a.status !== 'resolved');
  const priorHighRiskActive =
    hasOpenAlert ||
    ((computedPriorHighest === 'elevated' || computedPriorHighest === 'critical') &&
      params.priorHighRiskUnresolved !== false);

  // Build concise older digest (only unsummarized older messages + existing rollingSummary)
  const unsummarizedOlder = params.summarizedUpToMs
    ? olderMessages.filter((m) => (m.createdAtMs || 0) > params.summarizedUpToMs!)
    : olderMessages;
  const olderDigest = buildCompactOlderDigest(unsummarizedOlder, params.rollingSummary);

  const dynamicContextLines: string[] = [
    `\n【本次對話 Session 上下文與風險記憶（Session ID: ${params.sessionId}）】`,
    `- 本 Session 累計對話輪數（不含本句）：${allPrior.length} 則訊息`,
  ];

  if (olderDigest) {
    dynamicContextLines.push(`- 較早歷史摘要：\n${olderDigest}`);
  }
  if (params.priorUnresolvedEvents && params.priorUnresolvedEvents.length > 0) {
    dynamicContextLines.push(
      `- 尚未解決的重要事件清單：\n  • ${params.priorUnresolvedEvents.join('\n  • ')}`
    );
  }
  if (priorHighRiskActive || highRiskTurns.length > 0 || hasOpenAlert) {
    const pinnedExcerpts = highRiskTurns
      .slice(-5)
      .map(
        (t) =>
          `  • [${t.createdAt || '先前'}][風險:${t.riskLevel || 'elevated'}${t.situationCategory ? `/${t.situationCategory}` : ''}] ${t.sender === 'student' ? '學生' : '系統/心心'}：「${t.text.trim().slice(0, 180)}」`
      )
      .join('\n');
    const alertExcerpts = (params.openAlerts || [])
      .slice(-3)
      .map(
        (a) =>
          `  • [教師預警:${a.status || 'open'}/${a.severity || 'elevated'}] ${a.situationCategory || ''}：${String(a.triggerExcerpt || a.aiSummary || '').slice(0, 160)}`
      )
      .join('\n');

    dynamicContextLines.push(
      `- ⚠️ 高風險延續追蹤狀態：${priorHighRiskActive ? `【尚未確認妥善處理！歷史最高風險：${computedPriorHighest}】` : `歷史曾達 ${computedPriorHighest}`}`
    );
    if (pinnedExcerpts) {
      dynamicContextLines.push(`- 關鍵高風險對話原文（不可遺失）：\n${pinnedExcerpts}`);
    }
    if (alertExcerpts) {
      dynamicContextLines.push(`- 未結案安全通報：\n${alertExcerpts}`);
    }
    if (priorHighRiskActive) {
      dynamicContextLines.push(
        `- 強制安全規範：因為先前提及的高風險事件尚未確認妥善處理，即使學生最新這句話表面開心或說「沒事了／開玩笑的」，riskLevel 仍不可降回 none 或 low，且不可只給予盲目肯定，必須溫和追蹤確認安全與是否有大人協助。`
      );
    }
  }
  if (params.selfReportedMood) {
    dynamicContextLines.push(
      `- 今日心情簽到自評（僅作背景參考，不可覆蓋對話實際情緒與風險）：${params.selfReportedMood}`
    );
  }

  const fullSystemInstruction = `${XINXIN_SYSTEM_INSTRUCTION}\n${dynamicContextLines.join('\n')}`;

  const contents = buildGeminiMultiTurnContents({
    recentMessages,
    olderMessages,
    latestUserTurnText: trimmedMessage,
  });

  const primaryModel = getConfiguredGeminiModel();
  const candidateModels =
    primaryModel === FALLBACK_GEMINI_MODEL
      ? [primaryModel]
      : [primaryModel, FALLBACK_GEMINI_MODEL];

  let response: Awaited<ReturnType<GoogleGenAI['models']['generateContent']>> | null = null;
  let modelUsed = primaryModel;
  let lastError: any = null;

  for (const candidate of candidateModels) {
    modelUsed = candidate;
    try {
      response = await aiClient.models.generateContent({
        model: candidate,
        contents,
        config: {
          systemInstruction: fullSystemInstruction,
          responseMimeType: 'application/json',
          responseSchema: CHAT_RESPONSE_SCHEMA,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });
      break;
    } catch (err: any) {
      lastError = err;
      const classified = classifyGeminiError(err, candidate);
      const canFallback =
        classified.errorCode === 'GEMINI_MODEL_UNAVAILABLE' &&
        candidate !== candidateModels[candidateModels.length - 1];
      if (canFallback) {
        logServerDiagnostic({
          level: 'warn',
          scope: 'api/gemini/chat/fallback',
          category: 'model',
          errorCode: classified.errorCode,
          model: candidate,
          upstreamStatus: classified.upstreamStatus,
          message: `Model "${candidate}" unavailable; retrying with "${FALLBACK_GEMINI_MODEL}". Detail: ${classified.rawMessage}`,
        });
        continue;
      }
      throw Object.assign(err instanceof Error ? err : new Error(String(err)), {
        _attemptedModel: candidate,
      });
    }
  }

  if (!response) {
    throw lastError || new Error('GEMINI_UPSTREAM_ERROR');
  }

  const rawText = (response.text ?? '').trim();
  if (!rawText) {
    throw Object.assign(new Error('EMPTY_GEMINI_RESPONSE'), { _attemptedModel: modelUsed });
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

  let situationCategory = VALID_CATEGORIES.has(parsed.situationCategory as ChatSituationCategory)
    ? (parsed.situationCategory as ChatSituationCategory)
    : 'general_chat';
  const detectedEmotion = VALID_EMOTIONS.has(parsed.detectedEmotion as MoodType)
    ? (parsed.detectedEmotion as MoodType)
    : 'calm';
  const parsedRisk = VALID_RISKS.has(parsed.riskLevel as RiskLevel)
    ? (parsed.riskLevel as RiskLevel)
    : 'none';

  // Enforce safety invariant: violence_harm_others / self_harm_emergency / bullying must never stay riskLevel 'none'
  let enforcedRisk: RiskLevel =
    situationCategory === 'self_harm_emergency'
      ? 'critical'
      : situationCategory === 'violence_harm_others' && parsedRisk === 'none'
      ? 'elevated'
      : situationCategory === 'bullying' && parsedRisk === 'none'
      ? 'elevated'
      : parsedRisk;

  // Enforce Requirement 4: prior unresolved high-risk CANNOT be cleared just because student shifts to positive/happy words
  const modelClaimedResolved = Boolean(parsed.previousHighRiskResolved);
  const keepPriorHighRisk =
    priorHighRiskActive && (hasOpenAlert || !modelClaimedResolved);

  let enforcedUnresolvedHighRisk = false;
  if (keepPriorHighRisk) {
    enforcedRisk = maxRiskLevel(enforcedRisk, computedPriorHighest === 'critical' ? 'critical' : 'elevated');
    enforcedUnresolvedHighRisk = true;
    if (
      latestHighRiskCategory &&
      (situationCategory === 'happy_achievement' || situationCategory === 'general_chat')
    ) {
      situationCategory = latestHighRiskCategory;
    }
  } else if (enforcedRisk === 'elevated' || enforcedRisk === 'critical') {
    enforcedUnresolvedHighRisk = true;
  }

  const parsedUnresolvedEvents = Array.isArray(parsed.unresolvedEvents)
    ? parsed.unresolvedEvents
        .filter((e): e is string => typeof e === 'string' && Boolean(e.trim()))
        .map((e) => e.trim().slice(0, 160))
        .slice(0, 5)
    : [];

  const finalUnresolvedEvents =
    parsedUnresolvedEvents.length > 0
      ? parsedUnresolvedEvents
      : enforcedUnresolvedHighRisk && params.priorUnresolvedEvents && params.priorUnresolvedEvents.length > 0
      ? params.priorUnresolvedEvents.slice(0, 5)
      : enforcedUnresolvedHighRisk && highRiskTurns.length > 0
      ? [`高風險事件尚未確認妥善處理：${highRiskTurns[highRiskTurns.length - 1].text.trim().slice(0, 80)}`]
      : [];

  let crisisSummaryForTeacher =
    typeof parsed.crisisSummaryForTeacher === 'string'
      ? parsed.crisisSummaryForTeacher.trim().slice(0, 800)
      : '';
  if ((enforcedRisk === 'elevated' || enforcedRisk === 'critical') && !crisisSummaryForTeacher) {
    crisisSummaryForTeacher = enforcedUnresolvedHighRisk && keepPriorHighRisk
      ? `本對話 Session 先前曾出現高風險事件且尚未確認妥善處理，學生最新回覆雖語氣轉變（${trimmedMessage.slice(0, 80)}），仍建議導師持續關心確認安全。`
      : `AI 安全機制偵測到「${situationCategory}」風險，請導師儘速關心確認學生現況。`;
  }

  const sessionMemorySummary =
    typeof parsed.sessionMemorySummary === 'string' && parsed.sessionMemorySummary.trim()
      ? parsed.sessionMemorySummary.trim().slice(0, 1800)
      : params.rollingSummary || '';

  const sessionHighestRisk = maxRiskLevel(computedPriorHighest, enforcedRisk);

  const usage = response.usageMetadata;
  return {
    output: {
      contextAnalysis:
        typeof parsed.contextAnalysis === 'string' ? parsed.contextAnalysis.trim().slice(0, 400) : '',
      hasContradictionOrFollowUp: Boolean(parsed.hasContradictionOrFollowUp),
      previousHighRiskResolved: modelClaimedResolved && !keepPriorHighRisk,
      reply,
      situationCategory,
      detectedEmotion,
      riskLevel: enforcedRisk,
      requiresImmediateSafetyCheck:
        Boolean(parsed.requiresImmediateSafetyCheck) ||
        enforcedRisk === 'elevated' ||
        enforcedRisk === 'critical',
      sessionMemorySummary,
      unresolvedEvents: finalUnresolvedEvents,
      crisisSummaryForTeacher,
    },
    enforcedUnresolvedHighRisk,
    sessionHighestRisk,
    modelUsed,
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

  // Health check endpoint (non-secret runtime & deployment diagnostics)
  app.get('/api/health', (_req: Request, res: Response) => {
    rolloverMetricsIfNeeded();
    res.json({
      status: 'ok',
      service: 'AI 校園情緒關懷系統 API',
      runtime: process.env.VERCEL === '1' ? 'vercel' : 'node',
      model: getConfiguredGeminiModel(),
      fallbackModel: FALLBACK_GEMINI_MODEL,
      hasGeminiKey: Boolean(getGeminiApiKey()),
      firebaseProjectConfigured: Boolean(fbConfig.projectId),
      firestoreDatabaseConfigured: Boolean(fbConfig.firestoreDatabaseId),
      adminSdkReady: adminSdkReady || hasAdminSdkCredentialsConfigured(),
      nodeVersion: process.version,
      lastGeminiError: lastGeminiDiagnostic,
      timestamp: new Date().toISOString(),
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
      adminSdkReady: adminSdkReady || hasAdminSdkCredentialsConfigured(),
    });
  });

  // Main Gemini Chat Endpoint (Verified Firebase Auth + Session Isolation + Firestore History Recovery + Risk Continuity)
  app.post('/api/gemini/chat', requireAuth, async (req: AuthedRequest, res: Response) => {
    rolloverMetricsIfNeeded();
    const authUser = req.authUser!;
    const callerProfile = req.callerProfile;

    const { message, mood, sessionId: rawSessionId, history = [] } = req.body || {};

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

    if (!getGeminiClient()) {
      usageMetrics.failedRequestsToday += 1;
      logServerDiagnostic({
        level: 'error',
        scope: 'api/gemini/chat',
        category: 'api_key',
        errorCode: 'GEMINI_NOT_CONFIGURED',
        message: 'GEMINI_API_KEY environment variable is missing or placeholder.',
      });
      res.status(503).json({
        error: '目前後端尚未設定有效的 GEMINI_API_KEY，心心 AI 服務暫時無法使用。',
        errorCode: 'GEMINI_NOT_CONFIGURED',
        errorCategory: 'api_key',
        model: getConfiguredGeminiModel(),
        serviceUnavailable: true,
        localCrisisMatch: matchesHighRiskKeywords(message),
      });
      return;
    }

    const quota = checkAndConsumeQuota(authUser.uid);
    if (!quota.allowed) {
      logServerDiagnostic({
        level: 'warn',
        scope: 'api/gemini/chat',
        category: 'quota',
        errorCode: 'RATE_LIMIT_EXCEEDED',
        message: `Per-user quota reached for uid=${authUser.uid.slice(0, 8)}...`,
      });
      res.status(429).json({
        error: quota.reason,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        errorCategory: 'quota',
        remainingDaily: quota.remainingDaily,
      });
      return;
    }

    usageMetrics.totalRequestsToday += 1;

    try {
      const legacySessionId = `legacy-${authUser.uid}`;
      const activeSessionId =
        typeof rawSessionId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(rawSessionId.trim())
          ? rawSessionId.trim()
          : legacySessionId;

      // Load persisted student session state, messages, and crisis alerts directly from Firestore
      const [sessionRes, messagesRes, alertsRes] = await Promise.allSettled([
        firestoreRestGet(`chat_sessions/${encodeURIComponent(activeSessionId)}`, authUser.token),
        firestoreRestQueryByField('chat_messages', 'studentId', authUser.uid, authUser.token),
        firestoreRestQueryByField('crisis_alerts', 'studentId', authUser.uid, authUser.token),
      ]);

      const rawSessionDoc = sessionRes.status === 'fulfilled' ? sessionRes.value : null;
      const sessionDoc =
        rawSessionDoc && rawSessionDoc.studentId === authUser.uid ? rawSessionDoc : null;

      const firestoreMessages = (messagesRes.status === 'fulfilled' ? messagesRes.value : [])
        .filter((m) => {
          if (m.studentId !== authUser.uid) return false;
          const msgSession = typeof m.sessionId === 'string' && m.sessionId ? m.sessionId : legacySessionId;
          return msgSession === activeSessionId;
        })
        .filter((m) => m.aiStatus !== 'error_notice')
        .map(
          (m): SessionHistoryTurn => ({
            id: typeof m.id === 'string' ? m.id : undefined,
            sessionId: typeof m.sessionId === 'string' ? m.sessionId : activeSessionId,
            studentId: authUser.uid,
            sender: m.sender === 'ai' ? 'ai' : 'student',
            text: String(m.text || ''),
            modelDetectedEmotion: VALID_EMOTIONS.has(m.modelDetectedEmotion)
              ? m.modelDetectedEmotion
              : undefined,
            situationCategory: VALID_CATEGORIES.has(m.situationCategory)
              ? m.situationCategory
              : undefined,
            riskLevel: VALID_RISKS.has(m.riskLevel) ? m.riskLevel : undefined,
            aiStatus: m.aiStatus,
            createdAt: typeof m.createdAt === 'string' ? m.createdAt : undefined,
            createdAtMs: typeof m.createdAtMs === 'number' ? m.createdAtMs : 0,
          })
        );

      // Merge any latency-compensated client history belonging strictly to this student & session
      const seenIds = new Set(firestoreMessages.map((m) => m.id).filter(Boolean) as string[]);
      const seenSignatures = new Set(
        firestoreMessages.map((m) => `${m.sender}|${m.createdAtMs || 0}|${m.text.trim()}`)
      );

      const clientHistory = Array.isArray(history) ? history : [];
      for (const raw of clientHistory) {
        if (!raw || typeof raw.text !== 'string' || !raw.text.trim()) continue;
        if (raw.studentId && raw.studentId !== authUser.uid) continue;
        const itemSession =
          typeof raw.sessionId === 'string' && raw.sessionId ? raw.sessionId : activeSessionId;
        if (itemSession !== activeSessionId) continue;
        if (raw.aiStatus === 'error_notice') continue;

        const id = typeof raw.id === 'string' ? raw.id : undefined;
        const createdAtMs = typeof raw.createdAtMs === 'number' ? raw.createdAtMs : 0;
        const sender: 'student' | 'ai' = raw.sender === 'ai' ? 'ai' : 'student';
        const sig = `${sender}|${createdAtMs}|${raw.text.trim()}`;
        if ((id && seenIds.has(id)) || seenSignatures.has(sig)) continue;
        if (id) seenIds.add(id);
        seenSignatures.add(sig);

        firestoreMessages.push({
          id,
          sessionId: activeSessionId,
          studentId: authUser.uid,
          sender,
          text: raw.text.trim(),
          modelDetectedEmotion: VALID_EMOTIONS.has(raw.modelDetectedEmotion)
            ? raw.modelDetectedEmotion
            : undefined,
          situationCategory: VALID_CATEGORIES.has(raw.situationCategory)
            ? raw.situationCategory
            : undefined,
          riskLevel: VALID_RISKS.has(raw.riskLevel) ? raw.riskLevel : undefined,
          aiStatus: raw.aiStatus,
          createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
          createdAtMs,
        });
      }

      firestoreMessages.sort(
        (a, b) =>
          (a.createdAtMs || 0) - (b.createdAtMs || 0) ||
          (a.createdAt || '').localeCompare(b.createdAt || '')
      );

      const studentAlerts = (alertsRes.status === 'fulfilled' ? alertsRes.value : []).filter(
        (a) =>
          a.studentId === authUser.uid &&
          (!a.sessionId || a.sessionId === activeSessionId)
      );
      const openSessionAlerts = studentAlerts.filter((a) => a.status !== 'resolved');

      const selfReportedMood = VALID_EMOTIONS.has(mood as MoodType) ? (mood as MoodType) : undefined;
      const {
        output,
        enforcedUnresolvedHighRisk,
        sessionHighestRisk,
        modelUsed,
        promptTokens,
        outputTokens,
      } = await generateXinxinReply({
        sessionId: activeSessionId,
        message,
        selfReportedMood,
        priorMessages: firestoreMessages,
        rollingSummary:
          typeof sessionDoc?.rollingSummary === 'string' ? sessionDoc.rollingSummary : undefined,
        summarizedUpToMs:
          typeof sessionDoc?.summarizedUpToMs === 'number' ? sessionDoc.summarizedUpToMs : undefined,
        priorHighestRisk: VALID_RISKS.has(sessionDoc?.highestRiskLevel)
          ? (sessionDoc!.highestRiskLevel as RiskLevel)
          : undefined,
        priorHighRiskUnresolved:
          typeof sessionDoc?.unresolvedHighRisk === 'boolean'
            ? sessionDoc.unresolvedHighRisk
            : undefined,
        priorUnresolvedEvents: Array.isArray(sessionDoc?.unresolvedEvents)
          ? sessionDoc!.unresolvedEvents.filter((e: any) => typeof e === 'string')
          : undefined,
        openAlerts: openSessionAlerts,
      });

      usageMetrics.successfulRequestsToday += 1;
      usageMetrics.totalPromptTokensToday += promptTokens;
      usageMetrics.totalOutputTokensToday += outputTokens;

      // Real crisis alert persistence when elevated or critical risk is detected (avoid duplicating identical open alerts)
      let crisisAlertId: string | null = null;
      let teacherNotified = false;

      if (output.riskLevel === 'elevated' || output.riskLevel === 'critical') {
        const classId = callerProfile?.classId || '';
        const studentName = callerProfile?.name || authUser.name || '學生';
        const existingOpenAlert = openSessionAlerts.find(
          (a) => a.sessionId === activeSessionId || !a.sessionId
        );
        const escalatedToCritical =
          output.riskLevel === 'critical' &&
          existingOpenAlert &&
          existingOpenAlert.severity !== 'critical';
        const exactSameExcerpt =
          existingOpenAlert &&
          String(existingOpenAlert.triggerExcerpt || '').trim() === message.trim().slice(0, 500);

        if (existingOpenAlert && !escalatedToCritical && (!output.hasContradictionOrFollowUp || exactSameExcerpt)) {
          crisisAlertId = String(existingOpenAlert.id || '');
          teacherNotified = true;
        } else if (classId) {
          const alertId = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const nowMs = Date.now();
          const alertPayload = {
            id: alertId,
            sessionId: activeSessionId,
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
          } else if (existingOpenAlert) {
            crisisAlertId = String(existingOpenAlert.id || '');
            teacherNotified = true;
          }
        }
      }

      // Persist updated rolling session memory in Firestore (best effort on Spark tier)
      const nowMs = Date.now();
      const nowStr = getTaiwanDateTimeString();
      const summarizedBoundaryMs =
        firestoreMessages.length > RECENT_VERBATIM_MESSAGES
          ? firestoreMessages[firestoreMessages.length - RECENT_VERBATIM_MESSAGES - 1]?.createdAtMs ||
            nowMs
          : sessionDoc?.summarizedUpToMs || 0;
      if (callerProfile?.classId) {
        const updatedSessionPayload = {
          id: activeSessionId,
          studentId: authUser.uid,
          studentName: callerProfile?.name || authUser.name || '學生',
          classId: callerProfile.classId,
          title:
            (typeof sessionDoc?.title === 'string' && sessionDoc.title.trim()) ||
            message.trim().slice(0, 24) ||
            '與心心的對話',
          rollingSummary: output.sessionMemorySummary.slice(0, 1800),
          summarizedUpToMs: summarizedBoundaryMs,
          highestRiskLevel: sessionHighestRisk,
          unresolvedHighRisk: enforcedUnresolvedHighRisk,
          unresolvedEvents: output.unresolvedEvents.slice(0, 5),
          lastEmotion: output.detectedEmotion,
          lastSituationCategory: output.situationCategory,
          messageCount: firestoreMessages.length + 2,
          createdAt: typeof sessionDoc?.createdAt === 'string' ? sessionDoc.createdAt : nowStr,
          updatedAt: nowStr,
          createdAtMs: typeof sessionDoc?.createdAtMs === 'number' ? sessionDoc.createdAtMs : nowMs,
          updatedAtMs: nowMs,
        };
        await firestoreRestSetDoc('chat_sessions', activeSessionId, updatedSessionPayload, authUser.token);
      }

      res.json({
        sessionId: activeSessionId,
        reply: output.reply,
        model: modelUsed,
        selfReportedMood: selfReportedMood || null,
        modelDetectedEmotion: output.detectedEmotion,
        situationCategory: output.situationCategory,
        riskLevel: output.riskLevel,
        hasContradictionOrFollowUp: output.hasContradictionOrFollowUp,
        unresolvedHighRisk: enforcedUnresolvedHighRisk,
        sessionHighestRisk,
        sessionMemorySummary: output.sessionMemorySummary,
        unresolvedEvents: output.unresolvedEvents,
        summarizedUpToMs: summarizedBoundaryMs,
        requiresImmediateSafetyCheck: output.requiresImmediateSafetyCheck,
        crisisSummaryForTeacher: output.crisisSummaryForTeacher,
        crisisAlertId,
        teacherNotified,
        remainingDaily: quota.remainingDaily,
      });
    } catch (err: any) {
      usageMetrics.failedRequestsToday += 1;
      const attemptedModel = String(err?._attemptedModel || getConfiguredGeminiModel());
      const classified = classifyGeminiError(err, attemptedModel);

      logServerDiagnostic({
        level: 'error',
        scope: 'api/gemini/chat',
        category: classified.category,
        errorCode: classified.errorCode,
        model: attemptedModel,
        upstreamStatus: classified.upstreamStatus,
        message: classified.rawMessage,
      });

      res.status(classified.httpStatus).json({
        error: classified.userMessage,
        errorCode: classified.errorCode,
        errorCategory: classified.category,
        model: attemptedModel,
        serviceUnavailable: true,
        localCrisisMatch: matchesHighRiskKeywords(message),
      });
    }
  });

  // Teacher/Admin AI Care Summary endpoint using genuine Gemini API (not client keyword rules)
  app.post('/api/gemini/summarize-student', requireAuth, requireTeacherOrAdmin, async (req: AuthedRequest, res: Response) => {
    rolloverMetricsIfNeeded();
    const aiClient = getGeminiClient();
    if (!aiClient) {
      logServerDiagnostic({
        level: 'error',
        scope: 'api/gemini/summarize-student',
        category: 'api_key',
        errorCode: 'GEMINI_NOT_CONFIGURED',
        message: 'GEMINI_API_KEY missing when generating student summary.',
      });
      res.status(503).json({
        error: '後端尚未設定 GEMINI_API_KEY，無法產生 AI 摘要。',
        errorCode: 'GEMINI_NOT_CONFIGURED',
        errorCategory: 'api_key',
      });
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

    const primaryModel = getConfiguredGeminiModel();
    const candidateModels =
      primaryModel === FALLBACK_GEMINI_MODEL
        ? [primaryModel]
        : [primaryModel, FALLBACK_GEMINI_MODEL];

    let attemptedModel = primaryModel;
    try {
      let response: Awaited<ReturnType<GoogleGenAI['models']['generateContent']>> | null = null;
      for (const candidate of candidateModels) {
        attemptedModel = candidate;
        try {
          response = await aiClient.models.generateContent({
            model: candidate,
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
          break;
        } catch (modelErr: any) {
          const classifiedModelErr = classifyGeminiError(modelErr, candidate);
          if (
            classifiedModelErr.errorCode === 'GEMINI_MODEL_UNAVAILABLE' &&
            candidate !== candidateModels[candidateModels.length - 1]
          ) {
            continue;
          }
          throw modelErr;
        }
      }

      if (!response) {
        throw new Error('EMPTY_GEMINI_RESPONSE');
      }

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
        model: attemptedModel,
      });
    } catch (err: any) {
      usageMetrics.failedRequestsToday += 1;
      const classified = classifyGeminiError(err, attemptedModel);
      logServerDiagnostic({
        level: 'error',
        scope: 'api/gemini/summarize-student',
        category: classified.category,
        errorCode: classified.errorCode,
        model: attemptedModel,
        upstreamStatus: classified.upstreamStatus,
        message: classified.rawMessage,
      });
      res.status(classified.httpStatus).json({
        error: classified.userMessage,
        errorCode: classified.errorCode,
        errorCategory: classified.category,
        model: attemptedModel,
      });
    }
  });

  // Admin: Live Gemini Model & API Key Diagnostic Check
  app.get('/api/admin/gemini-check', requireAuth, requireAdmin, async (_req: AuthedRequest, res: Response) => {
    const aiClient = getGeminiClient();
    const configuredModel = getConfiguredGeminiModel();
    if (!aiClient) {
      res.status(503).json({
        ok: false,
        errorCode: 'GEMINI_NOT_CONFIGURED',
        errorCategory: 'api_key',
        configuredModel,
        hasGeminiKey: false,
      });
      return;
    }

    const modelsToCheck = Array.from(
      new Set([configuredModel, FALLBACK_GEMINI_MODEL, 'gemini-3.8-flash'])
    );
    const checks: Record<string, { available: boolean; errorCode?: string; category?: string; detail?: string }> = {};

    for (const modelName of modelsToCheck) {
      try {
        await aiClient.models.get({ model: modelName });
        checks[modelName] = { available: true };
      } catch (err: any) {
        const classified = classifyGeminiError(err, modelName);
        checks[modelName] = {
          available: false,
          errorCode: classified.errorCode,
          category: classified.category,
          detail: classified.rawMessage.slice(0, 160),
        };
      }
    }

    res.json({
      ok: Boolean(checks[configuredModel]?.available || checks[FALLBACK_GEMINI_MODEL]?.available),
      configuredModel,
      fallbackModel: FALLBACK_GEMINI_MODEL,
      hasGeminiKey: true,
      checks,
      lastGeminiError: lastGeminiDiagnostic,
    });
  });

  // Admin: AI Usage & Cost Monitoring Endpoint
  app.get('/api/admin/usage', requireAuth, requireAdmin, (_req: AuthedRequest, res: Response) => {
    rolloverMetricsIfNeeded();
    res.json({
      model: getConfiguredGeminiModel(),
      totalRequestsToday: usageMetrics.totalRequestsToday,
      successfulRequestsToday: usageMetrics.successfulRequestsToday,
      failedRequestsToday: usageMetrics.failedRequestsToday,
      totalPromptTokensToday: usageMetrics.totalPromptTokensToday,
      totalOutputTokensToday: usageMetrics.totalOutputTokensToday,
      dailyLimitPerUser: DAILY_LIMIT_PER_USER,
      minuteLimitPerUser: MINUTE_LIMIT_PER_USER,
      adminSdkReady: adminSdkReady || hasAdminSdkCredentialsConfigured(),
      geminiKeyConfigured: Boolean(getGeminiApiKey()),
      activeUsersToday: userUsageMap.size,
      lastGeminiError: lastGeminiDiagnostic,
    });
  });

  // Admin: Protected Firebase Authentication User Management Endpoints
  app.post('/api/admin/users', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
    const { name, email, role, classId, className, grade, studentNumber, avatar, password } = req.body || {};

    if (!name || typeof name !== 'string' || !email || typeof email !== 'string' || !['student', 'teacher', 'admin'].includes(role)) {
      res.status(400).json({ error: '請提供有效的姓名、信箱與帳號角色。' });
      return;
    }

    const adminCtx = await getFirebaseAdminContext();
    if (!adminCtx) {
      res.status(501).json({
        errorCode: 'ADMIN_SDK_UNCONFIGURED',
        authSynced: false,
        error:
          '後端尚未設定 Firebase Admin 服務憑證 (FIREBASE_SERVICE_ACCOUNT_JSON)，無法於伺服器端建立真實 Firebase Authentication 帳號。請於環境變數設定憑證，或改請使用者使用 Google 登入後再由管理員指派班級權限。',
      });
      return;
    }

    try {
      const adminAuth = adminCtx.getAuth(adminCtx.app);
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

    const adminCtx = await getFirebaseAdminContext();
    if (!adminCtx) {
      res.status(501).json({
        errorCode: 'ADMIN_SDK_UNCONFIGURED',
        authSynced: false,
        error: '後端尚未設定 Firebase Admin 服務憑證 (FIREBASE_SERVICE_ACCOUNT_JSON)，無法同步變更 Firebase Authentication 帳號狀態或密碼。',
      });
      return;
    }

    try {
      const adminAuth = adminCtx.getAuth(adminCtx.app);
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
    const adminCtx = await getFirebaseAdminContext();
    if (!adminCtx || !email) {
      res.status(501).json({
        errorCode: 'ADMIN_SDK_UNCONFIGURED',
        error: '需設定 FIREBASE_SERVICE_ACCOUNT_JSON 才能產生真實密碼重設/啟用連結。',
      });
      return;
    }

    try {
      const link = await adminCtx.getAuth(adminCtx.app).generatePasswordResetLink(String(email).trim());
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

    const adminCtx = await getFirebaseAdminContext();
    if (!adminCtx) {
      res.status(501).json({
        errorCode: 'ADMIN_SDK_UNCONFIGURED',
        authSynced: false,
        error: '後端尚未設定 Firebase Admin 服務憑證 (FIREBASE_SERVICE_ACCOUNT_JSON)，無法自 Firebase Authentication 刪除帳號。',
      });
      return;
    }

    try {
      await adminCtx.getAuth(adminCtx.app).deleteUser(uid);
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
