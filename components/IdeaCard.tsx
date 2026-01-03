import React, { useState, useEffect, useMemo, ReactNode } from 'react';
import { 
  Briefcase, User, AlertTriangle, Link as LinkIcon, CheckCircle, 
  Copy, Pencil, Trash2, Globe, Share2, Printer, Loader2, Zap, 
  BookOpen, Star, MessageSquare, Send, Target, UserPlus
} from 'lucide-react';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { COLLECTIONS, STATUS, APP_ID } from '../constants';
import { Button, Badge, Modal } from './UI';
import { callGemini } from '../services/gemini';
import { getDocRef } from '../App'; // Helper import
import { RatingDetail, RatingSummary } from '../types';

const getCollection = (name: string) => collection(db, 'artifacts', APP_ID, 'public', 'data', name);

const getDirectLink = (url: string) => {
  if (!url) return '';
  if (url.startsWith('data:image')) return url;
  if (url.includes('drive.google.com') && url.includes('/d/')) {
    const id = url.match(/\/d\/(.*?)\//)?.[1] || url.match(/\/d\/(.*?)($|\?)/)?.[1];
    if (id) return `https://lh3.googleusercontent.com/d/${id}`;
  }
  return url;
};

const getIdeaTitle = (idea: any) => {
  if (!idea) return "Untitled";
  return idea.formData?.["Initiative Title"] || idea.formData?.["Title"] || idea.formTitle;
};

const calculateAverageRating = (idea: any) => {
  if (idea.ratings && Object.keys(idea.ratings).length > 0) {
    const ratings: any[] = Object.values(idea.ratings);
    const total = ratings.reduce((sum, r) => sum + r.percentage, 0);
    const avgPct = Math.round(total / ratings.length);
    
    let grade = 'F';
    if (avgPct >= 80) grade = 'A';
    else if (avgPct >= 60) grade = 'B';
    else if (avgPct >= 40) grade = 'C';
    else grade = 'D';
    
    const kpiSums: any = {};
    const kpiCounts: any = {};
    
    ratings.forEach(r => {
      if(r.details) {
        r.details.forEach((d: any) => {
          kpiSums[d.label] = (kpiSums[d.label] || 0) + d.score;
          kpiCounts[d.label] = (kpiCounts[d.label] || 0) + 1;
        });
      }
    });
    
    const averagedDetails = Object.keys(kpiSums).map(label => ({
       label,
       score: parseFloat((kpiSums[label] / kpiCounts[label]).toFixed(1))
    }));

    return { percentage: avgPct, grade, count: ratings.length, details: averagedDetails };
  }
  if (idea.rating && !idea.ratings) return idea.rating;
  return null;
};

const renderFormValue = (value: any): ReactNode => {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string' && value.startsWith('data:image')) {
    return <img src={value} alt="Attachment" className="max-w-full h-48 object-contain rounded-sm border mt-2" />;
  }
  return String(value);
};

const generatePDF = (idea: any, analysisText = '') => {
  if (!window.html2pdf) {
    alert("System initializing... please try again in 5 seconds.");
    return;
  }

  const element = document.createElement('div');
  const displayTitle = getIdeaTitle(idea);
  const effectiveRating = calculateAverageRating(idea);
  
  let evaluationHtml = '';
  if (effectiveRating) {
    evaluationHtml = `
      <div style="margin-top: 30px; margin-bottom: 30px; border: 1px solid #94a3b8; border-radius: 4px; padding: 20px; background-color: #f1f5f9;">
        <h3 style="font-size: 14px; font-weight: bold; color: #0f172a; margin-top: 0; margin-bottom: 15px; border-bottom: 2px solid #334155; padding-bottom: 5px; text-transform: uppercase;">Technical Evaluation (Average)</h3>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
           <span style="font-size: 18px; font-weight: bold; color: #0f172a;">Grade: ${effectiveRating.grade}</span>
           <span style="font-size: 14px; color: #475569;">Feasibility Score: ${effectiveRating.percentage}% ${effectiveRating.count ? `(${effectiveRating.count} reviews)` : ''}</span>
        </div>
      </div>
    `;
  }

  const analysisHtml = analysisText ? `
    <div style="background-color: #f0fdf4; padding: 15px; border-radius: 4px; border-left: 4px solid #15803d; margin-bottom: 30px;">
      <h3 style="font-size: 14px; font-weight: bold; color: #14532d; margin-top: 0; margin-bottom: 8px; text-transform: uppercase;">AI Executive Summary</h3>
      <div style="font-size: 12px; line-height: 1.6; color: #14532d; white-space: pre-wrap; font-family: 'Courier New', Courier, monospace;">${analysisText}</div>
    </div>
  ` : '';

  element.innerHTML = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto;">
      <div style="border-bottom: 4px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="font-size: 24px; font-weight: 900; margin: 0; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px;">Operational Improvement Proposal</h1>
          <p style="margin: 5px 0 0; color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Internal Document • Confidential • EPROM</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-size: 11px; color: #64748b; font-family: monospace;">Ref ID: ${idea.publicId || idea.id.slice(0, 6).toUpperCase()}</p>
          <p style="margin: 0; font-size: 11px; color: #64748b;">${new Date().toLocaleDateString()}</p>
        </div>
      </div>
      
      <div style="background-color: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; margin-bottom: 30px;">
        <h2 style="font-size: 20px; font-weight: bold; color: #0f172a; margin-top: 0;">${displayTitle}</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px; font-size: 12px;">
          <div><span style="color:#64748b; text-transform:uppercase; font-size:10px; font-weight:bold;">Proposer</span><br/>${idea.employeeName}</div>
          <div><span style="color:#64748b; text-transform:uppercase; font-size:10px; font-weight:bold;">Department</span><br/>${idea.mainDepartment}</div>
        </div>
      </div>
      ${analysisHtml}
      ${evaluationHtml}
      <div style="margin-bottom: 30px;">
        ${Object.entries(idea.formData).map(([k, v]) => `
            <div style="margin-bottom: 20px; page-break-inside: avoid;">
              <h3 style="font-size: 11px; font-weight: bold; color: #475569; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px;">${k}</h3>
              <div style="font-size: 13px; line-height: 1.5; color: #334155; white-space: pre-wrap;">${Array.isArray(v) ? v.join(', ') : (typeof v === 'string' && v.startsWith('data:image') ? 'Image Attachment' : v)}</div>
            </div>
          `).join('')}
      </div>
    </div>
  `;

  const opt = {
    margin: 0.5,
    filename: `EPROM-Proposal-${getIdeaTitle(idea).replace(/\s+/g, '-')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
  };

  window.html2pdf().set(opt).from(element).save();
};

const RatingSystem = ({ idea, onRate, kpis, currentUser }: any) => {
  const [scores, setScores] = useState<any>({});

  useEffect(() => {
    const myRating = idea.ratings?.[currentUser.id];
    if (myRating && myRating.details) {
       const initialScores: any = {};
       myRating.details.forEach((d: any) => initialScores[d.label] = d.score);
       setScores(initialScores);
    } else {
       setScores({});
    }
  }, [idea, currentUser.id]);

  const handleScoreChange = (label: string, val: string) => {
    setScores((prev: any) => ({ ...prev, [label]: parseInt(val) }));
  };

  const calculateGrade = () => {
    let totalWeightedScore = 0;
    const details: RatingDetail[] = [];
    kpis.forEach((kpi: any) => {
      const score = scores[kpi.label] || 0;
      const weightedContribution = (score / 5) * kpi.weight;
      totalWeightedScore += weightedContribution;
      details.push({ label: kpi.label, weight: kpi.weight, score });
    });
    const percentage = Math.round(totalWeightedScore);
    let grade = 'F';
    if (percentage >= 80) grade = 'A';
    else if (percentage >= 60) grade = 'B';
    else if (percentage >= 40) grade = 'C';
    else grade = 'D';
    return { grade, percentage, details };
  };

  const submitRating = () => {
    onRate(idea.id, calculateGrade());
  };

  const currentResult = calculateGrade();

  return (
    <div className="bg-white border border-slate-200 rounded-sm p-6 mb-6 shadow-sm">
      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-100 pb-2">
        <Target className="w-4 h-4 text-sky-600" /> Technical Evaluation
      </h4>
      <div className="space-y-6">
        {kpis.map((kpi: any, idx: number) => (
          <div key={idx} className="flex flex-col gap-2">
            <div className="flex justify-between items-end">
               <span className="text-sm font-bold text-slate-800">{kpi.label}</span>
               <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono font-bold">Weight: {kpi.weight}%</span>
            </div>
            <div className="relative pt-1">
              <input 
                type="range" min="1" max="5" step="1"
                value={scores[kpi.label] || 0} 
                onChange={(e) => handleScoreChange(kpi.label, e.target.value)}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-700"
              />
              <div className="flex justify-between text-[9px] uppercase font-bold text-slate-400 mt-1">
                 <span>Ineffective (1)</span><span>Optimal (5)</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
        <div>
           <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">My Score</div>
           <div className="text-3xl font-black text-sky-700">{currentResult.percentage}% <span className="text-lg text-slate-400 font-medium">({currentResult.grade})</span></div>
        </div>
        <Button onClick={submitRating}>Save My Rating</Button>
      </div>
    </div>
  );
};

export const IdeaCard = ({ idea, isManager, canApprove, onStatus, onComment, onUpdateComment, isEmployeeView, onEditIdea, onDeleteIdea, currentUser, onTogglePublic, onRate, kpis, onJoinTeam, onCollaborate }: any) => {
  const [comment, setComment] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(idea.aiSummary || null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copying, setCopying] = useState(false);
  const [groupPeers, setGroupPeers] = useState<any[]>([]);
  const [roadmap, setRoadmap] = useState(idea.implementationPlan || null);

  useEffect(() => {
    if (showModal && isManager && idea.collaborationGroupId && idea.status === STATUS.PENDING) {
       const fetchPeers = async () => {
          try {
            const q = query(getCollection(COLLECTIONS.IDEAS), where('collaborationGroupId', '==', idea.collaborationGroupId));
            const snap = await getDocs(q);
            const peers = snap.docs.map(d => ({id: d.id, ...d.data()})).filter(d => d.id !== idea.id);
            setGroupPeers(peers);
          } catch(e) { console.error("Error fetching group peers", e); }
       };
       fetchPeers();
    }
  }, [showModal, isManager, idea.collaborationGroupId, idea.status, idea.id]);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    const content = Object.entries(idea.formData || {}).map(([k,v]) => `${k}: ${v}`).join('\n');
    const prompt = `Act as a Petroleum Engineering Consultant. Analyze this proposal titled "${idea.formTitle}". \n\nCONTENT:\n${content}\n\nPROVIDE:\n1. Executive Summary\n2. Operational Benefits (Efficiency/Cost)\n3. HSE Risk Analysis`;
    const analysis = await callGemini(prompt);
    await updateDoc(getDocRef(COLLECTIONS.IDEAS, idea.id), { aiSummary: analysis });
    setAiAnalysis(analysis);
    setIsAnalyzing(false);
  };

  const handleGenerateRoadmap = async () => {
    setIsAnalyzing(true);
    const prompt = `Create a 5-step high-level implementation roadmap for this Oil & Gas initiative: ${idea.formTitle}. Context: ${JSON.stringify(idea.formData).substring(0, 500)}. Format as bullet points with timelines.`;
    const result = await callGemini(prompt);
    await updateDoc(getDocRef(COLLECTIONS.IDEAS, idea.id), { implementationPlan: result });
    setRoadmap(result);
    setIsAnalyzing(false);
  };

  const handleShare = () => {
    setCopying(true);
    const link = `${window.location.origin}${window.location.pathname}?share=${idea.id}`;
    const textArea = document.createElement("textarea");
    textArea.value = link;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      alert("Secure Guest Link copied to clipboard.");
    } catch (err) {
      prompt("Copy this link manually:", link);
    }
    document.body.removeChild(textArea);
    setCopying(false);
  };

  const isCollaborator = idea.collaborators?.some((c: any) => c.id === currentUser?.id);
  const isOwner = idea.employeeId === currentUser?.id;
  const publicId = idea.publicId || "N/A";
  const displayTitle = getIdeaTitle(idea);
  
  const averageRating = useMemo(() => calculateAverageRating(idea), [idea]);

  return (
    <>
    <div onClick={() => setShowModal(true)} className={`bg-white rounded-sm shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer group flex flex-col h-full border ${idea.duplicateFlag ? 'border-amber-400' : 'border-slate-200'}`}>
      <div className="h-40 w-full bg-slate-100 relative overflow-hidden shrink-0">
         {idea.coverImage ? (
            <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style={{ backgroundImage: `url(${getDirectLink(idea.coverImage)})` }}></div>
         ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
               <Briefcase className="w-12 h-12 text-slate-400 opacity-50" />
            </div>
         )}
         <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
         <div className="absolute bottom-3 left-4 right-4">
            <h4 className="font-bold text-white text-lg leading-tight truncate shadow-sm font-sans">{displayTitle}</h4>
            <div className="flex items-center gap-2 mt-1">
               <span className="text-[10px] font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1"><User className="w-3 h-3" /> {idea.employeeName}</span>
            </div>
         </div>
         <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-md text-white text-[9px] font-mono px-2 py-1 rounded-sm border border-white/20">
            ID: {publicId}
         </div>
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex flex-wrap items-center gap-2 mb-3">
           <Badge status={idea.status} isPublic={idea.isPublic} rating={averageRating} isCollab={!!idea.collaborationGroupId} />
           {idea.duplicateFlag && (
                <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-sm flex items-center gap-1 border border-amber-200 uppercase tracking-wide">
                  <AlertTriangle className="w-3 h-3" /> Duplicate Risk
                </span>
           )}
        </div>
        
        <div className="flex-1">
           <div className="text-xs text-slate-500 font-medium line-clamp-3 leading-relaxed mb-4">
              {(Object.values(idea.formData || {}).find(val => typeof val === 'string' && (val as string).length > 50) as string) || "Click to view full proposal details..."}
           </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-medium mt-auto">
           <span className="flex items-center gap-1">{idea.mainDepartment}</span>
           <span className="font-mono">{new Date(idea.submittedAt).toLocaleDateString()}</span>
        </div>
      </div>
    </div>

    <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={displayTitle}>
        <div className="mb-8 pb-6 border-b border-slate-200">
           {idea.coverImage && (
              <div className="mb-6 rounded-sm overflow-hidden h-48 w-full relative border border-slate-200">
                 <img src={getDirectLink(idea.coverImage)} alt="Cover" className="w-full h-full object-cover" />
              </div>
           )}

           {isManager && idea.collaborationGroupId && idea.status === STATUS.PENDING && (
             <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 mb-6 animate-fade-in shadow-sm">
                <div className="flex items-start gap-4">
                   <div className="bg-white p-2 rounded-full border border-indigo-100"><LinkIcon className="w-5 h-5 text-indigo-600" /></div>
                   <div className="flex-1">
                      <h4 className="text-sm font-bold text-indigo-900 uppercase tracking-wide">Collaboration Request</h4>
                      <p className="text-xs text-indigo-800 mt-1 leading-relaxed">
                        This proposal requests to join Collaboration Group <strong>{idea.collaborationGroupId.slice(0,8)}...</strong>
                      </p>
                   </div>
                </div>
             </div>
           )}

           <div className="flex flex-col md:flex-row justify-between gap-6">
             <div className="bg-slate-100 p-4 rounded-sm border border-slate-200 flex-1">
                <div className="grid grid-cols-2 gap-4 text-xs">
                   <div>
                      <span className="block text-slate-400 uppercase font-bold tracking-wider mb-1 text-[10px]">Proposer</span>
                      <span className="font-bold text-slate-800">{idea.employeeName}</span>
                   </div>
                   <div>
                      <span className="block text-slate-400 uppercase font-bold tracking-wider mb-1 text-[10px]">Department</span>
                      <span className="font-bold text-slate-800">{idea.mainDepartment}</span>
                   </div>
                   <div className="col-span-2">
                      <span className="block text-slate-400 uppercase font-bold tracking-wider mb-1 text-[10px]">Unique Reference ID</span>
                      <span className="font-bold text-slate-800 font-mono text-sm bg-white px-2 py-1 rounded border border-slate-200 inline-flex items-center gap-2">
                        {publicId}
                        <button onClick={() => {navigator.clipboard.writeText(publicId); alert("ID Copied")}} title="Copy ID" className="text-slate-400 hover:text-sky-600"><Copy className="w-3 h-3" /></button>
                      </span>
                   </div>
                   {idea.collaborationGroupId && (
                    <div className="col-span-2">
                      <span className="block text-slate-400 uppercase font-bold tracking-wider mb-1 text-[10px]">Collaboration Group</span>
                      <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-200 text-xs flex items-center gap-1 w-fit">
                        <LinkIcon className="w-3 h-3" /> {idea.collaborationGroupId.slice(0, 8)}...
                      </span>
                    </div>
                   )}
                </div>
             </div>
             
             <div className="flex flex-col gap-2 min-w-[180px]">
                {isEmployeeView && isOwner && (
                  <div className="grid grid-cols-2 gap-2">
                   <Button variant="secondary" onClick={() => { onEditIdea(idea); setShowModal(false); }} className="h-9 text-xs">
                     <Pencil className="w-3 h-3 mr-1.5" /> Revise
                   </Button>
                   <Button variant="danger" onClick={() => { if(confirm("Are you sure you want to withdraw this proposal?")) onDeleteIdea(idea.id); }} className="h-9 text-xs">
                     <Trash2 className="w-3 h-3 mr-1.5" /> Withdraw
                   </Button>
                  </div>
                )}

                {isManager && (
                  <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100">
                     <Button variant="secondary" onClick={() => onEditIdea(idea)} className="h-8 text-xs">
                       <Pencil className="w-3 h-3 mr-1" /> Edit
                     </Button>
                     <Button variant="danger" onClick={() => { if(confirm("Delete this approved proposal? This action cannot be undone.")) onDeleteIdea(idea.id); }} className="h-8 text-xs">
                       <Trash2 className="w-3 h-3 mr-1" /> Delete
                     </Button>
                  </div>
                )}

                {onCollaborate && !isOwner && (
                  <Button variant="ai" onClick={() => onCollaborate(idea.publicId || idea.id)} className="h-9 text-xs">
                    <LinkIcon className="w-4 h-4 mr-1.5" /> Submit Related Idea
                  </Button>
                )}
                
                {onJoinTeam && !isOwner && !isCollaborator && (
                  <Button variant="secondary" onClick={() => onJoinTeam(idea.id)} className="h-9 text-xs">
                    <UserPlus className="w-4 h-4 mr-1.5" /> Join Team
                  </Button>
                )}

                {isManager && canApprove && (
                   <Button variant="secondary" onClick={() => onTogglePublic(idea.id, !idea.isPublic)} className="h-9 text-xs">
                      {idea.isPublic ? <Globe className="w-4 h-4 mr-1.5 text-sky-600" /> : <Globe className="w-4 h-4 mr-1.5" />} {idea.isPublic ? "Unpublish" : "Publish to Global"}
                   </Button>
                )}
                
                {(idea.isPublic || isManager) && (
                   <Button variant="secondary" onClick={handleShare} className="h-9 text-xs">
                     <Share2 className="w-4 h-4 mr-1.5" /> {copying ? "Link Copied" : "External Share"}
                   </Button>
                )}

                <Button variant="primary" onClick={() => generatePDF(idea, aiAnalysis)} className="h-9 text-xs">
                  <Printer className="w-4 h-4 mr-1.5" /> Export PDF
                </Button>
             </div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="space-y-4">
               {(!aiAnalysis && !roadmap) ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button variant="ai" onClick={handleAnalyze} disabled={isAnalyzing} className="w-full h-14 shadow-lg flex-col gap-1 border-indigo-200">
                      <div className="flex items-center gap-2">
                        {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        <span>{isAnalyzing ? "Processing..." : "Run AI Technical Assessment"}</span>
                      </div>
                      <span className="text-[10px] opacity-70 font-normal normal-case">Risk & Benefit Analysis</span>
                    </Button>
                    <Button variant="ai" onClick={handleGenerateRoadmap} disabled={isAnalyzing} className="w-full h-14 shadow-lg flex-col gap-1 border-indigo-200">
                      <div className="flex items-center gap-2">
                        {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                        <span>{isAnalyzing ? "Planning..." : "Generate Execution Roadmap"}</span>
                      </div>
                      <span className="text-[10px] opacity-70 font-normal normal-case">Create Implementation Plan</span>
                    </Button>
                 </div>
               ) : (
                  <>
                  {aiAnalysis && (
                    <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 p-6 rounded-sm shadow-sm relative overflow-hidden">
                       <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                       <h4 className="font-bold text-indigo-900 flex items-center gap-2 mb-4 text-sm uppercase tracking-wider"><Star className="w-4 h-4" /> AI Technical Review</h4>
                       <div className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed font-mono text-justify">{aiAnalysis}</div>
                    </div>
                  )}
                  {roadmap && (
                    <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 p-6 rounded-sm shadow-sm relative overflow-hidden">
                       <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                       <h4 className="font-bold text-emerald-900 flex items-center gap-2 mb-4 text-sm uppercase tracking-wider"><BookOpen className="w-4 h-4" /> Strategic Execution Plan</h4>
                       <div className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed font-mono text-justify">{roadmap}</div>
                    </div>
                  )}
                  </>
               )}
              </div>

              <div className="space-y-6">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Proposal Details</h4>
                {Object.entries(idea.formData || {}).map(([k, v]: [string, any]) => (
                  <div key={k} className="group">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <div className="w-1 h-1 bg-sky-500 rounded-full"></div> {String(k)}
                    </span>
                    <div className="text-sm text-slate-900 leading-7 whitespace-pre-wrap bg-white p-4 rounded-sm border border-slate-200 shadow-sm font-medium">
                       {renderFormValue(v)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-1 space-y-6">
              {isManager && kpis && <RatingSystem idea={idea} onRate={onRate} kpis={kpis} currentUser={currentUser} />}
              
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-sm shadow-sm">
                  <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <MessageSquare className="w-3 h-3" /> Technical Discussion
                  </h5>
                  <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {idea.comments?.length > 0 ? idea.comments.map((c: any, i: number) => (
                      <div key={i} className="text-xs bg-white p-3 rounded-sm border border-slate-200 shadow-sm relative">
                        <div className="flex justify-between mb-1 items-center">
                          <span className="font-bold text-slate-800">{c.author}</span>
                          <span className="text-[9px] text-slate-400 font-mono">{new Date(c.date).toLocaleDateString()}</span>
                        </div>
                        <p className="text-slate-600 leading-relaxed">{c.text}</p>
                      </div>
                    )) : <p className="text-xs text-slate-400 italic text-center py-4">No technical queries logged yet.</p>}
                  </div>
                  <div className="flex gap-2">
                    <input className="flex-1 text-xs border border-slate-300 px-3 py-2 rounded-sm focus:outline-none focus:border-sky-500" placeholder="Add technical note..." value={comment} onChange={e => setComment(e.target.value)} />
                    <Button onClick={() => { onComment(idea.id, comment); setComment(''); }} disabled={!comment.trim()} className="px-3">
                      <Send className="w-3 h-3" />
                    </Button>
                  </div>
              </div>

              {isManager && canApprove && (
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200">
                   <Button variant="danger" className="w-full" onClick={() => { onStatus(idea.id, STATUS.REJECTED); setShowModal(false); }}>Reject</Button>
                   <Button variant="success" className="w-full" onClick={() => { onStatus(idea.id, STATUS.APPROVED); setShowModal(false); }}>Approve & Fund</Button>
                </div>
              )}
            </div>
        </div>
    </Modal>
    </>
  );
};