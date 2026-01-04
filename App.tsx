import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { createRoot } from 'react-dom/client';
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
      setSearchTerm(''); // Optional: clear after search
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

    // Convert local messages to Gemini Content format
    const history: Content[] = messages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));

    const response = await aiService.sendMessageToAI(history, userMsg, mode);

    let finalText = response.text || "I'm having trouble thinking right now.";
    
    // Append grounding info if available
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
        {/* Sparkles Icon */}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:animate-pulse text-eprom-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-[380px] h-[600px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-50 overflow-hidden font-sans fade-in">
      {/* Header */}
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

      {/* Messages */}
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

      {/* Controls */}
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


// --- Pages ---

// 0. Search Page (Optimized)
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

// 1. Landing / Public Dashboard (Optimized)
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
      // Use pathname to ensure we include the repo name (e.g., /IDB-EPROM/) for GitHub Pages
      const baseUrl = window.location.href.split('#')[0];
      const url = `${baseUrl}#/view/${id}`;
      navigator.clipboard.writeText(url);
      alert("Shareable link copied to clipboard!");
  };

  return (
    <div className="min-h-screen bg-eprom-bg text-slate-800 pt-16">
      {/* Hero Area */}
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

      {/* Published Ideas Grid */}
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
                 {/* Background Image Logic */}
                 {idea.coverImage && (
                    <div className="absolute inset-0 z-0 bg-slate-950">
                      <img src={idea.coverImage} alt="Cover" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-60" />
                    </div>
                 )}
                 {/* Dark Overlay (Fade) */}
                 <div className="absolute inset-0 z-0 bg-gradient-to-t from-black via-black/90 to-transparent" />

                 {/* Rank Badge */}
                 <div className="absolute top-5 left-5 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center font-bold shadow-lg border border-white/20 z-20 text-lg">
                    {index + 1}
                 </div>

                 {/* Share Button */}
                 <div className="absolute top-5 right-5 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button 
                         onClick={(e) => { e.preventDefault(); e.stopPropagation(); copyShareLink(idea.id); }} 
                         className="text-[10px] bg-white text-slate-900 font-bold uppercase px-3 py-1.5 rounded shadow-lg hover:bg-slate-100 transition-colors"
                     >
                         Share
                     </button>
                 </div>

                 {/* Content Layer */}
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

                  {/* Manager Only: AI Analysis Button */}
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
                
                {/* Manager Analysis Overlay */}
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

// 2. Auth Page
const AuthPage = () => {
  const { login, user } = useAppContext();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
        if (isRegistering) {
            db.registerUser({ username, password, email: `${username}@eprom.com`, department: 'General', role: UserRole.EMPLOYEE });
            alert("Registration successful. Please wait for admin approval.");
            setIsRegistering(false);
        } else {
            await login(username, password);
            navigate('/dashboard');
        }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGuestLogin = async () => {
      try {
          await login('guest', 'guest');
          navigate('/dashboard');
      } catch (err: any) {
          setError("Guest login failed. Please contact admin.");
      }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md p-8 border-none shadow-2xl">
        <div className="text-center mb-8">
           <h1 className="text-2xl font-bold text-slate-900 mb-2">EPROM <span className="text-slate-400">ACCESS</span></h1>
           <p className="text-slate-500 text-xs uppercase tracking-widest">Secure Gateway</p>
        </div>
        
        {error && <div className="mb-6 bg-red-50 text-red-600 p-3 rounded text-sm text-center border border-red-100">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input 
            label="Username" 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
            placeholder="Enter identity..." 
            required 
          />
          <Input 
            label="Password" 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            placeholder="Enter credentials..." 
            required 
          />
          <Button type="submit" className="w-full shadow-lg mt-4">{isRegistering ? 'Submit Application' : 'Authenticate'}</Button>
        </form>
        
        <div className="mt-4 text-center">
            <button onClick={handleGuestLogin} className="text-xs uppercase font-bold text-slate-400 hover:text-slate-600 tracking-widest">
                Continue as Guest
            </button>
        </div>

        <div className="mt-6 text-center">
            <button onClick={() => setIsRegistering(!isRegistering)} className="text-xs text-slate-400 hover:text-slate-900 underline underline-offset-4">
                {isRegistering ? 'Back to Login' : 'Request Access / Register'}
            </button>
        </div>
      </Card>
    </div>
  );
};

// 3. Shared View Page
const SharedIdeaPage = () => {
  const { id } = useParams();
  const [idea, setIdea] = useState<Idea | null>(null);

  useEffect(() => {
    const all = db.getIdeas();
    const found = all.find(i => i.id === id);
    setIdea(found || null);
  }, [id]);

  if (!idea) return <div className="min-h-screen flex items-center justify-center text-slate-400 uppercase tracking-widest">Record not found or access denied.</div>;

  return (
    <div className="min-h-screen bg-slate-50 py-24 px-4">
        <div className="max-w-4xl mx-auto">
             <Card className="overflow-hidden shadow-2xl border-none">
                 {idea.coverImage && (
                     <div className="h-64 relative">
                         <img src={idea.coverImage} className="w-full h-full object-cover" />
                         <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-8">
                             <h1 className="text-4xl font-bold text-white drop-shadow-lg">{idea.title}</h1>
                         </div>
                     </div>
                 )}
                 <div className="p-8 md:p-12 bg-white">
                     {!idea.coverImage && <h1 className="text-3xl font-bold text-slate-900 mb-6">{idea.title}</h1>}
                     
                     <div className="flex gap-4 mb-8">
                         <Badge color="blue">{idea.category}</Badge>
                         <Badge color="gray">{idea.status}</Badge>
                         <span className="text-xs text-slate-500 uppercase font-bold tracking-wider self-center">By {idea.authorName}</span>
                     </div>

                     <div className="prose prose-slate max-w-none mb-12">
                         <p className="text-lg text-slate-600 leading-relaxed font-medium">{idea.description}</p>
                     </div>

                     <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-6 bg-slate-50 rounded border border-slate-100 mb-8">
                        <div>
                            <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Impact/Benefit</span>
                            <span className="text-sm font-bold text-slate-700">{idea.dynamicData?.benefits || 'N/A'}</span>
                        </div>
                        <div>
                            <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Cost Est.</span>
                            <span className="text-sm font-bold text-slate-700">{idea.dynamicData?.cost || 'N/A'}</span>
                        </div>
                        <div>
                            <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Timeline</span>
                            <span className="text-sm font-bold text-slate-700">{idea.dynamicData?.timeline || 'N/A'}</span>
                        </div>
                         <div>
                            <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Feasibility</span>
                            <span className="text-sm font-bold text-slate-700">{idea.dynamicData?.feasibility || 'N/A'}</span>
                        </div>
                     </div>
                     
                     <div className="text-center pt-8 border-t border-slate-100">
                         <p className="text-slate-400 text-xs uppercase tracking-widest mb-4">EPROM Innovation Registry</p>
                         <Link to="/">
                            <Button variant="secondary" className="text-xs uppercase">Return to Hub</Button>
                         </Link>
                     </div>
                 </div>
             </Card>
        </div>
    </div>
  );
};

// 4. Submission / Edit Form (Dynamic)
const IdeaFormPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAppContext();
    const { isRecording, startRecording, stopRecording } = useRecorder();
    
    // State initialization
    const existingIdea = location.state?.idea as Idea | undefined;
    const parentIdea = location.state?.parentIdea as Idea | undefined;
    
    const [templates, setTemplates] = useState<FormTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

    // Core Data
    const [title, setTitle] = useState(existingIdea?.title || '');
    const [category, setCategory] = useState(existingIdea?.category || 'Innovation');
    const [description, setDescription] = useState(existingIdea?.description || '');
    const [coverImage, setCoverImage] = useState<string | undefined>(existingIdea?.coverImage);
    
    // Dynamic Data
    const [dynamicData, setDynamicData] = useState<Record<string, any>>({});
    const [isEnhancing, setIsEnhancing] = useState(false);

    useEffect(() => {
        const t = db.getTemplates();
        setTemplates(t);
        
        if (existingIdea) {
            setSelectedTemplateId(existingIdea.templateId);
            setDynamicData(existingIdea.dynamicData || {});
        } else {
             // Default to the first template available if new
            if (t.length > 0) {
                setSelectedTemplateId(t[0].id);
            }
        }
    }, [existingIdea]);

    // Find the active template object
    const currentTemplate = templates.find(t => t.id === selectedTemplateId);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const base64 = await db.fileToBase64(e.target.files[0]);
            setCoverImage(base64);
            
            // Auto-analyze image to fill description if empty
            if (!description) {
                const analysis = await aiService.analyzeImage(base64.split(',')[1], e.target.files[0].type);
                setDescription(prev => prev ? prev : analysis);
            }
        }
    };

    const handleVoiceInput = async () => {
        if (isRecording) {
            const audio = await stopRecording();
            if (audio) {
                const text = await aiService.transcribeAudio(audio.base64, audio.mimeType);
                setDescription(prev => prev + " " + text);
            }
        } else {
            await startRecording();
        }
    };

    const handleEnhanceText = async () => {
        if (!description) return;
        setIsEnhancing(true);
        const enhanced = await aiService.enhanceIdeaText(description);
        setDescription(enhanced);
        setIsEnhancing(false);
    };

    const handleDynamicChange = (fieldId: string, value: any) => {
        setDynamicData(prev => ({ ...prev, [fieldId]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !currentTemplate) return;

        const newIdea: Idea = {
            id: existingIdea?.id || Date.now().toString(),
            authorId: user.id,
            authorName: user.username,
            department: user.department,
            createdAt: existingIdea?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            title,
            description,
            category,
            coverImage,
            status: existingIdea?.status || IdeaStatus.SUBMITTED,
            templateId: currentTemplate.id,
            templateName: currentTemplate.name,
            parentIdeaId: parentIdea?.id,
            dynamicData: dynamicData,
            tags: [], 
            ratings: existingIdea?.ratings || [],
            comments: existingIdea?.comments || []
        };

        db.saveIdea(newIdea);
        navigate('/dashboard');
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-24 fade-in">
            <div className="mb-8 border-b border-slate-200 pb-4 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">{existingIdea ? 'Edit Protocol' : (parentIdea ? 'Collaborate on Protocol' : 'Initialize New Protocol')}</h1>
                    {parentIdea && <p className="text-slate-500 mt-1">Contributing to: <span className="font-bold">{parentIdea.title}</span></p>}
                </div>
                <Button variant="ghost" onClick={() => navigate(-1)} className="text-xs uppercase">Cancel</Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Protocol Type Selector */}
                {!existingIdea && templates.length > 1 && (
                     <div className="mb-6">
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Protocol Type</label>
                        <select 
                            value={selectedTemplateId} 
                            onChange={(e) => {
                                setSelectedTemplateId(e.target.value);
                                setDynamicData({}); // Clear data on template switch
                            }}
                            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:border-eprom-blue focus:ring-1 focus:ring-eprom-blue transition-all appearance-none input-base"
                        >
                            {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Core Info */}
                <Card className="p-8 border-none shadow-lg">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Core Data</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input label="Protocol Title" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Predictive Valve Maintenance" />
                        <Select label="Category" options={['Cost Reduction', 'Safety Improvement', 'Process Optimization', 'Innovation', 'Sustainability']} value={category} onChange={e => setCategory(e.target.value)} required />
                    </div>
                    
                    <div className="mb-5">
                        <div className="flex justify-between items-end mb-1.5">
                             <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Description / Hypothesis</label>
                             <div className="flex gap-2">
                                <button type="button" onClick={handleVoiceInput} className={`text-[10px] font-bold uppercase flex items-center gap-1 ${isRecording ? 'text-red-600 animate-pulse' : 'text-slate-400 hover:text-slate-900'}`}>
                                    <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-600' : 'bg-slate-400'}`}></span>
                                    {isRecording ? 'Stop Recording' : 'Voice Input'}
                                </button>
                                <button type="button" onClick={handleEnhanceText} disabled={isEnhancing} className="text-[10px] font-bold uppercase text-indigo-500 hover:text-indigo-700 disabled:opacity-50">
                                    {isEnhancing ? 'Optimizing...' : 'AI Enhance'}
                                </button>
                             </div>
                        </div>
                        <textarea 
                            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded text-slate-900 placeholder-slate-400 focus:outline-none focus:border-eprom-blue focus:ring-1 focus:ring-eprom-blue transition-all min-h-[120px]"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            required
                        />
                    </div>

                    <div className="mb-5">
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Supporting Imagery</label>
                        <div className="flex items-center gap-4">
                            <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded text-xs font-bold uppercase transition-colors">
                                Upload Image
                                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                            </label>
                            {coverImage && <span className="text-xs text-green-600 font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Image Attached</span>}
                        </div>
                        {coverImage && (
                            <div className="mt-4 h-40 w-full md:w-1/2 overflow-hidden rounded border border-slate-200">
                                <img src={coverImage} className="w-full h-full object-cover" />
                            </div>
                        )}
                    </div>
                </Card>

                {/* Template Fields (Dynamic) */}
                {currentTemplate && (
                    <Card className="p-8 border-none shadow-lg">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Specific Data Points</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {currentTemplate.fields.map((field) => {
                                const commonProps = {
                                    key: field.id,
                                    label: field.label,
                                    required: field.required,
                                    value: dynamicData[field.id] || '',
                                    onChange: (e: any) => handleDynamicChange(field.id, field.type === 'checkbox' ? e.target.checked : e.target.value)
                                };

                                // Render different inputs based on field type
                                if (field.type === 'textarea') {
                                    return (
                                        <div key={field.id} className="col-span-1 md:col-span-2">
                                            <Textarea {...commonProps} />
                                        </div>
                                    );
                                } else if (field.type === 'select' && field.options) {
                                    return <Select {...commonProps} options={field.options} />;
                                } else if (field.type === 'checkbox') {
                                    return (
                                        <div key={field.id} className="flex items-center h-full pt-6">
                                            <label className="flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={!!dynamicData[field.id]} 
                                                    onChange={(e) => handleDynamicChange(field.id, e.target.checked)} 
                                                    className="form-checkbox h-5 w-5 text-eprom-blue rounded border-slate-300 focus:ring-eprom-blue" 
                                                />
                                                <span className="ml-2 text-sm text-slate-700 font-medium">{field.label}</span>
                                            </label>
                                        </div>
                                    );
                                } else {
                                    // Default Text, Number, Date
                                    return <Input {...commonProps} type={field.type} />;
                                }
                            })}
                        </div>
                    </Card>
                )}

                <div className="flex justify-end pt-4">
                    <Button type="submit" className="px-10 py-3 text-sm shadow-xl bg-slate-900 hover:bg-slate-800">Submit Protocol</Button>
                </div>
            </form>
        </div>
    );
};

// 5. Admin / Control Room (Full Featured)
const AdminPanel = () => {
  const { settings, refreshSettings } = useAppContext();
  const [users, setUsers] = useState<User[]>([]);
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'settings' | 'forms'>('users');
  
  // Settings State
  const [newCat, setNewCat] = useState('');
  const [newDept, setNewDept] = useState('');

  // Form Builder State
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [newFields, setNewFields] = useState<FormField[]>([]);
  const [editingField, setEditingField] = useState<Partial<FormField>>({});

  // KPI Builder State
  const DEFAULT_KPIS: RatingDimension[] = [
    { id: 'impact', name: 'Impact on Business Goals', description: 'Reduces cost, increases revenue, improves safety.', weight: 30 },
    { id: 'feasibility', name: 'Feasibility', description: 'Ease of implementation (resources, time).', weight: 20 },
    { id: 'roi', name: 'Cost vs. Benefit', description: 'Estimated cost compared to expected benefits.', weight: 20 },
    { id: 'innovation', name: 'Innovation Level', description: 'New approach vs incremental improvement.', weight: 15 },
    { id: 'risk', name: 'Risk Level', description: 'Operational, financial, or safety risks (High Score = Low Risk).', weight: 15 }
  ];

  const [currentKPIs, setCurrentKPIs] = useState<RatingDimension[]>(DEFAULT_KPIS);
  const [newKPI, setNewKPI] = useState<Partial<RatingDimension>>({});

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
      setUsers(db.getUsers());
      setTemplates(db.getTemplates());
  };

  // User Management
  const handleUserApproval = (uid: string, role: UserRole) => {
    db.updateUserStatus(uid, UserStatus.ACTIVE, role);
    refreshData();
  };

  const handleUserReject = (uid: string) => {
    db.updateUserStatus(uid, UserStatus.REJECTED);
    refreshData();
  };

  const handleRoleChange = (uid: string, newRole: UserRole) => {
    db.updateUserRole(uid, newRole);
    refreshData();
  };

  // Settings Management
  const handleAddCategory = () => {
    if (newCat) {
      db.updateSettings({ ...settings, categories: [...settings.categories, newCat] });
      refreshSettings();
      setNewCat('');
    }
  };
  const handleAddDept = () => {
    if (newDept) {
      db.updateSettings({ ...settings, departments: [...settings.departments, newDept] });
      refreshSettings();
      setNewDept('');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        try {
            const base64 = await db.fileToBase64(e.target.files[0]);
            const newSettings = { ...settings, logoUrl: base64 };
            db.updateSettings(newSettings);
            refreshSettings();
        } catch (err) {
            alert("Logo upload failed");
        }
    }
  };

  // Form Builder Logic
  const addFieldToTemplate = () => {
      if(!editingField.label || !editingField.type) return;
      
      const newField: FormField = {
          id: editingField.label.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now(),
          label: editingField.label,
          type: editingField.type as any,
          required: editingField.required || false,
          options: editingField.options ? (editingField.options as any).split(',') : undefined
      };
      setNewFields([...newFields, newField]);
      setEditingField({});
  };

  const addKPI = () => {
    if (!newKPI.name || !newKPI.weight) return;
    const k: RatingDimension = {
        id: (newKPI.name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now()).substring(0, 15),
        name: newKPI.name,
        description: newKPI.description || '',
        weight: Number(newKPI.weight)
    };
    setCurrentKPIs([...currentKPIs, k]);
    setNewKPI({});
  };

  const removeKPI = (id: string) => {
      setCurrentKPIs(currentKPIs.filter(k => k.id !== id));
  };
  
  const resetKPIs = () => setCurrentKPIs(DEFAULT_KPIS);
  const totalWeight = currentKPIs.reduce((sum, k) => sum + k.weight, 0);

  const handleEditTemplate = (t: FormTemplate) => {
      setEditingTemplateId(t.id);
      setNewTemplateName(t.name);
      setNewTemplateDesc(t.description);
      setNewFields(t.fields);
      setCurrentKPIs(t.ratingConfig || []);
      // Scroll to builder
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
      setEditingTemplateId(null);
      setNewTemplateName('');
      setNewTemplateDesc('');
      setNewFields([]);
      setCurrentKPIs(DEFAULT_KPIS);
  };

  const saveTemplate = () => {
      if(!newTemplateName || newFields.length === 0) return;
      
      const t: FormTemplate = {
          id: editingTemplateId || Date.now().toString(),
          name: newTemplateName,
          description: newTemplateDesc,
          fields: newFields,
          ratingConfig: currentKPIs,
          isActive: true
      };
      db.saveTemplate(t);
      
      // Reset
      handleCancelEdit();
      refreshData();
  };
  
  const deleteTemplate = (id: string) => {
      if (confirm("Are you sure you want to delete this protocol? Existing ideas may lose structural references.")) {
        db.deleteTemplate(id);
        refreshData();
      }
  }

  // Helper for pending user row
  const PendingUserRow = ({ u }: { u: User }) => {
      const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.EMPLOYEE);
      return (
        <tr className="hover:bg-amber-50 transition-colors bg-amber-50 border-l-4 border-amber-400">
            <td className="px-6 py-4 font-bold text-slate-800">{u.username}</td>
            <td className="px-6 py-4 text-slate-600">{u.email}</td>
            <td className="px-6 py-4 text-slate-600">{u.department}</td>
            <td className="px-6 py-4">
                <select 
                    value={selectedRole} 
                    onChange={e => setSelectedRole(e.target.value as UserRole)}
                    className="bg-white border border-slate-300 text-slate-800 text-xs rounded p-1"
                >
                    <option value={UserRole.EMPLOYEE}>Employee</option>
                    <option value={UserRole.MANAGER}>Manager</option>
                    <option value={UserRole.ADMIN}>Admin</option>
                </select>
            </td>
            <td className="px-6 py-4">
                <div className="flex space-x-2">
                    <Button variant="ghost" onClick={() => handleUserApproval(u.id, selectedRole)} className="text-green-600 hover:text-green-700 text-xs px-2 py-1 uppercase font-bold">Approve</Button>
                    <Button variant="ghost" onClick={() => handleUserReject(u.id)} className="text-red-600 hover:text-red-700 text-xs px-2 py-1 uppercase font-bold">Reject</Button>
                </div>
            </td>
        </tr>
      );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-24 fade-in">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Control Room</h1>
        <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            <span className="text-xs font-bold text-red-500 uppercase tracking-widest">Admin Privileges Active</span>
        </div>
      </div>
      
      <div className="flex space-x-8 mb-10 border-b border-slate-200">
        <button onClick={() => setActiveTab('users')} className={`pb-4 px-1 font-bold text-sm uppercase tracking-wider transition-all relative ${activeTab === 'users' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>
            Personnel
            {activeTab === 'users' && <span className="absolute bottom-0 left-0 w-full h-[3px] bg-slate-900"></span>}
        </button>
        <button onClick={() => setActiveTab('forms')} className={`pb-4 px-1 font-bold text-sm uppercase tracking-wider transition-all relative ${activeTab === 'forms' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>
            Protocol Builder
            {activeTab === 'forms' && <span className="absolute bottom-0 left-0 w-full h-[3px] bg-slate-900"></span>}
        </button>
        <button onClick={() => setActiveTab('settings')} className={`pb-4 px-1 font-bold text-sm uppercase tracking-wider transition-all relative ${activeTab === 'settings' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>
            System Config
            {activeTab === 'settings' && <span className="absolute bottom-0 left-0 w-full h-[3px] bg-slate-900"></span>}
        </button>
      </div>

      {activeTab === 'users' && (
        <Card className="overflow-hidden border-none shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 uppercase text-xs font-bold text-slate-500 tracking-wider">
                <tr>
                  <th className="px-6 py-4">Username</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.filter(u => u.status === UserStatus.PENDING).map(u => (
                    <PendingUserRow key={u.id} u={u} />
                ))}
                {users.filter(u => u.status === UserStatus.ACTIVE).map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">{u.username}</td>
                    <td className="px-6 py-4">{u.email}</td>
                    <td className="px-6 py-4">{u.department}</td>
                    <td className="px-6 py-4">
                        <select 
                            value={u.role} 
                            onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                            className="bg-transparent border border-slate-200 rounded p-1 text-slate-700 focus:bg-white focus:border-slate-900 text-xs uppercase font-bold"
                        >
                             <option value={UserRole.EMPLOYEE}>Employee</option>
                             <option value={UserRole.MANAGER}>Manager</option>
                             <option value={UserRole.ADMIN}>Admin</option>
                             <option value={UserRole.GUEST}>Guest</option>
                        </select>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex items-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2"></div>
                            <span className="text-xs uppercase text-emerald-600 font-bold tracking-wider">Active</span>
                        </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'forms' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* List of Templates */}
              <div className="lg:col-span-1 space-y-4">
                  <h3 className="text-lg font-bold text-slate-900 mb-4 uppercase tracking-wide">Active Protocols</h3>
                  {templates.map(t => (
                      <Card key={t.id} className={`p-5 border-l-4 transition-all hover:shadow-lg cursor-pointer ${editingTemplateId === t.id ? 'border-l-blue-500 bg-blue-50' : 'border-l-slate-900 bg-white'}`}>
                          <div className="flex justify-between items-start">
                              <div onClick={() => handleEditTemplate(t)} className="flex-1">
                                  <div className="font-bold text-slate-900 text-sm">{t.name}</div>
                                  <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider">{t.fields.length} Data Points</div>
                                  <div className="text-[10px] text-slate-900 mt-2 font-bold uppercase">
                                      {t.ratingConfig ? `${t.ratingConfig.length} Evaluators` : 'Default KPIs'}
                                  </div>
                              </div>
                              <div className="flex flex-col gap-1">
                                <button className="text-blue-600 hover:text-blue-800 transition-colors text-xs uppercase font-bold" onClick={() => handleEditTemplate(t)}>Edit</button>
                                <button className="text-red-500 hover:text-red-700 transition-colors text-xs uppercase font-bold" onClick={() => deleteTemplate(t.id)}>Delete</button>
                              </div>
                          </div>
                      </Card>
                  ))}
              </div>

              {/* Builder */}
              <Card className="lg:col-span-2 p-8 border-none shadow-lg">
                  <div className="flex justify-between items-center mb-8">
                      <h3 className="text-lg font-bold text-slate-900 uppercase tracking-wide flex items-center">
                          <span className={`w-2 h-2 rounded-full mr-3 ${editingTemplateId ? 'bg-blue-500' : 'bg-slate-900'}`}></span>
                          {editingTemplateId ? 'Modify Existing Protocol' : 'New Protocol Configuration'}
                      </h3>
                      {editingTemplateId && (
                          <button onClick={handleCancelEdit} className="text-xs text-slate-500 hover:text-slate-900 uppercase font-bold">Cancel Edit</button>
                      )}
                  </div>
                  
                  <div className="mb-8 grid grid-cols-2 gap-6">
                      <Input label="Protocol Name" value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} placeholder="e.g. Safety Incident Report" />
                      <Input label="Description" value={newTemplateDesc} onChange={e => setNewTemplateDesc(e.target.value)} placeholder="Short operational summary..." />
                  </div>

                  {/* Field Builder */}
                  <div className="bg-slate-50 p-6 rounded border border-slate-200 mb-8">
                      <h4 className="text-xs font-bold text-slate-900 mb-6 uppercase tracking-widest border-b border-slate-200 pb-2">01 // Data Structure</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                          <Input label="Field Label" value={editingField.label || ''} onChange={e => setEditingField({...editingField, label: e.target.value})} placeholder="Label" />
                          <div className="mb-5">
                              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Data Type</label>
                              <select 
                                value={editingField.type || ''} 
                                onChange={e => setEditingField({...editingField, type: e.target.value as any})}
                                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded text-slate-900 appearance-none input-base"
                              >
                                  <option value="">Select Type</option>
                                  <option value="text">Short Text</option>
                                  <option value="textarea">Long Text</option>
                                  <option value="number">Numeric</option>
                                  <option value="select">Selector</option>
                                  <option value="checkbox">Boolean</option>
                                  <option value="date">Date</option>
                              </select>
                          </div>
                          {editingField.type === 'select' && (
                             <Input label="Options (CSV)" value={editingField.options as any || ''} onChange={e => setEditingField({...editingField, options: e.target.value as any})} placeholder="A, B, C" />
                          )}
                          <div className="mb-5 flex items-center h-10 bg-white px-3 rounded border border-slate-300">
                              <input type="checkbox" checked={editingField.required || false} onChange={e => setEditingField({...editingField, required: e.target.checked})} className="mr-3 text-slate-900 bg-slate-100 border-slate-300 rounded" />
                              <span className="text-xs text-slate-500 uppercase font-bold">Required</span>
                          </div>
                      </div>
                      <Button onClick={addFieldToTemplate} className="w-full mt-2 border border-dashed border-slate-300 bg-black hover:bg-slate-50 text-slate-500">+ Append Data Field</Button>
                      
                      {newFields.length > 0 && (
                        <div className="mt-6 space-y-2">
                            {newFields.map((f, idx) => (
                                <div key={idx} className="bg-white p-3 rounded flex justify-between items-center text-xs border border-slate-200 shadow-sm">
                                    <span><span className="font-bold text-slate-900 uppercase">{f.label}</span> <span className="text-slate-500 ml-2">[{f.type}]</span></span>
                                    <span className="text-[10px] text-slate-400 uppercase font-bold">{f.required ? 'REQ' : 'OPT'}</span>
                                    {/* Ability to remove field during build? keeping it simple for now */}
                                </div>
                            ))}
                        </div>
                      )}
                  </div>

                  {/* KPI Builder */}
                  <div className="bg-slate-50 p-6 rounded border border-slate-200 mb-8">
                      <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-2">
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest">02 // Evaluation Metrics</h4>
                        <div className={`text-xs font-bold uppercase tracking-wide ${totalWeight === 100 ? 'text-emerald-600' : 'text-red-500'}`}>Total Weight: {totalWeight}%</div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end mb-6">
                           <Input label="Metric Name" value={newKPI.name || ''} onChange={e => setNewKPI({...newKPI, name: e.target.value})} placeholder="e.g. ROI" />
                           <Input label="Description" value={newKPI.description || ''} onChange={e => setNewKPI({...newKPI, description: e.target.value})} placeholder="Context" />
                           <Input label="Weight (%)" type="number" value={newKPI.weight || ''} onChange={e => setNewKPI({...newKPI, weight: Number(e.target.value)})} placeholder="20" />
                           <Button onClick={addKPI} className="mb-5 bg-white hover:bg-slate-100 border-slate-300 text-slate-600">Add Metric</Button>
                      </div>

                      <div className="space-y-2">
                          {currentKPIs.map(kpi => (
                              <div key={kpi.id} className="bg-white p-3 rounded flex justify-between items-center text-xs border border-slate-200 shadow-sm">
                                  <div className="flex-1">
                                      <span className="font-bold text-slate-800 mr-3 uppercase">{kpi.name}</span>
                                      <span className="text-slate-500">{kpi.description}</span>
                                  </div>
                                  <div className="flex items-center gap-4">
                                      <Badge color="blue">{kpi.weight}%</Badge>
                                      <button onClick={() => removeKPI(kpi.id)} className="text-red-500 hover:text-red-700 transition-colors uppercase font-bold text-[10px]">Remove</button>
                                  </div>
                              </div>
                          ))}
                      </div>
                      
                      <div className="mt-6 text-right">
                          <button onClick={resetKPIs} className="text-[10px] text-slate-900 hover:text-slate-600 uppercase font-bold tracking-wider">Reset Defaults</button>
                      </div>
                  </div>
                  
                  <div className="flex justify-end pt-6 border-t border-slate-200">
                      <Button onClick={saveTemplate} variant="primary" className="px-10 py-3 shadow-lg bg-slate-900 text-white" disabled={totalWeight !== 100}>
                          {editingTemplateId ? 'Update Protocol' : 'Deploy Protocol'}
                      </Button>
                  </div>
              </Card>
          </div>
      )}

      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <Card className="p-8 border-none shadow-lg">
              <h3 className="font-bold text-lg mb-6 text-slate-900 uppercase tracking-wide">System Definitions</h3>
              
              {/* Branding Section */}
              <div className="mb-8 p-6 bg-slate-50 rounded border border-slate-200">
                 <label className="block text-xs font-bold mb-3 text-slate-500 uppercase tracking-wide">Brand Identity (Logo)</label>
                 <div className="flex items-center gap-4">
                    {settings.logoUrl && (
                        <div className="w-16 h-16 bg-white border border-slate-200 rounded flex items-center justify-center p-2">
                            <img src={settings.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                        </div>
                    )}
                    <input type="file" onChange={handleLogoUpload} accept="image/*" className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-bold file:uppercase file:bg-slate-900 file:text-white hover:file:bg-slate-800 transition-colors"/>
                 </div>
              </div>

              <div className="mb-8">
                <label className="block text-xs font-bold mb-3 text-slate-500 uppercase tracking-wide">Operational Categories</label>
                <div className="flex gap-3 mb-4">
                  <Input placeholder="New Category" value={newCat} onChange={e => setNewCat(e.target.value)} className="mb-0 flex-1" />
                  <Button onClick={handleAddCategory} className="whitespace-nowrap px-6">Add</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {settings.categories.map(c => <Badge key={c} color="gray">{c}</Badge>)}
                </div>
              </div>
              <div className="pt-6 border-t border-slate-200">
                <label className="block text-xs font-bold mb-3 text-slate-500 uppercase tracking-wide">Organization Units</label>
                 <div className="flex gap-3 mb-4">
                  <Input placeholder="New Department" value={newDept} onChange={e => setNewDept(e.target.value)} className="mb-0 flex-1" />
                  <Button onClick={handleAddDept} className="whitespace-nowrap px-6">Add</Button>
                </div>
                 <div className="flex flex-wrap gap-2">
                  {settings.departments.map(d => <Badge key={d} color="gray">{d}</Badge>)}
                </div>
              </div>
           </Card>
        </div>
      )}
    </div>
  );
};

// 6. Collaboration Hub
const CollaborationHub = () => {
    const { user } = useAppContext();
    const [collabIdeas, setCollabIdeas] = useState<Idea[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        const all = db.getIdeas();
        const filtered = all.filter(i => 
            (i.status === IdeaStatus.PUBLISHED || i.status === IdeaStatus.APPROVED) &&
            (i.dynamicData?.collab === true || (i as any).collaborationNeeded === true)
        );
        setCollabIdeas(filtered);
    }, []);

    const handleJoin = (idea: Idea) => {
        navigate('/submit', { state: { parentIdea: idea } });
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-24 fade-in">
            <div className="mb-10 border-b border-slate-200 pb-4">
                <h1 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">Collaboration Hub</h1>
                <p className="text-slate-500 text-sm mt-1 font-medium">Join forces on active initiatives needing cross-functional expertise.</p>
            </div>

            {collabIdeas.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-slate-400 uppercase tracking-widest text-sm">No active collaboration requests.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {collabIdeas.map(idea => (
                         <Card key={idea.id} className="flex flex-col h-full hover:border-blue-300 transition-colors border-l-4 border-l-blue-500 bg-white p-6 shadow-md">
                             <div className="flex-1">
                                 <div className="flex items-center justify-between mb-4">
                                     <Badge color="blue">{idea.department}</Badge>
                                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{new Date(idea.createdAt).toLocaleDateString()}</span>
                                 </div>
                                 <h3 className="text-xl font-bold text-slate-900 mb-2">{idea.title}</h3>
                                 <p className="text-sm text-slate-600 line-clamp-3 mb-4">{idea.description}</p>
                                 
                                 <div className="bg-slate-50 p-3 rounded text-xs border border-slate-100 mb-4">
                                     <span className="font-bold text-slate-700 block mb-1 uppercase text-[10px]">Author</span>
                                     <span className="text-slate-600">{idea.authorName}</span>
                                 </div>
                             </div>
                             <div className="pt-0 mt-auto">
                                 <Button onClick={() => handleJoin(idea)} variant="secondary" className="w-full text-xs uppercase border-blue-200 text-blue-700 hover:bg-blue-50">Contribute / Join</Button>
                             </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

// 7. Dashboard (Optimized)
const Dashboard = () => {
  const { user } = useAppContext();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [published, setPublished] = useState<Idea[]>([]);
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const navigate = useNavigate();

  // For managing modal/rating state
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  
  // Rating State
  const [ratingDetails, setRatingDetails] = useState<Record<string, number>>({});
  const [ratingComment, setRatingComment] = useState('');
  
  // Load templates to get KPI Config
  useEffect(() => {
      setTemplates(db.getTemplates());
  }, []);

  useEffect(() => {
    const all = db.getIdeas();
    setPublished(all.filter(i => i.status === IdeaStatus.PUBLISHED));

    if (user?.role === UserRole.EMPLOYEE) {
      setIdeas(all.filter(i => i.authorId === user.id));
    } else {
      setIdeas(all);
    }
  }, [user]);

  const handleEdit = (idea: Idea) => {
    navigate('/submit', { state: { idea } });
  };

  const handleStatusChange = (idea: Idea, status: IdeaStatus) => {
    const updated = { ...idea, status };
    db.saveIdea(updated);
    setIdeas(db.getIdeas()); // Refresh
  };

  // --- KPI Calculation Logic ---
  const getCurrentKPIs = (idea: Idea) => {
      const template = templates.find(t => t.id === idea.templateId);
      // Fallback if template deleted or legacy idea
      if(!template || !template.ratingConfig) {
          return [
            { id: 'impact', name: 'Impact on Business Goals', description: 'Reduces cost, increases revenue, improves safety.', weight: 30 },
            { id: 'feasibility', name: 'Feasibility', description: 'Ease of implementation.', weight: 20 },
            { id: 'roi', name: 'Cost vs. Benefit', description: 'ROI.', weight: 20 },
            { id: 'innovation', name: 'Innovation Level', description: 'New approach vs incremental.', weight: 15 },
            { id: 'risk', name: 'Risk Level', description: 'Operational risks.', weight: 15 }
          ];
      }
      return template.ratingConfig;
  };

  const calculateGrade = (kpis: RatingDimension[], details: Record<string, number>) => {
      let totalWeightedScore = 0;
      let totalMaxPossible = 0;

      kpis.forEach(kpi => {
          const score = details[kpi.id] || 1; // Default to 1 if not set
          totalWeightedScore += score * kpi.weight;
          totalMaxPossible += 5 * kpi.weight; // Max score is 5
      });

      const percentage = (totalWeightedScore / totalMaxPossible) * 100;

      let grade = 'F';
      if(percentage >= 80) grade = 'A';
      else if (percentage >= 60) grade = 'B';
      else if (percentage >= 40) grade = 'C';
      else grade = 'D';

      return { percentage: Math.round(percentage), grade };
  };

  const submitRating = () => {
    if (!selectedIdea || !user) return;
    
    const kpis = getCurrentKPIs(selectedIdea);
    const { percentage, grade } = calculateGrade(kpis, ratingDetails);
    
    const detailsArray = Object.entries(ratingDetails).map(([key, val]) => ({ dimensionId: key, score: val }));

    const newRating: Rating = {
      managerId: user.id,
      managerName: user.username,
      details: detailsArray,
      totalScore: 5 * (percentage / 100),
      percentage,
      grade,
      comment: ratingComment,
      createdAt: new Date().toISOString()
    };
    
    const updatedRatings = [
        ...selectedIdea.ratings.filter(r => r.managerId !== user.id), 
        newRating
    ];

    const updated = { 
        ...selectedIdea, 
        ratings: updatedRatings
    };
    
    db.saveIdea(updated);
    setIdeas(db.getIdeas());
    setSelectedIdea(null);
    setRatingDetails({});
    setRatingComment('');
  };

  const copyShareLink = (id: string) => {
      // Use pathname to ensure we include the repo name (e.g., /IDB-EPROM/) for GitHub Pages
      const baseUrl = window.location.href.split('#')[0];
      const url = `${baseUrl}#/view/${id}`;
      navigator.clipboard.writeText(url);
      alert("Shareable link copied to clipboard!");
  };

  const getStatusColor = (s: IdeaStatus) => {
    switch(s) {
      case IdeaStatus.PUBLISHED: return 'green';
      case IdeaStatus.APPROVED: return 'blue';
      case IdeaStatus.REJECTED: return 'red';
      case IdeaStatus.NEEDS_REVISION: return 'amber';
      case IdeaStatus.ARCHIVED: return 'gray';
      default: return 'gray';
    }
  };

  const renderDynamicSummary = (idea: Idea) => {
      const cost = idea.dynamicData?.['cost'] || (idea as any).estimatedCost || 'N/A';
      const feasibility = idea.dynamicData?.['feasibility'] || (idea as any).feasibility || 'N/A';
      const timeline = idea.dynamicData?.['timeline'] || (idea as any).timeline || 'N/A';

      const isDark = !!idea.coverImage;
      const textClass = isDark ? 'text-slate-300 drop-shadow-sm' : 'text-slate-500';
      const labelClass = isDark ? 'text-slate-400' : 'text-slate-400';
      const bgClass = isDark ? 'bg-white/10 border-white/10 backdrop-blur-sm' : 'bg-slate-50 border-slate-200';

      return (
         <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mb-6 p-5 rounded border ${bgClass} ${textClass}`}>
            <div><span className={`font-bold block uppercase mb-1 ${labelClass}`}>Author</span> {idea.authorName}</div>
            <div><span className={`font-bold block uppercase mb-1 ${labelClass}`}>Cost</span> {cost}</div>
            <div><span className={`font-bold block uppercase mb-1 ${labelClass}`}>Feasibility</span> {feasibility}</div>
            <div><span className={`font-bold block uppercase mb-1 ${labelClass}`}>Timeline</span> {timeline}</div>
         </div>
      );
  }

  // --- Rating Modal State Helper ---
  const currentReviewKPIs = selectedIdea ? getCurrentKPIs(selectedIdea) : [];
  const currentReviewStats = selectedIdea ? calculateGrade(currentReviewKPIs, ratingDetails) : { percentage: 0, grade: 'N/A' };

  return (
    <div className="max-w-7xl mx-auto px-4 py-24 fade-in">
      {/* Published Grid Section */}
      <div className="mb-16">
          <h2 className="text-sm font-bold text-slate-500 mb-6 flex items-center uppercase tracking-widest border-b border-slate-200 pb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-900 mr-3 animate-pulse"></span> 
              Live Intelligence Stream
          </h2>
          <div className="flex overflow-x-auto gap-6 pb-8 snap-x snap-mandatory">
              {published.length === 0 ? (
                  <div className="w-full p-8 text-slate-400 bg-slate-50 rounded border border-slate-200 text-xs uppercase tracking-wider text-center flex-shrink-0">No active intelligence streams.</div>
              ) : (
                  published.map(p => (
                      <div key={p.id} className="min-w-[85vw] md:min-w-[450px] flex-shrink-0 snap-center bg-slate-900 rounded-lg border border-slate-800 shadow-xl relative overflow-hidden group hover:border-eprom-accent transition-all h-[400px]">
                          {p.coverImage && (
                              <div className="absolute inset-0 z-0 bg-slate-950">
                                  <img src={p.coverImage} className="w-full h-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-110" />
                              </div>
                          )}
                          <div className="absolute inset-0 z-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
                          
                          <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                              <button onClick={() => copyShareLink(p.id)} className="text-[10px] bg-white text-slate-900 font-bold uppercase px-3 py-1 rounded shadow-lg">Share</button>
                          </div>

                          <div className="absolute inset-0 z-10 p-6 flex flex-col justify-end">
                              <div className="flex justify-between items-start mb-2">
                                  <Badge color="green" className="bg-emerald-500/20 text-emerald-300 border-none backdrop-blur">Live</Badge>
                                  {p.ratings.length > 0 && (
                                      <div className="px-2 py-0.5 rounded text-[10px] font-bold text-emerald-300 border border-emerald-500/30 bg-emerald-900/40 uppercase tracking-wide backdrop-blur">
                                          Grade {p.ratings[0].grade}
                                      </div>
                                  )}
                              </div>
                              <h4 className="font-bold text-white mb-2 text-xl leading-tight drop-shadow-xl" title={p.title}>{p.title}</h4>
                              <p className="text-xs text-slate-300 mb-4 line-clamp-3 leading-relaxed font-medium drop-shadow-md">{p.description}</p>
                              <div className="text-[10px] text-slate-400 pt-4 border-t border-white/10 flex justify-between uppercase tracking-wider font-bold">
                                  <span>{p.authorName}</span>
                                  <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                              </div>
                          </div>
                      </div>
                  ))
              )}
          </div>
      </div>

      <div className="flex justify-between items-center mb-10">
        <div>
           <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
             {user?.role === UserRole.EMPLOYEE ? 'Bank of Ideas' : 'Command Center'}
           </h1>
           <p className="text-slate-500 mt-1 text-sm uppercase tracking-wide">Active Initiatives Overview</p>
        </div>
        
        {user?.role === UserRole.EMPLOYEE && (
          <Button onClick={() => navigate('/submit')} className="shadow-lg bg-slate-900 text-white hover:bg-slate-800 px-6">+ New Record</Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {ideas.map(idea => (
          <Card key={idea.id} className={`h-full flex flex-col transition-all hover:border-slate-300 relative overflow-hidden ${idea.parentIdeaId ? 'border-l-4 border-l-purple-500' : ''} ${idea.coverImage ? 'bg-slate-950 border-none' : 'p-8'}`}>
            {idea.coverImage && (
                <>
                    <div className="absolute inset-0 z-0 bg-slate-950">
                         {/* Reduced opacity to 30% for darker background */}
                         <img src={idea.coverImage} className="w-full h-full object-cover opacity-30" />
                    </div>
                    {/* Stronger gradient overlay for better text contrast */}
                    <div className="absolute inset-0 z-0 bg-gradient-to-t from-black via-black/90 to-black/60" />
                </>
            )}

            <div className={`relative z-10 flex-1 flex flex-col justify-between ${idea.coverImage ? 'p-8' : ''}`}>
              <div className="flex-1 mb-6">
                 <div className="flex items-center gap-3 mb-4 flex-wrap">
                    <h3 className={`text-2xl font-bold tracking-tight leading-tight ${idea.coverImage ? 'text-white drop-shadow-md' : 'text-slate-900'}`}>{idea.title}</h3>
                    <Badge color={getStatusColor(idea.status)}>{idea.status}</Badge>
                    <Badge color="gray" className={idea.coverImage ? 'bg-white/10 text-white border-white/20 backdrop-blur-sm' : ''}>{idea.category}</Badge>
                    {idea.parentIdeaId && <Badge color="amber">Linked</Badge>}
                 </div>
                 <p className={`mb-6 leading-relaxed font-medium text-sm ${idea.coverImage ? 'text-slate-300 drop-shadow-sm' : 'text-slate-600'}`}>{idea.description}</p>
                 
                 {renderDynamicSummary(idea)}

                 {/* Ratings Display */}
                 {idea.ratings.length > 0 && (
                   <div className={`p-5 rounded border mb-4 shadow-sm ${idea.coverImage ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                     <p className="text-[10px] font-bold uppercase text-slate-400 mb-4 tracking-widest">Performance Metrics</p>
                     {idea.ratings.map((r, idx) => (
                       <div key={idx} className={`mb-4 last:mb-0 border-b last:border-0 pb-4 last:pb-0 ${idea.coverImage ? 'border-white/10' : 'border-slate-100'}`}>
                         <div className="flex justify-between items-center mb-2">
                            <span className={`font-bold text-sm ${idea.coverImage ? 'text-slate-200' : 'text-slate-700'}`}>{r.managerName}</span>
                            <div className="flex items-center gap-3">
                                <span className={`text-xl font-bold tracking-tight ${idea.coverImage ? 'text-white' : 'text-slate-900'}`}>{r.percentage}%</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                                    r.grade === 'A' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 
                                    r.grade === 'B' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 
                                    r.grade === 'C' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-red-100 text-red-700 border border-red-200'
                                }`}>Grade {r.grade}</span>
                            </div>
                         </div>
                         <p className="text-xs text-slate-500 italic line-clamp-2">"{r.comment}"</p>
                       </div>
                     ))}
                   </div>
                 )}
              </div>

              {/* Actions Area - Stacked vertically for grid layout */}
              <div className="flex flex-col gap-2 pt-4 border-t border-slate-200/10">
                {/* External Share Button for Everyone if active */}
                <Button variant="ghost" className={`w-full text-xs uppercase font-bold border ${idea.coverImage ? 'text-slate-300 border-slate-600 hover:text-white hover:bg-white/10' : 'border-slate-200 text-slate-500 hover:text-slate-900'}`} onClick={() => copyShareLink(idea.id)}>Get Link</Button>

                {(user?.role === UserRole.MANAGER) && (
                   <>
                     {idea.status === IdeaStatus.SUBMITTED && (
                        <div className="flex gap-2">
                          <Button variant="primary" className="flex-1 text-xs uppercase" onClick={() => handleStatusChange(idea, IdeaStatus.APPROVED)}>Approve</Button>
                          <Button variant="danger" className="flex-1 text-xs uppercase" onClick={() => handleStatusChange(idea, IdeaStatus.REJECTED)}>Reject</Button>
                        </div>
                     )}
                     {idea.status === IdeaStatus.SUBMITTED && (
                       <Button variant="secondary" className="w-full text-xs uppercase" onClick={() => handleStatusChange(idea, IdeaStatus.NEEDS_REVISION)}>Request Revision</Button>
                     )}
                     {idea.status === IdeaStatus.APPROVED && (
                        <Button variant="primary" className="w-full text-xs uppercase bg-emerald-600 hover:bg-emerald-500 border-none shadow-lg" onClick={() => handleStatusChange(idea, IdeaStatus.PUBLISHED)}>Go Live</Button>
                     )}
                     
                     {/* Manager actions for PUBLISHED ideas (Revert/Reject) */}
                     {idea.status === IdeaStatus.PUBLISHED && (
                        <div className="flex flex-col gap-2">
                            <div className="grid grid-cols-2 gap-2">
                                <Button variant="secondary" className="w-full text-xs uppercase border-red-200 text-red-600 hover:bg-red-50" onClick={() => handleStatusChange(idea, IdeaStatus.APPROVED)}>Unpublish</Button>
                                <Button variant="danger" className="w-full text-xs uppercase" onClick={() => handleStatusChange(idea, IdeaStatus.REJECTED)}>Reject</Button>
                            </div>
                            <Button variant="ghost" className={`w-full text-xs uppercase ${idea.coverImage ? 'text-slate-300 hover:bg-white/10' : ''}`} onClick={() => handleStatusChange(idea, IdeaStatus.NEEDS_REVISION)}>Send to Revision</Button>
                        </div>
                     )}

                     {/* Manager actions for REJECTED ideas */}
                     {idea.status === IdeaStatus.REJECTED && (
                        <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-slate-100/10">
                            <div className="text-[10px] font-bold text-red-500 uppercase tracking-widest text-center mb-1">REJECTED OPTIONS</div>
                            <Button variant="secondary" className="w-full text-xs uppercase" onClick={() => handleStatusChange(idea, IdeaStatus.NEEDS_REVISION)}>Request Revision</Button>
                            <Button variant="secondary" className="w-full text-xs uppercase" onClick={() => handleStatusChange(idea, IdeaStatus.SUBMITTED)}>Un-Reject (Re-open)</Button>
                            <Button variant="ghost" className="w-full text-xs uppercase text-slate-400 hover:text-slate-600" onClick={() => handleStatusChange(idea, IdeaStatus.ARCHIVED)}>Archive Record</Button>
                        </div>
                     )}
                     
                     {/* Manager actions for ARCHIVED ideas */}
                     {idea.status === IdeaStatus.ARCHIVED && (
                        <div className="flex flex-col gap-2">
                             <Button variant="secondary" className="w-full text-xs uppercase" onClick={() => handleStatusChange(idea, IdeaStatus.SUBMITTED)}>Restore from Archive</Button>
                        </div>
                     )}

                     {/* Evaluate button logic */}
                     {idea.status !== IdeaStatus.ARCHIVED && idea.status !== IdeaStatus.REJECTED && (
                        <Button variant="ghost" className={`w-full text-xs uppercase border ${idea.coverImage ? 'border-slate-600 text-slate-300 hover:text-white' : 'border-slate-200 text-slate-600'}`} onClick={() => {
                            setSelectedIdea(idea);
                            const existing = idea.ratings.find(r => r.managerId === user.id);
                            const initialDetails: Record<string, number> = {};
                            getCurrentKPIs(idea).forEach(k => {
                                initialDetails[k.id] = existing ? (existing.details.find(d => d.dimensionId === k.id)?.score || 1) : 3; 
                            });
                            setRatingDetails(initialDetails);
                            setRatingComment(existing?.comment || '');
                        }}>Evaluate</Button>
                     )}
                   </>
                )}

                {/* Employee Actions */}
                {user?.id === idea.authorId && (idea.status === IdeaStatus.DRAFT || idea.status === IdeaStatus.NEEDS_REVISION || idea.status === IdeaStatus.SUBMITTED) && (
                   <Button variant="secondary" className="w-full text-xs uppercase" onClick={() => handleEdit(idea)}>Edit Record</Button>
                )}
              </div>
            </div>
          </Card>
        ))}
        {ideas.length === 0 && <div className="col-span-full text-center text-slate-400 py-20 uppercase tracking-widest text-sm">System Idle.</div>}
      </div>

      {/* Advanced Rating Modal */}
      {selectedIdea && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <Card className="w-full max-w-2xl p-8 border-none shadow-2xl bg-white max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-8 border-b border-slate-100 pb-6">
                <div>
                    <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Evaluate Protocol</h3>
                    <p className="text-slate-500 text-xs uppercase tracking-wide mt-1">"{selectedIdea.title}"</p>
                </div>
                {/* Live Score Preview */}
                <div className="text-right">
                    <div className="text-4xl font-bold text-slate-900 tracking-tighter">{currentReviewStats.percentage}%</div>
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded inline-block uppercase tracking-wider mt-1 ${
                         currentReviewStats.grade === 'A' ? 'bg-emerald-100 text-emerald-700' : 
                         currentReviewStats.grade === 'B' ? 'bg-blue-100 text-blue-700' : 
                         currentReviewStats.grade === 'C' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                    }`}>Grade {currentReviewStats.grade}</div>
                </div>
              </div>

              <div className="space-y-6 mb-8">
                  {currentReviewKPIs.map(kpi => (
                      <div key={kpi.id} className="bg-slate-50 p-5 rounded border border-slate-200">
                          <div className="flex justify-between items-center mb-3">
                              <label className="font-bold text-slate-800 text-sm uppercase">{kpi.name}</label>
                              <span className="text-[10px] text-slate-900 font-bold bg-slate-200 px-2 py-1 rounded uppercase tracking-wide">{kpi.weight}% Impact</span>
                          </div>
                          <p className="text-xs text-slate-500 mb-4">{kpi.description}</p>
                          
                          <div className="flex items-center gap-6">
                              <input 
                                type="range" 
                                min="1" max="5" step="1"
                                value={ratingDetails[kpi.id] || 3}
                                onChange={(e) => setRatingDetails(prev => ({...prev, [kpi.id]: Number(e.target.value)}))}
                                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
                              />
                              <div className="text-2xl font-bold text-slate-900 w-8 text-center">{ratingDetails[kpi.id] || 3}</div>
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400 mt-2 px-1 uppercase font-bold tracking-wider">
                              <span>Minimal</span>
                              <span>Critical</span>
                          </div>
                      </div>
                  ))}
              </div>

              <div className="mb-8">
                <label className="block text-xs font-bold mb-3 text-slate-400 uppercase tracking-wide">Assessment Notes</label>
                <textarea className="w-full border border-slate-300 bg-white text-slate-900 rounded p-4 focus:border-slate-900 focus:outline-none placeholder-slate-400 min-h-[100px]" value={ratingComment} onChange={e => setRatingComment(e.target.value)} placeholder="ENTER JUSTIFICATION..."></textarea>
              </div>

              <div className="flex justify-end gap-4 pt-6 border-t border-slate-100">
                <Button variant="ghost" onClick={() => setSelectedIdea(null)} className="uppercase text-xs text-slate-500">Abort</Button>
                <Button onClick={submitRating} className="uppercase text-xs px-8 shadow-lg">Confirm Rating</Button>
              </div>
           </Card>
        </div>
      )}
      
      {/* Global AI Chat Assistant */}
      {user && <AIChat />}
    </div>
  );
};

// ... (Main App Logic remains mostly the same, only ensuring wrapper classes match new style) ...

const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<AppSettings>(db.getSettings());

  useEffect(() => {
    setUser(db.getCurrentUser());
  }, []);

  const login = async (u: string, p: string) => {
    // Simulate Async
    await new Promise(r => setTimeout(r, 500));
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
    </AppContext.Provider>
  );
};

const ProtectedRoute = ({ children, roles, excludedRoles }: { children: React.ReactElement, roles?: UserRole[], excludedRoles?: UserRole[] }) => {
  const { user } = useAppContext();
  
  if (!user) return <Navigate to="/auth" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  if (excludedRoles && excludedRoles.includes(user.role)) return <Navigate to="/admin" />; // Admin default redirect
  
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
                <ProtectedRoute excludedRoles={[UserRole.ADMIN]}>
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