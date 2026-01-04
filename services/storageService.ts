import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, 
  query, where 
} from 'firebase/firestore';
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, 
  onAuthStateChanged, User as FirebaseUser 
} from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { User, Idea, AppSettings, UserRole, UserStatus, IdeaStatus, FormTemplate } from '../types';

// --- Firebase Configuration ---
const firebaseConfig = (typeof window !== 'undefined' && (window as any).__firebase_config) ? JSON.parse((window as any).__firebase_config) : {
  apiKey: "AIzaSyAMOU-IK6UfKk75UR0P_Rs80z0uEsssQ9o",
  authDomain: "epromdeploy.firebaseapp.com",
  projectId: "epromdeploy",
  storageBucket: "epromdeploy.firebasestorage.app",
  messagingSenderId: "179394609832",
  appId: "1:179394609832:web:cf8d21ea2eef70990cb89d",
  measurementId: "G-X5GVRLDBQQ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// --- Google Drive Script ---
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbywVx70i2DXMf90cuMkE84Jn3rNlIr6dQJwXdoVx7l9kzzSXU-9uxn1MnrbWnJRRu6b/exec";

// --- Constants ---
const COLLECTIONS = {
  USERS: 'users',
  IDEAS: 'ideas',
  SETTINGS: 'settings',
  TEMPLATES: 'templates'
};

const DEFAULT_SETTINGS_ID = 'global_settings';

// --- Auth Services ---

export const subscribeToAuth = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      // Fetch extended user profile from Firestore
      const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid));
      if (userDoc.exists()) {
        callback(userDoc.data() as User);
      } else {
        // Fallback if doc missing (shouldn't happen in normal flow)
        callback(null);
      }
    } else {
      callback(null);
    }
  });
};

export const loginUser = async (email: string, password: string): Promise<User> => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, userCredential.user.uid));
  
  if (!userDoc.exists()) throw new Error('User profile not found.');
  
  const user = userDoc.data() as User;
  if (user.status === UserStatus.PENDING) throw new Error('Account pending admin approval');
  if (user.status === UserStatus.REJECTED) throw new Error('Account rejected');
  
  return user;
};

export const registerUser = async (userData: Omit<User, 'id' | 'status'>): Promise<User> => {
  // Check if username taken (manual check as Auth uses email)
  const q = query(collection(db, COLLECTIONS.USERS), where("username", "==", userData.username));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) throw new Error('Username taken');

  const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password || 'password');
  
  // Auto-assign Admin role for specific email for bootstrapping
  const role = userData.email === 'admin@eprom.com' ? UserRole.ADMIN : UserRole.EMPLOYEE;
  const status = userData.email === 'admin@eprom.com' ? UserStatus.ACTIVE : UserStatus.PENDING;

  const newUser: User = {
    ...userData,
    id: userCredential.user.uid,
    role,
    status,
    // Don't save password in Firestore
    password: '' 
  };

  await setDoc(doc(db, COLLECTIONS.USERS, newUser.id), newUser);
  return newUser;
};

export const logoutUser = async () => {
  await signOut(auth);
};

export const getUserById = async (id: string): Promise<User | null> => {
    const d = await getDoc(doc(db, COLLECTIONS.USERS, id));
    return d.exists() ? d.data() as User : null;
};

export const getUsers = async (): Promise<User[]> => {
  const snapshot = await getDocs(collection(db, COLLECTIONS.USERS));
  return snapshot.docs.map(d => d.data() as User);
};

export const updateUserStatus = async (userId: string, status: UserStatus, role?: UserRole) => {
  const ref = doc(db, COLLECTIONS.USERS, userId);
  const data: any = { status };
  if (role) data.role = role;
  await updateDoc(ref, data);
};

export const updateUserRole = async (userId: string, role: UserRole) => {
  await updateDoc(doc(db, COLLECTIONS.USERS, userId), { role });
};

export const deleteUser = async (userId: string) => {
  await deleteDoc(doc(db, COLLECTIONS.USERS, userId));
};

// --- Idea Services ---

export const getIdeas = async (): Promise<Idea[]> => {
  const snapshot = await getDocs(collection(db, COLLECTIONS.IDEAS));
  return snapshot.docs.map(d => d.data() as Idea);
};

export const saveIdea = async (idea: Idea) => {
  await setDoc(doc(db, COLLECTIONS.IDEAS, idea.id), idea);
};

export const deleteIdea = async (id: string) => {
  await deleteDoc(doc(db, COLLECTIONS.IDEAS, id));
};

// --- Settings Services ---

export const getSettings = async (): Promise<AppSettings> => {
  const d = await getDoc(doc(db, COLLECTIONS.SETTINGS, DEFAULT_SETTINGS_ID));
  if (d.exists()) return d.data() as AppSettings;
  
  // Default fallback
  const defaults: AppSettings = {
    appName: 'EPROM Innovation Hub',
    logoUrl: '',
    departments: ['Operations', 'Safety', 'Engineering', 'IT', 'HR'],
    categories: ['Cost Reduction', 'Safety Improvement', 'Process Optimization', 'Innovation', 'Sustainability']
  };
  // Save defaults to DB
  await setDoc(doc(db, COLLECTIONS.SETTINGS, DEFAULT_SETTINGS_ID), defaults);
  return defaults;
};

export const updateSettings = async (settings: AppSettings) => {
  await setDoc(doc(db, COLLECTIONS.SETTINGS, DEFAULT_SETTINGS_ID), settings);
};

// --- Template Services ---

export const getTemplates = async (): Promise<FormTemplate[]> => {
  const snapshot = await getDocs(collection(db, COLLECTIONS.TEMPLATES));
  const templates = snapshot.docs.map(d => d.data() as FormTemplate);
  
  if (templates.length === 0) {
      // Seed default template
      const defaultTemplate: FormTemplate = {
        id: 'default-1',
        name: 'Standard Operational Improvement',
        description: 'Standard form for submitting operational efficiency and cost reduction ideas.',
        isActive: true,
        ratingConfig: [
          { id: 'impact', name: 'Impact on Business Goals', description: 'Reduces cost, increases revenue, improves safety.', weight: 30 },
          { id: 'feasibility', name: 'Feasibility', description: 'Ease of implementation (resources, time).', weight: 20 },
          { id: 'roi', name: 'Cost vs. Benefit', description: 'Estimated cost compared to expected benefits.', weight: 20 },
          { id: 'innovation', name: 'Innovation Level', description: 'New approach vs incremental improvement.', weight: 15 },
          { id: 'risk', name: 'Risk Level', description: 'Operational, financial, or safety risks (High Score = Low Risk).', weight: 15 }
        ],
        fields: [
          { id: 'benefits', label: 'Benefits / Value Proposition', type: 'textarea', required: true },
          { id: 'cost', label: 'Estimated Cost', type: 'text', required: false },
          { id: 'feasibility', label: 'Implementation Feasibility', type: 'select', options: ['Easy', 'Moderate', 'Complex'], required: true },
          { id: 'priority', label: 'Priority Level', type: 'select', options: ['Low', 'Medium', 'High'], required: false },
          { id: 'timeline', label: 'Expected Timeline', type: 'select', options: ['Short-term', 'Long-term'], required: false },
          { id: 'collab', label: 'Collaboration Needed?', type: 'checkbox', required: false },
          { id: 'tags', label: 'Tags/Keywords', type: 'text', required: false }
        ]
      };
      await setDoc(doc(db, COLLECTIONS.TEMPLATES, defaultTemplate.id), defaultTemplate);
      return [defaultTemplate];
  }
  return templates;
};

export const saveTemplate = async (template: FormTemplate) => {
  await setDoc(doc(db, COLLECTIONS.TEMPLATES, template.id), template);
};

export const deleteTemplate = async (id: string) => {
  await deleteDoc(doc(db, COLLECTIONS.TEMPLATES, id));
};

// --- File Services ---

// 1. Firebase Storage for Images (Cover Images, Logos)
export const uploadImageToFirebase = async (file: File): Promise<string> => {
    // Basic validation
    if (!file.type.startsWith('image/')) {
        throw new Error('Only image files are allowed for this field.');
    }
    
    try {
      // Create a unique path: images/{timestamp}_{filename}
      const storageRef = ref(storage, `images/${Date.now()}_${file.name}`);
      
      // Upload
      const snapshot = await uploadBytes(storageRef, file);
      
      // Get URL
      const url = await getDownloadURL(snapshot.ref);
      return url;
    } catch (error: any) {
      console.warn("Firebase Storage Upload failed. Checking for CORS/Network issue. Attempting fallback to Drive.", error);
      // Fallback: If Firebase Storage fails (often due to unconfigured CORS on the bucket), 
      // we use the Google Script (Drive) method which handles CORS via text/plain proxy.
      try {
        const driveUrl = await uploadToDrive(file);
        // Drive URLs often need export=view for image tags, uploadToDrive might return download link
        if (driveUrl.includes('export=download')) {
            return driveUrl.replace('export=download', 'export=view');
        }
        return driveUrl;
      } catch (driveError: any) {
         throw new Error(`Upload failed: ${error.message || "Firebase Error"} | Fallback failed: ${driveError.message}`);
      }
    }
};

// 2. Google Drive for Attachments (PDFs, Docs) via App Script
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export const uploadToDrive = async (file: File): Promise<string> => {
  // Check file size (5MB limit for App Script)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("File size exceeds 5MB limit. Please upload a smaller file.");
  }

  try {
    const base64 = await fileToBase64(file);
    const content = base64.split(',')[1];
    
    const fileName = file.name || "uploaded_file";
    const mimeType = file.type || "application/octet-stream";

    const payload = {
      filename: fileName,
      name: fileName,
      mimeType: mimeType,
      type: mimeType,
      data: content,
      base64: content,
      file: content
    };

    console.log("Uploading file to Drive...", { fileName, mimeType });

    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8", 
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Server returned ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    let result;
    try {
        result = JSON.parse(text);
    } catch (e) {
        console.error("Invalid JSON response:", text);
        throw new Error("Invalid response format from server.");
    }

    if (result.error || result.status === 'error') {
        throw new Error(result.error || result.message || "Unknown server error");
    }

    const fileUrl = result.url || result.fileUrl || result.link || result.downloadUrl;

    if (!fileUrl) {
        throw new Error("No URL returned from upload script.");
    }

    return fileUrl;
  } catch (error: any) {
    console.error("Drive Upload failed", error);
    throw new Error(error.message || "Upload failed");
  }
};