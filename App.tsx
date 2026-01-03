import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { onAuthStateChanged, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, onSnapshot, doc, arrayUnion, writeBatch, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './services/firebase';
import { COLLECTIONS, ROLES, STATUS, DEFAULT_ADMIN, DEFAULT_KPIS, DEFAULT_FORM_FIELDS, APP_ID } from './constants';
import { LoadingScreen, Button, Input, Card, Modal, StatCard, Badge } from './components/UI';
import { IdeaCard } from './components/IdeaCard';
import { callGemini, GOOGLE_SCRIPT_URL } from './services/gemini';
import { Zap, LogOut, Briefcase, Activity, Clock, Users, Globe, Target, UserPlus, Pencil, Save, Trash2, Layout, Plus, X, Upload, FileCheck, Loader2, ChevronDown, AlertTriangle, Image as ImageIcon, CheckCircle, Link as LinkIcon, AlertCircle, Handshake, Lock, FileText } from 'lucide-react';
import { User, Idea } from './types';

// --- Helpers ---
export const getCollection = (name: string) => collection(db, 'artifacts', APP_ID, 'public', 'data', name);
export const getDocRef = (name: string, id: string) => doc(db, 'artifacts', APP_ID, 'public', 'data', name, id);

const generatePublicId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const checkDuplicates = async (newTitle: string, newDesc: string, category: string) => {
  try {
    const q = query(
      getCollection(COLLECTIONS.IDEAS),
      where('category', '==', category),
    );
    const snap = await getDocs(q);
    
    if (snap.empty) return null;

    const existingIdeas = snap.docs.slice(0, 20).map(d => ({
      id: d.id,
      title: d.data().formTitle,
      desc: JSON.stringify(d.data().formData).substring(0, 300)
    }));

    const prompt = `
      You are an AI auditor for an Oil & Gas Innovation Database. Analyze if the NEW_PROPOSAL is a duplicate or heavily overlaps with any EXISTING_PROPOSALS.
      
      NEW_PROPOSAL:
      Title: ${newTitle}
      Content: ${newDesc.substring(0, 500)}

      EXISTING_PROPOSALS:
      ${JSON.stringify(existingIdeas)}

      Return a raw JSON object (no markdown) with this schema:
      {
        "isDuplicate": boolean,
        "matchId": "string (ID of matched idea or null)",
        "matchTitle": "string (Title of matched idea or null)",
        "reason": "string (Technical explanation for the Asset Manager)"
      }
    `;

    const jsonString = await callGemini(prompt);
    if (!jsonString) return null;
    
    const cleanJson = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);

  } catch (e) {
    console.error("Duplicate check failed", e);
    return null;
  }
};

// --- Components defined within App.tsx to keep structure from original input ---

const InnovationCarousel = ({ variant = 'full' }: any) => {
  const [slides, setSlides] = useState<any[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const q = query(getCollection(COLLECTIONS.IDEAS), where('isPublic', '==', true));
    const unsub = onSnapshot(q, (snap) => {
      setSlides(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let interval: any;
    if (slides.length > 1) {
       interval = setInterval(() => setCurrent(c => (c + 1) % slides.length), 8000);
    }
    return () => clearInterval(interval);
  }, [slides.length]);

  if (slides.length === 0) return (
    <div className={`bg-slate-900 flex flex-col items-center justify-center text-center p-8 ${variant === 'full' ? 'h-full' : 'h-64 rounded-sm'} relative overflow-hidden`}>
      <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
      <Briefcase className="w-12 h-12 text-sky-600 mb-4 relative z-10" />
      <h3 className="text-xl font-bold text-white mb-2 relative z-10">Operational Excellence</h3>
      <p className="text-slate-400 max-w-sm text-sm relative z-10">Driving efficiency and safety through innovation.</p>
    </div>
  );

  const slide = slides[current];

  return (
    <div className={`relative overflow-hidden group bg-slate-900 ${variant === 'full' ? 'h-full' : 'h-96 rounded-sm shadow-xl border-b-8 border-sky-600'}`}>
       {slide.coverImage ? (
        <div className="absolute inset-0 bg-cover bg-center transition-all duration-1000 transform scale-105 group-hover:scale-100" style={{ backgroundImage: `url(${slide.coverImage})` }}>
           <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-slate-900/40"></div>
        </div>
      ) : (
        <>
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-800 via-slate-900 to-black"></div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-10"></div>
        </>
      )}
      
      <div className="absolute bottom-0 left-0 right-0 p-10 z-10">
        <div className="max-w-4xl">
          <div className="flex items-center gap-3 mb-4">
             <span className="bg-sky-600/90 backdrop-blur text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest inline-flex items-center gap-1 shadow-lg">
                <Briefcase className="w-3 h-3" /> {slide.category}
             </span>
             <span className="text-sky-300 text-[10px] uppercase font-bold tracking-widest flex items-center gap-1 bg-slate-900/50 px-2 py-1 rounded-full">
                <Activity className="w-3 h-3" /> Featured Initiative
             </span>
          </div>
          <h2 className="font-black text-white leading-tight mb-4 text-4xl font-sans tracking-tight drop-shadow-md">{slide.formTitle}</h2>
          <p className="text-slate-200 text-sm leading-relaxed line-clamp-3 mb-6 font-medium max-w-2xl border-l-4 border-sky-500 pl-4 bg-gradient-to-r from-slate-900/50 to-transparent p-2 rounded-r-lg">
             {slide.aiSummary || Object.values(slide.formData)[0]?.toString().substring(0, 150) + "..."}
          </p>
          <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-wider text-slate-300">
            <div className="flex items-center gap-2">
               <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-sky-500/50 flex items-center justify-center text-white text-[10px] shadow-lg">{slide.employeeName?.[0]}</div>
               <span>{slide.employeeName}</span>
            </div>
            <span className="w-1 h-1 bg-slate-500 rounded-full"></span>
            <span className="text-sky-400">{slide.mainDepartment}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ... Portals ...

const GuestManagement = ({ guests, onApprove, onAdd, onDelete }: any) => {
  const [newEmail, setNewEmail] = useState('');
  return (
    <Card className="p-6">
      <h3 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2"><Globe className="w-5 h-5" /> Guest Access Control</h3>
      <div className="flex gap-2 mb-8 p-4 bg-slate-50 rounded-sm border border-slate-200">
        <input className="flex-1 bg-white border border-slate-300 rounded-sm px-3 py-2 text-sm" placeholder="Pre-approve Guest Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
        <Button onClick={() => { onAdd(newEmail); setNewEmail(''); }} disabled={!newEmail}>Add Guest</Button>
      </div>
      <div className="space-y-2">
        {guests.length === 0 && <div className="text-slate-400 text-sm italic">No guests configured.</div>}
        {guests.map((g: any) => (
          <div key={g.id} className="flex justify-between items-center p-3 border rounded-sm hover:bg-slate-50">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${g.status === STATUS.APPROVED ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="font-mono text-sm">{g.email}</span>
              {g.status === STATUS.PENDING && <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Pending Request</span>}
            </div>
            <div className="flex gap-2">
              {g.status === STATUS.PENDING && (<Button variant="success" className="px-3 py-1 text-xs h-8" onClick={() => onApprove(g.id)}>Approve</Button>)}
              <button onClick={() => onDelete(g.id)} className="text-slate-400 hover:text-red-600 p-2"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

const KPIManager = ({ kpis, onUpdate }: any) => {
    const [newKPI, setNewKPI] = useState({ label: '', description: '', weight: 0 });
    const add = () => { if (!newKPI.label || !newKPI.weight) return; onUpdate([...kpis, newKPI]); setNewKPI({ label: '', description: '', weight: 0 }); };
    const remove = (index: number) => { onUpdate(kpis.filter((_: any, i: number) => i !== index)); };
    const totalWeight = kpis.reduce((acc: number, curr: any) => acc + (Number(curr.weight) || 0), 0);
    return (
      <Card className="p-6">
        <h3 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2"><Target className="w-5 h-5" /> KPI Configuration</h3>
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg mb-6"><div className="flex gap-2 items-end mb-4"><div className="flex-1"><label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">KPI Name</label><input className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm focus:border-indigo-500 focus:outline-none" value={newKPI.label} onChange={e => setNewKPI({...newKPI, label: e.target.value})} /></div><div className="flex-1"><label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Description</label><input className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm focus:border-indigo-500 focus:outline-none" value={newKPI.description} onChange={e => setNewKPI({...newKPI, description: e.target.value})} /></div><div className="w-24"><label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Weight %</label><input type="number" className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm focus:border-indigo-500 focus:outline-none" value={newKPI.weight} onChange={e => setNewKPI({...newKPI, weight: parseInt(e.target.value) || 0})} /></div><Button onClick={add}>Add</Button></div><div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-slate-500 px-1"><span>Total Weight: {totalWeight}%</span>{totalWeight !== 100 && <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded">Warning: Total should be 100%</span>}</div></div><div className="space-y-3">{kpis.map((k: any, i: number) => (<div key={i} className="flex justify-between items-center p-4 border border-slate-100 rounded-lg hover:bg-slate-50 hover:border-slate-200 transition-all shadow-sm"><div><div className="font-bold text-slate-800 text-sm flex items-center gap-2">{k.label} <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px]"> {k.weight}%</span></div><div className="text-xs text-slate-400 mt-0.5">{k.description}</div></div><button onClick={() => remove(i)} className="text-slate-300 hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition-colors"><Trash2 className="w-4 h-4" /></button></div>))}</div>
      </Card>
    );
};

const DepartmentManager = ({ departments, showToast }: any) => {
  const [name, setName] = useState('');
  const add = async () => { if(!name) return; await addDoc(getCollection(COLLECTIONS.DEPARTMENTS), { name }); setName(''); showToast("Organization unit added"); };
  return (<Card className="p-6"><h3 className="font-bold text-lg text-slate-900 mb-6">Organizational Structure</h3><div className="flex gap-2 mb-8"><div className="flex-1"><input className="w-full px-4 py-2 border border-slate-300 rounded-sm focus:outline-none focus:border-slate-900" value={name} onChange={e => setName(e.target.value)} placeholder="New Department Name" /></div><Button onClick={add} variant="primary" className="h-full">Add Unit</Button></div><div className="flex flex-wrap gap-3">{departments.map((d: any) => (<div key={d.id} className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-sm text-sm font-semibold shadow-sm flex items-center gap-2"><Briefcase className="w-3 h-3 text-slate-400" />{d.name}</div>))}</div></Card>);
};

const FormBuilder = ({ forms, showToast }: any) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newForm, setNewForm] = useState({ category: '', title: '', fields: DEFAULT_FORM_FIELDS });
  const [field, setField] = useState({ label: '', type: 'text', options: '' });

  const deleteTemplate = async (id: string) => {
    if (confirm("Delete this form template?")) {
      try {
        await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', COLLECTIONS.FORMS, id));
        showToast("Template deleted.");
      } catch (error) { showToast("Failed to delete.", "error"); }
    }
  };

  const save = async () => { const processedFields = newForm.fields.map((f: any) => { if ((f.type === 'dropdown' || f.type === 'checkbox') && typeof f.options === 'string') { return { ...f, options: f.options.split(',').map((o: string) => o.trim()) }; } return f; }); await addDoc(getCollection(COLLECTIONS.FORMS), { ...newForm, fields: processedFields }); showToast("Template Saved"); setIsCreating(false); setNewForm({ category: '', title: '', fields: DEFAULT_FORM_FIELDS }); };
  const addField = () => { if (field.label) { let newField: any = { ...field }; if ((field.type === 'dropdown' || field.type === 'checkbox') && field.options) { /* keep as string for UI */ } setNewForm(prev => ({...prev, fields: [...prev.fields, newField]})); setField({label:'', type:'text', options: ''}); } };
  
  if(!isCreating) return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-lg text-slate-900">Form Templates</h3>
        <Button onClick={() => setIsCreating(true)} variant="primary"><Plus className="w-4 h-4 mr-1" /> New Template</Button>
      </div>
      <div className="grid gap-3">
        {forms.map((f: any) => (
          <div key={f.id} className="p-4 border border-slate-200 rounded-sm flex justify-between items-center hover:bg-slate-50 transition-colors">
            <div>
              <span className="font-bold text-slate-800">{f.title}</span>
              <span className="ml-3 text-xs font-bold text-slate-400 uppercase tracking-widest">{f.category}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => deleteTemplate(f.id)} className="text-slate-400 hover:text-red-600 p-2 rounded-full hover:bg-white"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );

  return (<Card className="p-8 border-l-4 border-l-slate-900"><h3 className="font-bold text-xl text-slate-900 mb-6">Design New Template</h3><div className="space-y-4 mb-8"><Input label="Category" value={newForm.category} onChange={(e: any) => setNewForm({...newForm, category: e.target.value})} placeholder="e.g. Health & Safety" /><Input label="Title" value={newForm.title} onChange={(e: any) => setNewForm({...newForm, title: e.target.value})} placeholder="e.g. Incident Report" /></div><div className="bg-slate-50 p-6 rounded-sm border border-slate-200 mb-8"><h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-4">Field Configuration</h4><div className="flex gap-3 mb-4 items-end"><div className="flex-1"><label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Field Name</label><input className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm" value={field.label} onChange={(e: any) => setField({...field, label: e.target.value})} /></div><div className="w-1/3"><label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Type</label><select className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm bg-white" value={field.type} onChange={(e: any) => setField({...field, type: e.target.value})}><option value="text">Text Input</option><option value="textarea">Text Area</option><option value="dropdown">Dropdown List</option><option value="checkbox">Checkbox Group</option><option value="file">File Attachment</option></select></div>{(field.type === 'dropdown' || field.type === 'checkbox') && (<div className="flex-1"><label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Options (comma separated)</label><input className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm" value={field.options} onChange={(e: any) => setField({...field, options: e.target.value})} /></div>)}<Button onClick={addField} variant="secondary">Add</Button></div><div className="flex flex-wrap gap-2">{newForm.fields.map((f: any, i: number) => (<div key={i} className="bg-white border border-slate-300 px-3 py-1 rounded-sm text-xs font-mono text-slate-600 flex items-center gap-2">{f.label} <span className="opacity-50">({f.type})</span><button onClick={() => setNewForm(prev => ({...prev, fields: prev.fields.filter((_, idx) => idx !== i)}))} className="text-red-500 hover:text-red-700 ml-1"><X className="w-3 h-3" /></button></div>))}</div></div><div className="flex justify-end gap-3"><Button variant="ghost" onClick={() => setIsCreating(false)}>Discard</Button><Button onClick={save} variant="primary">Publish Template</Button></div></Card>);
};

const CollaborationHub = ({ currentUser, ideas, onJoinTeam, onCollaborate, onEditIdea, onDeleteIdea }: any) => {
  const openIdeas = ideas.filter((i: any) => 
    i.status !== STATUS.REJECTED && 
    (i.isPublic || i.collaborationGroupId)
  );

  const groupedIdeas = useMemo(() => {
    const groups: any = {};
    const singles: any[] = [];
    
    openIdeas.forEach((idea: any) => {
      if (idea.collaborationGroupId) {
        if (!groups[idea.collaborationGroupId]) groups[idea.collaborationGroupId] = [];
        groups[idea.collaborationGroupId].push(idea);
      } else {
        singles.push(idea);
      }
    });
    return { groups, singles };
  }, [openIdeas]);

  return (
    <div className="space-y-8 animate-fade-in">
       <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-sm p-8 text-white shadow-md border-l-4 border-l-amber-500">
          <div className="flex items-center gap-6">
             <div className="p-4 bg-white/5 rounded-full backdrop-blur-sm border border-white/10">
               <Handshake className="w-10 h-10 text-amber-500" />
             </div>
             <div>
                <h2 className="text-2xl font-bold uppercase tracking-wide font-sans">Collaboration Matrix</h2>
                <p className="text-slate-300 font-mono text-sm mt-1">Join active working groups or propose related initiatives.</p>
             </div>
          </div>
       </div>

       {Object.keys(groupedIdeas.groups).length > 0 && (
         <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 border-b border-slate-200 pb-2">
              <Layout className="w-4 h-4 text-indigo-600" /> Active Collaboration Clusters
            </h3>
            <div className="grid grid-cols-1 gap-6">
              {Object.entries(groupedIdeas.groups).map(([groupId, groupIdeas]: [string, any]) => (
                <div key={groupId} className="bg-white border border-indigo-100 rounded-sm p-6 shadow-sm relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                   <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                           <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-widest">Group ID: {groupId.slice(0,8)}</span>
                           <span className="text-slate-400 text-xs font-bold">{groupIdeas.length} Proposals</span>
                        </div>
                        <h4 className="text-lg font-bold text-slate-800">Operational Cluster</h4>
                      </div>
                      <Button variant="ai" onClick={() => onCollaborate(groupIdeas[0].publicId || groupIdeas[0].id)} className="h-8 text-xs">
                         <Plus className="w-3 h-3 mr-1" /> Submit Related Proposal
                      </Button>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-sm border border-slate-200">
                      {groupIdeas.map((idea: any) => (
                        <div key={idea.id} className="bg-white p-3 rounded-sm border border-slate-200 shadow-sm hover:border-indigo-300 cursor-pointer transition-all">
                           <h5 className="font-bold text-sm text-slate-800 truncate">{idea.formTitle}</h5>
                           <div className="flex justify-between mt-2 text-[10px] text-slate-500 font-medium">
                              <span>{idea.employeeName}</span>
                              <Badge status={idea.status} />
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              ))}
            </div>
         </div>
       )}

       <div className="space-y-6">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 border-b border-slate-200 pb-2">
             <Target className="w-4 h-4 text-sky-600" /> Individual Opportunities
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groupedIdeas.singles.length === 0 && Object.keys(groupedIdeas.groups).length === 0 && (
                <div className="col-span-full text-center py-16 bg-slate-50 rounded-sm border-2 border-dashed border-slate-300">
                  <div className="mx-auto w-16 h-16 bg-white rounded-full flex items-center justify-center text-slate-400 mb-4 shadow-sm">
                    <Users className="w-8 h-8" />
                  </div>
                  <h4 className="text-slate-600 font-bold mb-1">No Active Calls for Collaboration</h4>
                  <p className="text-slate-400 text-sm">Check back later for cross-departmental opportunities.</p>
                </div>
              )}
              {groupedIdeas.singles.map((idea: any) => (
                <IdeaCard 
                  key={idea.id} 
                  idea={idea} 
                  currentUser={currentUser} 
                  onJoinTeam={onJoinTeam} 
                  onCollaborate={onCollaborate}
                  onEditIdea={onEditIdea}
                  onDeleteIdea={onDeleteIdea}
                  isEmployeeView={true} 
                />
              ))}
          </div>
       </div>
    </div>
  );
};

const EmployeePortal = ({ currentUser, showToast }: any) => {
  const [tab, setTab] = useState('new');
  const [departments, setDepartments] = useState<any[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [allIdeas, setAllIdeas] = useState<any[]>([]);
  const [activeForm, setActiveForm] = useState<any>(null);
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);
  const [submission, setSubmission] = useState<any>({});
  const [targetDept, setTargetDept] = useState('');
  const [subDepts, setSubDepts] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [linkedId, setLinkedId] = useState('');

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', COLLECTIONS.DEPARTMENTS), s => setDepartments(s.docs.map(d => ({id:d.id, ...d.data()}))));
    const unsub2 = onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', COLLECTIONS.FORMS), s => setForms(s.docs.map(d => ({id:d.id, ...d.data()}))));
    const unsub3 = onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', COLLECTIONS.IDEAS), s => setAllIdeas(s.docs.map(d => ({id:d.id, ...d.data()}))));
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  const myIdeas = useMemo(() => allIdeas.filter(i => i.employeeId === currentUser.id), [allIdeas, currentUser]);

  const handleEditIdea = (idea: any) => {
    const matchingForm = forms.find(f => f.title === idea.formTitle); 
    if (matchingForm) {
      setActiveForm(matchingForm);
      setSubmission(idea.formData);
      setTargetDept(idea.mainDepartment);
      setSubDepts(idea.subDepartments || []);
      setEditingIdeaId(idea.id);
      setCoverPhoto(idea.coverImage || null);
      setIsLinking(!!idea.collaborationGroupId);
      setLinkedId(''); 
      setTab('new');
    } else {
      showToast("Original Form Template not found.", "error");
    }
  };

  const handleJoinGroup = (targetId: string) => {
    setTab('new');
    setIsLinking(true);
    setLinkedId(targetId);
    showToast(`Collaboration Mode: Linked to ${targetId}. Select a form to proceed.`);
  };

  const handleSubmit = useCallback(async (e: any) => {
    e.preventDefault();
    if (!targetDept) return showToast("Please select a target department", "error");
    setIsSubmitting(true);
    
    let groupIdToUse = null;
    if (isLinking && linkedId) {
       const q = query(collection(db, 'artifacts', APP_ID, 'public', 'data', COLLECTIONS.IDEAS), where('publicId', '==', linkedId.trim().toUpperCase()));
       const querySnapshot = await getDocs(q);
       let linkedDoc = null;
       if (!querySnapshot.empty) {
          linkedDoc = querySnapshot.docs[0];
       } else {
          // Try id lookup as fallback
          const q2 = query(collection(db, 'artifacts', APP_ID, 'public', 'data', COLLECTIONS.IDEAS), where('__name__', '==', linkedId.trim()));
          const s2 = await getDocs(q2);
          if(!s2.empty) linkedDoc = s2.docs[0];
       }
       
       if (linkedDoc) {
           const linkedData = linkedDoc.data();
           groupIdToUse = linkedData.collaborationGroupId;
           if (!groupIdToUse) {
              groupIdToUse = crypto.randomUUID();
              await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', COLLECTIONS.IDEAS, linkedDoc.id), { collaborationGroupId: groupIdToUse });
           }
       } else {
           showToast("Invalid Proposal ID for link.", "error");
           setIsSubmitting(false);
           return;
       }
    }

    showToast("AI Audit: Checking for redundancies...", "ai");
    const duplicateResult = await checkDuplicates(activeForm.title, JSON.stringify(submission), activeForm.category);
    const newPublicId = generatePublicId();

    const ideaData: any = {
      employeeId: currentUser.id,
      employeeName: currentUser.name,
      status: STATUS.PENDING,
      formTitle: activeForm.title,
      category: activeForm.category, 
      formData: submission,
      mainDepartment: targetDept,
      subDepartments: subDepts,
      submittedAt: new Date().toISOString(),
      publicId: editingIdeaId ? (allIdeas.find(i => i.id === editingIdeaId)?.publicId || newPublicId) : newPublicId,
      collaborationGroupId: groupIdToUse,
      coverImage: coverPhoto,
      duplicateFlag: duplicateResult?.isDuplicate ? duplicateResult : null
    };

    if (editingIdeaId) {
      await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', COLLECTIONS.IDEAS, editingIdeaId), ideaData);
      showToast("Proposal Revised.");
    } else {
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', COLLECTIONS.IDEAS), { ...ideaData, comments: [], collaborators: [] });
      showToast("Proposal Submitted Successfully");
    }

    setActiveForm(null); setSubmission({}); setTargetDept(''); setSubDepts([]); setEditingIdeaId(null); setIsSubmitting(false);
    setIsLinking(false); setLinkedId(''); setCoverPhoto(null);
  }, [activeForm, currentUser, showToast, submission, subDepts, targetDept, editingIdeaId, isLinking, linkedId, allIdeas, coverPhoto]);

  // Handle file uploads (simplified for this context, normally calls google script)
  const handleFileUpload = (file: File, label: string) => {
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        setSubmission((prev: any) => ({ ...prev, [label]: reader.result }));
        showToast("File attached.", "success");
    };
  };

  const handleJoinTeam = useCallback(async (id: string) => {
    await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', COLLECTIONS.IDEAS, id), {
      collaborators: arrayUnion({ id: currentUser.id, name: currentUser.name, joinedAt: new Date().toISOString() })
    });
    showToast("You have been added to the project team.", "success");
  }, [currentUser, showToast]);

  return (
    <div>
      <div className="flex gap-6 mb-6 border-b border-slate-200">
         <button onClick={() => setTab('new')} className={`pb-3 border-b-2 font-bold text-xs uppercase tracking-wider transition-colors ${tab==='new' ? 'border-sky-700 text-sky-800' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>New Proposal</button>
         <button onClick={() => setTab('history')} className={`pb-3 border-b-2 font-bold text-xs uppercase tracking-wider transition-colors ${tab==='history' ? 'border-sky-700 text-sky-800' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>My Portfolio</button>
         <button onClick={() => setTab('collab')} className={`pb-3 border-b-2 font-bold text-xs uppercase tracking-wider transition-colors ${tab==='collab' ? 'border-sky-700 text-sky-800' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Collaboration Matrix</button>
      </div>

      {tab === 'collab' && <CollaborationHub 
          currentUser={currentUser} 
          ideas={allIdeas} 
          onJoinTeam={handleJoinTeam} 
          onCollaborate={handleJoinGroup} 
          onEditIdea={handleEditIdea}
          onDeleteIdea={async (id: string) => { await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', COLLECTIONS.IDEAS, id)); showToast("Deleted."); }}
      />}

      {tab === 'history' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {myIdeas.map(idea => (
               <IdeaCard 
                  key={idea.id} idea={idea} isEmployeeView={true} currentUser={currentUser}
                  onEditIdea={handleEditIdea}
                  onDeleteIdea={async (id: string) => { await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', COLLECTIONS.IDEAS, id)); showToast("Deleted."); }}
               />
             ))}
        </div>
      )}

      {tab === 'new' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            
            {isLinking && linkedId && (
               <div className="mb-6 bg-indigo-50 border border-indigo-200 p-4 rounded-sm flex items-center justify-between animate-fade-in">
                  <div className="flex items-center gap-3">
                     <LinkIcon className="w-5 h-5 text-indigo-600" />
                     <div>
                        <div className="text-sm font-bold text-indigo-900">Collaboration Mode Active</div>
                        <div className="text-xs text-indigo-700">Submitting proposal linked to ID: <span className="font-mono font-bold">{linkedId}</span></div>
                     </div>
                  </div>
                  <Button variant="ghost" onClick={() => { setIsLinking(false); setLinkedId(''); }} className="text-xs text-indigo-600 hover:bg-indigo-100">Cancel Link</Button>
               </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {forms.map(form => (
                <button key={form.id} onClick={() => { setActiveForm(form); setEditingIdeaId(null); setSubmission({}); if(!linkedId) { setIsLinking(false); } setCoverPhoto(null); }} className="flex items-start p-5 bg-white border border-slate-200 rounded-sm hover:border-sky-500 hover:shadow-md transition-all text-left group">
                  <div className="mr-4 bg-slate-50 p-2.5 rounded-sm group-hover:bg-sky-50 transition-colors border border-slate-100"><FileText className="w-5 h-5 text-slate-500 group-hover:text-sky-600" /></div>
                  <div><div className="font-bold text-base text-slate-800 group-hover:text-sky-900">{form.title}</div><div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-bold">{form.category}</div></div>
                </button>
              ))}
            </div>

            <Modal isOpen={!!activeForm} onClose={() => { setActiveForm(null); }} title={activeForm?.title || "New Submission"}>
                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="bg-sky-50 p-4 rounded-sm border-l-4 border-sky-600 flex items-start gap-3">
                      <Zap className="w-5 h-5 text-sky-700 mt-0.5 flex-shrink-0" />
                      <div><h4 className="text-sm font-bold text-sky-900">AI-Powered Audit Active</h4><p className="text-xs text-sky-800 mt-1">Your submission will be instantly audited for duplicates.</p></div>
                   </div>

                   {/* Collaboration Toggle inside Form */}
                   <div className="bg-slate-50 p-4 rounded-sm border border-slate-200">
                          <label className="flex items-center gap-3 cursor-pointer group mb-4">
                             <div className={`w-5 h-5 rounded-sm border flex items-center justify-center transition-colors ${isLinking ? 'bg-sky-700 border-sky-700' : 'bg-white border-slate-300'}`}>
                                {isLinking && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                             </div>
                             <input type="checkbox" className="hidden" checked={isLinking} onChange={e => setIsLinking(e.target.checked)} />
                             <div>
                                <span className="block text-sm font-bold text-slate-700">Collaboration & Linkage</span>
                                <span className="text-xs text-slate-500">Is this related to an existing initiative?</span>
                             </div>
                          </label>
                          
                          {isLinking && (
                            <div className="animate-fade-in">
                               <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Related Proposal ID</label>
                               <input 
                                  type="text" 
                                  className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm uppercase font-mono placeholder-slate-400 focus:outline-none focus:border-sky-500" 
                                  placeholder="e.g. X9J2K1" 
                                  value={linkedId} 
                                  onChange={e => setLinkedId(e.target.value.toUpperCase())}
                               />
                            </div>
                          )}
                   </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {activeForm?.fields.map((f: any, i: number) => (
                      <div key={i} className="col-span-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{f.label} {f.required && "*"}</label>
                        {f.type === 'textarea' ? (
                          <textarea className="w-full px-4 py-3 bg-white border border-slate-300 text-sm rounded-sm" required={f.required} value={submission[f.label] || ''} onChange={e => setSubmission({...submission, [f.label]: e.target.value})} />
                        ) : f.type === 'file' ? (
                            <input type="file" onChange={(e) => e.target.files && handleFileUpload(e.target.files[0], f.label)} />
                        ) : (
                          <input type={f.type} className="w-full px-4 py-3 bg-white border border-slate-300 text-sm rounded-sm" required={f.required} value={submission[f.label] || ''} onChange={e => setSubmission({...submission, [f.label]: e.target.value})} />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="bg-slate-100 p-6 rounded-sm border border-slate-200">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Approving Authority</label>
                      <select className="w-full px-4 py-3 bg-white border border-slate-300 text-sm rounded-sm" value={targetDept} onChange={e => setTargetDept(e.target.value)} required>
                          <option value="">Select Department...</option>
                          {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                      </select>
                  </div>

                  <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                      <Button variant="ghost" onClick={() => setActiveForm(null)}>Discard</Button>
                      <Button variant="primary" type="submit" disabled={isSubmitting}>{isSubmitting ? "Processing..." : "Submit Proposal"}</Button>
                  </div>
                </form>
            </Modal>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminPortal = ({ showToast }: any) => {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState<any[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [guests, setGuests] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any[]>([]);

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', COLLECTIONS.USERS), s => setUsers(s.docs.map(d => ({id:d.id, ...d.data()}))));
    const unsub2 = onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', COLLECTIONS.FORMS), s => setForms(s.docs.map(d => ({id:d.id, ...d.data()}))));
    const unsub3 = onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', COLLECTIONS.DEPARTMENTS), s => setDepartments(s.docs.map(d => ({id:d.id, ...d.data()}))));
    const unsub4 = onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', COLLECTIONS.GUESTS), s => setGuests(s.docs.map(d => ({id:d.id, ...d.data()}))));
    const unsub5 = onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', COLLECTIONS.KPIS), async (s) => { 
        if (s.empty) { 
            const kpiRef = doc(collection(db, 'artifacts', APP_ID, 'public', 'data', COLLECTIONS.KPIS)); 
            await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', COLLECTIONS.KPIS, 'config'), { list: DEFAULT_KPIS }); 
        } else { 
            const data = s.docs.find(d => d.id === 'config')?.data(); 
            setKpis(data?.list || DEFAULT_KPIS); 
        }
    });
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
  }, []);

  const updateKPIs = async (newList: any) => { await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', COLLECTIONS.KPIS, 'config'), { list: newList }); showToast("KPIs Updated"); };
  const approveUser = useCallback(async (id: string, role: string, dept: string) => { await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', COLLECTIONS.USERS, id), { status: STATUS.APPROVED, role, department: dept }); showToast("User access granted."); }, [showToast]);
  const updateUser = useCallback(async (id: string, data: any) => { await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', COLLECTIONS.USERS, id), data); showToast("User details updated."); }, [showToast]);
  const deleteUser = useCallback(async (id: string) => { await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', COLLECTIONS.USERS, id)); showToast("User removed."); }, [showToast]);
  const approveGuest = useCallback(async (id: string) => { await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', COLLECTIONS.GUESTS, id), { status: STATUS.APPROVED }); showToast("Guest access authorized."); }, [showToast]);
  const addGuest = useCallback(async (email: string) => { await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', COLLECTIONS.GUESTS), { email, status: STATUS.APPROVED, addedAt: new Date().toISOString() }); showToast("Guest pre-approved."); }, [showToast]);
  const deleteGuest = useCallback(async (id: string) => { await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', COLLECTIONS.GUESTS, id)); showToast("Guest removed."); }, [showToast]);

  const pending = useMemo(() => users.filter(u => u.status === STATUS.PENDING), [users]);
  const active = useMemo(() => users.filter(u => u.status === STATUS.APPROVED && u.role !== ROLES.ADMIN), [users]);

  return (
    <div>
      <div className="mb-8"><h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">System Administration</h1><p className="text-slate-500 mt-1">Manage users, configuration, and organizational structure.</p></div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        <div className="md:col-span-3 sticky top-24 space-y-2 z-10 overflow-x-auto md:overflow-visible flex md:block gap-2 md:gap-0 pb-2 md:pb-0">
          <button onClick={() => setActiveTab('users')} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all whitespace-nowrap md:whitespace-normal ${activeTab === 'users' ? 'bg-slate-900 text-white font-medium shadow-md translate-x-1' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100 hover:border-slate-200'}`}><Users className="w-4 h-4 flex-shrink-0" /> Access Control</button>
          <button onClick={() => setActiveTab('guests')} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all whitespace-nowrap md:whitespace-normal ${activeTab === 'guests' ? 'bg-slate-900 text-white font-medium shadow-md translate-x-1' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100 hover:border-slate-200'}`}><Globe className="w-4 h-4 flex-shrink-0" /> Guest Access</button>
          <button onClick={() => setActiveTab('kpis')} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all whitespace-nowrap md:whitespace-normal ${activeTab === 'kpis' ? 'bg-slate-900 text-white font-medium shadow-md translate-x-1' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100 hover:border-slate-200'}`}><Target className="w-4 h-4 flex-shrink-0" /> KPI Configuration</button>
          <button onClick={() => setActiveTab('departments')} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all whitespace-nowrap md:whitespace-normal ${activeTab === 'departments' ? 'bg-slate-900 text-white font-medium shadow-md translate-x-1' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100 hover:border-slate-200'}`}><Briefcase className="w-4 h-4 flex-shrink-0" /> Departments</button>
          <button onClick={() => setActiveTab('forms')} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all whitespace-nowrap md:whitespace-normal ${activeTab === 'forms' ? 'bg-slate-900 text-white font-medium shadow-md translate-x-1' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100 hover:border-slate-200'}`}><Layout className="w-4 h-4 flex-shrink-0" /> Form Templates</button>
        </div>
        <div className="md:col-span-9 space-y-8">
            {activeTab === 'users' && (
                <div className="space-y-6">
                    <Card className="p-6">
                        <div className="flex items-center gap-2 mb-6"><UserPlus className="w-5 h-5 text-slate-900" /><h3 className="font-bold text-lg text-slate-900">Pending Access Requests</h3></div>
                        {pending.length === 0 ? <div className="text-slate-400 text-sm italic py-4">No pending requests.</div> : (
                            <div className="divide-y divide-slate-100">{pending.map(u => (
                                <div key={u.id} className="py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div><div className="font-bold text-slate-900">{u.name}</div><div className="text-xs text-slate-500 font-mono">{u.email}</div><div className="text-[10px] text-slate-400 mt-1">{u.username ? `@${u.username}` : ''} {u.phone ? `• ${u.phone}` : ''}</div></div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="success" onClick={() => approveUser(u.id, ROLES.EMPLOYEE, departments[0]?.name || '')} className="py-1 px-3 text-xs h-7">Approve</Button>
                                        <button onClick={() => deleteUser(u.id)} className="text-slate-400 hover:text-red-600 p-1 ml-1"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            ))}</div>
                        )}
                    </Card>
                    <Card className="p-6">
                         <div className="flex items-center gap-2 mb-6"><Users className="w-5 h-5 text-slate-900" /><h3 className="font-bold text-lg text-slate-900">Active Directory</h3></div>
                         {active.length === 0 ? <div className="text-slate-400 text-sm italic py-4">No active users.</div> : (
                            <div className="divide-y divide-slate-100">{active.map(u => (
                                <div key={u.id} className="py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div><div className="font-bold text-slate-900">{u.name}</div><div className="text-xs text-slate-500 font-mono">{u.email}</div><div className="text-[10px] text-slate-400">{u.role} | {u.department} {u.phone ? `• ${u.phone}` : ''}</div></div>
                                    <button onClick={() => deleteUser(u.id)} className="text-slate-400 hover:text-red-600 p-1 ml-1"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            ))}</div>
                         )}
                    </Card>
                </div>
            )}
            {activeTab === 'guests' && <GuestManagement guests={guests} onApprove={approveGuest} onAdd={addGuest} onDelete={deleteGuest} />}
            {activeTab === 'kpis' && <KPIManager kpis={kpis} onUpdate={updateKPIs} />}
            {activeTab === 'departments' && <DepartmentManager departments={departments} showToast={showToast} />}
            {activeTab === 'forms' && <FormBuilder forms={forms} showToast={showToast} />}
        </div>
      </div>
    </div>
  );
};

const ManagerPortal = ({ currentUser, showToast }: any) => {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [filter, setFilter] = useState('all');
  const [kpis, setKpis] = useState<any[]>(DEFAULT_KPIS);

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', COLLECTIONS.IDEAS), s => setIdeas(s.docs.map(d => ({id:d.id, ...d.data()} as Idea))));
    const unsub2 = onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', COLLECTIONS.KPIS, 'config'), s => { if (s.exists()) setKpis(s.data().list); });
    return () => { unsub1(); unsub2(); };
  }, []);

  const displayedIdeas = useMemo(() => filter === 'myDept' ? ideas.filter(i => i.mainDepartment === currentUser.department) : ideas, [filter, ideas, currentUser]);

  const handleRate = async (ideaId: string, rating: any) => {
    const ideaToUpdate = ideas.find(i => i.id === ideaId);
    if (!ideaToUpdate) return;

    const currentRatings = ideaToUpdate.ratings || {};
    
    // Add/Update current manager's rating
    const newRatings = {
      ...currentRatings,
      [currentUser.id]: {
        ...rating,
        managerName: currentUser.name,
        date: new Date().toISOString()
      }
    };

    // Calculate Global Average
    const entries = Object.values(newRatings);
    const count = entries.length;
    const avgPct = Math.round(entries.reduce((sum: number, r: any) => sum + (r.percentage || 0), 0) / (count || 1));
    
    let grade = 'F';
    if (avgPct >= 80) grade = 'A';
    else if (avgPct >= 60) grade = 'B';
    else if (avgPct >= 40) grade = 'C';
    else grade = 'D';

    const kpiSums: any = {};
    
    entries.forEach((r: any) => {
        if (r.details) {
            r.details.forEach((d: any) => {
                if (!kpiSums[d.label]) kpiSums[d.label] = 0;
                kpiSums[d.label] = (Number(kpiSums[d.label]) || 0) + (Number(d.score) || 0);
            });
        }
    });
    
    const avgDetails = Object.keys(kpiSums).map(label => {
        const weight = rating.details.find((d:any) => d.label === label)?.weight || 0;
        return {
            label,
            weight,
            score: parseFloat((kpiSums[label] / count).toFixed(1))
        };
    });

    const averageRatingObj = {
        percentage: avgPct,
        grade: grade,
        details: avgDetails,
        count: count
    };

    await updateDoc(getDocRef(COLLECTIONS.IDEAS, ideaId), { 
        ratings: newRatings,
        rating: averageRatingObj 
    });
    showToast('Rating submitted.');
  };

  const handleStatus = async (id: string, status: string) => {
    await updateDoc(getDocRef(COLLECTIONS.IDEAS, id), { status });
    showToast(`Status updated to ${status}`);
  };

  const handleComment = async (id: string, text: string) => {
    const comment = { id: Date.now(), author: currentUser.name, text, date: new Date().toISOString() };
    await updateDoc(getDocRef(COLLECTIONS.IDEAS, id), { comments: arrayUnion(comment) });
    showToast("Comment added");
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center border-b border-slate-200 pb-4">
        <div><h2 className="text-xl font-bold text-slate-900">Asset Management</h2><p className="text-slate-500 text-xs">Review and approve proposals.</p></div>
        <div className="flex bg-slate-100 rounded-sm p-1">
          <button onClick={() => setFilter('all')} className={`px-4 py-1.5 text-xs font-bold rounded-sm ${filter === 'all' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Global View</button>
          <button onClick={() => setFilter('myDept')} className={`px-4 py-1.5 text-xs font-bold rounded-sm ${filter === 'myDept' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>My Dept</button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedIdeas.map(idea => (
          <IdeaCard 
            key={idea.id} 
            idea={idea} 
            isManager={true} 
            canApprove={idea.mainDepartment === currentUser.department} 
            onStatus={handleStatus} 
            onComment={handleComment} 
            currentUser={currentUser} 
            onRate={handleRate} 
            kpis={kpis} 
            onUpdateComment={() => {}}
            onEditIdea={() => {}}
            onDeleteIdea={async (id: string) => { await deleteDoc(getDocRef(COLLECTIONS.IDEAS, id)); showToast("Deleted."); }}
            onTogglePublic={async (id: string, isPublic: boolean) => { await updateDoc(getDocRef(COLLECTIONS.IDEAS, id), { isPublic }); showToast(isPublic ? "Published" : "Unpublished"); }}
            onJoinTeam={() => {}}
            onCollaborate={() => {}}
          />
        ))}
      </div>
    </div>
  );
};

const Login = ({ onLogin }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    if (email === DEFAULT_ADMIN.email && password === DEFAULT_ADMIN.password) {
        onLogin(DEFAULT_ADMIN);
        return;
    }

    try {
      await signInAnonymously(auth); 
      const q = query(getCollection(COLLECTIONS.USERS), where('email', '==', email), where('password', '==', password));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
          const userData = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
          if(userData.status === STATUS.APPROVED) {
             onLogin(userData);
          } else {
             setError('Account pending approval.');
          }
      } else {
          setError('Invalid credentials.');
      }
    } catch (err) {
      setError('Login failed');
    } finally {
        setLoading(false);
    }
  };

  return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Card className="w-full max-w-md p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">EPROM Innovation</h2>
            <form onSubmit={handleLogin} className="space-y-4">
                <Input label="Email" value={email} onChange={(e: any) => setEmail(e.target.value)} type="email" required />
                <Input label="Password" value={password} onChange={(e: any) => setPassword(e.target.value)} type="password" required />
                {error && <div className="text-red-600 text-xs">{error}</div>}
                <Button type="submit" variant="primary" className="w-full" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</Button>
            </form>
            <div className="mt-8 text-center pt-6 border-t border-slate-100">
                <p className="text-slate-400 text-xs mb-4 uppercase tracking-wide font-bold">New Personnel?</p>
                <Button variant="secondary" onClick={() => (window as any).requestRegister && (window as any).requestRegister()} className="w-full h-10 text-xs">Register for Access</Button>
            </div>
        </Card>
      </div>
  );
};

const RegisterPage = ({ onRegister, onBack }: any) => {
  const [form, setForm] = useState({ name: '', email: '', username: '', phone: '', password: '' });
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-200 p-4 font-sans">
      <Card className="w-full max-w-lg p-12 shadow-2xl border-t-8 border-slate-900">
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">Personnel Registration</h2>
          <p className="text-slate-500 mt-2 text-sm">Submit details for IT Department clearance.</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onRegister(form); }} className="space-y-6">
          <Input label="Full Name" value={form.name} onChange={(e: any) => setForm({...form, name: e.target.value})} required />
          <Input label="User Name" value={form.username} onChange={(e: any) => setForm({...form, username: e.target.value})} required />
          <div className="grid grid-cols-2 gap-4">
             <Input label="Corporate Email" type="email" value={form.email} onChange={(e: any) => setForm({...form, email: e.target.value})} required />
             <Input label="Phone Number" type="tel" value={form.phone} onChange={(e: any) => setForm({...form, phone: e.target.value})} required />
          </div>
          <Input label="Create Password" type="password" value={form.password} onChange={(e: any) => setForm({...form, password: e.target.value})} required />
          <div className="pt-8 flex gap-4">
            <Button variant="ghost" onClick={onBack} className="flex-1">Cancel</Button>
            <Button variant="primary" type="submit" className="flex-1">Submit Application</Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default function IdeaBankApp() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('login'); 
  const [toast, setToast] = useState<{message: string, type: string} | null>(null);

  useEffect(() => {
    (window as any).requestRegister = () => setView('register');
    const unsub = onAuthStateChanged(auth, async (u) => {
       if(!u) { setLoading(false); return; }
       if (!user) setLoading(false); 
    });
    return () => unsub();
  }, []);

  const showToast = useCallback((message: string, type = 'success') => { setToast({ message, type }); setTimeout(() => setToast(null), 3000); }, []);

  const handleRegister = async (data: any) => {
    try {
      await addDoc(getCollection(COLLECTIONS.USERS), {
        ...data,
        role: 'unassigned',
        status: STATUS.PENDING,
        createdAt: new Date().toISOString()
      });
      showToast("Application submitted for approval.", "success");
      setView('login');
    } catch (err) {
      showToast("Registration failed", "error");
    }
  };

  if (loading) return <LoadingScreen />;
  
  if (view === 'register') return <RegisterPage onRegister={handleRegister} onBack={() => setView('login')} />;

  if (!user) return <Login onLogin={(u: User) => { setUser(u); setLoading(false); }} />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
        {toast && (<div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-sm shadow-2xl border-l-4 text-sm font-bold tracking-wide animate-fade-in uppercase ${toast.type === 'error' ? 'bg-white border-red-600 text-red-800' : toast.type === 'ai' ? 'bg-white border-indigo-600 text-indigo-800' : 'bg-white border-emerald-600 text-emerald-800'}`}>{toast.type === 'ai' && <Zap className="w-4 h-4 inline-block mr-2 text-indigo-600" />}{toast.message}</div>)}
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-50 shadow-md">
            <h1 className="font-bold text-lg tracking-tight">EPROM <span className="text-sky-500">INNOVATE</span></h1>
            <div className="flex items-center gap-4">
                <div className="text-right hidden md:block">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{user.role}</div>
                    <div className="text-sm font-bold">{user.name}</div>
                </div>
                <Button variant="ghost" onClick={() => setUser(null)} className="text-slate-300 hover:text-white"><LogOut className="w-5 h-5" /></Button>
            </div>
        </div>
        
        <div className="max-w-7xl mx-auto p-6">
            <div className="mb-8 shadow-2xl rounded-sm overflow-hidden"><InnovationCarousel /></div>
            {user.role === ROLES.ADMIN ? (
                <AdminPortal showToast={showToast} />
            ) : user.role === ROLES.MANAGER ? (
                <ManagerPortal currentUser={user} showToast={showToast} />
            ) : (
                <EmployeePortal currentUser={user} showToast={showToast} />
            )}
        </div>
    </div>
  );
}
