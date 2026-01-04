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
  settings: AppSettings;
  login: (u: string, p: string) => Promise<void>;
  logout: () => void;
  refreshSettings: () => void;
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

  return (
    <nav className="fixed top-0 w-full z-50 glass-panel border-b border-white/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center cursor-pointer group" onClick={() => navigate('/')}>
            {settings.logoUrl ? (
              <img 
                src={settings.logoUrl} 
                alt="EPROM" 
                className="h-10 w-auto object-contain mr-4 transition-transform duration-300 group-hover:scale-105" 
              />
            ) : (
              <div className="h-9 w-9 bg-slate-900 rounded-lg flex items-center justify-center font-bold text-white mr-3 shadow-lg shadow-slate-900/20 group-hover:scale-105 transition-transform">E</div>
            )}
            <span className="font-bold text-lg tracking-tight text-slate-900 group-hover:text-eprom-accent transition-colors">
              {!settings.logoUrl && <span>EPROM <span className="text-slate-400 font-light">HUB</span></span>}
            </span>
          </div>
          
          <div className="flex-1 max-w-md px-8 flex items-center">
            {user && (
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
            )}
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
                   <Link to="/admin" className="text-slate-500 hover:text-red-600 transition-colors text-xs font-bold uppercase tracking-widest flex items-center gap-1">
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
  const [user, setUser] = useState<User | null>(db.getCurrentUser());
  const [settings, setSettings] = useState<AppSettings>(db.getSettings());

  const login = async (u: string, p: string) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const loggedUser = db.loginUser(u, p);
    setUser(loggedUser);
  };

  const logout = () => {
    db.logoutUser();
    setUser(null);
  };

  const refreshSettings = () => {
    setSettings(db.getSettings());
  };

  return (
    <AppContext.Provider value={{ user, settings, login, logout, refreshSettings }}>
      {children}
      <AIChat />
    </AppContext.Provider>
  );
};

// --- Pages ---

const SearchPage = () => {
    const [searchParams] = useSearchParams();
    const query = searchParams.get('q') || '';
    const [results, setResults] = useState<Idea[]>([]);
    const { user } = useAppContext();
    const navigate = useNavigate();

    useEffect(() => {
        if (!query) {
            setResults([]);
            return;
        }
        const term = query.toLowerCase();
        const allIdeas = db.getIdeas();
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
    }, [query, user]);

    return (
        <div className="max-w-7xl mx-auto px-4 py-24 min-h-screen fade-in">
             <div className="mb-8 border-b border-slate-200 pb-4">
                <h1 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">Search Results</h1>
                <p className="text-slate-500 text-sm mt-1 font-medium">Found {results.length} records for "{query}"</p>
             </div>

             {results.length === 0 ? (
                 <div className="text-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm">
                     <p className="text-slate-400 uppercase tracking-widest text-sm">No matches found in the registry.</p>
                 </div>
             ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {results.map(idea => (
                         <Card key={idea.id} className={`flex flex-col justify-between hover:border-slate-300 transition-colors cursor-pointer group relative overflow-hidden rounded-xl ${idea.coverImage ? 'bg-slate-900 border-none' : 'p-6'}`} onClick={() => navigate('/dashboard')}>
                             {idea.coverImage && (
                                <>
                                  <div className="absolute inset-0 z-0 bg-slate-950">
                                    <img src={idea.coverImage} alt="Cover" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-50" />
                                  </div>
                                  <div className="absolute inset-0 z-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
                                </>
                             )}
                             
                             <div className={`relative z-10 ${idea.coverImage ? 'p-6' : ''}`}>
                                 <div className="flex items-center gap-3 mb-3">
                                     <Badge color="blue">{idea.category}</Badge>
                                     <Badge color="gray">{idea.status}</Badge>
                                 </div>
                                 <h3 className={`text-xl font-bold ${idea.coverImage ? 'text-white drop-shadow-lg' : 'text-slate-800'}`}>{idea.title}</h3>
                                 <p className={`text-sm line-clamp-2 mt-2 font-medium ${idea.coverImage ? 'text-slate-300 drop-shadow-md' : 'text-slate-500'}`}>{idea.description}</p>
                             </div>
                             <div className={`mt-4 relative z-10 flex justify-between items-end ${idea.coverImage ? 'px-6 pb-6' : ''}`}>
                                 <div className={`text-xs uppercase font-bold tracking-wide ${idea.coverImage ? 'text-slate-400' : 'text-slate-400'}`}>{idea.authorName}</div>
                                 <div className={`text-[10px] font-bold ${idea.coverImage ? 'text-slate-500' : 'text-slate-400'}`}>{new Date(idea.createdAt).toLocaleDateString()}</div>
                             </div>
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
  const [activeAnalysis, setActiveAnalysis] = useState<string | null>(null);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<aiService.ManagerAnalysisResult | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const all = db.getIdeas();
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
  }, []);

  const handleManagerAnalysis = async (idea: Idea) => {
    if (analyzingId === idea.id) return;
    setAnalyzingId(idea.id);
    setAiAnalysisResult(null);
    setActiveAnalysis(idea.id);
    
    const result = await aiService.generateManagerAnalysis(idea.title, idea.description);
    setAiAnalysisResult(result);
    setAnalyzingId(null);
  };

  const closeAnalysis = () => {
    setActiveAnalysis(null);
    setAiAnalysisResult(null);
  }

  const copyShareLink = (id: string) => {
      const baseUrl = window.location.href.split('#')[0];
      const url = `${baseUrl}#/view/${id}`;
      navigator.clipboard.writeText(url);
      alert("Shareable link copied to clipboard!");
  };

  return (
    <div className="min-h-screen bg-eprom-bg text-slate-800 pt-16">
      <div className="relative py-32 px-4 overflow-hidden border-b border-slate-200 bg-white">
        <div className="absolute inset-0 bg-luxury-gradient z-0"></div>
        
        <div className="relative z-10 max-w-7xl mx-auto text-center">
          <Badge color="gray" className="mb-8 inline-block bg-white/80 border-slate-200 shadow-sm text-slate-600 backdrop-blur-sm">Enterprise Innovation System</Badge>
          <h1 className="text-5xl md:text-8xl font-black mb-8 tracking-tighter text-slate-900 leading-[0.9]">
            EPROM <span className="text-slate-400 font-light">Idea bank.</span>
          </h1>
          <p className="text-2xl text-slate-900 max-w-2xl mx-auto mb-4 leading-relaxed font-bold tracking-tight">
            Innovating Energy. Empowering Ideas.
          </p>
          <p className="text-lg text-slate-500 max-w-3xl mx-auto mb-12 leading-relaxed font-medium">
            EPROM Idea Bank is the innovation hub for the oil and gas sector, designed to capture, develop, and implement groundbreaking ideas that enhance operational excellence and sustainability. By connecting expertise with creativity, we transform challenges into opportunities, driving the future of energy through collaboration and smart solutions.
          </p>
          {!user && (
            <Link to="/auth">
              <Button variant="primary" className="text-lg px-10 py-4 rounded-full bg-slate-900 hover:bg-slate-800 border-none shadow-2xl hover:shadow-xl hover:scale-105 transition-all text-white">Initialize Session</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-20 relative z-10">
        <div className="flex items-center mb-12 border-l-4 border-slate-900 pl-6">
           <h2 className="text-3xl font-bold text-slate-900 tracking-tight uppercase">Top 10 Innovations</h2>
        </div>
        
        {publishedIdeas.length === 0 ? (
          <div className="text-center py-20 bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="text-slate-400 text-lg">System Idle. Awaiting Innovation Inputs.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {publishedIdeas.map((idea, index) => (
              <Card 
                  key={idea.id} 
                  className="group relative h-[420px] overflow-hidden rounded-2xl border-none shadow-xl bg-slate-900 hover:shadow-2xl transition-all duration-500 cursor-pointer"
                  onClick={() => navigate(`/view/${idea.id}`)}
              >
                 {idea.coverImage && (
                    <div className="absolute inset-0 z-0 bg-slate-950">
                      <img src={idea.coverImage} alt="Cover" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-60" />
                    </div>
                 )}
                 <div className="absolute inset-0 z-0 bg-gradient-to-t from-black via-black/90 to-transparent" />

                 <div className="absolute top-5 left-5 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center font-bold shadow-lg border border-white/20 z-20 text-lg">
                    {index + 1}
                 </div>

                 <div className="absolute top-5 right-5 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button 
                         onClick={(e) => { e.preventDefault(); e.stopPropagation(); copyShareLink(idea.id); }} 
                         className="text-[10px] bg-white text-slate-900 font-bold uppercase px-3 py-1.5 rounded shadow-lg hover:bg-slate-100 transition-colors"
                     >
                         Share
                     </button>
                 </div>

                <div className="absolute inset-0 z-10 p-8 flex flex-col justify-end transform transition-transform duration-300">
                  <div className="flex justify-between items-start mb-3 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                    <Badge color="blue" className="bg-blue-500/20 text-blue-100 border-blue-500/30 backdrop-blur-md">{idea.category}</Badge>
                    <span className="text-[10px] uppercase tracking-widest text-slate-300 font-bold">{new Date(idea.createdAt).toLocaleDateString()}</span>
                  </div>
                  
                  <h3 className="text-3xl font-bold text-white mb-3 leading-none drop-shadow-xl tracking-tight">{idea.title}</h3>
                  <p className="text-slate-200 text-sm line-clamp-2 mb-6 font-medium drop-shadow-md opacity-90">{idea.description}</p>
                
                  <div className="flex items-center justify-between pt-5 border-t border-white/10">
                       <div className="text-xs text-slate-300 uppercase tracking-wider font-bold">
                          {idea.authorName}
                       </div>
                       {idea.ratings.length > 0 && (
                           <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white">{(idea as any).avgScore.toFixed(0)}%</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                                    idea.ratings[0].grade === 'A' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 
                                    idea.ratings[0].grade === 'B' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                                    idea.ratings[0].grade === 'C' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'
                                } backdrop-blur-md`}>Grade {idea.ratings[0].grade}</span>
                           </div>
                       )}
                  </div>

                  {user?.role === UserRole.MANAGER && (
                    <div className="mt-4">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleManagerAnalysis(idea); }}
                        className="flex items-center text-xs font-bold text-indigo-300 hover:text-white transition-colors uppercase tracking-wide gap-1"
                      >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                         AI Executive Brief
                      </button>
                    </div>
                  )}
                </div>
                
                {activeAnalysis === idea.id && (
                  <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-xl z-30 p-8 overflow-y-auto flex flex-col fade-in">
                     <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
                        <h4 className="font-bold text-white uppercase text-xs tracking-widest">AI Executive Analysis</h4>
                        <button onClick={closeAnalysis} className="text-slate-400 hover:text-white transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        </button>
                     </div>
                     
                     {analyzingId === idea.id ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-3">
                                <span className="w-3 h-3 bg-indigo-500 rounded-full animate-ping"></span>
                                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Processing Intelligence...</span>
                            </div>
                        </div>
                     ) : aiAnalysisResult ? (
                        <div className="space-y-6 text-sm">
                           <div>
                              <span className="font-bold text-slate-300 block mb-2 uppercase tracking-wide text-xs">Executive Summary</span>
                              <p className="text-slate-400 leading-relaxed font-light">{aiAnalysisResult.summary}</p>
                           </div>
                           <div className="grid grid-cols-1 gap-4">
                              <div className="bg-emerald-900/10 p-4 rounded-lg border border-emerald-500/20">
                                 <span className="font-bold text-emerald-400 block mb-3 uppercase text-[10px] tracking-wider">Key Benefits</span>
                                 <ul className="list-disc list-inside space-y-2 text-emerald-200/70 text-xs">
                                    {aiAnalysisResult.pros.map((p, i) => <li key={i}>{p}</li>)}
                                 </ul>
                              </div>
                              <div className="bg-red-900/10 p-4 rounded-lg border border-red-500/20">
                                 <span className="font-bold text-red-400 block mb-3 uppercase text-[10px] tracking-wider">Risks / Challenges</span>
                                 <ul className="list-disc list-inside space-y-2 text-red-200/70 text-xs">
                                    {aiAnalysisResult.cons.map((c, i) => <li key={i}>{c}</li>)}
                                 </ul>
                              </div>
                           </div>
                        </div>
                     ) : (
                        <div className="text-red-500 text-xs">Analysis failed.</div>
                     )}
                  </div>
                )}
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

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        await login(formData.username, formData.password);
        navigate('/dashboard');
      } else {
        db.registerUser({
            username: formData.username,
            password: formData.password,
            email: formData.email,
            department: formData.department,
            role: UserRole.EMPLOYEE
        });
        alert("Registration successful. Please wait for admin approval.");
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md p-8">
        <h2 className="text-2xl font-bold mb-6 text-center">{isLogin ? 'Login' : 'Register'}</h2>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit}>
          <Input label="Username" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} required />
          <Input label="Password" type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
          {!isLogin && (
            <>
               <Input label="Email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
               <Select label="Department" options={db.getSettings().departments} value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} required />
            </>
          )}
          <Button type="submit" className="w-full mt-4">{isLogin ? 'Sign In' : 'Create Account'}</Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500 cursor-pointer hover:text-eprom-blue" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? "Need an account? Register" : "Already have an account? Login"}
        </p>
      </Card>
    </div>
  );
};

const SharedIdeaPage = () => {
  const { id } = useParams();
  const [idea, setIdea] = useState<Idea | null>(null);

  useEffect(() => {
    if (id) {
      const found = db.getIdeas().find(i => i.id === id);
      setIdea(found || null);
    }
  }, [id]);

  if (!idea) return <div className="text-center py-20">Idea not found.</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-20">
       <Card className="p-8">
          <Badge color="blue" className="mb-4">{idea.category}</Badge>
          <h1 className="text-3xl font-bold mb-4">{idea.title}</h1>
          <div className="flex items-center gap-4 text-sm text-slate-500 mb-8">
            <span>By {idea.authorName}</span>
            <span>{new Date(idea.createdAt).toLocaleDateString()}</span>
          </div>
          {idea.coverImage && <img src={idea.coverImage} className="w-full h-64 object-cover rounded-lg mb-8" />}
          <p className="whitespace-pre-wrap text-lg leading-relaxed text-slate-700">{idea.description}</p>
          
          <div className="mt-8 grid grid-cols-2 gap-4 bg-slate-50 p-6 rounded-lg">
             {Object.entries(idea.dynamicData).map(([key, val]) => (
                <div key={key}>
                   <span className="block text-xs font-bold uppercase text-slate-400">{key}</span>
                   <span className="font-medium">{val.toString()}</span>
                </div>
             ))}
          </div>
       </Card>
    </div>
  );
};

const CollaborationHub = () => {
    const [collabIdeas, setCollabIdeas] = useState<Idea[]>([]);
    const navigate = useNavigate();
    
    useEffect(() => {
        const all = db.getIdeas();
        setCollabIdeas(all.filter(i => 
             (i.status === IdeaStatus.PUBLISHED || i.status === IdeaStatus.APPROVED) && 
             (i.dynamicData['collab'] === true || (i as any).collaborationNeeded === true)
        ));
    }, []);

    return (
        <div className="max-w-7xl mx-auto px-4 py-20">
            <h1 className="text-3xl font-bold mb-2">Collaboration Hub</h1>
            <p className="text-slate-500 mb-8">Join forces on these active initiatives.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {collabIdeas.map(idea => (
                    <Card key={idea.id} className="p-6">
                        <Badge color="blue" className="mb-2">{idea.category}</Badge>
                        <h3 className="font-bold text-lg mb-2">{idea.title}</h3>
                        <p className="text-sm text-slate-500 mb-4 line-clamp-3">{idea.description}</p>
                        <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100">
                            <span className="text-xs font-bold text-slate-400">{idea.authorName}</span>
                            <Button 
                                variant="secondary" 
                                className="text-xs py-1 px-3"
                                onClick={() => navigate('/submit', { state: { parentIdea: idea } })}
                            >
                                Collaborate
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>
            {collabIdeas.length === 0 && <div className="text-center py-20 text-slate-400">No active collaboration requests.</div>}
        </div>
    );
};

const IdeaFormPage = () => {
    const { user } = useAppContext();
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

    const [templates, setTemplates] = useState<FormTemplate[]>([]);
    const { isRecording, startRecording, stopRecording } = useRecorder();
    const [isEnhancing, setIsEnhancing] = useState(false);

    useEffect(() => {
        const t = db.getTemplates();
        setTemplates(t);
        if (!editingIdea && t.length > 0) {
            setTemplateId(t[0].id);
        }
    }, [editingIdea]);

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
            const base64 = await db.fileToBase64(e.target.files[0]);
            setCoverImage(base64);
        }
    }

    const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if(e.target.files?.[0]) {
            setIsUploading(true);
            try {
                const url = await db.uploadToDrive(e.target.files[0]);
                setAttachments(prev => [...prev, url]);
                alert("File uploaded to Drive successfully!");
            } catch (err) {
                alert("Failed to upload file to Google Drive. Ensure the script is deployed correctly.");
            } finally {
                setIsUploading(false);
            }
        }
    }

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!user) return;

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
            attachments: attachments
        };

        db.saveIdea(newIdea);
        navigate('/dashboard');
    }

    const currentTemplate = templates.find(t => t.id === templateId);

    return (
        <div className="max-w-4xl mx-auto px-4 py-24 fade-in">
            <div className="mb-8 border-b border-slate-200 pb-4 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">{editingIdea ? 'Refine Protocol' : (parentIdea ? 'Collaborate on Protocol' : 'Initialize Protocol')}</h1>
                    {parentIdea && <p className="text-blue-600 font-bold mt-1 text-sm flex items-center gap-2"><span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span> Contributing to: "{parentIdea.title}"</p>}
                    {!parentIdea && <p className="text-slate-500 mt-1 text-sm font-medium">Submit new innovation for operational review.</p>}
                </div>
                <Button variant="ghost" onClick={() => navigate(-1)} className="text-xs uppercase">Cancel</Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                <Card className="p-8 border-none shadow-lg">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">01 // Core Intelligence</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <Input label="Protocol Title" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Flare Gas Recovery" />
                        <Select label="Category" options={db.getSettings().categories} value={category} onChange={e => setCategory(e.target.value)} required />
                    </div>
                    
                    <div className="mb-6 relative">
                        <div className="flex justify-between items-end mb-1.5">
                             <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Technical Description</label>
                             <div className="flex gap-2">
                                <button type="button" onClick={handleEnhance} disabled={isEnhancing} className="text-[10px] font-bold uppercase text-indigo-500 hover:text-indigo-700 disabled:opacity-50 flex items-center gap-1">
                                    {isEnhancing ? (
                                        <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></span>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
                                    )}
                                    AI Enhance
                                </button>
                                <button type="button" onClick={handleAudioInput} className={`text-[10px] font-bold uppercase flex items-center gap-1 ${isRecording ? 'text-red-600 animate-pulse' : 'text-slate-400 hover:text-slate-900'}`}>
                                    <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-600' : 'bg-slate-400'}`}></span>
                                    {isRecording ? 'Stop Rec' : 'Dictate'}
                                </button>
                             </div>
                        </div>
                        <textarea 
                            className="w-full px-4 py-3 bg-slate-50/50 border border-slate-300 rounded text-slate-900 placeholder-slate-400 focus:outline-none focus:border-eprom-blue focus:ring-1 focus:ring-eprom-blue transition-all min-h-[160px] text-sm leading-relaxed"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            required
                            placeholder="Describe the operational challenge and proposed solution..."
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Visual Reference (Cover)</label>
                        <div className="flex items-start gap-6">
                            <label className="flex-shrink-0 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-3 rounded text-xs font-bold uppercase transition-colors border border-slate-200 hover:border-slate-300 flex flex-col items-center justify-center w-32 h-32">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                <span>Select Img</span>
                                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                            </label>
                            {coverImage ? (
                                <div className="h-32 w-full flex-1 overflow-hidden rounded border border-slate-200 bg-slate-50 relative group">
                                    <img src={coverImage} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button type="button" onClick={() => setCoverImage('')} className="text-white text-xs uppercase font-bold">Remove</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-32 w-full flex-1 rounded border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400 text-xs">
                                    No Image Selected
                                </div>
                            )}
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
                                        <Textarea 
                                            label={field.label} 
                                            required={field.required}
                                            value={dynamicData[field.id] || ''}
                                            onChange={e => setDynamicData({...dynamicData, [field.id]: e.target.value})}
                                        />
                                    ) : field.type === 'select' && field.options ? (
                                        <Select 
                                            label={field.label}
                                            options={field.options}
                                            required={field.required}
                                            value={dynamicData[field.id] || ''}
                                            onChange={e => setDynamicData({...dynamicData, [field.id]: e.target.value})}
                                        />
                                    ) : field.type === 'checkbox' ? (
                                        <div className="flex items-center h-full pt-6">
                                            <label className="flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={!!dynamicData[field.id]} 
                                                    onChange={(e) => setDynamicData({...dynamicData, [field.id]: e.target.checked})}
                                                    className="form-checkbox h-5 w-5 text-eprom-blue rounded border-slate-300 focus:ring-eprom-blue" 
                                                />
                                                <span className="ml-2 text-sm text-slate-700 font-medium">{field.label}</span>
                                            </label>
                                        </div>
                                    ) : (
                                        <Input 
                                            label={field.label}
                                            type={field.type}
                                            required={field.required}
                                            value={dynamicData[field.id] || ''}
                                            onChange={e => setDynamicData({...dynamicData, [field.id]: e.target.value})}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                <Card className="p-8 border-none shadow-lg">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">03 // Supporting Documents</h3>
                    
                    <div className="mb-4">
                        <label className="flex items-center justify-center w-full h-24 px-4 transition bg-white border-2 border-slate-300 border-dashed rounded-md appearance-none cursor-pointer hover:border-slate-400 focus:outline-none bg-slate-50 hover:bg-slate-100">
                            <span className="flex items-center space-x-2 text-slate-500">
                                {isUploading ? (
                                    <span className="flex items-center gap-2 text-sm font-bold animate-pulse">
                                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                                        Uploading to Drive...
                                    </span>
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                        <span className="text-xs font-bold uppercase">Upload to Google Drive</span>
                                    </>
                                )}
                            </span>
                            <input type="file" name="file_upload" className="hidden" disabled={isUploading} onChange={handleAttachmentUpload} />
                        </label>
                    </div>

                    {attachments.length > 0 && (
                        <div className="grid grid-cols-1 gap-2">
                            {attachments.map((url, index) => (
                                <div key={index} className="flex justify-between items-center p-3 bg-blue-50 border border-blue-100 rounded text-sm text-blue-800">
                                    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline truncate max-w-[80%]">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                        Attachment {index + 1} (Drive Link)
                                    </a>
                                    <button type="button" onClick={() => removeAttachment(index)} className="text-red-500 hover:text-red-700 text-xs font-bold uppercase">Remove</button>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                <div className="flex justify-end gap-4 pt-4">
                    <Button type="submit" className="px-12 py-4 shadow-xl bg-slate-900 hover:bg-slate-800 text-white font-bold tracking-widest text-sm">
                        {editingIdea && (editingIdea.status === IdeaStatus.NEEDS_REVISION || editingIdea.status === IdeaStatus.REJECTED) ? 'Resubmit Protocol' : 'Launch Protocol'}
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
    const refreshData = () => { setUsers(db.getUsers()); setTemplates(db.getTemplates()); };
    const handleUserApproval = (uid: string, role: UserRole) => { db.updateUserStatus(uid, UserStatus.ACTIVE, role); refreshData(); };
    const handleUserReject = (uid: string) => { db.updateUserStatus(uid, UserStatus.REJECTED); refreshData(); };
    const handleRoleChange = (uid: string, newRole: UserRole) => { db.updateUserRole(uid, newRole); refreshData(); };
    const handleAddCategory = () => { if (newCat) { db.updateSettings({ ...settings, categories: [...settings.categories, newCat] }); refreshSettings(); setNewCat(''); } };
    const handleAddDept = () => { if (newDept) { db.updateSettings({ ...settings, departments: [...settings.departments, newDept] }); refreshSettings(); setNewDept(''); } };
    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) { try { const base64 = await db.fileToBase64(e.target.files[0]); const newSettings = { ...settings, logoUrl: base64 }; db.updateSettings(newSettings); refreshSettings(); } catch (err) { alert("Logo upload failed"); } } };
    const addFieldToTemplate = () => { if(!editingField.label || !editingField.type) return; const newField: FormField = { id: editingField.label.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now(), label: editingField.label, type: editingField.type as any, required: editingField.required || false, options: editingField.options ? (editingField.options as any).split(',') : undefined }; setNewFields([...newFields, newField]); setEditingField({}); };
    const addKPI = () => { if (!newKPI.name || !newKPI.weight) return; const k: RatingDimension = { id: (newKPI.name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now()).substring(0, 15), name: newKPI.name, description: newKPI.description || '', weight: Number(newKPI.weight) }; setCurrentKPIs([...currentKPIs, k]); setNewKPI({}); };
    const removeKPI = (id: string) => { setCurrentKPIs(currentKPIs.filter(k => k.id !== id)); };
    const resetKPIs = () => setCurrentKPIs(DEFAULT_KPIS);
    const totalWeight = currentKPIs.reduce((sum, k) => sum + k.weight, 0);
    const handleEditTemplate = (t: FormTemplate) => { setEditingTemplateId(t.id); setNewTemplateName(t.name); setNewTemplateDesc(t.description); setNewFields(t.fields); setCurrentKPIs(t.ratingConfig || []); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const handleCancelEdit = () => { setEditingTemplateId(null); setNewTemplateName(''); setNewTemplateDesc(''); setNewFields([]); setCurrentKPIs(DEFAULT_KPIS); };
    const saveTemplate = () => { if(!newTemplateName || newFields.length === 0) return; const t: FormTemplate = { id: editingTemplateId || Date.now().toString(), name: newTemplateName, description: newTemplateDesc, fields: newFields, ratingConfig: currentKPIs, isActive: true }; db.saveTemplate(t); handleCancelEdit(); refreshData(); };
    const deleteTemplate = (id: string) => { if (confirm("Are you sure?")) { db.deleteTemplate(id); refreshData(); } }

    const PendingUserRow = ({ u }: { u: User }) => {
      const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.EMPLOYEE);
      return (
        <tr className="hover:bg-amber-50 transition-colors bg-amber-50 border-l-4 border-amber-400">
            <td className="px-6 py-4 font-bold text-slate-800">{u.username}</td>
            <td className="px-6 py-4 text-slate-600">{u.email}</td>
            <td className="px-6 py-4 text-slate-600">{u.department}</td>
            <td className="px-6 py-4"><select value={selectedRole} onChange={e => setSelectedRole(e.target.value as UserRole)} className="bg-white border border-slate-300 text-slate-800 text-xs rounded p-1"><option value={UserRole.EMPLOYEE}>Employee</option><option value={UserRole.MANAGER}>Manager</option><option value={UserRole.ADMIN}>Admin</option><option value={UserRole.GUEST}>Guest</option></select></td>
            <td className="px-6 py-4"><div className="flex space-x-2"><Button variant="ghost" onClick={() => handleUserApproval(u.id, selectedRole)} className="text-green-600 hover:text-green-700 text-xs px-2 py-1 uppercase font-bold">Approve</Button><Button variant="ghost" onClick={() => handleUserReject(u.id)} className="text-red-600 hover:text-red-700 text-xs px-2 py-1 uppercase font-bold">Reject</Button></div></td>
        </tr>
      );
    }

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
                    <div className="overflow-x-auto"><table className="w-full text-left text-sm text-slate-600"><thead className="bg-slate-50 border-b border-slate-200 uppercase text-xs font-bold text-slate-500 tracking-wider"><tr><th className="px-6 py-4">Username</th><th className="px-6 py-4">Email</th><th className="px-6 py-4">Department</th><th className="px-6 py-4">Role</th><th className="px-6 py-4">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{users.filter(u => u.status === UserStatus.PENDING).map(u => (<PendingUserRow key={u.id} u={u} />))}{users.filter(u => u.status === UserStatus.ACTIVE).map(u => (<tr key={u.id} className="hover:bg-slate-50 transition-colors"><td className="px-6 py-4 font-bold text-slate-800">{u.username}</td><td className="px-6 py-4">{u.email}</td><td className="px-6 py-4">{u.department}</td><td className="px-6 py-4"><select value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)} className="bg-transparent border border-slate-200 rounded p-1 text-slate-700 focus:bg-white focus:border-slate-900 text-xs uppercase font-bold"><option value={UserRole.EMPLOYEE}>Employee</option><option value={UserRole.MANAGER}>Manager</option><option value={UserRole.ADMIN}>Admin</option><option value={UserRole.GUEST}>Guest</option></select></td><td className="px-6 py-4"><div className="flex items-center"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2"></div><span className="text-xs uppercase text-emerald-600 font-bold tracking-wider">Active</span></div></td></tr>))}</tbody></table></div>
                </Card>
            )}
            {activeTab === 'forms' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 space-y-4"><h3 className="text-lg font-bold text-slate-900 mb-4 uppercase tracking-wide">Active Protocols</h3>{templates.map(t => (<Card key={t.id} className={`p-5 border-l-4 transition-all hover:shadow-lg cursor-pointer ${editingTemplateId === t.id ? 'border-l-blue-500 bg-blue-50' : 'border-l-slate-900 bg-white'}`}><div className="flex justify-between items-start"><div onClick={() => handleEditTemplate(t)} className="flex-1"><div className="font-bold text-slate-900 text-sm">{t.name}</div><div className="text-xs text-slate-500 mt-1 uppercase tracking-wider">{t.fields.length} Data Points</div><div className="text-[10px] text-slate-900 mt-2 font-bold uppercase">{t.ratingConfig ? `${t.ratingConfig.length} Evaluators` : 'Default KPIs'}</div></div><div className="flex flex-col gap-1"><button className="text-blue-600 hover:text-blue-800 transition-colors text-xs uppercase font-bold" onClick={() => handleEditTemplate(t)}>Edit</button><button className="text-red-500 hover:text-red-700 transition-colors text-xs uppercase font-bold" onClick={() => deleteTemplate(t.id)}>Delete</button></div></div></Card>))}</div>
                    <Card className="lg:col-span-2 p-8 border-none shadow-lg"><div className="flex justify-between items-center mb-8"><h3 className="text-lg font-bold text-slate-900 uppercase tracking-wide flex items-center"><span className={`w-2 h-2 rounded-full mr-3 ${editingTemplateId ? 'bg-blue-500' : 'bg-slate-900'}`}></span>{editingTemplateId ? 'Modify Existing Protocol' : 'New Protocol Configuration'}</h3>{editingTemplateId && (<button onClick={handleCancelEdit} className="text-xs text-slate-500 hover:text-slate-900 uppercase font-bold">Cancel Edit</button>)}</div><div className="mb-8 grid grid-cols-2 gap-6"><Input label="Protocol Name" value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} placeholder="e.g. Safety Incident Report" /><Input label="Description" value={newTemplateDesc} onChange={e => setNewTemplateDesc(e.target.value)} placeholder="Short operational summary..." /></div><div className="bg-slate-50 p-6 rounded border border-slate-200 mb-8"><h4 className="text-xs font-bold text-slate-900 mb-6 uppercase tracking-widest border-b border-slate-200 pb-2">01 // Data Structure</h4><div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end"><Input label="Field Label" value={editingField.label || ''} onChange={e => setEditingField({...editingField, label: e.target.value})} placeholder="Label" /><div className="mb-5"><label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Data Type</label><select value={editingField.type || ''} onChange={e => setEditingField({...editingField, type: e.target.value as any})} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded text-slate-900 appearance-none input-base"><option value="">Select Type</option><option value="text">Short Text</option><option value="textarea">Long Text</option><option value="number">Numeric</option><option value="select">Selector</option><option value="checkbox">Boolean</option><option value="date">Date</option></select></div>{editingField.type === 'select' && (<Input label="Options (CSV)" value={editingField.options as any || ''} onChange={e => setEditingField({...editingField, options: e.target.value as any})} placeholder="A, B, C" />)}<div className="mb-5 flex items-center h-10 bg-white px-3 rounded border border-slate-300"><input type="checkbox" checked={editingField.required || false} onChange={e => setEditingField({...editingField, required: e.target.checked})} className="mr-3 text-slate-900 bg-slate-100 border-slate-300 rounded" /><span className="text-xs text-slate-500 uppercase font-bold">Required</span></div></div><Button onClick={addFieldToTemplate} className="w-full mt-2 border border-dashed border-slate-300 bg-white hover:bg-slate-50 text-slate-500">+ Append Data Field</Button>{newFields.length > 0 && (<div className="mt-6 space-y-2">{newFields.map((f, idx) => (<div key={idx} className="bg-white p-3 rounded flex justify-between items-center text-xs border border-slate-200 shadow-sm"><span><span className="font-bold text-slate-900 uppercase">{f.label}</span> <span className="text-slate-500 ml-2">[{f.type}]</span></span><span className="text-[10px] text-slate-400 uppercase font-bold">{f.required ? 'REQ' : 'OPT'}</span></div>))}</div>)}</div><div className="bg-slate-50 p-6 rounded border border-slate-200 mb-8"><div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-2"><h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest">02 // Evaluation Metrics</h4><div className={`text-xs font-bold uppercase tracking-wide ${totalWeight === 100 ? 'text-emerald-600' : 'text-red-500'}`}>Total Weight: {totalWeight}%</div></div><div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end mb-6"><Input label="Metric Name" value={newKPI.name || ''} onChange={e => setNewKPI({...newKPI, name: e.target.value})} placeholder="e.g. ROI" /><Input label="Description" value={newKPI.description || ''} onChange={e => setNewKPI({...newKPI, description: e.target.value})} placeholder="Context" /><Input label="Weight (%)" type="number" value={newKPI.weight || ''} onChange={e => setNewKPI({...newKPI, weight: Number(e.target.value)})} placeholder="20" /><Button onClick={addKPI} className="mb-5 bg-white hover:bg-slate-100 border-slate-300 text-slate-600">Add Metric</Button></div><div className="space-y-2">{currentKPIs.map(kpi => (<div key={kpi.id} className="bg-white p-3 rounded flex justify-between items-center text-xs border border-slate-200 shadow-sm"><div className="flex-1"><span className="font-bold text-slate-800 mr-3 uppercase">{kpi.name}</span><span className="text-slate-500">{kpi.description}</span></div><div className="flex items-center gap-4"><Badge color="blue">{kpi.weight}%</Badge><button onClick={() => removeKPI(kpi.id)} className="text-red-500 hover:text-red-700 transition-colors uppercase font-bold text-[10px]">Remove</button></div></div>))}</div><div className="mt-6 text-right"><button onClick={resetKPIs} className="text-[10px] text-slate-900 hover:text-slate-600 uppercase font-bold tracking-wider">Reset Defaults</button></div></div><div className="flex justify-end pt-6 border-t border-slate-200"><Button onClick={saveTemplate} variant="primary" className="px-10 py-3 shadow-lg bg-slate-900 text-white" disabled={totalWeight !== 100}>{editingTemplateId ? 'Update Protocol' : 'Deploy Protocol'}</Button></div></Card>
                </div>
            )}
            {activeTab === 'settings' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8"><Card className="p-8 border-none shadow-lg"><h3 className="font-bold text-lg mb-6 text-slate-900 uppercase tracking-wide">System Definitions</h3><div className="mb-8 p-6 bg-slate-50 rounded border border-slate-200"><label className="block text-xs font-bold mb-3 text-slate-500 uppercase tracking-wide">Brand Identity (Logo)</label><div className="flex items-center gap-4">{settings.logoUrl && (<div className="w-16 h-16 bg-white border border-slate-200 rounded flex items-center justify-center p-2"><img src={settings.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" /></div>)}<input type="file" onChange={handleLogoUpload} accept="image/*" className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-bold file:uppercase file:bg-slate-900 file:text-white hover:file:bg-slate-800 transition-colors"/></div></div><div className="mb-8"><label className="block text-xs font-bold mb-3 text-slate-500 uppercase tracking-wide">Operational Categories</label><div className="flex gap-3 mb-4"><Input placeholder="New Category" value={newCat} onChange={e => setNewCat(e.target.value)} className="mb-0 flex-1" /><Button onClick={handleAddCategory} className="whitespace-nowrap px-6">Add</Button></div><div className="flex flex-wrap gap-2">{settings.categories.map(c => <Badge key={c} color="gray">{c}</Badge>)}</div></div><div className="pt-6 border-t border-slate-200"><label className="block text-xs font-bold mb-3 text-slate-500 uppercase tracking-wide">Organization Units</label><div className="flex gap-3 mb-4"><Input placeholder="New Department" value={newDept} onChange={e => setNewDept(e.target.value)} className="mb-0 flex-1" /><Button onClick={handleAddDept} className="whitespace-nowrap px-6">Add</Button></div><div className="flex flex-wrap gap-2">{settings.departments.map(d => <Badge key={d} color="gray">{d}</Badge>)}</div></div></Card></div>
            )}
        </div>
    );
};

const Dashboard = () => {
  const { user } = useAppContext();
  const navigate = useNavigate();
  const [ideas, setIdeas] = useState<Idea[]>([]);

  useEffect(() => {
    if (user) {
      const allIdeas = db.getIdeas();
      // Admin/Manager sees all, Employee sees own
      if (user.role === UserRole.ADMIN || user.role === UserRole.MANAGER) {
        setIdeas(allIdeas);
      } else {
        setIdeas(allIdeas.filter(i => i.authorId === user.id));
      }
    }
  }, [user]);

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this protocol?")) {
      db.deleteIdea(id);
      setIdeas(prev => prev.filter(i => i.id !== id));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-24 fade-in">
       <div className="flex justify-between items-end mb-8 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">Mission Control</h1>
            <p className="text-slate-500 font-medium text-sm mt-1">
              {user?.role === UserRole.EMPLOYEE ? 'My Active Protocols' : 'Global Innovation Overview'}
            </p>
          </div>
          {user?.role === UserRole.EMPLOYEE && (
            <Link to="/submit">
              <Button>+ Initialize Protocol</Button>
            </Link>
          )}
       </div>

       {ideas.length === 0 ? (
         <div className="py-20 text-center bg-white border border-slate-200 rounded-xl">
           <p className="text-slate-400 font-bold uppercase tracking-wider text-sm">No protocols in registry.</p>
         </div>
       ) : (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {ideas.map(idea => (
             <Card key={idea.id} className="flex flex-col h-full relative group">
                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <Badge color={
                      idea.status === IdeaStatus.PUBLISHED ? 'blue' : 
                      idea.status === IdeaStatus.APPROVED ? 'green' : 
                      idea.status === IdeaStatus.REJECTED ? 'red' : 'yellow'
                    }>{idea.status}</Badge>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{new Date(idea.createdAt).toLocaleDateString()}</span>
                  </div>
                  <h3 className="font-bold text-lg text-slate-900 mb-2 leading-tight">{idea.title}</h3>
                  <p className="text-sm text-slate-500 line-clamp-3">{idea.description}</p>
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center rounded-b-lg">
                   <Link to={`/view/${idea.id}`} className="text-xs font-bold text-eprom-blue uppercase hover:underline">View Details</Link>
                   <div className="flex gap-2">
                      {(user?.id === idea.authorId || user?.role === UserRole.ADMIN) && (
                        <>
                          <button onClick={() => navigate('/submit', { state: { idea } })} className="text-slate-400 hover:text-blue-600">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button onClick={() => handleDelete(idea.id)} className="text-slate-400 hover:text-red-600">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </>
                      )}
                   </div>
                </div>
             </Card>
           ))}
         </div>
       )}
    </div>
  );
};

const ProtectedRoute = ({ children, roles, excludedRoles }: { children: React.ReactElement, roles?: UserRole[], excludedRoles?: UserRole[] }) => {
  const { user } = useAppContext();
  if (!user) return <Navigate to="/auth" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  if (excludedRoles && excludedRoles.includes(user.role)) return <Navigate to="/admin" />;
  return children;
};

const App = () => {
  return (
    <HashRouter>
      <AppProvider>
        <div className="min-h-screen flex flex-col font-sans text-slate-800 bg-eprom-bg selection:bg-slate-900 selection:text-white">
          <Navbar />
          <div className="flex-grow">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/view/:id" element={<SharedIdeaPage />} />
              <Route path="/search" element={<SearchPage />} />
              
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />

              <Route path="/collaboration" element={
                  <ProtectedRoute excludedRoles={[UserRole.ADMIN]}>
                      <CollaborationHub />
                  </ProtectedRoute>
              } />
              
              <Route path="/submit" element={
                <ProtectedRoute roles={[UserRole.EMPLOYEE]}>
                  <IdeaFormPage />
                </ProtectedRoute>
              } />
              
              <Route path="/admin" element={
                <ProtectedRoute roles={[UserRole.ADMIN]}>
                  <AdminPanel />
                </ProtectedRoute>
              } />
            </Routes>
          </div>
          <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-10 text-center text-xs uppercase tracking-widest">
            <p className="mb-2">&copy; {new Date().getFullYear()} EPROM Systems</p>
            <p className="text-[10px]">Confidential & Proprietary</p>
          </footer>
        </div>
      </AppProvider>
    </HashRouter>
  );
};

export default App;