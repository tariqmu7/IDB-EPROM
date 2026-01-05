import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
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

// Initialize Firebase (Compat style)
// We check .apps.length to avoid re-initialization errors during hot-reload
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  // Initialize settings once immediately after app creation
  try {
    firebase.firestore().settings({
        experimentalForceLongPolling: true,
        // @ts-ignore - 'merge' is sometimes needed to suppress warnings in specific environments
        merge: true 
    });
  } catch (e) {
    // Ignore if settings already applied
  }
}

const app = firebase.app();
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();


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
  return auth.onAuthStateChanged(async (firebaseUser) => {
    if (firebaseUser) {
      // Fetch extended user profile from Firestore
      const userDoc = await db.collection(COLLECTIONS.USERS).doc(firebaseUser.uid).get();
      if (userDoc.exists) {
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
  const userCredential = await auth.signInWithEmailAndPassword(email, password);
  if (!userCredential.user) throw new Error('Login failed.');

  const userDoc = await db.collection(COLLECTIONS.USERS).doc(userCredential.user.uid).get();
  
  if (!userDoc.exists) throw new Error('User profile not found.');
  
  const user = userDoc.data() as User;
  if (user.status === UserStatus.PENDING) throw new Error('Account pending admin approval');
  if (user.status === UserStatus.REJECTED) throw new Error('Account rejected');
  
  return user;
};

export const registerUser = async (userData: Omit<User, 'id' | 'status'>): Promise<User> => {
  // Check if username taken (manual check as Auth uses email)
  const q = await db.collection(COLLECTIONS.USERS).where("username", "==", userData.username).get();
  if (!q.empty) throw new Error('Username taken');

  const userCredential = await auth.createUserWithEmailAndPassword(userData.email, userData.password || 'password');
  if (!userCredential.user) throw new Error('Registration failed.');
  
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

  await db.collection(COLLECTIONS.USERS).doc(newUser.id).set(newUser);
  return newUser;
};

export const logoutUser = async () => {
  await auth.signOut();
};

export const getUserById = async (id: string): Promise<User | null> => {
    const d = await db.collection(COLLECTIONS.USERS).doc(id).get();
    return d.exists ? d.data() as User : null;
};

export const getUsers = async (): Promise<User[]> => {
  const snapshot = await db.collection(COLLECTIONS.USERS).get();
  return snapshot.docs.map(d => d.data() as User);
};

export const updateUserStatus = async (userId: string, status: UserStatus, role?: UserRole) => {
  const ref = db.collection(COLLECTIONS.USERS).doc(userId);
  const data: any = { status };
  if (role) data.role = role;
  await ref.update(data);
};

export const updateUserRole = async (userId: string, role: UserRole) => {
  await db.collection(COLLECTIONS.USERS).doc(userId).update({ role });
};

export const deleteUser = async (userId: string) => {
  await db.collection(COLLECTIONS.USERS).doc(userId).delete();
};

// --- Idea Services ---

export const getIdeas = async (): Promise<Idea[]> => {
  const snapshot = await db.collection(COLLECTIONS.IDEAS).get();
  return snapshot.docs.map(d => d.data() as Idea);
};

export const saveIdea = async (idea: Idea) => {
  await db.collection(COLLECTIONS.IDEAS).doc(idea.id).set(idea);
};

export const deleteIdea = async (id: string) => {
  await db.collection(COLLECTIONS.IDEAS).doc(id).delete();
};

// --- Settings Services ---

export const getSettings = async (): Promise<AppSettings> => {
  const d = await db.collection(COLLECTIONS.SETTINGS).doc(DEFAULT_SETTINGS_ID).get();
  if (d.exists) return d.data() as AppSettings;
  
  // Default fallback
  const defaults: AppSettings = {
    appName: 'EPROM Innovation Hub',
    logoUrl: '',
    departments: ['Operations', 'Safety', 'Engineering', 'IT', 'HR'],
    categories: ['Cost Reduction', 'Safety Improvement', 'Process Optimization', 'Innovation', 'Sustainability']
  };
  // Save defaults to DB
  await db.collection(COLLECTIONS.SETTINGS).doc(DEFAULT_SETTINGS_ID).set(defaults);
  return defaults;
};

export const updateSettings = async (settings: AppSettings) => {
  await db.collection(COLLECTIONS.SETTINGS).doc(DEFAULT_SETTINGS_ID).set(settings);
};

// --- Template Services ---

export const getTemplates = async (): Promise<FormTemplate[]> => {
  const snapshot = await db.collection(COLLECTIONS.TEMPLATES).get();
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
      await db.collection(COLLECTIONS.TEMPLATES).doc(defaultTemplate.id).set(defaultTemplate);
      return [defaultTemplate];
  }
  return templates;
};

export const saveTemplate = async (template: FormTemplate) => {
  await db.collection(COLLECTIONS.TEMPLATES).doc(template.id).set(template);
};

export const deleteTemplate = async (id: string) => {
  await db.collection(COLLECTIONS.TEMPLATES).doc(id).delete();
};

// --- File Services ---

// Helper to convert file to Base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

// 1. Image Upload Strategy (Direct Base64 Storage)
// This avoids CORS issues on GitHub Pages by storing the image string directly in Firestore.
export const uploadImageToFirebase = async (file: File): Promise<string> => {
    // Basic validation
    if (!file.type.startsWith('image/')) {
        throw new Error('Only image files are allowed for this field.');
    }

    // Limit to 500KB to respect Firestore doc limits (1MB)
    if (file.size > 500 * 1024) {
        throw new Error("Image is too large for the database. Please use an image under 500KB.");
    }

    try {
        console.log("Converting image to Base64...");
        const base64String = await fileToBase64(file);
        return base64String;
    } catch (error: any) {
        console.error("Image encoding failed:", error);
        throw new Error("Failed to process image file.");
    }
};

// 2. Google Drive for Attachments (PDFs, Docs) via App Script
export const uploadToDrive = async (file: File): Promise<string> => {
  // STRICTER LIMIT: 1MB to prevent Google Apps Script "Utilities.newBlob" crash
  const LIMIT_MB = 1;
  if (file.size > LIMIT_MB * 1024 * 1024) {
    throw new Error(`File size exceeds ${LIMIT_MB}MB limit. Please upload a smaller file or compress it.`);
  }

  try {
    const base64 = await fileToBase64(file);
    const content = base64.split(',')[1]; // Remove data URL prefix
    
    const fileName = file.name || "uploaded_file";
    const mimeType = file.type || "application/octet-stream";

    // Optimized Payload: Minimal data to prevent GAS from running out of memory/time
    const payload = {
      filename: fileName,
      mimeType: mimeType,
      base64: content 
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
        let errorMsg = result.error || result.message || "Unknown server error";
        // Map common Apps Script memory error to user friendly message
        if (errorMsg.includes("newBlob") || errorMsg.includes("Utilities")) {
             errorMsg = "Server memory limit exceeded. Please try a file smaller than 1MB.";
        }
        throw new Error(errorMsg);
    }

    const fileUrl = result.url || result.fileUrl || result.link || result.downloadUrl;

    if (!fileUrl) {
        throw new Error("No URL returned from upload script.");
    }

    return fileUrl;
  } catch (error: any) {
    console.error("Drive Upload failed", error);
    throw new Error(error.message || "Upload failed. Please try a smaller file or checking internet connection.");
  }
};