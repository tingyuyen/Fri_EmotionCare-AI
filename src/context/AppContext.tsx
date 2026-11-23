import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, SchoolClass, MoodLog, CareNote, ChatMessage, MoodType, UserRole, ChatAccessLog } from '../types';
import {
  INITIAL_CLASSES,
  INITIAL_USERS,
  INITIAL_MOOD_LOGS,
  INITIAL_CARE_NOTES,
  INITIAL_CHAT_MESSAGES,
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
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';

interface AppContextType {
  currentUser: User;
  setCurrentUser: (user: User) => void;
  firebaseUser: FirebaseUser | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  users: User[];
  classes: SchoolClass[];
  moodLogs: MoodLog[];
  careNotes: CareNote[];
  chatHistory: ChatMessage[];
  todayDate: string;
  isCloudSynced: boolean;
  addMoodLog: (mood: MoodType, score: number, tags: string[], note?: string) => Promise<MoodLog>;
  addCareNote: (
    studentId: string,
    alertLevel: 'normal' | 'attention' | 'urgent',
    content: string,
    actionTaken?: string
  ) => Promise<void>;
  sendChatMessage: (text: string) => Promise<void>;
  isAiTyping: boolean;
  chatAccessLogs: ChatAccessLog[];
  logChatAccess: (studentId: string, studentName: string, purpose?: string) => Promise<void>;
  getStudentChatMessages: (studentId: string) => { allowed: boolean; messages: ChatMessage[]; error?: string };
  addClass: (cls: Omit<SchoolClass, 'id'>) => Promise<void>;
  addUser: (user: Omit<User, 'id'>) => Promise<User>;
  updateUser: (userId: string, updates: Partial<User>) => Promise<void>;
  updateUserRole: (userId: string, role: UserRole) => Promise<void>;
  toggleUserStatus: (userId: string, status: 'active' | 'disabled') => Promise<void>;
  activateTeacherAccount: (userId: string) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  resetAllData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const todayDate = new Date().toISOString().split('T')[0];

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(true);

  // Core Data States (Initialized with mock defaults, then synchronized with Firestore)
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [classes, setClasses] = useState<SchoolClass[]>(INITIAL_CLASSES);
  const [moodLogs, setMoodLogs] = useState<MoodLog[]>(INITIAL_MOOD_LOGS);
  const [careNotes, setCareNotes] = useState<CareNote[]>(INITIAL_CARE_NOTES);
  const [chatMessagesMap, setChatMessagesMap] = useState<Record<string, ChatMessage[]>>(INITIAL_CHAT_MESSAGES);

  // Active user (student by default, or logged in Google user)
  const [currentUser, setCurrentUser] = useState<User>(INITIAL_USERS[3] || INITIAL_USERS[0]); // 林小光
  const [isAiTyping, setIsAiTyping] = useState<boolean>(false);

  // 1. Seed or Sync Firestore Initial Collections when authenticated
  useEffect(() => {
    if (!firebaseUser) return;

    async function initFirestoreData() {
      try {
        // Only attempt initial seed check if authenticated
        const classesSnap = await getDocs(collection(db, 'classes')).catch((err) => {
          handleFirestoreError(err, OperationType.GET, 'classes');
          return null;
        });

        if (classesSnap && classesSnap.empty) {
          console.log('Seeding initial classes into Firestore...');
          for (const c of INITIAL_CLASSES) {
            await setDoc(doc(db, 'classes', c.id), c).catch((err) => {
              handleFirestoreError(err, OperationType.WRITE, `classes/${c.id}`);
            });
          }
        }
      } catch (e) {
        console.warn('Initial Firestore setup note:', e);
      }
    }

    initFirestoreData();
  }, [firebaseUser]);

  // 2. Real-time Listeners for Firestore Collections (Only attach when auth is ready and user is authenticated)
  useEffect(() => {
    if (!firebaseUser) return;

    const unsubs: (() => void)[] = [];

    try {
      // Classes listener (allowed for any signed-in user)
      const unsubClasses = onSnapshot(
        collection(db, 'classes'),
        (snapshot) => {
          if (!snapshot.empty) {
            const list: SchoolClass[] = [];
            snapshot.forEach((d) => list.push(d.data() as SchoolClass));
            setClasses(list);
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, 'classes');
        }
      );
      unsubs.push(unsubClasses);

      // Users listener (allowed for signed-in user)
      const unsubUsers = onSnapshot(
        collection(db, 'users'),
        (snapshot) => {
          if (!snapshot.empty) {
            const list: User[] = [];
            snapshot.forEach((d) => list.push(d.data() as User));
            setUsers(list);
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, 'users');
        }
      );
      unsubs.push(unsubUsers);

      // Mood logs listener (filtered for student or full for teacher/admin)
      const moodQuery =
        currentUser.role === 'student'
          ? query(collection(db, 'mood_logs'), where('studentId', '==', firebaseUser.uid))
          : collection(db, 'mood_logs');

      const unsubMood = onSnapshot(
        moodQuery,
        (snapshot) => {
          if (!snapshot.empty) {
            const list: MoodLog[] = [];
            snapshot.forEach((d) => list.push(d.data() as MoodLog));
            list.sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date));
            setMoodLogs((prev) => {
              // Merge with current state
              const map = new Map(prev.map((l) => [l.id, l]));
              list.forEach((l) => map.set(l.id, l));
              return Array.from(map.values()).sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date));
            });
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, 'mood_logs');
        }
      );
      unsubs.push(unsubMood);

      // Care notes listener (only for teachers and admins as per security rules)
      if (currentUser.role === 'teacher' || currentUser.role === 'admin') {
        const unsubCare = onSnapshot(
          collection(db, 'care_notes'),
          (snapshot) => {
            if (!snapshot.empty) {
              const list: CareNote[] = [];
              snapshot.forEach((d) => list.push(d.data() as CareNote));
              list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
              setCareNotes(list);
            }
          },
          (error) => {
            handleFirestoreError(error, OperationType.GET, 'care_notes');
          }
        );
        unsubs.push(unsubCare);
      }

      // Chat messages listener (student's own chat messages or full for teacher)
      const chatQuery =
        currentUser.role === 'student'
          ? query(collection(db, 'chat_messages'), where('studentId', '==', firebaseUser.uid))
          : collection(db, 'chat_messages');

      const unsubChat = onSnapshot(
        chatQuery,
        (snapshot) => {
          if (!snapshot.empty) {
            setChatMessagesMap((prev) => {
              const map: Record<string, ChatMessage[]> = { ...prev };
              snapshot.forEach((d) => {
                const msg = d.data() as ChatMessage;
                if (!map[msg.studentId]) {
                  map[msg.studentId] = [];
                }
                if (!map[msg.studentId].some((m) => m.id === msg.id)) {
                  map[msg.studentId].push(msg);
                }
              });
              return map;
            });
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, 'chat_messages');
        }
      );
      unsubs.push(unsubChat);
    } catch (e) {
      console.warn('Listener setup notice:', e);
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [firebaseUser, currentUser.role]);



  // 3. Listen to Firebase Auth state
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        // Check if user profile exists in Firestore users collection
        try {
          const userDocRef = doc(db, 'users', fbUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            setCurrentUser(userDoc.data() as User);
          } else {
            // Check if this email is an admin
            const isAdminEmail = fbUser.email === 'tingyu19980928@gmail.com' || fbUser.email?.includes('admin');
            const newProfile: User = {
              id: fbUser.uid,
              name: fbUser.displayName || '訪客老師/同學',
              email: fbUser.email || '',
              role: isAdminEmail ? 'admin' : 'student',
              grade: '三年級',
              classId: 'class-302',
              className: '三年二班',
              avatar: isAdminEmail ? '👨‍💼' : '👦',
            };

            await setDoc(userDocRef, newProfile).catch((err) => {
              handleFirestoreError(err, OperationType.WRITE, `users/${fbUser.uid}`);
            });
            setCurrentUser(newProfile);
          }
        } catch (err) {
          console.error('Error fetching/creating user doc in Firestore:', err);
        }
      }
    });

    return () => unsubAuth();
  }, []);

  // Google Sign-in flow
  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log('Google Sign-in successful:', result.user.displayName);
    } catch (err) {
      console.error('Google Sign-in error:', err);
    }
  };

  const signOutUser = async () => {
    try {
      await firebaseSignOut(auth);
      // Fallback to student
      setCurrentUser(users.find((u) => u.id === 'student-302-01') || users[0]);
    } catch (err) {
      console.error('Sign-out error:', err);
    }
  };

  // Active student's chat history
  const chatHistory = chatMessagesMap[currentUser.id] || [];

  // Add Mood Log to Firestore
  const addMoodLog = async (mood: MoodType, score: number, tags: string[], note?: string): Promise<MoodLog> => {
    const now = new Date();
    const timeStr = now.toTimeString().substring(0, 5);
    const logId = `log-${Date.now()}`;

    const newLog: MoodLog = {
      id: logId,
      studentId: currentUser.id,
      studentName: currentUser.name,
      classId: currentUser.classId || 'class-302',
      mood,
      score,
      tags,
      note,
      date: todayDate,
      createdAt: `${todayDate} ${timeStr}`,
    };

    // Update local state immediately for instant responsive feedback
    setMoodLogs((prev) => [newLog, ...prev.filter((l) => !(l.studentId === currentUser.id && l.date === todayDate))]);

    // Persist to Firestore if authenticated
    if (firebaseUser) {
      try {
        await setDoc(doc(db, 'mood_logs', logId), newLog);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `mood_logs/${logId}`);
      }
    }

    return newLog;
  };

  // Add Care Note to Firestore
  const addCareNote = async (
    studentId: string,
    alertLevel: 'normal' | 'attention' | 'urgent',
    content: string,
    actionTaken?: string
  ) => {
    const student = users.find((u) => u.id === studentId);
    const now = new Date();
    const timeStr = now.toTimeString().substring(0, 5);
    const noteId = `care-${Date.now()}`;

    const newNote: CareNote = {
      id: noteId,
      studentId,
      studentName: student?.name || '未知學生',
      classId: student?.classId || currentUser.classId || 'class-302',
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      alertLevel,
      content,
      actionTaken,
      createdAt: `${todayDate} ${timeStr}`,
    };

    // Update local state immediately
    setCareNotes((prev) => [newNote, ...prev]);

    // Persist to Firestore if authenticated
    if (firebaseUser) {
      try {
        await setDoc(doc(db, 'care_notes', noteId), newNote);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `care_notes/${noteId}`);
      }
    }
  };

  const [chatAccessLogs, setChatAccessLogs] = useState<ChatAccessLog[]>([]);

  const logChatAccess = async (studentId: string, studentName: string, purpose: string = '例行情緒輔導關懷') => {
    const logId = `access-${Date.now()}`;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const newLog: ChatAccessLog = {
      id: logId,
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      studentId,
      studentName,
      classId: currentUser.classId || 'class-302',
      timestamp: now,
      purpose,
    };

    setChatAccessLogs((prev) => [newLog, ...prev]);

    if (firebaseUser) {
      try {
        await setDoc(doc(db, 'chat_access_logs', logId), newLog);
      } catch (err) {
        console.warn('Chat access log write notice:', err);
      }
    }
  };

  // Send Chat Message to Gemini API and persist in Firestore
  const sendChatMessage = async (text: string) => {
    if (!text.trim()) return;

    const studentId = currentUser.id;
    const now = new Date();
    const timeStr = now.toTimeString().substring(0, 5);
    const isoTime = now.toISOString().replace('T', ' ').substring(0, 19);
    const msgId = `chat-${Date.now()}`;

    const userMsg: ChatMessage = {
      id: msgId,
      studentId,
      studentName: currentUser.name,
      classId: currentUser.classId || 'class-302',
      sender: 'student',
      text,
      timestamp: timeStr,
      createdAt: isoTime,
    };

    const currentHistory = chatMessagesMap[studentId] || [];
    const updatedHistory = [...currentHistory, userMsg];

    setChatMessagesMap((prev) => ({
      ...prev,
      [studentId]: updatedHistory,
    }));

    // Save student message to Firestore
    if (firebaseUser) {
      try {
        await setDoc(doc(db, 'chat_messages', msgId), userMsg);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `chat_messages/${msgId}`);
      }
    }

    setIsAiTyping(true);

    const todayLog = moodLogs.find((l) => l.studentId === studentId && l.date === todayDate);

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          mood: todayLog?.mood,
          history: updatedHistory,
        }),
      });

      if (!response.ok) {
        throw new Error('伺服器處理對話時發生異常');
      }

      const data = await response.json();
      const aiReplyText = data.reply || '心心一直都在這裡陪伴你喔 🌱';
      const aiMsgId = `chat-${Date.now() + 1}`;

      const aiMsg: ChatMessage = {
        id: aiMsgId,
        studentId,
        studentName: currentUser.name,
        classId: currentUser.classId || 'class-302',
        sender: 'ai',
        text: aiReplyText,
        emotionTag: data.moodDetected || todayLog?.mood,
        timestamp: new Date().toTimeString().substring(0, 5),
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      };

      setChatMessagesMap((prev) => ({
        ...prev,
        [studentId]: [...(prev[studentId] || []), aiMsg],
      }));

      // Save AI reply message to Firestore
      if (firebaseUser) {
        try {
          await setDoc(doc(db, 'chat_messages', aiMsgId), aiMsg);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `chat_messages/${aiMsgId}`);
        }
      }
    } catch (err) {
      console.error('Chat API Error:', err);
      const fallbackAiMsg: ChatMessage = {
        id: `chat-${Date.now() + 1}`,
        studentId,
        studentName: currentUser.name,
        classId: currentUser.classId || 'class-302',
        sender: 'ai',
        text: '心心收到你的悄悄話了！謝謝你願意跟我說，深吸一口氣，心心隨時都在身邊陪著你喔 💖',
        timestamp: new Date().toTimeString().substring(0, 5),
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      };

      setChatMessagesMap((prev) => ({
        ...prev,
        [studentId]: [...(prev[studentId] || []), fallbackAiMsg],
      }));
    } finally {
      setIsAiTyping(false);
    }
  };


  // Add Class to Firestore
  const addClass = async (cls: Omit<SchoolClass, 'id'>) => {
    const classId = `class-${Date.now().toString().slice(-4)}`;
    const newClass: SchoolClass = {
      ...cls,
      id: classId,
    };

    setClasses((prev) => [...prev, newClass]);

    if (firebaseUser) {
      try {
        await setDoc(doc(db, 'classes', classId), newClass);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `classes/${classId}`);
      }
    }
  };

  // Add User to Firestore
  const addUser = async (userData: Omit<User, 'id'>): Promise<User> => {
    const userId = `${userData.role}-${Date.now().toString().slice(-6)}`;
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    // If teacher, evaluate password setup
    const isTeacher = userData.role === 'teacher';
    const hasPasswordSet = userData.passwordSet ?? (!isTeacher);
    const needsActivation = userData.needsActivation ?? (isTeacher && !hasPasswordSet);

    const newUser: User = {
      ...userData,
      id: userId,
      status: userData.status || 'active',
      passwordSet: hasPasswordSet,
      needsActivation: needsActivation,
      createdAt: userData.createdAt || nowStr,
      updatedAt: nowStr,
    };

    setUsers((prev) => [...prev, newUser]);

    if (firebaseUser) {
      try {
        await setDoc(doc(db, 'users', userId), newUser);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${userId}`);
      }
    }

    return newUser;
  };

  // Update User in Firestore
  const updateUser = async (userId: string, updates: Partial<User>) => {
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const cleanUpdates = {
      ...updates,
      updatedAt: nowStr,
    };

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, ...cleanUpdates } : u))
    );

    if (currentUser.id === userId) {
      setCurrentUser((prev) => ({ ...prev, ...cleanUpdates }));
    }

    if (firebaseUser) {
      try {
        await updateDoc(doc(db, 'users', userId), cleanUpdates);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
      }
    }
  };

  // Toggle User Status (啟用 / 停用)
  const toggleUserStatus = async (userId: string, status: 'active' | 'disabled') => {
    await updateUser(userId, { status });
  };

  // Activate Teacher Account (完成安全啟用流程)
  const activateTeacherAccount = async (userId: string) => {
    await updateUser(userId, {
      passwordSet: true,
      needsActivation: false,
      status: 'active',
    });
  };

  // Update User Role in Firestore
  const updateUserRole = async (userId: string, role: UserRole) => {
    await updateUser(userId, { role });
  };

  // Delete User from Firestore
  const deleteUser = async (userId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));

    if (firebaseUser) {
      try {
        await deleteDoc(doc(db, 'users', userId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${userId}`);
      }
    }
  };

  // Reset to initial clean simulated cohort in Firestore
  const resetAllData = async () => {
    setUsers(INITIAL_USERS);
    setClasses(INITIAL_CLASSES);
    setMoodLogs(INITIAL_MOOD_LOGS);
    setCareNotes(INITIAL_CARE_NOTES);
    setChatMessagesMap(INITIAL_CHAT_MESSAGES);
    setCurrentUser(INITIAL_USERS.find((u) => u.id === 'student-302-01') || INITIAL_USERS[0]);

    if (firebaseUser) {
      try {
        for (const c of INITIAL_CLASSES) {
          await setDoc(doc(db, 'classes', c.id), c);
        }
        for (const u of INITIAL_USERS) {
          await setDoc(doc(db, 'users', u.id), u);
        }
        for (const m of INITIAL_MOOD_LOGS) {
          await setDoc(doc(db, 'mood_logs', m.id), m);
        }
        for (const cn of INITIAL_CARE_NOTES) {
          await setDoc(doc(db, 'care_notes', cn.id), cn);
        }
      } catch (err) {
        console.warn('Reset sync warning:', err);
      }
    }
  };

  const getStudentChatMessages = (studentId: string) => {
    const targetStudent = users.find((u) => u.id === studentId);
    if (!targetStudent) {
      return { allowed: false, messages: [], error: '查無該名學生檔案' };
    }

    // Security check: Teachers can ONLY access students in their assigned class
    if (currentUser.role === 'teacher') {
      const teacherClassId = currentUser.classId;
      if (teacherClassId && targetStudent.classId !== teacherClassId) {
        return {
          allowed: false,
          messages: [],
          error: `【存取被拒絕】您為「${currentUser.className || '所屬班級'}」導師，依校園隱私及安全規範，嚴格禁止跨班查閱「${targetStudent.className || targetStudent.classId}」之學生對話紀錄。`,
        };
      }
    } else if (currentUser.role === 'student') {
      // Students can ONLY view their own dialog
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
        currentUser,
        setCurrentUser,
        firebaseUser,
        signInWithGoogle,
        signOutUser,
        users,
        classes,
        moodLogs,
        careNotes,
        chatHistory,
        todayDate,
        isCloudSynced,
        addMoodLog,
        addCareNote,
        sendChatMessage,
        isAiTyping,
        chatAccessLogs,
        logChatAccess,
        getStudentChatMessages,
        addClass,
        addUser,
        updateUser,
        updateUserRole,
        toggleUserStatus,
        activateTeacherAccount,
        deleteUser,
        resetAllData,
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
