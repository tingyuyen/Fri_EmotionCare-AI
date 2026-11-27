import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  User,
  SchoolClass,
  MoodLog,
  CareNote,
  ChatMessage,
  ChatSession,
  MoodType,
  UserRole,
  ChatAccessLog,
  CrisisAlert,
  AiUsageSummary,
} from '../types';
import {
  LEGACY_PRESET_USER_IDS,
  LEGACY_PRESET_CLASS_IDS,
  LEGACY_PRESET_MOOD_LOG_IDS,
  LEGACY_PRESET_CARE_NOTE_IDS,
} from '../data/mockData';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  getTaiwanDateString,
  getTaiwanTimeString,
  getTaiwanDateTimeString,
  stripUndefined,
} from '../utils/date';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export interface AdminMutationResult {
  ok: boolean;
  authSynced: boolean;
  firestoreSynced: boolean;
  activationLink?: string;
  warning?: string;
  errorCode?: string;
}

interface BootstrapStatus {
  isAdmin: boolean;
  envBootstrap: boolean;
  bootstrapClaimed: boolean;
  adminSdkReady: boolean;
}

interface AppContextType {
  authLoading: boolean;
  profileLoading: boolean;
  syncStatus: SyncStatus;
  lastSyncError: string | null;
  clearSyncError: () => void;
  currentUser: User | null;
  firebaseUser: FirebaseUser | null;
  bootstrapStatus: BootstrapStatus | null;
  accountBlockedReason: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  sendResetPasswordEmail: (email: string) => Promise<void>;
  claimInitialAdmin: () => Promise<void>;
  completeFirstLoginSetup: (params: {
    role: 'student' | 'teacher';
    name: string;
    classId: string;
    studentNumber?: string;
  }) => Promise<void>;
  signOutUser: () => Promise<void>;
  users: User[];
  classes: SchoolClass[];
  moodLogs: MoodLog[];
  careNotes: CareNote[];
  chatSessions: ChatSession[];
  activeSessionId: string | null;
  activeChatSession: ChatSession | null;
  chatHistory: ChatMessage[];
  crisisAlerts: CrisisAlert[];
  chatAccessLogs: ChatAccessLog[];
  todayDate: string;
  isAiTyping: boolean;
  lastChatError: string | null;
  clearChatError: () => void;
  startNewChatSession: () => string;
  selectChatSession: (sessionId: string) => void;
  addMoodLog: (mood: MoodType, score: number, tags: string[], note?: string) => Promise<MoodLog>;
  addCareNote: (
    studentId: string,
    alertLevel: 'normal' | 'attention' | 'urgent',
    content: string,
    actionTaken?: string
  ) => Promise<void>;
  sendChatMessage: (text: string) => Promise<void>;
  acknowledgeCrisisAlert: (alertId: string, status: 'acknowledged' | 'resolved', resolutionNote?: string) => Promise<void>;
  logChatAccess: (studentId: string, studentName: string, purpose?: string) => Promise<void>;
  getStudentChatMessages: (studentId: string) => { allowed: boolean; messages: ChatMessage[]; error?: string };
  addClass: (cls: Omit<SchoolClass, 'id'>) => Promise<void>;
  addUser: (
    user: Omit<User, 'id'> & { password?: string; firestoreOnlyFallback?: boolean }
  ) => Promise<AdminMutationResult>;
  updateUser: (
    userId: string,
    updates: Partial<User> & { newPassword?: string; firestoreOnlyFallback?: boolean }
  ) => Promise<AdminMutationResult>;
  updateUserRole: (userId: string, role: UserRole) => Promise<AdminMutationResult>;
  toggleUserStatus: (userId: string, status: 'active' | 'disabled') => Promise<AdminMutationResult>;
  activateTeacherAccount: (userId: string) => Promise<AdminMutationResult>;
  generateTeacherActivationLink: (userId: string, email: string) => Promise<{ ok: boolean; activationLink?: string; error?: string }>;
  deleteUser: (userId: string, firestoreOnlyFallback?: boolean) => Promise<AdminMutationResult>;
  fetchAiUsageSummary: () => Promise<AiUsageSummary | null>;
  cleanupLegacyPresetUsers: () => Promise<{ deletedUsers: number; deletedClasses: number }>;
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

function upsertMessageSorted(list: ChatMessage[], msg: ChatMessage): ChatMessage[] {
  const filtered = list.filter((m) => m.id !== msg.id);
  filtered.push(msg);
  filtered.sort(
    (a, b) =>
      (a.createdAtMs || 0) - (b.createdAtMs || 0) ||
      (a.createdAt || '').localeCompare(b.createdAt || '')
  );
  return filtered;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const todayDate = getTaiwanDateString();

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [bootstrapStatus, setBootstrapStatus] = useState<BootstrapStatus | null>(null);
  const [accountBlockedReason, setAccountBlockedReason] = useState<string | null>(null);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [lastChatError, setLastChatError] = useState<string | null>(null);

  // Core Data States — NEVER pre-populated with mock data in Cloud mode!
  const [users, setUsers] = useState<User[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [moodLogs, setMoodLogs] = useState<MoodLog[]>([]);
  const [careNotes, setCareNotes] = useState<CareNote[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [chatSessionsLoaded, setChatSessionsLoaded] = useState<boolean>(false);
  const [chatMessagesLoaded, setChatMessagesLoaded] = useState<boolean>(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [chatMessagesMap, setChatMessagesMap] = useState<Record<string, ChatMessage[]>>({});
  const [crisisAlerts, setCrisisAlerts] = useState<CrisisAlert[]>([]);
  const [chatAccessLogs, setChatAccessLogs] = useState<ChatAccessLog[]>([]);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAiTyping, setIsAiTyping] = useState<boolean>(false);

  const clearPrivateState = useCallback(() => {
    setUsers([]);
    setClasses([]);
    setMoodLogs([]);
    setCareNotes([]);
    setChatSessions([]);
    setChatSessionsLoaded(false);
    setChatMessagesLoaded(false);
    setActiveSessionId(null);
    setChatMessagesMap({});
    setCrisisAlerts([]);
    setChatAccessLogs([]);
    setCurrentUser(null);
    setBootstrapStatus(null);
    setAccountBlockedReason(null);
    setLastSyncError(null);
    setLastChatError(null);
  }, []);

  const refreshBootstrapStatus = useCallback(async (fbUser: FirebaseUser): Promise<BootstrapStatus | null> => {
    try {
      const idToken = await fbUser.getIdToken();
      const resp = await fetch('/api/auth/bootstrap-status', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!resp.ok) return null;
      const data = (await resp.json()) as BootstrapStatus;
      setBootstrapStatus(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  // 1. Listen to Firebase Auth state
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);

      if (!fbUser) {
        clearPrivateState();
        setAuthLoading(false);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);
      setAccountBlockedReason(null);

      try {
        // Load public/signed-in classes list first so onboarding selector has classes
        const classesSnap = await getDocs(collection(db, 'classes')).catch(() => null);
        if (classesSnap) {
          setClasses(classesSnap.docs.map((d) => d.data() as SchoolClass));
        }

        const status = await refreshBootstrapStatus(fbUser);
        const userDocRef = doc(db, 'users', fbUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const profile = userDoc.data() as User;
          if (profile.status === 'disabled') {
            setAccountBlockedReason('您的帳號目前已被管理員停用，無法進入系統。請聯繫學校輔導處或系統管理員。');
            setCurrentUser(profile);
          } else {
            setCurrentUser(profile);
          }
        } else if (status?.envBootstrap && fbUser.emailVerified) {
          // Verified email explicitly configured in server ADMIN_BOOTSTRAP_EMAILS
          const nowStr = getTaiwanDateTimeString();
          const adminProfile: User = {
            id: fbUser.uid,
            name: fbUser.displayName || '系統管理員',
            email: fbUser.email || '',
            role: 'admin',
            avatar: '👨‍💼',
            status: 'active',
            passwordSet: true,
            needsActivation: false,
            authLinked: true,
            createdAt: nowStr,
            updatedAt: nowStr,
          };
          const batch = writeBatch(db);
          batch.set(doc(db, 'admins', fbUser.uid), { id: fbUser.uid, email: fbUser.email || '' });
          if (!status.bootstrapClaimed) {
            batch.set(doc(db, 'system', 'admin_bootstrap'), {
              claimedBy: fbUser.uid,
              claimedEmail: fbUser.email || '',
              claimedAt: nowStr,
            });
          }
          batch.set(userDocRef, stripUndefined(adminProfile));
          await batch.commit();
          setCurrentUser(adminProfile);
        } else {
          // User authenticated with Firebase, awaiting onboarding/class selection or initial admin claim
          setCurrentUser(null);
        }
      } catch (err: any) {
        console.error('Auth/Profile bootstrap error:', err);
        setLastSyncError('讀取帳號權限資料失敗，請確認網路連線或重新整理。');
      } finally {
        setAuthLoading(false);
        setProfileLoading(false);
      }
    });

    return () => unsubAuth();
  }, [clearPrivateState, refreshBootstrapStatus]);

  // 2. Real-time Firestore Listeners (ONLY after auth + active profile are ready; least-privilege scoped queries!)
  useEffect(() => {
    if (!firebaseUser || !currentUser) return;
    if (currentUser.status === 'disabled') return;
    if (currentUser.role === 'teacher' && currentUser.needsActivation) return;

    const unsubs: (() => void)[] = [];
    const uid = firebaseUser.uid;

    try {
      // Classes listener
      const unsubClasses = onSnapshot(
        collection(db, 'classes'),
        (snapshot) => {
          const list = snapshot.docs.map((d) => {
            const data = d.data() as SchoolClass;
            return { ...data, id: data.id || d.id };
          });
          setClasses(dedupeById(list));
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, 'classes');
        }
      );
      unsubs.push(unsubClasses);

      // Users listener — strictly scoped by role!
      if (currentUser.role === 'admin') {
        const unsubUsers = onSnapshot(
          collection(db, 'users'),
          (snapshot) => {
            const list = snapshot.docs.map((d) => {
              const data = d.data() as User;
              return { ...data, id: data.id || d.id };
            });
            setUsers(dedupeById(list));
          },
          (error) => handleFirestoreError(error, OperationType.GET, 'users')
        );
        unsubs.push(unsubUsers);
      } else if (currentUser.role === 'teacher' && currentUser.classId) {
        const unsubClassStudents = onSnapshot(
          query(
            collection(db, 'users'),
            where('classId', '==', currentUser.classId),
            where('role', '==', 'student')
          ),
          (snapshot) => {
            const studentsList = snapshot.docs.map((d) => {
              const data = d.data() as User;
              return { ...data, id: data.id || d.id };
            });
            setUsers(dedupeById([currentUser, ...studentsList.filter((s) => s.id !== currentUser.id)]));
          },
          (error) => handleFirestoreError(error, OperationType.GET, 'users')
        );
        unsubs.push(unsubClassStudents);
      } else {
        // Student only listens to their own profile doc
        const unsubSelf = onSnapshot(
          doc(db, 'users', uid),
          (snapshot) => {
            if (snapshot.exists()) {
              const selfData = snapshot.data() as User;
              setCurrentUser(selfData);
              setUsers([selfData]);
              if (selfData.status === 'disabled') {
                setAccountBlockedReason('您的帳號已被管理員停用。');
              }
            }
          },
          (error) => handleFirestoreError(error, OperationType.GET, `users/${uid}`)
        );
        unsubs.push(unsubSelf);
      }

      // Mood logs listener — strictly scoped!
      let moodQueryRef: ReturnType<typeof query> | ReturnType<typeof collection> | null = null;
      if (currentUser.role === 'admin') {
        moodQueryRef = collection(db, 'mood_logs');
      } else if (currentUser.role === 'teacher' && currentUser.classId) {
        moodQueryRef = query(collection(db, 'mood_logs'), where('classId', '==', currentUser.classId));
      } else if (currentUser.role === 'student') {
        moodQueryRef = query(collection(db, 'mood_logs'), where('studentId', '==', uid));
      }

      if (moodQueryRef) {
        const unsubMood = onSnapshot(
          moodQueryRef,
          (snapshot) => {
            const list = dedupeById(
              snapshot.docs.map((d) => {
                const data = d.data() as MoodLog;
                return { ...data, id: data.id || d.id };
              })
            );
            list.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0) || (b.createdAt || b.date).localeCompare(a.createdAt || a.date));
            setMoodLogs(list);
          },
          (error) => handleFirestoreError(error, OperationType.GET, 'mood_logs')
        );
        unsubs.push(unsubMood);
      }

      // Care notes listener — Teachers (own class) & Admins only!
      let careQueryRef: ReturnType<typeof query> | ReturnType<typeof collection> | null = null;
      if (currentUser.role === 'admin') {
        careQueryRef = collection(db, 'care_notes');
      } else if (currentUser.role === 'teacher' && currentUser.classId) {
        careQueryRef = query(collection(db, 'care_notes'), where('classId', '==', currentUser.classId));
      }

      if (careQueryRef) {
        const unsubCare = onSnapshot(
          careQueryRef,
          (snapshot) => {
            const list = dedupeById(
              snapshot.docs.map((d) => {
                const data = d.data() as CareNote;
                return { ...data, id: data.id || d.id };
              })
            );
            list.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0) || b.createdAt.localeCompare(a.createdAt));
            setCareNotes(list);
          },
          (error) => handleFirestoreError(error, OperationType.GET, 'care_notes')
        );
        unsubs.push(unsubCare);
      }

      // Chat messages listener — strictly scoped!
      let chatQueryRef: ReturnType<typeof query> | ReturnType<typeof collection> | null = null;
      if (currentUser.role === 'admin') {
        chatQueryRef = collection(db, 'chat_messages');
      } else if (currentUser.role === 'teacher' && currentUser.classId) {
        chatQueryRef = query(collection(db, 'chat_messages'), where('classId', '==', currentUser.classId));
      } else if (currentUser.role === 'student') {
        chatQueryRef = query(collection(db, 'chat_messages'), where('studentId', '==', uid));
      }

      if (chatQueryRef) {
        const unsubChat = onSnapshot(
          chatQueryRef,
          (snapshot) => {
            const grouped: Record<string, ChatMessage[]> = {};
            snapshot.docs.forEach((d) => {
              const raw = d.data() as ChatMessage;
              const msg: ChatMessage = { ...raw, id: raw.id || d.id };
              if (!grouped[msg.studentId]) grouped[msg.studentId] = [];
              grouped[msg.studentId].push(msg);
            });
            for (const sid of Object.keys(grouped)) {
              grouped[sid] = dedupeById(grouped[sid]);
              grouped[sid].sort(
                (a, b) =>
                  (a.createdAtMs || 0) - (b.createdAtMs || 0) ||
                  (a.createdAt || '').localeCompare(b.createdAt || '')
              );
            }
            setChatMessagesMap(grouped);
            setChatMessagesLoaded(true);
          },
          (error) => handleFirestoreError(error, OperationType.GET, 'chat_messages')
        );
        unsubs.push(unsubChat);
      }

      // Chat sessions listener — strictly scoped!
      let sessionQueryRef: ReturnType<typeof query> | ReturnType<typeof collection> | null = null;
      if (currentUser.role === 'admin') {
        sessionQueryRef = collection(db, 'chat_sessions');
      } else if (currentUser.role === 'teacher' && currentUser.classId) {
        sessionQueryRef = query(collection(db, 'chat_sessions'), where('classId', '==', currentUser.classId));
      } else if (currentUser.role === 'student') {
        sessionQueryRef = query(collection(db, 'chat_sessions'), where('studentId', '==', uid));
      }

      if (sessionQueryRef) {
        const unsubSessions = onSnapshot(
          sessionQueryRef,
          (snapshot) => {
            const list = dedupeById(
              snapshot.docs.map((d) => {
                const data = d.data() as ChatSession;
                return { ...data, id: data.id || d.id };
              })
            );
            list.sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));
            setChatSessions(list);
            setChatSessionsLoaded(true);
          },
          (error) => handleFirestoreError(error, OperationType.GET, 'chat_sessions')
        );
        unsubs.push(unsubSessions);
      }

      // Crisis alerts listener
      let alertQueryRef: ReturnType<typeof query> | ReturnType<typeof collection> | null = null;
      if (currentUser.role === 'admin') {
        alertQueryRef = collection(db, 'crisis_alerts');
      } else if (currentUser.role === 'teacher' && currentUser.classId) {
        alertQueryRef = query(collection(db, 'crisis_alerts'), where('classId', '==', currentUser.classId));
      } else if (currentUser.role === 'student') {
        alertQueryRef = query(collection(db, 'crisis_alerts'), where('studentId', '==', uid));
      }

      if (alertQueryRef) {
        const unsubAlerts = onSnapshot(
          alertQueryRef,
          (snapshot) => {
            const list = dedupeById(
              snapshot.docs.map((d) => {
                const data = d.data() as CrisisAlert;
                return { ...data, id: data.id || d.id };
              })
            );
            list.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
            setCrisisAlerts(list);
          },
          (error) => handleFirestoreError(error, OperationType.GET, 'crisis_alerts')
        );
        unsubs.push(unsubAlerts);
      }

      // Chat access audit logs listener — Teachers (own views) & Admins!
      let auditQueryRef: ReturnType<typeof query> | ReturnType<typeof collection> | null = null;
      if (currentUser.role === 'admin') {
        auditQueryRef = collection(db, 'chat_access_logs');
      } else if (currentUser.role === 'teacher') {
        auditQueryRef = query(collection(db, 'chat_access_logs'), where('teacherId', '==', uid));
      }

      if (auditQueryRef) {
        const unsubAudit = onSnapshot(
          auditQueryRef,
          (snapshot) => {
            const list = dedupeById(
              snapshot.docs.map((d) => {
                const data = d.data() as ChatAccessLog;
                return { ...data, id: data.id || d.id };
              })
            );
            list.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0) || b.timestamp.localeCompare(a.timestamp));
            setChatAccessLogs(list);
          },
          (error) => handleFirestoreError(error, OperationType.GET, 'chat_access_logs')
        );
        unsubs.push(unsubAudit);
      }
    } catch (e: any) {
      console.error('Firestore listener setup error:', e);
      setLastSyncError('雲端資料同步訂閱失敗：' + (e?.message || '未知錯誤'));
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [firebaseUser, currentUser?.id, currentUser?.role, currentUser?.classId, currentUser?.status, currentUser?.needsActivation]);

  // Auth Methods
  const signInWithGoogle = async () => {
    setLastSyncError(null);
    await signInWithPopup(auth, googleProvider);
  };

  const signInWithEmail = async (email: string, password: string) => {
    setLastSyncError(null);
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };

  const signUpWithEmail = async (email: string, password: string) => {
    setLastSyncError(null);
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    try {
      await sendEmailVerification(cred.user);
    } catch (verifyErr) {
      console.warn('Initial verification email send warning:', verifyErr);
    }
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) throw new Error('尚未登入');
    await sendEmailVerification(auth.currentUser);
  };

  const sendResetPasswordEmail = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const claimInitialAdmin = async () => {
    if (!firebaseUser) throw new Error('請先登入 Google 帳號');
    if (!firebaseUser.emailVerified) throw new Error('必須使用已驗證電子信箱才可啟用管理員權限');

    const nowStr = getTaiwanDateTimeString();
    const adminProfile: User = {
      id: firebaseUser.uid,
      name: firebaseUser.displayName || '初始系統管理員',
      email: firebaseUser.email || '',
      role: 'admin',
      avatar: '👨‍💼',
      status: 'active',
      passwordSet: true,
      needsActivation: false,
      authLinked: true,
      createdAt: nowStr,
      updatedAt: nowStr,
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'admins', firebaseUser.uid), {
      id: firebaseUser.uid,
      email: firebaseUser.email || '',
    });
    batch.set(doc(db, 'system', 'admin_bootstrap'), {
      claimedBy: firebaseUser.uid,
      claimedEmail: firebaseUser.email || '',
      claimedAt: nowStr,
    });
    batch.set(doc(db, 'users', firebaseUser.uid), stripUndefined(adminProfile));

    await batch.commit();

    // Ensure at least one starter class exists so students & teachers can onboard cleanly
    const existingClasses = await getDocs(collection(db, 'classes')).catch(() => null);
    if (!existingClasses || existingClasses.empty) {
      await setDoc(
        doc(db, 'classes', 'class-302'),
        stripUndefined({
          id: 'class-302',
          name: '三年二班',
          grade: '三年級',
          teacherId: 'pending-teacher',
          teacherName: '待指派導師',
          studentCount: 0,
          createdAt: nowStr,
        })
      ).catch(() => {});
    }

    setCurrentUser(adminProfile);
    await refreshBootstrapStatus(firebaseUser);
  };

  const completeFirstLoginSetup = async ({
    role,
    name,
    classId,
    studentNumber,
  }: {
    role: 'student' | 'teacher';
    name: string;
    classId: string;
    studentNumber?: string;
  }) => {
    if (!firebaseUser) throw new Error('請先登入');

    const fallbackStarterClass: SchoolClass = {
      id: 'class-302',
      name: '三年二班',
      grade: '三年級',
      teacherId: role === 'teacher' ? firebaseUser.uid : 'pending-teacher',
      teacherName: role === 'teacher' ? name.trim() || firebaseUser.displayName || '新進教師' : '待指派導師',
      studentCount: 0,
    };

    const selectedClass =
      classes.find((c) => c.id === classId) ||
      classes[0] ||
      (classId === 'class-302' || !classId ? fallbackStarterClass : undefined);

    if (!selectedClass) throw new Error('請選擇有效的所屬班級');

    const nowStr = getTaiwanDateTimeString();
    const userProfile: User = {
      id: firebaseUser.uid,
      name: name.trim() || firebaseUser.displayName || (role === 'teacher' ? '新進教師' : '新同學'),
      email: firebaseUser.email || '',
      role,
      grade: selectedClass.grade,
      classId: selectedClass.id,
      className: selectedClass.name,
      studentNumber: role === 'student' ? (studentNumber?.trim() || '01') : undefined,
      avatar: role === 'teacher' ? '👩‍🏫' : '🧒',
      status: 'active',
      passwordSet: true,
      needsActivation: false,
      authLinked: true,
      createdAt: nowStr,
      updatedAt: nowStr,
    };

    await setDoc(doc(db, 'users', firebaseUser.uid), stripUndefined(userProfile));
    setCurrentUser(userProfile);
  };

  const signOutUser = async () => {
    try {
      if (firebaseUser) {
        await firebaseSignOut(auth);
      }
    } finally {
      clearPrivateState();
    }
  };

  // Restore latest Firebase session automatically on reload / re-login for students
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'student') return;
    if (!chatSessionsLoaded || !chatMessagesLoaded) return;
    if (activeSessionId) return;

    const studentSessions = chatSessions.filter((s) => s.studentId === currentUser.id);
    const allStudentMsgs = chatMessagesMap[currentUser.id] || [];
    const legacySessionId = `legacy-${currentUser.id}`;
    const hasLegacyMsgs = allStudentMsgs.some((m) => !m.sessionId || m.sessionId === legacySessionId);

    if (studentSessions.length > 0) {
      setActiveSessionId(studentSessions[0].id);
    } else if (hasLegacyMsgs) {
      setActiveSessionId(legacySessionId);
    } else {
      const freshId = doc(collection(db, 'chat_sessions')).id;
      setActiveSessionId(freshId);
    }
  }, [currentUser, chatSessionsLoaded, chatMessagesLoaded, activeSessionId, chatSessions, chatMessagesMap]);

  const startNewChatSession = useCallback(() => {
    const freshId = doc(collection(db, 'chat_sessions')).id;
    setActiveSessionId(freshId);
    setLastChatError(null);
    return freshId;
  }, []);

  const selectChatSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setLastChatError(null);
  }, []);

  const activeChatSession = useMemo(() => {
    if (!currentUser || !activeSessionId) return null;
    return chatSessions.find((s) => s.id === activeSessionId && s.studentId === currentUser.id) || null;
  }, [currentUser, chatSessions, activeSessionId]);

  const chatHistory = useMemo(() => {
    if (!currentUser) return [];
    const allMsgs = chatMessagesMap[currentUser.id] || [];
    const legacySessionId = `legacy-${currentUser.id}`;
    const targetSessionId = activeSessionId || legacySessionId;
    return allMsgs.filter((m) => (m.sessionId || legacySessionId) === targetSessionId);
  }, [currentUser, chatMessagesMap, activeSessionId]);

  // Add/Update Daily Mood Log (Deterministic 1 doc per student per Taiwan day; awaits confirmation)
  const addMoodLog = async (
    mood: MoodType,
    score: number,
    tags: string[],
    note?: string
  ): Promise<MoodLog> => {
    if (!currentUser) throw new Error('請先登入');

    const nowMs = Date.now();
    const timeStr = getTaiwanTimeString();
    const logId = `${currentUser.id}_${todayDate}`;
    const existingToday = moodLogs.find((l) => l.id === logId || (l.studentId === currentUser.id && l.date === todayDate));

    const newLog: MoodLog = {
      id: logId,
      studentId: currentUser.id,
      studentName: currentUser.name,
      classId: currentUser.classId || '',
      mood,
      score,
      tags: tags.slice(0, 6),
      note: note?.trim() ? note.trim().slice(0, 500) : undefined,
      date: todayDate,
      createdAt: existingToday?.createdAt || `${todayDate} ${timeStr}`,
      updatedAt: `${todayDate} ${timeStr}`,
      createdAtMs: existingToday?.createdAtMs || nowMs,
    };

    if (!firebaseUser) throw new Error('尚未登入 Firebase，無法儲存心情簽到');
    if (!currentUser.classId) throw new Error('帳號尚未指派班級，請聯繫導師或管理員設定班級');

    setSyncStatus('syncing');
    setLastSyncError(null);
    try {
      await setDoc(doc(db, 'mood_logs', logId), stripUndefined(newLog));
      setMoodLogs((prev) => [newLog, ...prev.filter((l) => l.id !== logId)]);
      setSyncStatus('synced');
      return newLog;
    } catch (err: any) {
      setSyncStatus('error');
      setLastSyncError('心情簽到儲存失敗，請檢查帳號驗證與網路連線。');
      handleFirestoreError(err, OperationType.WRITE, `mood_logs/${logId}`);
      throw err;
    }
  };

  // Add Care Note (Awaits confirmation before updating UI)
  const addCareNote = async (
    studentId: string,
    alertLevel: 'normal' | 'attention' | 'urgent',
    content: string,
    actionTaken?: string
  ) => {
    if (!currentUser) throw new Error('請先登入');
    if (!firebaseUser) throw new Error('尚未登入 Firebase');
    const student = users.find((u) => u.id === studentId);
    const nowMs = Date.now();
    const timeStr = getTaiwanTimeString();

    const noteRef = doc(collection(db, 'care_notes'));
    const noteId = noteRef.id;

    const newNote: CareNote = {
      id: noteId,
      studentId,
      studentName: student?.name || '未知學生',
      classId: student?.classId || currentUser.classId || 'unassigned',
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      alertLevel,
      content: content.trim().slice(0, 1000),
      actionTaken: actionTaken?.trim() ? actionTaken.trim().slice(0, 500) : undefined,
      createdAt: `${todayDate} ${timeStr}`,
      createdAtMs: nowMs,
    };

    setSyncStatus('syncing');
    setLastSyncError(null);
    try {
      await setDoc(noteRef, stripUndefined(newNote));
      setCareNotes((prev) => [newNote, ...prev.filter((n) => n.id !== noteId)]);
      setSyncStatus('synced');
    } catch (err: any) {
      setSyncStatus('error');
      setLastSyncError('關懷筆記寫入雲端失敗，請確認具備該班級導師權限。');
      handleFirestoreError(err, OperationType.WRITE, `care_notes/${noteId}`);
    }
  };

  // Log teacher access to student AI transcript
  const logChatAccess = async (studentId: string, studentName: string, purpose: string = '例行情緒輔導關懷') => {
    if (!currentUser || !firebaseUser) return;
    const student = users.find((u) => u.id === studentId);
    const nowMs = Date.now();
    const nowStr = getTaiwanDateTimeString();

    const logRef = doc(collection(db, 'chat_access_logs'));
    const logId = logRef.id;

    const newLog: ChatAccessLog = {
      id: logId,
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      studentId,
      studentName,
      classId: student?.classId || currentUser.classId || 'unassigned',
      timestamp: nowStr,
      createdAtMs: nowMs,
      purpose: purpose.slice(0, 300),
    };

    try {
      await setDoc(logRef, stripUndefined(newLog));
    } catch (err) {
      console.warn('Chat access log write failed:', err);
    }
  };

  // Acknowledge or resolve a Crisis Alert
  const acknowledgeCrisisAlert = async (
    alertId: string,
    status: 'acknowledged' | 'resolved',
    resolutionNote?: string
  ) => {
    if (!currentUser) throw new Error('請先登入');
    const nowStr = getTaiwanDateTimeString();
    const updates = stripUndefined({
      status,
      acknowledgedBy: currentUser.id,
      acknowledgedByName: currentUser.name,
      acknowledgedAt: nowStr,
      resolutionNote: resolutionNote?.trim() ? resolutionNote.trim().slice(0, 1000) : undefined,
    });

    setSyncStatus('syncing');
    try {
      await updateDoc(doc(db, 'crisis_alerts', alertId), updates);
      if (status === 'resolved') {
        const targetAlert = crisisAlerts.find((a) => a.id === alertId);
        if (targetAlert?.sessionId) {
          const remainingOpen = crisisAlerts.some(
            (a) =>
              a.id !== alertId &&
              a.sessionId === targetAlert.sessionId &&
              a.status !== 'resolved'
          );
          if (!remainingOpen) {
            const targetSession = chatSessions.find((s) => s.id === targetAlert.sessionId);
            if (targetSession && targetSession.unresolvedHighRisk) {
              await setDoc(
                doc(db, 'chat_sessions', targetSession.id),
                stripUndefined({
                  ...targetSession,
                  unresolvedHighRisk: false,
                  unresolvedEvents: [],
                  updatedAt: nowStr,
                  updatedAtMs: Date.now(),
                }),
                { merge: true }
              ).catch(() => {});
            }
          }
        }
      }
      setSyncStatus('synced');
    } catch (err) {
      setSyncStatus('error');
      handleFirestoreError(err, OperationType.UPDATE, `crisis_alerts/${alertId}`);
    }
  };

  // Send Chat Message to authenticated Gemini API route & persist BOTH student message and AI/system reply reliably
  const sendChatMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !currentUser) return;

    setLastChatError(null);
    const studentId = currentUser.id;
    const nowMs = Date.now();
    const timeStr = getTaiwanTimeString();
    const isoTime = getTaiwanDateTimeString();
    const todayLog = moodLogs.find((l) => l.studentId === studentId && l.date === todayDate);

    if (!firebaseUser) {
      setLastChatError('請先登入 Firebase 帳號後再傳送訊息。');
      return;
    }

    if (!currentUser.classId) {
      setLastChatError('您的帳號尚未設定所屬班級，請先完成班級設定或聯繫管理員。');
      return;
    }

    const legacySessionId = `legacy-${studentId}`;
    const targetSessionId = activeSessionId || doc(collection(db, 'chat_sessions')).id;
    if (!activeSessionId) {
      setActiveSessionId(targetSessionId);
    }

    const existingSession = chatSessions.find((s) => s.id === targetSessionId);
    const sessionMessages = (chatMessagesMap[studentId] || []).filter(
      (m) => (m.sessionId || legacySessionId) === targetSessionId
    );

    // 1. Ensure session document exists and create/persist student message FIRST
    const msgRef = doc(collection(db, 'chat_messages'));
    const msgId = msgRef.id;

    const userMsg: ChatMessage = {
      id: msgId,
      sessionId: targetSessionId,
      studentId,
      studentName: currentUser.name,
      classId: currentUser.classId || '',
      sender: 'student',
      text: trimmed,
      selfReportedMood: todayLog?.mood,
      timestamp: timeStr,
      createdAt: isoTime,
      createdAtMs: nowMs,
    };

    // Capture full chronological session history BEFORE appending userMsg
    const priorHistory = sessionMessages
      .filter((m) => m.aiStatus !== 'error_notice')
      .slice(-40)
      .map((m) => ({
        id: m.id,
        sessionId: m.sessionId || targetSessionId,
        studentId: m.studentId,
        sender: m.sender,
        text: m.text,
        modelDetectedEmotion: m.modelDetectedEmotion,
        situationCategory: m.situationCategory,
        riskLevel: m.riskLevel,
        aiStatus: m.aiStatus,
        createdAt: m.createdAt,
        createdAtMs: m.createdAtMs,
      }));

    const baseSessionDoc: ChatSession = existingSession || {
      id: targetSessionId,
      studentId,
      studentName: currentUser.name,
      classId: currentUser.classId,
      title: trimmed.slice(0, 24) || '與心心的對話',
      highestRiskLevel: 'none',
      unresolvedHighRisk: false,
      unresolvedEvents: [],
      messageCount: sessionMessages.length,
      createdAt: isoTime,
      updatedAt: isoTime,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    };

    setSyncStatus('syncing');
    try {
      await setDoc(
        doc(db, 'chat_sessions', targetSessionId),
        stripUndefined({
          ...baseSessionDoc,
          updatedAt: isoTime,
          updatedAtMs: nowMs,
          messageCount: sessionMessages.length + 1,
        }),
        { merge: true }
      );
      await setDoc(msgRef, stripUndefined(userMsg));
      setChatMessagesMap((prev) => ({
        ...prev,
        [studentId]: upsertMessageSorted(prev[studentId] || [], userMsg),
      }));
      setSyncStatus('synced');
    } catch (err: any) {
      setSyncStatus('error');
      setLastChatError('訊息無法寫入雲端資料庫，請確認信箱已完成驗證且帳號狀態正常。');
      handleFirestoreError(err, OperationType.WRITE, `chat_messages/${msgId}`);
      return;
    }

    setIsAiTyping(true);

    try {
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          sessionId: targetSessionId,
          message: trimmed,
          mood: todayLog?.mood,
          history: priorHistory,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Do NOT mask API failure as a real AI response! Save an explicit error/safety notice record.
        const baseErr =
          data?.error ||
          `AI 伺服器回應異常（HTTP ${response.status}），Gemini AI 服務暫時不可用，請稍後再試。`;
        const errMessage = data?.errorCode ? `${baseErr}（代碼：${data.errorCode}）` : baseErr;
        setLastChatError(errMessage);

        let fallbackNotified = false;
        if (data?.localCrisisMatch && currentUser.classId) {
          try {
            const alertRef = doc(collection(db, 'crisis_alerts'));
            const alertPayload: CrisisAlert = {
              id: alertRef.id,
              sessionId: targetSessionId,
              studentId,
              studentName: currentUser.name,
              classId: currentUser.classId,
              className: currentUser.className || '',
              situationCategory: 'self_harm_emergency',
              severity: 'critical',
              triggerExcerpt: trimmed.slice(0, 500),
              aiSummary: '（AI 暫時離線）系統安全關鍵詞偵測到高風險訊息，請導師立即確認學生人身安全！',
              status: 'open',
              createdAt: getTaiwanDateTimeString(),
              createdAtMs: Date.now(),
            };
            await setDoc(alertRef, stripUndefined(alertPayload));
            fallbackNotified = true;
          } catch {
            fallbackNotified = false;
          }
        }

        const noticeRef = doc(collection(db, 'chat_messages'));
        const noticeMsg: ChatMessage = {
          id: noticeRef.id,
          sessionId: targetSessionId,
          studentId,
          studentName: currentUser.name,
          classId: currentUser.classId,
          sender: 'ai',
          text: data?.localCrisisMatch
            ? `【系統安全提示｜AI 服務暫時無法連線】你剛才提到的內容讓我們很關心你的安全。請先確認你或身邊的人目前是否安全、有沒有受傷，並立刻向現場的班導師、輔導老師或家人求助；緊急狀況請撥打 110、119、113 或 1925。${
                fallbackNotified
                  ? '（系統已將緊急關懷通報寫入教師預警清單）'
                  : '（目前無法自動通知老師，請務必親自向現場大人求助）'
              }`
            : `【系統通知｜AI 服務暫時不可用】${errMessage}（此為系統提示，並非心心 AI 生成的回覆）`,
          aiStatus: data?.localCrisisMatch ? 'safety_fallback' : 'error_notice',
          riskLevel: data?.localCrisisMatch ? 'critical' : 'none',
          teacherNotified: fallbackNotified,
          timestamp: getTaiwanTimeString(),
          createdAt: getTaiwanDateTimeString(),
          createdAtMs: Date.now(),
        };

        await setDoc(noticeRef, stripUndefined(noticeMsg)).catch((e) =>
          console.warn('Could not save fallback notice message:', e)
        );
        return;
      }

      // Gemini succeeded! Check if elevated/critical risk needs client-side alert fallback if server didn't persist
      let teacherNotified = Boolean(data.teacherNotified);
      if (
        (data.riskLevel === 'elevated' || data.riskLevel === 'critical') &&
        !teacherNotified &&
        currentUser.classId
      ) {
        try {
          const alertRef = doc(collection(db, 'crisis_alerts'));
          const alertPayload: CrisisAlert = {
            id: alertRef.id,
            sessionId: targetSessionId,
            studentId,
            studentName: currentUser.name,
            classId: currentUser.classId,
            className: currentUser.className || '',
            situationCategory: data.situationCategory,
            severity: data.riskLevel,
            triggerExcerpt: trimmed.slice(0, 500),
            aiSummary:
              data.crisisSummaryForTeacher ||
              '系統偵測到高風險校園安全或情緒危機訊息，請導師儘速關心確認學生狀態。',
            status: 'open',
            createdAt: getTaiwanDateTimeString(),
            createdAtMs: Date.now(),
          };
          await setDoc(alertRef, stripUndefined(alertPayload));
          teacherNotified = true;
        } catch {
          teacherNotified = false;
        }
      }

      const aiNowMs = Date.now();
      const aiNowStr = getTaiwanDateTimeString();
      const aiRef = doc(collection(db, 'chat_messages'));
      const aiMsg: ChatMessage = {
        id: aiRef.id,
        sessionId: targetSessionId,
        studentId,
        studentName: currentUser.name,
        classId: currentUser.classId,
        sender: 'ai',
        text: data.reply,
        selfReportedMood: todayLog?.mood,
        modelDetectedEmotion: data.modelDetectedEmotion,
        emotionTag: data.modelDetectedEmotion,
        situationCategory: data.situationCategory,
        riskLevel: data.riskLevel || 'none',
        hasContradictionOrFollowUp: Boolean(data.hasContradictionOrFollowUp),
        unresolvedHighRisk: Boolean(data.unresolvedHighRisk),
        aiStatus: 'gemini',
        teacherNotified,
        timestamp: getTaiwanTimeString(),
        createdAt: aiNowStr,
        createdAtMs: aiNowMs,
      };

      await setDoc(aiRef, stripUndefined(aiMsg));
      setChatMessagesMap((prev) => ({
        ...prev,
        [studentId]: upsertMessageSorted(prev[studentId] || [], aiMsg),
      }));

      // Sync rolling session memory & unresolved high-risk status to Firestore
      const updatedSession: ChatSession = {
        ...baseSessionDoc,
        rollingSummary:
          typeof data.sessionMemorySummary === 'string' && data.sessionMemorySummary.trim()
            ? data.sessionMemorySummary.trim().slice(0, 1800)
            : baseSessionDoc.rollingSummary,
        summarizedUpToMs:
          typeof data.summarizedUpToMs === 'number'
            ? data.summarizedUpToMs
            : baseSessionDoc.summarizedUpToMs,
        highestRiskLevel: data.sessionHighestRisk || baseSessionDoc.highestRiskLevel || 'none',
        unresolvedHighRisk: Boolean(data.unresolvedHighRisk),
        unresolvedEvents: Array.isArray(data.unresolvedEvents) ? data.unresolvedEvents.slice(0, 5) : [],
        lastEmotion: data.modelDetectedEmotion,
        lastSituationCategory: data.situationCategory,
        messageCount: sessionMessages.length + 2,
        updatedAt: aiNowStr,
        updatedAtMs: aiNowMs,
      };
      await setDoc(doc(db, 'chat_sessions', targetSessionId), stripUndefined(updatedSession), {
        merge: true,
      }).catch((e) => console.warn('Could not sync chat session memory:', e));
    } catch (err: any) {
      console.error('Chat API Network Error:', err);
      const errMsgText = '無法連線至 AI 伺服器，請檢查網路後重試。';
      setLastChatError(errMsgText);

      const errNoticeRef = doc(collection(db, 'chat_messages'));
      const errNoticeMsg: ChatMessage = {
        id: errNoticeRef.id,
        sessionId: targetSessionId,
        studentId,
        studentName: currentUser.name,
        classId: currentUser.classId,
        sender: 'ai',
        text: `【系統通知｜連線異常】${errMsgText}（此為系統提示，並非心心 AI 生成的回覆）`,
        aiStatus: 'error_notice',
        timestamp: getTaiwanTimeString(),
        createdAt: getTaiwanDateTimeString(),
        createdAtMs: Date.now(),
      };
      await setDoc(errNoticeRef, stripUndefined(errNoticeMsg)).catch(() => {});
    } finally {
      setIsAiTyping(false);
    }
  };

  // Add Class (Awaits Firestore confirmation)
  const addClass = async (cls: Omit<SchoolClass, 'id'>) => {
    if (!firebaseUser || currentUser?.role !== 'admin') throw new Error('請先以管理員身分登入');
    const classRef = doc(collection(db, 'classes'));
    const classId = classRef.id;
    const newClass: SchoolClass = {
      ...cls,
      id: classId,
    };

    setSyncStatus('syncing');
    try {
      await setDoc(classRef, stripUndefined({ ...newClass, createdAt: getTaiwanDateTimeString() }));
      setSyncStatus('synced');
    } catch (err) {
      setSyncStatus('error');
      handleFirestoreError(err, OperationType.WRITE, `classes/${classId}`);
    }
  };

  // Add User via protected backend Auth + Firestore
  const addUser = async (
    userData: Omit<User, 'id'> & { password?: string; firestoreOnlyFallback?: boolean }
  ): Promise<AdminMutationResult> => {
    if (!firebaseUser || currentUser?.role !== 'admin') throw new Error('請先登入管理員帳號');
    setSyncStatus('syncing');

    const idToken = await firebaseUser.getIdToken();
    const { password, firestoreOnlyFallback, ...profileFields } = userData;

    if (!firestoreOnlyFallback) {
      const resp = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ ...profileFields, password }),
      });

      const body = await resp.json().catch(() => ({}));
      if (resp.ok) {
        setSyncStatus('synced');
        return {
          ok: true,
          authSynced: true,
          firestoreSynced: true,
          activationLink: body.activationLink,
        };
      }

      if (body?.errorCode !== 'ADMIN_SDK_UNCONFIGURED') {
        setSyncStatus('error');
        throw new Error(body?.error || '建立使用者失敗');
      }

      // Return explicit unconfigured status so UI can ask admin rather than silently faking Auth sync
      setSyncStatus('idle');
      return {
        ok: false,
        authSynced: false,
        firestoreSynced: false,
        errorCode: 'ADMIN_SDK_UNCONFIGURED',
        warning: body.error,
      };
    }

    // Explicit Firestore-only pre-registration fallback requested by Admin
    const userRef = doc(collection(db, 'users'));
    const nowStr = getTaiwanDateTimeString();
    const isTeacher = profileFields.role === 'teacher';
    const hasPasswordSet = Boolean(password && password.trim().length > 0);
    const newUser: User = {
      ...profileFields,
      id: userRef.id,
      status: profileFields.status || 'active',
      passwordSet: isTeacher ? hasPasswordSet : true,
      needsActivation: isTeacher ? !hasPasswordSet : false,
      authLinked: false,
      createdAt: nowStr,
      updatedAt: nowStr,
    };

    try {
      await setDoc(userRef, stripUndefined(newUser));
      setSyncStatus('synced');
      return {
        ok: true,
        authSynced: false,
        firestoreSynced: true,
        warning: '已寫入 Firestore 預備名冊（authLinked: false）；因後端未配置 Admin SDK 憑證，使用者需透過 Google 登入後由管理員關聯或待憑證設定後同步 Auth。',
      };
    } catch (err) {
      setSyncStatus('error');
      handleFirestoreError(err, OperationType.WRITE, `users/${userRef.id}`);
      throw err;
    }
  };

  // Update User (Syncs Auth via backend if Admin SDK ready, and updates Firestore waiting for confirmation)
  const updateUser = async (
    userId: string,
    updates: Partial<User> & { newPassword?: string; firestoreOnlyFallback?: boolean }
  ): Promise<AdminMutationResult> => {
    if (currentUser?.role !== 'admin') {
      throw new Error('權限不足：僅限管理員可修改現有學生端或教師端帳號資料。');
    }
    const nowStr = getTaiwanDateTimeString();
    const { newPassword, firestoreOnlyFallback, ...profileUpdates } = updates;
    const cleanUpdates = stripUndefined({
      ...profileUpdates,
      updatedAt: nowStr,
    });

    if (!firebaseUser) throw new Error('請先登入管理員帳號');
    setSyncStatus('syncing');

    let authSynced = false;
    let warning: string | undefined;

    if (!firestoreOnlyFallback) {
      const idToken = await firebaseUser.getIdToken();
      const resp = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: cleanUpdates.name,
          email: cleanUpdates.email,
          role: cleanUpdates.role,
          classId: cleanUpdates.classId,
          status: cleanUpdates.status,
          newPassword,
        }),
      });

      const body = await resp.json().catch(() => ({}));
      if (resp.ok) {
        authSynced = true;
      } else if (body?.errorCode === 'ADMIN_SDK_UNCONFIGURED') {
        authSynced = false;
        warning = '已更新 Firestore 資料；因後端未配置 Admin SDK 憑證，Firebase Authentication 狀態未同步。';
      } else {
        setSyncStatus('error');
        throw new Error(body?.error || '更新 Auth 帳號失敗');
      }
    }

    try {
      await updateDoc(doc(db, 'users', userId), cleanUpdates);
      if (cleanUpdates.role === 'admin') {
        const target = users.find((u) => u.id === userId);
        await setDoc(doc(db, 'admins', userId), { id: userId, email: cleanUpdates.email || target?.email || '' });
      }
      setSyncStatus('synced');
      return { ok: true, authSynced, firestoreSynced: true, warning };
    } catch (err) {
      setSyncStatus('error');
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
      throw err;
    }
  };

  const toggleUserStatus = async (userId: string, status: 'active' | 'disabled') => {
    return updateUser(userId, { status });
  };

  const activateTeacherAccount = async (userId: string) => {
    return updateUser(userId, {
      passwordSet: true,
      needsActivation: false,
      status: 'active',
    });
  };

  const updateUserRole = async (userId: string, role: UserRole) => {
    return updateUser(userId, { role });
  };

  const generateTeacherActivationLink = async (userId: string, email: string) => {
    if (!firebaseUser) return { ok: false, error: '尚未登入' };
    const idToken = await firebaseUser.getIdToken();
    const resp = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/activation-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ email }),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return { ok: false, error: body?.error || '無法產生安全啟用連結' };
    }
    return { ok: true, activationLink: body.activationLink };
  };

  const deleteUser = async (userId: string, firestoreOnlyFallback?: boolean): Promise<AdminMutationResult> => {
    if (currentUser?.role !== 'admin') {
      throw new Error('權限不足：僅限管理員可刪除現有學生端或教師端帳號。');
    }
    if (!firebaseUser) throw new Error('請先登入管理員帳號');
    if (userId === firebaseUser.uid) {
      throw new Error('不可刪除目前正在登入的管理員帳號。');
    }
    setSyncStatus('syncing');

    const targetUser = users.find((u) => u.id === userId);
    let authSynced = false;
    let warning: string | undefined;

    if (!firestoreOnlyFallback) {
      const idToken = await firebaseUser.getIdToken();
      const resp = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const body = await resp.json().catch(() => ({}));
      if (resp.ok) {
        authSynced = true;
      } else if (body?.errorCode === 'ADMIN_SDK_UNCONFIGURED') {
        authSynced = false;
        warning = '已刪除 Firestore 使用者資料；因後端未設定 Admin SDK 憑證，若需同步移除 Auth 登入紀錄請設定 FIREBASE_SERVICE_ACCOUNT_JSON。';
      } else {
        setSyncStatus('error');
        throw new Error(body?.error || '刪除帳號失敗');
      }
    }

    try {
      await deleteDoc(doc(db, 'users', userId));
      if (targetUser?.role === 'admin') {
        await deleteDoc(doc(db, 'admins', userId)).catch(() => {});
      }
      setSyncStatus('synced');
      return { ok: true, authSynced, firestoreSynced: true, warning };
    } catch (err) {
      setSyncStatus('error');
      handleFirestoreError(err, OperationType.DELETE, `users/${userId}`);
      throw err;
    }
  };

  const fetchAiUsageSummary = async (): Promise<AiUsageSummary | null> => {
    if (!firebaseUser) return null;
    try {
      const idToken = await firebaseUser.getIdToken();
      const resp = await fetch('/api/admin/usage', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!resp.ok) return null;
      return (await resp.json()) as AiUsageSummary;
    } catch {
      return null;
    }
  };

  // Explicit Admin-only cleanup to delete previously seeded legacy preset users/classes
  const cleanupLegacyPresetUsers = async (): Promise<{ deletedUsers: number; deletedClasses: number }> => {
    if (currentUser?.role !== 'admin') {
      throw new Error('僅限管理員可清理預設測試資料');
    }
    if (!firebaseUser) throw new Error('請先登入管理員帳號');
    setSyncStatus('syncing');
    try {
      const legacyUsers = users.filter((u) => LEGACY_PRESET_USER_IDS.includes(u.id));
      const legacyClasses = classes.filter((c) => LEGACY_PRESET_CLASS_IDS.includes(c.id));
      const legacyLogs = moodLogs.filter((m) => LEGACY_PRESET_MOOD_LOG_IDS.includes(m.id));
      const legacyNotes = careNotes.filter((cn) => LEGACY_PRESET_CARE_NOTE_IDS.includes(cn.id));

      const batch = writeBatch(db);
      for (const u of legacyUsers) {
        batch.delete(doc(db, 'users', u.id));
      }
      for (const c of legacyClasses) {
        batch.delete(doc(db, 'classes', c.id));
      }
      for (const m of legacyLogs) {
        batch.delete(doc(db, 'mood_logs', m.id));
      }
      for (const cn of legacyNotes) {
        batch.delete(doc(db, 'care_notes', cn.id));
      }

      for (const uid of LEGACY_PRESET_USER_IDS) {
        batch.delete(doc(db, 'users', uid));
      }
      for (const cid of LEGACY_PRESET_CLASS_IDS) {
        batch.delete(doc(db, 'classes', cid));
      }

      await batch.commit();
      setSyncStatus('synced');
      return { deletedUsers: legacyUsers.length, deletedClasses: legacyClasses.length };
    } catch (err) {
      setSyncStatus('error');
      handleFirestoreError(err, OperationType.DELETE, 'cleanup_legacy_presets');
      throw err;
    }
  };

  const getStudentChatMessages = (studentId: string) => {
    if (!currentUser) {
      return { allowed: false, messages: [], error: '請先登入系統' };
    }
    const targetStudent = users.find((u) => u.id === studentId);
    if (!targetStudent) {
      return { allowed: false, messages: [], error: '查無該名學生檔案（跨班學生不提供查詢存取）' };
    }

    if (currentUser.role === 'teacher') {
      const teacherClassId = currentUser.classId;
      if (!teacherClassId || targetStudent.classId !== teacherClassId) {
        return {
          allowed: false,
          messages: [],
          error: `【存取被拒絕】您為「${currentUser.className || '所屬班級'}」導師，依校園隱私及安全規範，嚴格禁止跨班查閱「${targetStudent.className || targetStudent.classId}」之學生對話紀錄。`,
        };
      }
    } else if (currentUser.role === 'student') {
      if (currentUser.id !== studentId) {
        return {
          allowed: false,
          messages: [],
          error: '【存取被拒絕】學生僅具備個人對話查閱權限，禁止查閱其他同學之 AI 對話紀錄。',
        };
      }
    }

    const messages = chatMessagesMap[studentId] || [];
    return { allowed: true, messages };
  };

  return (
    <AppContext.Provider
      value={{
        authLoading,
        profileLoading,
        syncStatus,
        lastSyncError,
        clearSyncError: () => setLastSyncError(null),
        currentUser,
        firebaseUser,
        bootstrapStatus,
        accountBlockedReason,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        resendVerificationEmail,
        sendResetPasswordEmail,
        claimInitialAdmin,
        completeFirstLoginSetup,
        signOutUser,
        users,
        classes,
        moodLogs,
        careNotes,
        chatSessions,
        activeSessionId,
        activeChatSession,
        chatHistory,
        crisisAlerts,
        chatAccessLogs,
        todayDate,
        isAiTyping,
        lastChatError,
        clearChatError: () => setLastChatError(null),
        startNewChatSession,
        selectChatSession,
        addMoodLog,
        addCareNote,
        sendChatMessage,
        acknowledgeCrisisAlert,
        logChatAccess,
        getStudentChatMessages,
        addClass,
        addUser,
        updateUser,
        updateUserRole,
        toggleUserStatus,
        activateTeacherAccount,
        generateTeacherActivationLink,
        deleteUser,
        fetchAiUsageSummary,
        cleanupLegacyPresetUsers,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
