import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import * as db from './services/storageService';
import * as aiService from './services/aiService';
import { User, UserRole, UserStatus, Idea, IdeaStatus, AppSettings, FormTemplate, FormField, RatingDimension, Rating } from './types';
import { Badge, Button, Input, Select, Textarea, Card } from './components/Shared';
import { Content } from '@google/genai';

// --- Context ---

interface AppContextType {
  user: User | null;
  settings: AppSettings | null;
  login: (u: string, p: string) => Promise<UserRole>;
  logout: () => void;
  refreshSettings: () => void;
  authLoading: boolean;
}

const AppContext = createContext<AppContextType | null>(null);

const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};

// --- Custom Hooks ---

const useRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please ensure permissions are granted.");
    }
  };

  const stopRecording = (): Promise<{base64: string, mimeType: string} | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null);
        return;
      }
      
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64String = result.split(',')[1];
           // Stop all tracks
           mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
           resolve({ base64: base64String, mimeType: 'audio/webm' });
        };
      };
      
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    });
  };

  return { isRecording, startRecording, stopRecording };
};

// --- Helper Components ---

const Navbar = () => {
  const { user, logout, settings } = useAppContext();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
      setSearchTerm(''); 
    }
  };

  const logoUrl = settings?.logoUrl;

  return (
    <nav className="fixed top-0 w-full z-50 glass-panel border-b border-white/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center cursor-pointer group" onClick={() => navigate('/')}>
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt="EPROM" 
                className="h-10 w-auto object-contain mr-4 transition-transform duration-300 group-hover:scale-105" 
              />
            ) : (
              <div className="h-9 w-9 bg-slate-900 rounded-lg flex items-center justify-center font-bold text-white mr-3 shadow-lg shadow-slate-900/20 group-hover:scale-105 transition-transform">E</div>
            )}
            <span className="font-bold text-lg tracking-tight text-slate-900 group-hover:text-eprom-accent transition-colors">
              {!logoUrl && <span>EPROM <span className="text-slate-400 font-light">HUB</span></span>}
            </span>
          </div>
          
          <div className="flex-1 max-w-md px-8 flex items-center">
            <div className="relative w-full group">
              <input 
                  type="text" 
                  placeholder="Search innovation registry..." 
                  className="w-full bg-slate-100/50 border border-slate-200 rounded-full py-2 px-5 text-sm text-slate-800 focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all placeholder-slate-400"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleSearch}
              />
              <div className="absolute right-4 top-2.5 text-slate-400 group-focus-within:text-slate-900 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            {user ? (
              <>
                {user.role !== UserRole.ADMIN && (
                   <>
                     <Link to="/dashboard" className="text-slate-500 hover:text-slate-900 transition-colors text-xs font-bold uppercase tracking-widest">Dashboard</Link>
                     <Link to="/collaboration" className="text-slate-500 hover:text-slate-900 transition-colors text-xs font-bold uppercase tracking-widest">Collab</Link>
                   </>
                )}
                
                {user.role === UserRole.EMPLOYEE && (
                   <Link to="/submit" className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded text-xs font-bold uppercase tracking-wide transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">Submit Idea</Link>
                )}
                
                {user.role === UserRole.ADMIN && (
                   <Link to="/admin" className="text-slate-900 hover:text-red-600 transition-colors text-xs font-bold uppercase tracking-widest flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                      Control Room
                   </Link>
                )}
                <div className="h-6 w-[1px] bg-slate-200 mx-2"></div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block leading-tight">
                        <div className="text-sm font-bold text-slate-900">{user.username}</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">{user.role}</div>
                    </div>
                    <Button variant="ghost" onClick={logout} className="text-xs uppercase font-bold text-slate-400 hover:text-red-500">Logout</Button>
                </div>
              </>
            ) : (
              <Link to="/auth" className="text-slate-900 hover:text-eprom-accent font-bold transition-colors uppercase text-sm tracking-wide">Login</Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

// --- AI Components ---

const AIChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<aiService.ChatMode>('standard');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    const history: Content[] = messages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));

    const response = await aiService.sendMessageToAI(history, userMsg, mode);

    let finalText = response.text || "I'm having trouble thinking right now.";
    
    if (response.groundingMetadata?.groundingChunks) {
      const links = response.groundingMetadata.groundingChunks
        .map((chunk: any) => chunk.web?.uri ? `[${chunk.web.title || 'Source'}](${chunk.web.uri})` : null)
        .filter(Boolean)
        .join(', ');
      if (links) finalText += `\n\nSources: ${links}`;
    }

    setMessages(prev => [...prev, { role: 'model', text: finalText }]);
    setIsLoading(false);
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform z-50 group border border-slate-700"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:animate-pulse text-eprom-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-[380px] h-[600px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-50 overflow-hidden font-sans fade-in">
      <div className="bg-slate-900 p-4 flex justify-between items-center text-white">
        <div className="flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-eprom-accent animate-pulse"></div>
           <span className="font-bold tracking-wide text-sm">AI Assistant</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 text-xs mt-10">
            <p className="mb-2">Hello! I'm Gemini.</p>
            <p>I can help you analyze ideas, refine descriptions, or search the web.</p>
          </div>
        )}
        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg p-3 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-slate-900 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-800 shadow-sm'}`}>
              {m.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
             <div className="bg-white border border-slate-200 p-3 rounded-lg flex gap-1 shadow-sm">
               <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
               <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-100"></span>
               <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-200"></span>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-white border-t border-slate-200">
        <div className="flex gap-2 mb-2 overflow-x-auto pb-1 no-scrollbar">
          <button 
            onClick={() => setMode('standard')} 
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-colors ${mode === 'standard' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
          >
            Chat
          </button>
          <button 
            onClick={() => setMode('thinking')} 
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1 transition-colors ${mode === 'thinking' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
          >
            <span>Reasoning</span>
            <span className="text-[8px] opacity-70">(Pro)</span>
          </button>
          <button 
            onClick={() => setMode('search')} 
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1 transition-colors ${mode === 'search' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
          >
             <span>Web</span>
             <span className="text-[8px] opacity-70">(Flash)</span>
          </button>
        </div>
        <div className="flex gap-2">
          <input 
            type="text" 
            value={input} 
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={mode === 'search' ? "Search Google..." : "Ask Gemini..."}
            className="flex-1 bg-slate-100 border-none rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all placeholder-slate-400"
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="p-2 bg-slate-900 text-white rounded-md disabled:opacity-50 hover:bg-slate-800 transition-colors shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

// --- AppProvider Implementation ---

const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // 1. Subscribe to Auth Changes
    const unsubscribe = db.subscribeToAuth((u) => {
      setUser(u);
      setAuthLoading(false);
    });

    // 2. Initial Settings Fetch
    refreshSettings();

    return () => unsubscribe();
  }, []);

  const login = async (u: string, p: string): Promise<UserRole> => {
    const loggedUser = await db.loginUser(u, p);
    setUser(loggedUser);
    return loggedUser.role;
  };

  const logout = async () => {
    await db.logoutUser();
    setUser(null);
  };

  const refreshSettings = async () => {
    const s = await db.getSettings();
    setSettings(s);
  };

  if (authLoading) {
     return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 uppercase font-bold text-sm tracking-widest animate-pulse">Initializing System...</div>;
  }

  return (
    <AppContext.Provider value={{ user, settings, login, logout, refreshSettings, authLoading }}>
      {children}
      <AIChat />
    </AppContext.Provider>
  );
};

// --- Pages ---

const SharedIdeaPage = () => {
  const { id } = useParams();
  const { user } = useAppContext();
  const navigate = useNavigate();
  const [idea, setIdea] = useState<Idea | null>(null);
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Manager Evaluation State
  const [evalScores, setEvalScores] = useState<Record<string, number>>({});
  const [evalComment, setEvalComment] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const fetch = async () => {
        if (!id) return;
        setIsLoading(true);
        const allIdeas = await db.getIdeas();
        const found = allIdeas.find(i => i.id === id);
        
        if (found) {
            setIdea(found);
            const templates = await db.getTemplates();
            const t = templates.find(tmpl => tmpl.id === found.templateId);
            setTemplate(t || null);
            
            // Init scores if manager
            if (t?.ratingConfig) {
                const initScores: Record<string, number> = {};
                t.ratingConfig.forEach(k => initScores[k.id] = 3); // Default middle
                setEvalScores(initScores);
            }
        }
        setIsLoading(false);
    }
    fetch();
  }, [id]);

  if (isLoading) return <div className="text-center py-20 text-slate-400">Loading Protocol Data...</div>;
  if (!idea) return <div className="text-center py-20 text-slate-400">Idea not found.</div>;

  // PUBLIC ACCESS GUARD
  const isPublic = idea?.status === IdeaStatus.PUBLISHED;
  if (idea && !user && !isPublic) {
    return <Navigate to="/auth" />;
  }

  const handleAIEvaluation = async () => {
    if (!idea || !template?.ratingConfig) return;
    setIsProcessing(true);
    const result = await aiService.generateEvaluation(idea.title, idea.description, template.ratingConfig);
    if (result) {
      setEvalScores(result.scores);
      setEvalComment(result.comment);
    } else {
      alert("AI Evaluation failed. Please try again.");
    }
    setIsProcessing(false);
  };

  const calculateTotalScore = () => {
    if (!template?.ratingConfig) return 0;
    let total = 0;
    let totalWeight = 0;
    template.ratingConfig.forEach(k => {
      const score = evalScores[k.id] || 0;
      total += score * k.weight;
      totalWeight += k.weight;
    });
    // Scale: total is sum of (1-5 * weight). If totalWeight is 100, max is 500.
    // Return weighted average 1-5
    return totalWeight > 0 ? total / totalWeight : 0;
  };

  const updateStatus = async (status: IdeaStatus) => {
      if(!idea) return;
      const updatedIdea = { ...idea, status: status };
      await db.saveIdea(updatedIdea);
      setIdea(updatedIdea);
      alert(`Status updated to: ${status}`);
  }

  const submitEvaluation = async (verdict: 'APPROVE' | 'REJECT' | 'REVISE') => {
    if (!idea || !user || !template) return;

    const weightedScore = calculateTotalScore();
    const percentage = (weightedScore / 5) * 100;
    
    let grade = 'F';
    if (percentage >= 90) grade = 'A';
    else if (percentage >= 80) grade = 'B';
    else if (percentage >= 70) grade = 'C';
    else if (percentage >= 60) grade = 'D';

    const newRating: Rating = {
      managerId: user.id,
      managerName: user.username,
      details: Object.entries(evalScores).map(([k, v]) => ({ dimensionId: k, score: v })),
      totalScore: Number(weightedScore.toFixed(1)),
      percentage: Math.round(percentage),
      grade,
      comment: evalComment,
      createdAt: new Date().toISOString()
    };

    let newStatus = idea.status;
    if(verdict === 'APPROVE') newStatus = IdeaStatus.APPROVED;
    if(verdict === 'REVISE') newStatus = IdeaStatus.NEEDS_REVISION;
    if(verdict === 'REJECT') newStatus = IdeaStatus.REJECTED;

    const updatedRatings = [...(idea.ratings || []), newRating];

    const updatedIdea = { 
        ...idea, 
        status: newStatus,
        ratings: updatedRatings,
        managerFeedback: evalComment 
    };

    await db.saveIdea(updatedIdea);
    setIdea(updatedIdea);
    alert(`Protocol ${verdict}D`);
    navigate('/dashboard');
  };

  const isManager = user?.role === UserRole.MANAGER || user?.role === UserRole.ADMIN;
  const isEvaluating = idea.status === IdeaStatus.SUBMITTED;

  return (
    <div className="max-w-7xl mx-auto px-4 py-24 fade-in">
       {/* Header */}
       <div className="flex justify-between items-start mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
               <Badge color={idea.status === IdeaStatus.PUBLISHED ? 'green' : idea.status === IdeaStatus.APPROVED ? 'blue' : idea.status === IdeaStatus.REJECTED ? 'red' : idea.status === IdeaStatus.NEEDS_REVISION ? 'amber' : 'gray'}>{idea.status}</Badge>
               <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{idea.category}</span>
            </div>
            <h1 className="text-4xl font-bold text-slate-900 leading-tight mb-2">{idea.title}</h1>
            <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
                <span className="flex items-center gap-1">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                   {idea.authorName}
                </span>
                <span>•</span>
                <span>{idea.department}</span>
                <span>•</span>
                <span>{new Date(idea.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          {user ? (
            user.role !== UserRole.ADMIN ? 
              <Button variant="ghost" onClick={() => navigate(-1)} className="uppercase text-xs font-bold">Back to Dashboard</Button> :
              <Button variant="ghost" onClick={() => navigate('/admin')} className="uppercase text-xs font-bold">Return to Control Room</Button>
          ) : (
             <Link to="/auth"><Button variant="primary" className="text-xs uppercase">Login</Button></Link>
          )}
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
             {idea.coverImage && (
                <div className="rounded-xl overflow-hidden shadow-lg border border-slate-200">
                   <img src={idea.coverImage} className="w-full h-80 object-cover" alt="Cover" />
                </div>
             )}
             
             <Card className="p-8 border-none shadow-md">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">Technical Detail</h3>
                <p className="whitespace-pre-wrap text-slate-700 leading-relaxed text-lg">{idea.description}</p>
             </Card>

             <Card className="p-8 border-none shadow-md">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">Operational Data</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                   {Object.entries(idea.dynamicData).map(([key, val]) => (
                      <div key={key}>
                         <span className="block text-xs font-bold uppercase text-slate-500 mb-1">{key}</span>
                         <span className="font-medium text-slate-900">{val.toString()}</span>
                      </div>
                   ))}
                </div>
             </Card>

             {idea.attachments && idea.attachments.length > 0 && (
                <Card className="p-8 border-none shadow-md">
                   <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">Attachments</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {idea.attachments.map((url, i) => (
                         <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all group cursor-pointer decoration-none">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-sm border border-slate-100">
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                                <p className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-600">Attachment {i + 1}</p>
                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">View Document</p>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transform group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                         </a>
                      ))}
                   </div>
                </Card>
             )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
             {/* Same logic for Manager/Viewer as before, just ensuring data is loaded */}
             {isManager && isEvaluating && template?.ratingConfig ? (
                <Card className="p-6 border-l-4 border-l-indigo-600 shadow-xl bg-white sticky top-24">
                   <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight">Evaluation Console</h3>
                      <button onClick={handleAIEvaluation} disabled={isProcessing} className="text-[10px] font-bold uppercase bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded hover:bg-indigo-100 transition-colors flex items-center gap-2">
                         {isProcessing ? <span className="animate-spin">⚙️</span> : <span>✨ AI Auto-Grade</span>}
                      </button>
                   </div>
                   {/* ... (Existing Evaluation Controls) ... */}
                   <div className="space-y-5 mb-8">
                      {template.ratingConfig.map(kpi => (
                         <div key={kpi.id}>
                            <div className="flex justify-between text-xs mb-1.5">
                               <span className="font-bold text-slate-700">{kpi.name}</span>
                               <span className="font-mono text-slate-500">{evalScores[kpi.id] || '-'}/5</span>
                            </div>
                            <input type="range" min="1" max="5" value={evalScores[kpi.id] || 3} onChange={(e) => setEvalScores({...evalScores, [kpi.id]: Number(e.target.value)})} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                            <p className="text-[10px] text-slate-400 mt-1">{kpi.description}</p>
                         </div>
                      ))}
                   </div>
                   <div className="mb-6">
                      <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">Verdict / Feedback</label>
                      <textarea value={evalComment} onChange={(e) => setEvalComment(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 h-32" placeholder="Provide constructive feedback..." />
                   </div>
                   <div className="grid grid-cols-1 gap-3">
                      <Button onClick={() => submitEvaluation('APPROVE')} className="w-full bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white">Approve (Internal)</Button>
                      <div className="grid grid-cols-2 gap-3">
                         <Button onClick={() => submitEvaluation('REVISE')} variant="secondary" className="text-xs">Request Revision</Button>
                         <Button onClick={() => submitEvaluation('REJECT')} variant="danger" className="text-xs">Reject</Button>
                      </div>
                   </div>
                </Card>
             ) : (
                <Card className="p-6 border-none shadow-md bg-slate-50 sticky top-24">
                   <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Protocol Status</h3>
                   <div className="mb-6">
                      <div className={`text-xl font-bold mb-1 ${idea.status === IdeaStatus.PUBLISHED ? 'text-green-600' : idea.status === IdeaStatus.APPROVED ? 'text-blue-600' : idea.status === IdeaStatus.REJECTED ? 'text-red-600' : idea.status === IdeaStatus.NEEDS_REVISION ? 'text-amber-600' : 'text-slate-600'}`}>{idea.status.replace('_', ' ')}</div>
                      <div className="text-xs text-slate-500">Last updated {new Date(idea.updatedAt).toLocaleDateString()}</div>
                   </div>
                   {isManager && (idea.status === IdeaStatus.APPROVED || idea.status === IdeaStatus.PUBLISHED) && (
                       <div className="p-4 bg-white border border-slate-200 rounded mb-6">
                           <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-3">Publishing Controls</h4>
                           {idea.status === IdeaStatus.APPROVED && (<div className="space-y-2"><p className="text-xs text-slate-500 mb-2">Protocol is approved internally. Publish to make it live?</p><Button onClick={() => updateStatus(IdeaStatus.PUBLISHED)} className="w-full bg-slate-900 text-white">Publish Live</Button><Button onClick={() => updateStatus(IdeaStatus.NEEDS_REVISION)} variant="secondary" className="w-full text-xs">Return for Revision</Button></div>)}
                           {idea.status === IdeaStatus.PUBLISHED && (<div className="space-y-2"><p className="text-xs text-slate-500 mb-2">Protocol is live. Unpublish?</p><Button onClick={() => updateStatus(IdeaStatus.APPROVED)} variant="secondary" className="w-full">Unpublish</Button></div>)}
                       </div>
                   )}
                   {idea.ratings && idea.ratings.length > 0 && (
                      <div className="space-y-4 mb-6">
                         <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Evaluation History</h4>
                         {idea.ratings.slice().reverse().map((rating, index) => (
                            <div key={index} className="p-4 bg-white rounded border border-slate-200 shadow-sm">
                               <div className="flex justify-between items-start mb-3"><div><div className="text-xs text-slate-400 font-bold uppercase mb-0.5">{new Date(rating.createdAt).toLocaleDateString()}</div><div className="font-bold text-slate-900 text-sm">{rating.managerName}</div></div><div className="text-right"><span className={`text-xl font-black ${rating.grade >= 'D' ? 'text-red-600' : 'text-slate-900'}`}>{rating.grade}</span><span className="block text-[10px] font-bold text-slate-500">{rating.percentage}%</span></div></div>
                               <p className="text-sm text-slate-600 italic border-l-2 border-indigo-100 pl-3">"{rating.comment}"</p>
                            </div>
                         ))}
                      </div>
                   )}
                   {(user?.id === idea.authorId) && (idea.status === IdeaStatus.NEEDS_REVISION || idea.status === IdeaStatus.REJECTED) && (
                      <Button onClick={() => navigate('/submit', { state: { idea } })} className="w-full mt-4">Edit & Resubmit</Button>
                   )}
                </Card>
             )}
          </div>
       </div>
    </div>
  );
};

const Dashboard = () => {
  const { user } = useAppContext();
  const navigate = useNavigate();
  const [myIdeas, setMyIdeas] = useState<Idea[]>([]);
  const [reviewQueue, setReviewQueue] = useState<Idea[]>([]);
  const [registry, setRegistry] = useState<Idea[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
        if (user) {
            setIsLoading(true);
            const allIdeas = await db.getIdeas();
            
            if (user.role === UserRole.EMPLOYEE) {
                setMyIdeas(allIdeas.filter(i => i.authorId === user.id));
            } else {
                setReviewQueue(allIdeas.filter(i => i.status === IdeaStatus.SUBMITTED));
                setRegistry(allIdeas.filter(i => i.status !== IdeaStatus.SUBMITTED && i.status !== IdeaStatus.DRAFT));
            }
            setIsLoading(false);
        }
    };
    fetchData();
  }, [user]);

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this protocol?")) {
      await db.deleteIdea(id);
      // Refresh
      const allIdeas = await db.getIdeas();
      if (user?.role === UserRole.EMPLOYEE) {
         setMyIdeas(allIdeas.filter(i => i.authorId === user!.id));
      } else {
         setReviewQueue(allIdeas.filter(i => i.status === IdeaStatus.SUBMITTED));
         setRegistry(allIdeas.filter(i => i.status !== IdeaStatus.SUBMITTED && i.status !== IdeaStatus.DRAFT));
      }
    }
  };

  const IdeaGrid = ({ ideas, emptyMsg }: { ideas: Idea[], emptyMsg: string }) => {
    if (ideas.length === 0) return <div className="py-12 text-center bg-white border border-slate-200 rounded-xl text-slate-400 text-sm font-bold uppercase tracking-wide">{emptyMsg}</div>;
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ideas.map(idea => (
          <Card key={idea.id} className="flex flex-col h-full relative group hover:border-blue-400 transition-colors cursor-pointer" onClick={() => navigate(`/view/${idea.id}`)}>
             <div className="p-6 flex-1">
               <div className="flex justify-between items-start mb-4">
                 <Badge color={idea.status === IdeaStatus.PUBLISHED ? 'green' : idea.status === IdeaStatus.APPROVED ? 'blue' : idea.status === IdeaStatus.REJECTED ? 'red' : idea.status === IdeaStatus.SUBMITTED ? 'blue' : 'amber'}>{idea.status}</Badge>
                 <span className="text-[10px] font-bold text-slate-400 uppercase">{new Date(idea.createdAt).toLocaleDateString()}</span>
               </div>
               <h3 className="font-bold text-lg text-slate-900 mb-2 leading-tight">{idea.title}</h3>
               <p className="text-sm text-slate-500 line-clamp-3 mb-4">{idea.description}</p>
               <div className="flex items-center gap-2 text-xs text-slate-400 font-bold uppercase">
                  <span>{idea.authorName}</span>
                  <span>•</span>
                  <span>{idea.department}</span>
               </div>
             </div>
             {(user?.id === idea.authorId || user?.role === UserRole.ADMIN) && (
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end items-center gap-3 rounded-b-lg" onClick={e => e.stopPropagation()}>
                    <button onClick={() => navigate('/submit', { state: { idea } })} className="text-slate-400 hover:text-blue-600 p-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                    <button onClick={() => handleDelete(idea.id)} className="text-slate-400 hover:text-red-600 p-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                </div>
             )}
          </Card>
        ))}
      </div>
    );
  };

  if (isLoading) return <div className="max-w-7xl mx-auto px-4 py-24 text-center text-slate-400">Syncing with HQ...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-24 fade-in">
       <div className="flex justify-between items-end mb-10 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">Mission Control</h1>
            <p className="text-slate-500 font-medium text-sm mt-1">
              Welcome back, <span className="text-slate-900 font-bold">{user?.username}</span>.
            </p>
          </div>
          {user?.role === UserRole.EMPLOYEE && (
            <Link to="/submit">
              <Button className="shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">+ Initialize Protocol</Button>
            </Link>
          )}
       </div>

       {user?.role === UserRole.EMPLOYEE ? (
         <>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">My Protocols</h2>
            <IdeaGrid ideas={myIdeas} emptyMsg="No active protocols found. Initialize one to get started." />
         </>
       ) : (
         <div className="space-y-16">
            <section>
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                    <h2 className="text-sm font-bold text-indigo-900 uppercase tracking-widest">Pending Review Queue</h2>
                    <Badge color="blue">{reviewQueue.length} Pending</Badge>
                </div>
                <IdeaGrid ideas={reviewQueue} emptyMsg="Review queue clear. Good job!" />
            </section>
            <section>
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-200 pb-2">Innovation Registry</h2>
                <IdeaGrid ideas={registry} emptyMsg="Registry is empty." />
            </section>
         </div>
       )}
    </div>
  );
};

const CollaborationHub = () => {
    const [collabIdeas, setCollabIdeas] = useState<Idea[]>([]);
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        const fetch = async () => {
            const all = await db.getIdeas();
            setCollabIdeas(all.filter(i => 
                (i.status === IdeaStatus.PUBLISHED || i.status === IdeaStatus.APPROVED) && 
                (i.dynamicData['collab'] === true || (i as any).collaborationNeeded === true)
            ));
            setIsLoading(false);
        };
        fetch();
    }, []);

    if (isLoading) return <div className="text-center py-24 text-slate-400">Loading Collab Opportunities...</div>;

    return (
        <div className="max-w-7xl mx-auto px-4 py-24">
            <h1 className="text-3xl font-bold mb-2 text-slate-900 uppercase tracking-tight">Collaboration Hub</h1>
            <p className="text-slate-500 mb-10 font-medium">Join forces on these active initiatives.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {collabIdeas.map(idea => (
                    <Card key={idea.id} className="p-6">
                        <Badge color="blue" className="mb-3">{idea.category}</Badge>
                        <h3 className="font-bold text-lg mb-2 text-slate-900">{idea.title}</h3>
                        <p className="text-sm text-slate-500 mb-6 line-clamp-3">{idea.description}</p>
                        <div className="flex justify-between items-center mt-auto pt-4 border-t border-slate-100">
                            <span className="text-xs font-bold text-slate-400">{idea.authorName}</span>
                            <Button variant="secondary" className="text-xs py-1.5 px-4 font-bold border-slate-300" onClick={() => navigate('/submit', { state: { parentIdea: idea } })}>Collaborate</Button>
                        </div>
                    </Card>
                ))}
            </div>
            {collabIdeas.length === 0 && <div className="text-center py-20 text-slate-400 bg-white border border-slate-200 rounded-lg">No active collaboration requests.</div>}
        </div>
    );
};

const SearchPage = () => {
    const [searchParams] = useSearchParams();
    const query = searchParams.get('q') || '';
    const [results, setResults] = useState<Idea[]>([]);
    const { user } = useAppContext();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetch = async () => {
            if (!query) { setResults([]); return; }
            setIsLoading(true);
            const term = query.toLowerCase();
            const allIdeas = await db.getIdeas();
            const filtered = allIdeas.filter(idea => {
                const isMine = user?.id === idea.authorId;
                const isPublic = idea.status === IdeaStatus.PUBLISHED;
                const isCollab = idea.status === IdeaStatus.APPROVED && (idea.dynamicData['collab'] || (idea as any).collaborationNeeded);
                const canSee = isMine || isPublic || isCollab || user?.role === UserRole.ADMIN || user?.role === UserRole.MANAGER || user?.role === UserRole.GUEST;
                if (!canSee) return false;
                return (
                    idea.title.toLowerCase().includes(term) ||
                    idea.description.toLowerCase().includes(term) ||
                    idea.category.toLowerCase().includes(term) ||
                    idea.authorName.toLowerCase().includes(term) ||
                    idea.tags?.some(t => t.toLowerCase().includes(term))
                );
            });
            setResults(filtered);
            setIsLoading(false);
        };
        fetch();
    }, [query, user]);

    return (
        <div className="max-w-7xl mx-auto px-4 py-24 min-h-screen fade-in">
             <div className="mb-8 border-b border-slate-200 pb-4">
                <h1 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">Search Results</h1>
                <p className="text-slate-500 text-sm mt-1 font-medium">Found {results.length} records for "{query}"</p>
             </div>
             {isLoading ? <div className="text-slate-400">Searching...</div> : results.length === 0 ? (
                 <div className="text-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm"><p className="text-slate-400 uppercase tracking-widest text-sm">No matches found in the registry.</p></div>
             ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {results.map(idea => (
                         <Card key={idea.id} className={`flex flex-col justify-between hover:border-slate-300 transition-colors cursor-pointer group relative overflow-hidden rounded-xl ${idea.coverImage ? 'bg-slate-900 border-none' : 'p-6'}`} onClick={() => navigate('/dashboard')}>
                             {idea.coverImage && (<><div className="absolute inset-0 z-0 bg-slate-950"><img src={idea.coverImage} alt="Cover" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-50" /></div><div className="absolute inset-0 z-0 bg-gradient-to-t from-black via-black/80 to-transparent" /></>)}
                             <div className={`relative z-10 ${idea.coverImage ? 'p-6' : ''}`}>
                                 <div className="flex items-center gap-3 mb-3"><Badge color="blue">{idea.category}</Badge><Badge color="gray">{idea.status}</Badge></div>
                                 <h3 className={`text-xl font-bold ${idea.coverImage ? 'text-white drop-shadow-lg' : 'text-slate-800'}`}>{idea.title}</h3>
                                 <p className={`text-sm line-clamp-2 mt-2 font-medium ${idea.coverImage ? 'text-slate-300 drop-shadow-md' : 'text-slate-500'}`}>{idea.description}</p>
                             </div>
                             <div className={`mt-4 relative z-10 flex justify-between items-end ${idea.coverImage ? 'px-6 pb-6' : ''}`}><div className={`text-xs uppercase font-bold tracking-wide ${idea.coverImage ? 'text-slate-400' : 'text-slate-400'}`}>{idea.authorName}</div><div className={`text-[10px] font-bold ${idea.coverImage ? 'text-slate-500' : 'text-slate-400'}`}>{new Date(idea.createdAt).toLocaleDateString()}</div></div>
                         </Card>
                    ))}
                </div>
             )}
        </div>
    );
};

const LandingPage = () => {
  const [publishedIdeas, setPublishedIdeas] = useState<Idea[]>([]);
  const { user } = useAppContext();
  const navigate = useNavigate();

  useEffect(() => {
    const fetch = async () => {
        const all = await db.getIdeas();
        const topRated = all
        .filter(i => i.status === IdeaStatus.PUBLISHED)
        .map(i => {
            const avgScore = i.ratings.length > 0 
            ? i.ratings.reduce((acc, curr) => acc + curr.percentage, 0) / i.ratings.length
            : 0;
            return { ...i, avgScore };
        })
        .sort((a, b) => b.avgScore - a.avgScore)
        .slice(0, 10);
        setPublishedIdeas(topRated);
    };
    fetch();
  }, []);

  return (
    <div className="min-h-screen bg-eprom-bg text-slate-800 pt-16">
      <div className="relative py-32 px-4 overflow-hidden border-b border-slate-200 bg-white">
        <div className="absolute inset-0 bg-luxury-gradient z-0"></div>
        <div className="relative z-10 max-w-7xl mx-auto text-center">
          <Badge color="gray" className="mb-8 inline-block bg-white/80 border-slate-200 shadow-sm text-slate-600 backdrop-blur-sm">Enterprise Innovation System</Badge>
          <h1 className="text-5xl md:text-8xl font-black mb-8 tracking-tighter text-slate-900 leading-[0.9]">
            EPROM <span className="text-slate-400 font-light">Idea bank.</span>
          </h1>
          <p className="text-2xl text-slate-900 max-w-2xl mx-auto mb-4 leading-relaxed font-bold tracking-tight">Innovating Energy. Empowering Ideas.</p>
          <p className="text-lg text-slate-500 max-w-3xl mx-auto mb-12 leading-relaxed font-medium">EPROM Idea Bank is the innovation hub for the oil and gas sector.</p>
          {!user && (
            <Link to="/auth"><Button variant="primary" className="text-lg px-10 py-4 rounded-full bg-slate-900 hover:bg-slate-800 border-none shadow-2xl hover:shadow-xl hover:scale-105 transition-all text-white">Initialize Session</Button></Link>
          )}
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-20 relative z-10">
        <div className="flex items-center mb-12 border-l-4 border-slate-900 pl-6"><h2 className="text-3xl font-bold text-slate-900 tracking-tight uppercase">Top 10 Innovations</h2></div>
        {publishedIdeas.length === 0 ? (
          <div className="text-center py-20 bg-white border border-slate-200 rounded-xl shadow-sm"><div className="text-slate-400 text-lg">System Idle. Awaiting Innovation Inputs.</div></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {publishedIdeas.map((idea, index) => (
              <Card key={idea.id} className="group relative h-[420px] overflow-hidden rounded-2xl border-none shadow-xl bg-slate-900 hover:shadow-2xl transition-all duration-500 cursor-pointer" onClick={() => navigate(`/view/${idea.id}`)}>
                 {idea.coverImage && (<div className="absolute inset-0 z-0 bg-slate-950"><img src={idea.coverImage} alt="Cover" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-60" /></div>)}
                 <div className="absolute inset-0 z-0 bg-gradient-to-t from-black via-black/90 to-transparent" />
                 <div className="absolute top-5 left-5 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center font-bold shadow-lg border border-white/20 z-20 text-lg">{index + 1}</div>
                <div className="absolute inset-0 z-10 p-8 flex flex-col justify-end transform transition-transform duration-300">
                  <div className="flex justify-between items-start mb-3 transform translate-y-2 group-hover:translate-y-0 transition-transform"><Badge color="blue" className="bg-blue-500/20 text-blue-100 border-blue-500/30 backdrop-blur-md">{idea.category}</Badge><span className="text-[10px] uppercase tracking-widest text-slate-300 font-bold">{new Date(idea.createdAt).toLocaleDateString()}</span></div>
                  <h3 className="text-3xl font-bold text-white mb-3 leading-none drop-shadow-xl tracking-tight">{idea.title}</h3>
                  <p className="text-slate-200 text-sm line-clamp-2 mb-6 font-medium drop-shadow-md opacity-90">{idea.description}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const AuthPage = () => {
  const { login, user } = useAppContext();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: '', password: '', email: '', department: 'Engineering' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
        if (user.role === UserRole.ADMIN) {
            navigate('/admin');
        } else {
            navigate('/dashboard');
        }
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (isLogin) {
        const role = await login(formData.email, formData.password); // Changed to email
        if (role === UserRole.ADMIN) navigate('/admin');
        else navigate('/dashboard');
      } else {
        await db.registerUser({
            username: formData.username,
            password: formData.password,
            email: formData.email,
            department: formData.department,
            role: UserRole.EMPLOYEE
        });
        alert("Registration successful. Please login.");
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md p-8">
        <h2 className="text-2xl font-bold mb-6 text-center">{isLogin ? 'Login' : 'Register'}</h2>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit}>
          {!isLogin && <Input label="Username" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} required />}
          <Input label="Email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
          <Input label="Password" type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
          {!isLogin && (
            <Select label="Department" options={['Operations', 'Safety', 'Engineering', 'IT', 'HR']} value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} required />
          )}
          <Button type="submit" disabled={isLoading} className="w-full mt-4">{isLoading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}</Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500 cursor-pointer hover:text-eprom-blue" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? "Need an account? Register" : "Already have an account? Login"}
        </p>
      </Card>
    </div>
  );
};

const IdeaFormPage = () => {
    const { user, settings } = useAppContext();
    const navigate = useNavigate();
    const location = useLocation();
    const editingIdea = location.state?.idea as Idea | undefined;
    const parentIdea = location.state?.parentIdea as Idea | undefined;

    const [title, setTitle] = useState(editingIdea?.title || (parentIdea ? `Contribution: ${parentIdea.title}` : ''));
    const [description, setDescription] = useState(editingIdea?.description || '');
    const [category, setCategory] = useState(editingIdea?.category || 'Innovation');
    const [templateId, setTemplateId] = useState(editingIdea?.templateId || '');
    const [dynamicData, setDynamicData] = useState<Record<string, any>>(editingIdea?.dynamicData || {});
    const [coverImage, setCoverImage] = useState(editingIdea?.coverImage || '');
    
    const [attachments, setAttachments] = useState<string[]>(editingIdea?.attachments || []);
    const [isUploading, setIsUploading] = useState(false);
    const [isUploadingCover, setIsUploadingCover] = useState(false);

    const [templates, setTemplates] = useState<FormTemplate[]>([]);
    const { isRecording, startRecording, stopRecording } = useRecorder();
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [categories, setCategories] = useState<string[]>([]);

    useEffect(() => {
        const fetch = async () => {
            const t = await db.getTemplates();
            setTemplates(t);
            if (!editingIdea && t.length > 0) setTemplateId(t[0].id);
            if (settings) setCategories(settings.categories);
        };
        fetch();
    }, [editingIdea, settings]);

    const handleEnhance = async () => {
        if(!description) return;
        setIsEnhancing(true);
        const enhanced = await aiService.enhanceIdeaText(description);
        setDescription(enhanced);
        setIsEnhancing(false);
    }

    const handleAudioInput = async () => {
        if(isRecording) {
            const audioFile = await stopRecording();
            if(audioFile) {
                setDescription(prev => prev + "\n[Processing Audio...]");
                const text = await aiService.transcribeAudio(audioFile.base64, audioFile.mimeType);
                setDescription(prev => prev.replace("\n[Processing Audio...]", "") + " " + text);
            }
        } else {
            startRecording();
        }
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if(e.target.files?.[0]) {
            setIsUploadingCover(true);
            try {
                const url = await db.uploadImageToFirebase(e.target.files[0]);
                setCoverImage(url);
            } catch (err: any) {
                alert("Image Upload Failed: " + err.message);
            } finally {
                setIsUploadingCover(false);
            }
        }
    }

    const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if(e.target.files?.[0]) {
            const file = e.target.files[0];
            setIsUploading(true);
            try {
                const url = await db.uploadToDrive(file);
                setAttachments(prev => [...prev, url]);
                alert("File uploaded to Drive successfully!");
            } catch (err: any) {
                console.error(err);
                alert(`Upload failed: ${err.message || "Unknown error"}. Check console for details.`);
            } finally {
                setIsUploading(false);
                e.target.value = ''; 
            }
        }
    }

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!user) return;
        setIsUploading(true);

        const template = templates.find(t => t.id === templateId);
        let status = editingIdea?.status || IdeaStatus.SUBMITTED;
        
        if (user.role === UserRole.EMPLOYEE && (status === IdeaStatus.NEEDS_REVISION || status === IdeaStatus.REJECTED || status === IdeaStatus.DRAFT)) {
            status = IdeaStatus.SUBMITTED;
        }

        const newIdea: Idea = {
            id: editingIdea?.id || Date.now().toString(),
            authorId: user.id,
            authorName: user.username,
            department: user.department,
            createdAt: editingIdea?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            title,
            description,
            category,
            coverImage,
            templateId,
            templateName: template?.name || 'Unknown',
            parentIdeaId: parentIdea?.id || editingIdea?.parentIdeaId,
            dynamicData,
            tags: [],
            status: status,
            ratings: editingIdea?.ratings || [],
            comments: editingIdea?.comments || [],
            attachments: attachments,
            managerFeedback: editingIdea?.managerFeedback 
        };

        await db.saveIdea(newIdea);
        setIsUploading(false);
        navigate('/dashboard');
    }

    const currentTemplate = templates.find(t => t.id === templateId);

    return (
        <div className="max-w-4xl mx-auto px-4 py-24 fade-in">
            <div className="mb-8 border-b border-slate-200 pb-4 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">{editingIdea ? 'Refine Protocol' : (parentIdea ? 'Collaborate on Protocol' : 'Initialize Protocol')}</h1>
                </div>
                <Button variant="ghost" onClick={() => navigate(-1)} className="text-xs uppercase">Cancel</Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                <Card className="p-8 border-none shadow-lg">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">01 // Core Intelligence</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <Input label="Protocol Title" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Flare Gas Recovery" />
                        <Select label="Category" options={categories} value={category} onChange={e => setCategory(e.target.value)} required />
                    </div>
                    
                    <div className="mb-6 relative">
                        <div className="flex justify-between items-end mb-1.5">
                             <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Technical Description</label>
                             <div className="flex gap-2">
                                <button type="button" onClick={handleEnhance} disabled={isEnhancing} className="text-[10px] font-bold uppercase text-indigo-500 hover:text-indigo-700 disabled:opacity-50 flex items-center gap-1">
                                    {isEnhancing ? <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></span> : "✨"} AI Enhance
                                </button>
                                <button type="button" onClick={handleAudioInput} className={`text-[10px] font-bold uppercase flex items-center gap-1 ${isRecording ? 'text-red-600 animate-pulse' : 'text-slate-400 hover:text-slate-900'}`}>
                                    <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-600' : 'bg-slate-400'}`}></span> {isRecording ? 'Stop Rec' : 'Dictate'}
                                </button>
                             </div>
                        </div>
                        <textarea className="w-full px-4 py-3 bg-slate-50/50 border border-slate-300 rounded text-slate-900 placeholder-slate-400 focus:outline-none focus:border-eprom-blue focus:ring-1 focus:ring-eprom-blue transition-all min-h-[160px] text-sm leading-relaxed" value={description} onChange={e => setDescription(e.target.value)} required placeholder="Describe the operational challenge and proposed solution..." />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Visual Reference (Cover)</label>
                        <div className="flex items-start gap-6">
                            <label className="flex-shrink-0 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-3 rounded text-xs font-bold uppercase transition-colors border border-slate-200 hover:border-slate-300 flex flex-col items-center justify-center w-32 h-32">
                                <span>{isUploadingCover ? '...' : 'Select Img'}</span>
                                <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploadingCover} className="hidden" />
                            </label>
                            {coverImage ? (
                                <div className="h-32 w-full flex-1 overflow-hidden rounded border border-slate-200 bg-slate-50 relative group">
                                    <img src={coverImage} className="w-full h-full object-cover" alt="Cover" />
                                    <button type="button" onClick={() => setCoverImage('')} className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs uppercase font-bold">Remove</button>
                                </div>
                            ) : <div className="h-32 w-full flex-1 rounded border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400 text-xs">No Image Selected</div>}
                        </div>
                    </div>
                </Card>

                {currentTemplate && (
                    <Card className="p-8 border-none shadow-lg">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">02 // Specific Data</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {currentTemplate.fields.map((field) => (
                                <div key={field.id} className={field.type === 'textarea' ? 'col-span-1 md:col-span-2' : ''}>
                                    {field.type === 'textarea' ? (
                                        <Textarea label={field.label} required={field.required} value={dynamicData[field.id] || ''} onChange={e => setDynamicData({...dynamicData, [field.id]: e.target.value})} />
                                    ) : field.type === 'select' && field.options ? (
                                        <Select label={field.label} options={field.options} required={field.required} value={dynamicData[field.id] || ''} onChange={e => setDynamicData({...dynamicData, [field.id]: e.target.value})} />
                                    ) : field.type === 'checkbox' ? (
                                        <div className="flex items-center h-full pt-6">
                                            <label className="flex items-center cursor-pointer">
                                                <input type="checkbox" checked={!!dynamicData[field.id]} onChange={(e) => setDynamicData({...dynamicData, [field.id]: e.target.checked})} className="form-checkbox h-5 w-5 text-eprom-blue rounded border-slate-300" />
                                                <span className="ml-2 text-sm text-slate-700 font-medium">{field.label}</span>
                                            </label>
                                        </div>
                                    ) : (
                                        <Input label={field.label} type={field.type} required={field.required} value={dynamicData[field.id] || ''} onChange={e => setDynamicData({...dynamicData, [field.id]: e.target.value})} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                <Card className="p-8 border-none shadow-lg">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">03 // Supporting Documents (Drive)</h3>
                    <div className="mb-4">
                        <label className="flex items-center justify-center w-full h-24 px-4 transition bg-white border-2 border-slate-300 border-dashed rounded-md appearance-none cursor-pointer hover:border-slate-400 focus:outline-none bg-slate-50 hover:bg-slate-100">
                            <span className="flex items-center space-x-2 text-slate-500">
                                {isUploading ? <span className="flex items-center gap-2 text-sm font-bold animate-pulse">Uploading to Drive...</span> : <span className="text-xs font-bold uppercase">Upload to Google Drive</span>}
                            </span>
                            <input type="file" name="file_upload" className="hidden" disabled={isUploading} onChange={handleAttachmentUpload} />
                        </label>
                    </div>
                    {attachments.length > 0 && (
                        <div className="grid grid-cols-1 gap-2">
                            {attachments.map((url, index) => (
                                <div key={index} className="flex justify-between items-center p-3 bg-blue-50 border border-blue-100 rounded text-sm text-blue-800">
                                    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline truncate max-w-[80%]">Attachment {index + 1}</a>
                                    <button type="button" onClick={() => removeAttachment(index)} className="text-red-500 hover:text-red-700 text-xs font-bold uppercase">Remove</button>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                <div className="flex justify-end gap-4 pt-4">
                    <Button type="submit" disabled={isUploading || isUploadingCover} className="px-12 py-4 shadow-xl bg-slate-900 hover:bg-slate-800 text-white font-bold tracking-widest text-sm">
                        {isUploading ? 'Processing...' : (editingIdea && (editingIdea.status === IdeaStatus.NEEDS_REVISION || editingIdea.status === IdeaStatus.REJECTED) ? 'Resubmit Protocol' : 'Launch Protocol')}
                    </Button>
                </div>
            </form>
        </div>
    );
};

const AdminPanel = () => {
    const { settings, refreshSettings } = useAppContext();
    const [users, setUsers] = useState<User[]>([]);
    const [templates, setTemplates] = useState<FormTemplate[]>([]);
    const [activeTab, setActiveTab] = useState<'users' | 'settings' | 'forms'>('users');
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);

    // State for forms ... (same as before)
    const [newCat, setNewCat] = useState('');
    const [newDept, setNewDept] = useState('');
    const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateDesc, setNewTemplateDesc] = useState('');
    const [newFields, setNewFields] = useState<FormField[]>([]);
    const [editingField, setEditingField] = useState<Partial<FormField>>({});
    const DEFAULT_KPIS: RatingDimension[] = [
        { id: 'impact', name: 'Impact on Business Goals', description: 'Reduces cost, increases revenue, improves safety.', weight: 30 },
        { id: 'feasibility', name: 'Feasibility', description: 'Ease of implementation (resources, time).', weight: 20 },
        { id: 'roi', name: 'Cost vs. Benefit', description: 'Estimated cost compared to expected benefits.', weight: 20 },
        { id: 'innovation', name: 'Innovation Level', description: 'New approach vs incremental improvement.', weight: 15 },
        { id: 'risk', name: 'Risk Level', description: 'Operational, financial, or safety risks (High Score = Low Risk).', weight: 15 }
    ];
    const [currentKPIs, setCurrentKPIs] = useState<RatingDimension[]>(DEFAULT_KPIS);
    const [newKPI, setNewKPI] = useState<Partial<RatingDimension>>({});

    useEffect(() => { refreshData(); }, []);
    
    const refreshData = async () => { 
        setUsers(await db.getUsers()); 
        setTemplates(await db.getTemplates()); 
    };
    
    const handleUserApproval = async (uid: string, role: UserRole) => { await db.updateUserStatus(uid, UserStatus.ACTIVE, role); refreshData(); };
    const handleUserReject = async (uid: string) => { await db.updateUserStatus(uid, UserStatus.REJECTED); refreshData(); };
    const handleDeleteUser = async (uid: string) => { if(confirm("Are you sure? This cannot be undone.")) { await db.deleteUser(uid); refreshData(); } };
    const handleRoleChange = async (uid: string, newRole: UserRole) => { await db.updateUserRole(uid, newRole); refreshData(); };
    
    const handleAddCategory = async () => { if (newCat && settings) { await db.updateSettings({ ...settings, categories: [...settings.categories, newCat] }); refreshSettings(); setNewCat(''); } };
    const handleAddDept = async () => { if (newDept && settings) { await db.updateSettings({ ...settings, departments: [...settings.departments, newDept] }); refreshSettings(); setNewDept(''); } };
    
    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { 
        if (e.target.files && e.target.files[0] && settings) { 
            setIsUploadingLogo(true);
            try { 
                const file = e.target.files[0];
                const url = await db.uploadImageToFirebase(file);
                await db.updateSettings({ ...settings, logoUrl: url }); 
                refreshSettings(); 
                alert("Logo updated successfully via Firebase!");
            } catch (err: any) { 
                alert("Logo upload failed: " + err.message); 
            } finally {
                setIsUploadingLogo(false);
            }
        } 
    };

    // ... (Template management same as before, just async calls)
    const addFieldToTemplate = () => { if(!editingField.label || !editingField.type) return; const newField: FormField = { id: editingField.label.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now(), label: editingField.label, type: editingField.type as any, required: editingField.required || false, options: editingField.options ? (editingField.options as any).split(',') : undefined }; setNewFields([...newFields, newField]); setEditingField({}); };
    const addKPI = () => { if (!newKPI.name || !newKPI.weight) return; const k: RatingDimension = { id: (newKPI.name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now()).substring(0, 15), name: newKPI.name, description: newKPI.description || '', weight: Number(newKPI.weight) }; setCurrentKPIs([...currentKPIs, k]); setNewKPI({}); };
    const removeKPI = (id: string) => { setCurrentKPIs(currentKPIs.filter(k => k.id !== id)); };
    const resetKPIs = () => setCurrentKPIs(DEFAULT_KPIS);
    const totalWeight = currentKPIs.reduce((sum, k) => sum + k.weight, 0);
    const handleEditTemplate = (t: FormTemplate) => { setEditingTemplateId(t.id); setNewTemplateName(t.name); setNewTemplateDesc(t.description); setNewFields(t.fields); setCurrentKPIs(t.ratingConfig || []); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const handleCancelEdit = () => { setEditingTemplateId(null); setNewTemplateName(''); setNewTemplateDesc(''); setNewFields([]); setCurrentKPIs(DEFAULT_KPIS); };
    const saveTemplate = async () => { if(!newTemplateName || newFields.length === 0) return; const t: FormTemplate = { id: editingTemplateId || Date.now().toString(), name: newTemplateName, description: newTemplateDesc, fields: newFields, ratingConfig: currentKPIs, isActive: true }; await db.saveTemplate(t); handleCancelEdit(); refreshData(); };
    const deleteTemplate = async (id: string) => { if (confirm("Are you sure?")) { await db.deleteTemplate(id); refreshData(); } }

    const PendingUserRow = ({ u }: { u: User }) => {
      const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.EMPLOYEE);
      return (
        <tr className="hover:bg-amber-50 transition-colors bg-amber-50 border-l-4 border-amber-400">
            <td className="px-6 py-4 font-bold text-slate-800">{u.username}</td>
            <td className="px-6 py-4 text-slate-600">{u.email}</td>
            <td className="px-6 py-4 text-slate-600">{u.department}</td>
            <td className="px-6 py-4"><select value={selectedRole} onChange={e => setSelectedRole(e.target.value as UserRole)} className="bg-white border border-slate-300 text-slate-800 text-xs rounded p-1"><option value={UserRole.EMPLOYEE}>Employee</option><option value={UserRole.MANAGER}>Manager</option><option value={UserRole.ADMIN}>Admin</option><option value={UserRole.GUEST}>Guest</option></select></td>
            <td className="px-6 py-4">
                <div className="flex space-x-2">
                    <Button variant="ghost" onClick={() => handleUserApproval(u.id, selectedRole)} className="text-green-600 hover:text-green-700 text-xs px-2 py-1 uppercase font-bold">Approve</Button>
                    <Button variant="ghost" onClick={() => handleUserReject(u.id)} className="text-red-600 hover:text-red-700 text-xs px-2 py-1 uppercase font-bold">Reject</Button>
                    <Button variant="ghost" onClick={() => handleDeleteUser(u.id)} className="text-red-600 hover:text-red-700 text-xs px-2 py-1 uppercase font-bold">Delete</Button>
                </div>
            </td>
        </tr>
      );
    }

    if (!settings) return null;

    return (
        <div className="max-w-7xl mx-auto px-4 py-24 fade-in">
            <div className="flex items-center justify-between mb-8"><h1 className="text-3xl font-bold text-slate-900 tracking-tight">Control Room</h1><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div><span className="text-xs font-bold text-red-500 uppercase tracking-widest">Admin Privileges Active</span></div></div>
            <div className="flex space-x-8 mb-10 border-b border-slate-200">
                <button onClick={() => setActiveTab('users')} className={`pb-4 px-1 font-bold text-sm uppercase tracking-wider transition-all relative ${activeTab === 'users' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>Personnel {activeTab === 'users' && <span className="absolute bottom-0 left-0 w-full h-[3px] bg-slate-900"></span>}</button>
                <button onClick={() => setActiveTab('forms')} className={`pb-4 px-1 font-bold text-sm uppercase tracking-wider transition-all relative ${activeTab === 'forms' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>Protocol Builder {activeTab === 'forms' && <span className="absolute bottom-0 left-0 w-full h-[3px] bg-slate-900"></span>}</button>
                <button onClick={() => setActiveTab('settings')} className={`pb-4 px-1 font-bold text-sm uppercase tracking-wider transition-all relative ${activeTab === 'settings' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>System Config {activeTab === 'settings' && <span className="absolute bottom-0 left-0 w-full h-[3px] bg-slate-900"></span>}</button>
            </div>
            
            {activeTab === 'users' && (
                <Card className="overflow-hidden border-none shadow-lg">
                    <div className="overflow-x-auto"><table className="w-full text-left text-sm text-slate-600"><thead className="bg-slate-50 border-b border-slate-200 uppercase text-xs font-bold text-slate-500 tracking-wider"><tr><th className="px-6 py-4">Username</th><th className="px-6 py-4">Email</th><th className="px-6 py-4">Department</th><th className="px-6 py-4">Role</th><th className="px-6 py-4">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{users.filter(u => u.status === UserStatus.PENDING).map(u => (<PendingUserRow key={u.id} u={u} />))}{users.filter(u => u.status === UserStatus.ACTIVE).map(u => (<tr key={u.id} className="hover:bg-slate-50 transition-colors"><td className="px-6 py-4 font-bold text-slate-800">{u.username}</td><td className="px-6 py-4">{u.email}</td><td className="px-6 py-4">{u.department}</td><td className="px-6 py-4"><select value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)} className="bg-transparent border border-slate-200 rounded p-1 text-slate-700 focus:bg-white focus:border-slate-900 text-xs uppercase font-bold"><option value={UserRole.EMPLOYEE}>Employee</option><option value={UserRole.MANAGER}>Manager</option><option value={UserRole.ADMIN}>Admin</option><option value={UserRole.GUEST}>Guest</option></select></td><td className="px-6 py-4"><div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-500"></div><span className="text-xs font-bold text-green-600 uppercase">Active</span></div></td></tr>))}</tbody></table></div>
                </Card>
            )}

            {activeTab === 'forms' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                     <div className="lg:col-span-1 space-y-6">
                         <Card className="p-6">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4">Template Manager</h3>
                            <div className="space-y-3">
                                {templates.map(t => (
                                    <div key={t.id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-200 rounded hover:border-slate-300">
                                        <div><div className="text-xs font-bold text-slate-800">{t.name}</div><div className="text-[10px] text-slate-500">{t.fields.length} fields • {t.ratingConfig?.length || 0} KPIs</div></div>
                                        <div className="flex gap-2"><button onClick={() => handleEditTemplate(t)} className="text-blue-600 text-xs font-bold uppercase">Edit</button><button onClick={() => deleteTemplate(t.id)} className="text-red-600 text-xs font-bold uppercase">Del</button></div>
                                    </div>
                                ))}
                                <Button onClick={() => { setEditingTemplateId(null); setNewTemplateName(''); setNewTemplateDesc(''); setNewFields([]); setCurrentKPIs(DEFAULT_KPIS); }} className="w-full mt-4 text-xs">New Template</Button>
                            </div>
                         </Card>
                     </div>
                     <div className="lg:col-span-2 space-y-8">
                         <Card className="p-8">
                            <div className="flex justify-between items-start mb-6"><h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">{editingTemplateId ? 'Edit Protocol Template' : 'Create Protocol Template'}</h3>{editingTemplateId && <Button variant="ghost" onClick={handleCancelEdit} className="text-xs text-red-500">Cancel Edit</Button>}</div>
                            <div className="space-y-4 mb-8"><Input label="Template Name" value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} placeholder="e.g. Safety Incident Report" /><Textarea label="Description" value={newTemplateDesc} onChange={e => setNewTemplateDesc(e.target.value)} placeholder="Purpose of this form..." /></div>
                            <div className="mb-8 border-t border-slate-100 pt-6">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Form Fields Schema</h4>
                                <div className="space-y-3 mb-4">
                                    {newFields.map((f, i) => (
                                        <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded"><span className="text-[10px] font-mono text-slate-400 bg-white border border-slate-200 px-1 rounded">{f.type}</span><span className="text-sm font-bold text-slate-700 flex-1">{f.label}</span>{f.required && <span className="text-[10px] text-red-500 font-bold uppercase">Req</span>}<button onClick={() => setNewFields(newFields.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500">×</button></div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-12 gap-3 items-end bg-slate-50 p-4 rounded border border-slate-200">
                                    <div className="col-span-4"><Input label="Label" value={editingField.label || ''} onChange={e => setEditingField({...editingField, label: e.target.value})} className="mb-0" /></div>
                                    <div className="col-span-3"><Select label="Type" options={['text', 'textarea', 'number', 'select', 'checkbox', 'date']} value={editingField.type || ''} onChange={e => setEditingField({...editingField, type: e.target.value as any})} className="mb-0" /></div>
                                    <div className="col-span-2 flex items-center h-[42px]"><label className="flex items-center"><input type="checkbox" checked={editingField.required || false} onChange={e => setEditingField({...editingField, required: e.target.checked})} className="mr-2"/> <span className="text-xs font-bold uppercase text-slate-500">Req</span></label></div>
                                    <div className="col-span-3"><Button onClick={addFieldToTemplate} className="w-full text-xs">Add Field</Button></div>
                                    {editingField.type === 'select' && (<div className="col-span-12 mt-3"><Input label="Options (comma separated)" value={(editingField.options as any) || ''} onChange={e => setEditingField({...editingField, options: e.target.value as any})} className="mb-0" /></div>)}
                                </div>
                            </div>
                            <div className="mb-8 border-t border-slate-100 pt-6">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Evaluation KPIs</h4>
                                <div className="space-y-3 mb-4">
                                    {currentKPIs.map((k) => (
                                        <div key={k.id} className="flex justify-between items-center p-3 bg-indigo-50 border border-indigo-100 rounded text-indigo-900"><div><div className="text-xs font-bold">{k.name} <span className="opacity-50">({k.weight}%)</span></div><div className="text-[10px] opacity-75">{k.description}</div></div><button onClick={() => removeKPI(k.id)} className="text-indigo-400 hover:text-indigo-700">×</button></div>
                                    ))}
                                    <div className="flex justify-between items-center text-xs font-bold text-slate-500 pt-2"><span>Total Weight: {totalWeight}%</span>{totalWeight !== 100 && <span className="text-red-500">Warning: Should equal 100%</span>}</div>
                                </div>
                                <div className="grid grid-cols-12 gap-3 items-end bg-slate-50 p-4 rounded border border-slate-200">
                                     <div className="col-span-4"><Input label="KPI Name" value={newKPI.name || ''} onChange={e => setNewKPI({...newKPI, name: e.target.value})} className="mb-0" /></div>
                                     <div className="col-span-2"><Input label="Weight %" type="number" value={newKPI.weight || ''} onChange={e => setNewKPI({...newKPI, weight: Number(e.target.value)})} className="mb-0" /></div>
                                     <div className="col-span-4"><Input label="Description" value={newKPI.description || ''} onChange={e => setNewKPI({...newKPI, description: e.target.value})} className="mb-0" /></div>
                                     <div className="col-span-2"><Button onClick={addKPI} className="w-full text-xs">Add</Button></div>
                                </div>
                                <div className="mt-2 text-right"><button onClick={resetKPIs} className="text-[10px] font-bold uppercase text-slate-400 hover:text-slate-600 underline">Reset to Default KPIs</button></div>
                            </div>
                            <Button onClick={saveTemplate} className="w-full py-4 text-sm tracking-widest">Save Protocol Template</Button>
                         </Card>
                     </div>
                </div>
            )}

            {activeTab === 'settings' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Card className="p-8">
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-6">Departments</h3>
                        <div className="flex flex-wrap gap-2 mb-6">{settings.departments.map(d => (<span key={d} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">{d}</span>))}</div>
                        <div className="flex gap-2"><Input value={newDept} onChange={e => setNewDept(e.target.value)} placeholder="New Department" className="flex-1 mb-0" /><Button onClick={handleAddDept}>Add</Button></div>
                    </Card>
                    <Card className="p-8">
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-6">Categories</h3>
                        <div className="flex flex-wrap gap-2 mb-6">{settings.categories.map(c => (<span key={c} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">{c}</span>))}</div>
                        <div className="flex gap-2"><Input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="New Category" className="flex-1 mb-0" /><Button onClick={handleAddCategory}>Add</Button></div>
                    </Card>
                    <Card className="p-8 md:col-span-2">
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-6">Branding</h3>
                        <div className="flex items-center gap-6">
                            {settings.logoUrl ? <img src={settings.logoUrl} className="h-16 w-auto" alt="Logo" /> : <div className="h-16 w-16 bg-slate-200 rounded flex items-center justify-center text-slate-400 font-bold">LOGO</div>}
                            <div>
                                <label className={`block text-xs font-bold uppercase mb-2 ${isUploadingLogo ? 'text-blue-500 animate-pulse' : 'text-slate-500'}`}>{isUploadingLogo ? 'Uploading to Firebase...' : 'Upload Company Logo'}</label>
                                <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={isUploadingLogo} className="text-sm text-slate-500 disabled:opacity-50" />
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

const App = () => {
  return (
    <HashRouter>
      <AppProvider>
        <div className="min-h-screen bg-eprom-bg text-slate-800 font-sans selection:bg-eprom-blue selection:text-white pb-20">
          <Navbar />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/submit" element={<IdeaFormPage />} />
            <Route path="/view/:id" element={<SharedIdeaPage />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/collaboration" element={<CollaborationHub />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </AppProvider>
    </HashRouter>
  );
};

export default App;