import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useLocation, Navigate, Outlet } from 'react-router-dom';
import * as db from './services/storageService';
import { User, Idea, FormTemplate, IdeaStatus, UserRole, Rating, RatingDimension, AppSettings, FormField } from './types';
import { Badge, Button, Input, Textarea, Select, Card } from './components/Shared';
import { sendMessageToAI, ChatMode } from './services/aiService';
import { Content } from '@google/genai';

// --- Context Definition ---
interface AppContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType>({ user: null, login: async () => {}, logout: () => {}, isLoading: false });
const useAppContext = () => useContext(AppContext);

// --- Provider ---
const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const u = db.getCurrentUser();
    if (u) setUser(u);
    setIsLoading(false);
  }, []);

  const login = async (u: string, p: string) => {
    const user = db.loginUser(u, p);
    setUser(user);
  };

  const logout = () => {
    db.logoutUser();
    setUser(null);
  };

  return (
    <AppContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AppContext.Provider>
  );
};

// --- AIChat Component ---
const AIChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user'|'model', text: string}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
        const history: Content[] = messages.map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
        }));

        const response = await sendMessageToAI(history, userMsg, 'standard');
        setMessages(prev => [...prev, { role: 'model', text: response.text || "No response." }]);
    } catch (e) {
        setMessages(prev => [...prev, { role: 'model', text: "Error connecting to AI." }]);
    } finally {
        setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} className="fixed bottom-6 right-6 w-14 h-14 bg-slate-900 text-white rounded-full shadow-xl flex items-center justify-center hover:scale-105 transition-all z-50">
        <span className="text-2xl">✨</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-80 md:w-96 h-[500px] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col z-50 overflow-hidden font-sans">
      <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
        <h3 className="font-bold text-sm uppercase tracking-wider">AI Assistant</h3>
        <button onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-lg text-sm leading-relaxed ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white text-slate-800 border border-slate-200 shadow-sm'}`}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && <div className="text-xs text-slate-400 p-2 animate-pulse">Thinking...</div>}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-3 bg-white border-t border-slate-100 flex gap-2">
        <input 
          className="flex-1 bg-slate-100 border-none rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask a question..."
        />
        <button onClick={handleSend} disabled={loading} className="bg-slate-900 text-white px-3 rounded text-sm font-bold hover:bg-slate-800">Send</button>
      </div>
    </div>
  );
};

// --- Submit Idea Component ---
const SubmitIdea = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAppContext();
    const existingIdea = location.state?.idea as Idea | undefined;
    
    const [title, setTitle] = useState(existingIdea?.title || '');
    const [description, setDescription] = useState(existingIdea?.description || '');
    const [category, setCategory] = useState(existingIdea?.category || 'Innovation');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        
        const idea: Idea = {
            id: existingIdea?.id || Date.now().toString(),
            authorId: existingIdea?.authorId || user.id,
            authorName: existingIdea?.authorName || user.username,
            department: user.department,
            createdAt: existingIdea?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            title,
            description,
            category,
            templateId: existingIdea?.templateId || 'default-1',
            templateName: 'Standard',
            dynamicData: existingIdea?.dynamicData || {},
            tags: existingIdea?.tags || [],
            status: existingIdea?.status || IdeaStatus.DRAFT,
            ratings: existingIdea?.ratings || [],
            comments: existingIdea?.comments || []
        };
        db.saveIdea(idea);
        navigate('/');
    };

    return (
        <div className="max-w-3xl mx-auto py-12 px-4 fade-in">
             <Button onClick={() => navigate('/')} variant="ghost" className="mb-6">← Back to Dashboard</Button>
             <Card className="p-8">
                 <h1 className="text-2xl font-bold mb-6 text-slate-900">{existingIdea ? 'Edit Proposal' : 'New Innovation Proposal'}</h1>
                 <form onSubmit={handleSubmit} className="space-y-6">
                     <Input label="Title" value={title} onChange={e => setTitle(e.target.value)} required placeholder="E.g., Automated Safety Inspections" />
                     <Select label="Category" options={['Cost Reduction', 'Safety Improvement', 'Process Optimization', 'Innovation', 'Sustainability']} value={category} onChange={e => setCategory(e.target.value)} />
                     <Textarea label="Description" value={description} onChange={e => setDescription(e.target.value)} required rows={6} placeholder="Describe the current problem and your proposed solution..." />
                     <div className="flex justify-end pt-4">
                         <Button type="submit" variant="primary">Save Proposal</Button>
                     </div>
                 </form>
             </Card>
        </div>
    );
};

// --- Login Component ---
const Login = () => {
    const { login } = useAppContext();
    const [username, setUsername] = useState('j.doe');
    const [password, setPassword] = useState('password');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await login(username, password);
            navigate('/');
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 font-sans">
            <Card className="w-full max-w-md p-10">
                <div className="text-center mb-8">
                    <div className="w-12 h-12 bg-slate-900 rounded mx-auto mb-4 flex items-center justify-center text-white font-bold text-xl">E</div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">EPROM HUB</h1>
                    <p className="text-slate-500 text-sm mt-2">Sign in to access intelligence stream</p>
                </div>
                {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-6 text-xs font-bold border border-red-100">{error}</div>}
                <form onSubmit={handleLogin} className="space-y-4">
                    <Input label="Username" value={username} onChange={e => setUsername(e.target.value)} />
                    <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
                    <Button type="submit" className="w-full mt-4 shadow-lg">Enter Command Center</Button>
                </form>
                <div className="mt-6 text-center text-xs text-slate-400">
                    <p>Demo Accounts:</p>
                    <p>Admin: admin / password</p>
                    <p>Manager: manager / password</p>
                    <p>Employee: j.doe / password</p>
                </div>
            </Card>
        </div>
    );
};

// --- Dashboard Component (Optimized) ---
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

  // Carousel State
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  
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

  // Auto-scroll Carousel Effect
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || published.length === 0 || isPaused) return;

    const interval = setInterval(() => {
        const firstCard = container.firstElementChild as HTMLElement;
        if (!firstCard) return;
        
        // Calculate width of one item including gap (gap-6 = 24px)
        const itemWidth = firstCard.offsetWidth + 24; 
        const maxScroll = container.scrollWidth - container.clientWidth;
        
        // If we are at the end (or close enough), go back to start
        if (container.scrollLeft >= maxScroll - 10) { 
             container.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
             container.scrollBy({ left: itemWidth, behavior: 'smooth' });
        }
    }, 3000); // 3-second interval for readability

    return () => clearInterval(interval);
  }, [published, isPaused]);

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
          <div className="flex justify-between items-end mb-6 border-b border-slate-200 pb-2">
            <h2 className="text-sm font-bold text-slate-500 flex items-center uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-900 mr-3 animate-pulse"></span> 
                Live Intelligence Stream
            </h2>
            {isPaused && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">Stream Paused</span>}
          </div>
          
          <div 
            ref={scrollContainerRef}
            className="flex overflow-x-auto gap-6 pb-8 snap-x snap-mandatory scroll-smooth"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
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

// --- Protected Layout Wrapper ---
const ProtectedLayout = () => {
    const { user, isLoading } = useAppContext();
    
    if (isLoading) return <div className="h-screen flex items-center justify-center text-slate-400 uppercase tracking-widest text-xs">Initializing Secure Connection...</div>;
    
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="min-h-screen bg-eprom-bg text-eprom-text font-sans selection:bg-eprom-accent selection:text-white">
            <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-40 h-16 flex items-center px-6 justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-900 rounded flex items-center justify-center text-white font-bold">E</div>
                    <span className="font-bold text-slate-900 tracking-tight">EPROM HUB</span>
                </div>
                <div className="flex items-center gap-4">
                     <div className="text-right hidden md:block">
                        <div className="text-xs font-bold text-slate-900">{user.username}</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider">{user.role} | {user.department}</div>
                     </div>
                     <Button variant="ghost" onClick={() => db.logoutUser() || window.location.reload()} className="text-xs uppercase border border-slate-200">Logout</Button>
                </div>
            </header>
            <main className="pt-16">
                <div className="fixed inset-0 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 z-0"></div>
                <div className="relative z-10">
                   <Outlet />
                </div>
            </main>
        </div>
    );
};

// --- Main App Entry ---
export default function App() {
  return (
    <Router>
      <AppProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedLayout />}>
             <Route index element={<Dashboard />} />
             <Route path="submit" element={<SubmitIdea />} />
             <Route path="view/:id" element={<div className="p-10 text-center text-slate-500">Public Access View (Secure Link)</div>} />
          </Route>
        </Routes>
      </AppProvider>
    </Router>
  );
}