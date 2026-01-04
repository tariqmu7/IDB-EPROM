import { User, Idea, AppSettings, UserRole, UserStatus, IdeaStatus, FormTemplate } from '../types';

// Provided Config
export const firebaseConfig = (typeof window !== 'undefined' && (window as any).__firebase_config) ? JSON.parse((window as any).__firebase_config) : {
  apiKey: "AIzaSyAMOU-IK6UfKk75UR0P_Rs80z0uEsssQ9o",
  authDomain: "epromdeploy.firebaseapp.com",
  projectId: "epromdeploy",
  storageBucket: "epromdeploy.firebasestorage.app",
  messagingSenderId: "179394609832",
  appId: "1:179394609832:web:cf8d21ea2eef70990cb89d",
  measurementId: "G-X5GVRLDBQQ"
};

const STORAGE_KEYS = {
  USERS: 'eprom_users',
  IDEAS: 'eprom_ideas',
  SETTINGS: 'eprom_settings',
  CURRENT_USER: 'eprom_current_user',
  TEMPLATES: 'eprom_templates'
};

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbywVx70i2DXMf90cuMkE84Jn3rNlIr6dQJwXdoVx7l9kzzSXU-9uxn1MnrbWnJRRu6b/exec";

// Initial Data Seeding
const seedData = () => {
  if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
    const defaultSettings: AppSettings = {
      appName: 'EPROM Innovation Hub',
      logoUrl: '',
      departments: ['Operations', 'Safety', 'Engineering', 'IT', 'HR'],
      categories: ['Cost Reduction', 'Safety Improvement', 'Process Optimization', 'Innovation', 'Sustainability']
    };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(defaultSettings));
  }

  // Seed Users
  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    const admin: User = {
      id: 'admin-1',
      username: 'admin',
      email: 'admin@eprom.com',
      department: 'IT',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      password: 'password'
    };
    const manager: User = {
      id: 'manager-1',
      username: 'manager',
      email: 'manager@eprom.com',
      department: 'Operations',
      role: UserRole.MANAGER,
      status: UserStatus.ACTIVE,
      password: 'password'
    };
    const emp1: User = {
      id: 'emp-1',
      username: 'j.doe',
      email: 'j.doe@eprom.com',
      department: 'Engineering',
      role: UserRole.EMPLOYEE,
      status: UserStatus.ACTIVE,
      password: 'password'
    };
    const emp2: User = {
      id: 'emp-2',
      username: 's.connor',
      email: 's.connor@eprom.com',
      department: 'Safety',
      role: UserRole.EMPLOYEE,
      status: UserStatus.ACTIVE,
      password: 'password'
    };
    // Guest User for Shared Links
    const guest: User = {
      id: 'guest-1',
      username: 'guest',
      email: 'guest@eprom.com',
      department: 'External',
      role: UserRole.GUEST,
      status: UserStatus.ACTIVE,
      password: 'guest'
    };
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify([admin, manager, emp1, emp2, guest]));
  }

  // Seed Default Template with new KPIs
  if (!localStorage.getItem(STORAGE_KEYS.TEMPLATES)) {
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
    localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify([defaultTemplate]));
  }

  // Seed Dummy Ideas (If empty)
  if (!localStorage.getItem(STORAGE_KEYS.IDEAS)) {
    const ideas: Idea[] = [
      {
        id: 'idea-1',
        authorId: 'emp-1',
        authorName: 'j.doe',
        department: 'Engineering',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days ago
        updatedAt: new Date().toISOString(),
        title: 'AI-Driven Predictive Maintenance Protocol',
        description: 'Implementation of a machine learning model to analyze vibration data from critical rotary equipment. By detecting anomalies early, we can schedule maintenance during planned downtimes, reducing unexpected failures by an estimated 40%.',
        category: 'Innovation',
        coverImage: 'https://images.unsplash.com/photo-1581092921461-eab6245b0262?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        templateId: 'default-1',
        templateName: 'Standard Operational Improvement',
        dynamicData: {
          benefits: 'Reduces downtime, saves repair costs.',
          cost: '$50,000 Initial',
          feasibility: 'Moderate',
          priority: 'High',
          timeline: 'Long-term',
          collab: true,
          tags: 'AI, Maintenance, Reliability'
        },
        tags: ['AI', 'Maintenance'],
        status: IdeaStatus.PUBLISHED,
        ratings: [
          {
            managerId: 'manager-1',
            managerName: 'manager',
            details: [{dimensionId: 'impact', score: 5}, {dimensionId: 'feasibility', score: 3}, {dimensionId: 'roi', score: 5}, {dimensionId: 'innovation', score: 5}, {dimensionId: 'risk', score: 4}],
            totalScore: 4.4,
            percentage: 88,
            grade: 'A',
            comment: 'Excellent strategic initiative. Fits perfectly with our digitalization roadmap.',
            createdAt: new Date().toISOString()
          }
        ],
        comments: []
      },
      {
        id: 'idea-2',
        authorId: 'emp-2',
        authorName: 's.connor',
        department: 'Safety',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
        updatedAt: new Date().toISOString(),
        title: 'Waste Heat Recovery System for Unit 4',
        description: 'Proposal to install heat exchangers on the exhaust stack of Unit 4. This recovered thermal energy can preheat the feedwater, reducing overall fuel consumption by approximately 12%.',
        category: 'Sustainability',
        coverImage: 'https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        templateId: 'default-1',
        templateName: 'Standard Operational Improvement',
        dynamicData: {
          benefits: 'Fuel savings, reduced emissions.',
          cost: '$120,000',
          feasibility: 'Complex',
          priority: 'Medium',
          timeline: 'Long-term'
        },
        tags: ['Green', 'Energy'],
        status: IdeaStatus.PUBLISHED,
        ratings: [
           {
            managerId: 'manager-1',
            managerName: 'manager',
            details: [{dimensionId: 'impact', score: 4}, {dimensionId: 'feasibility', score: 2}, {dimensionId: 'roi', score: 5}, {dimensionId: 'innovation', score: 3}, {dimensionId: 'risk', score: 3}],
            totalScore: 3.5,
            percentage: 70,
            grade: 'B',
            comment: 'Good ROI potential, but engineering complexity is high. Proceed with feasibility study.',
            createdAt: new Date().toISOString()
          }
        ],
        comments: []
      },
      {
        id: 'idea-3',
        authorId: 'emp-1',
        authorName: 'j.doe',
        department: 'Engineering',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
        updatedAt: new Date().toISOString(),
        title: 'Digital Shift Handoff Log',
        description: 'Replace paper logs with a tablet-based application for shift handovers. This ensures data integrity, searchability, and instant access to historical shift data for troubleshooting.',
        category: 'Process Optimization',
        templateId: 'default-1',
        templateName: 'Standard Operational Improvement',
        dynamicData: {
          benefits: 'Better communication, data logs.',
          cost: '$5,000',
          feasibility: 'Easy',
          priority: 'High',
          timeline: 'Short-term'
        },
        tags: ['Digitalization', 'Operations'],
        status: IdeaStatus.SUBMITTED,
        ratings: [],
        comments: []
      },
      {
        id: 'idea-4',
        authorId: 'emp-2',
        authorName: 's.connor',
        department: 'Safety',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        title: 'Automated Drone Inspection for Flares',
        description: 'Using drones to inspect flare tips while live avoids the need for dangerous manual climbs or expensive scaffolding during shutdowns.',
        category: 'Safety Improvement',
        coverImage: 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        templateId: 'default-1',
        templateName: 'Standard Operational Improvement',
        dynamicData: {
          benefits: 'Safety risk elimination, speed.',
          cost: '$15,000 / inspection',
          feasibility: 'Moderate',
          collab: true,
          tags: 'Drone, Safety'
        },
        tags: [],
        status: IdeaStatus.APPROVED,
        ratings: [],
        comments: []
      }
    ];
    localStorage.setItem(STORAGE_KEYS.IDEAS, JSON.stringify(ideas));
  }
};

seedData();

// --- Service Methods ---

export const getSettings = (): AppSettings => {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
};

export const updateSettings = (settings: AppSettings) => {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
};

export const getUsers = (): User[] => {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
};

export const registerUser = (user: Omit<User, 'id' | 'status'>): User => {
  const users = getUsers();
  if (users.find(u => u.username === user.username)) throw new Error('Username taken');
  
  const newUser: User = {
    ...user,
    id: Date.now().toString(),
    status: UserStatus.PENDING 
  };
  
  users.push(newUser);
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  return newUser;
};

export const updateUserStatus = (userId: string, status: UserStatus, role?: UserRole) => {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx !== -1) {
    users[idx].status = status;
    if (role) {
      users[idx].role = role;
    }
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }
};

export const updateUserRole = (userId: string, role: UserRole) => {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx !== -1) {
    users[idx].role = role;
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }
};

export const deleteUser = (userId: string) => {
  const users = getUsers().filter(u => u.id !== userId);
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
};

export const loginUser = (username: string, password: string): User => {
  const users = getUsers();
  const user = users.find(u => u.username === username && u.password === password);
  
  if (!user) throw new Error('Invalid credentials');
  if (user.status === UserStatus.PENDING) throw new Error('Account pending admin approval');
  if (user.status === UserStatus.REJECTED) throw new Error('Account rejected');
  
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  return user;
};

export const logoutUser = () => {
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
};

export const getCurrentUser = (): User | null => {
  const u = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  return u ? JSON.parse(u) : null;
};

export const getIdeas = (): Idea[] => {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.IDEAS) || '[]');
};

export const saveIdea = (idea: Idea) => {
  const ideas = getIdeas();
  const idx = ideas.findIndex(i => i.id === idea.id);
  if (idx !== -1) {
    ideas[idx] = idea;
  } else {
    ideas.push(idea);
  }
  localStorage.setItem(STORAGE_KEYS.IDEAS, JSON.stringify(ideas));
};

export const deleteIdea = (id: string) => {
  const ideas = getIdeas().filter(i => i.id !== id);
  localStorage.setItem(STORAGE_KEYS.IDEAS, JSON.stringify(ideas));
};

// Templates
export const getTemplates = (): FormTemplate[] => {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.TEMPLATES) || '[]');
};

export const saveTemplate = (template: FormTemplate) => {
  const templates = getTemplates();
  const idx = templates.findIndex(t => t.id === template.id);
  if (idx !== -1) {
    templates[idx] = template;
  } else {
    templates.push(template);
  }
  localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
};

export const deleteTemplate = (id: string) => {
  const templates = getTemplates().filter(t => t.id !== id);
  localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
};

// Helper for file to base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export const uploadToDrive = async (file: File): Promise<string> => {
  try {
    const base64 = await fileToBase64(file);
    const content = base64.split(',')[1];
    
    const payload = {
      filename: file.name,
      mimeType: file.type,
      data: content
    };

    // Note: 'no-cors' mode is often required for simple GAS POSTs from browser due to CORS,
    // but 'no-cors' yields an opaque response (cannot read JSON).
    // If the script explicitly handles CORS (Option request + headers), 'cors' works.
    // Assuming standard web app deployment allowing anonymous execution:
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      // mode: 'no-cors', // Using no-cors prevents reading the response (URL). 
      // If the provided script supports CORS, use 'cors'. 
      // We will try 'cors' first assuming a well-written script.
      headers: {
        "Content-Type": "text/plain;charset=utf-8", // text/plain prevents preflight
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    return result.url;
  } catch (error) {
    console.error("Upload failed", error);
    // Fallback or re-throw
    throw new Error("Failed to upload attachment to Drive.");
  }
};