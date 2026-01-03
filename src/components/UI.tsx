import React from 'react';
import { Zap, FileText, X, Globe, Link as LinkIcon, Award } from 'lucide-react';
import { STATUS } from '../constants';

export const LoadingScreen = ({ message = "Initializing System...", onRetry }: { message?: string, onRetry?: () => void }) => (
  <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
    <div className="relative">
      <div className="w-12 h-12 border-4 border-slate-700 border-t-sky-500 rounded-full animate-spin mb-4"></div>
      <div className="absolute inset-0 flex items-center justify-center">
        <Zap className="w-4 h-4 text-sky-500" />
      </div>
    </div>
    <div className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-4">{message}</div>
    {onRetry && <button onClick={onRetry} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs transition-colors">Retry Connection</button>}
  </div>
);

export const Button = ({ children, onClick, variant = 'primary', className = '', type = 'button', disabled = false, title }: any) => {
  const baseStyle = "px-4 py-2 text-xs font-bold tracking-wide uppercase transition-all duration-200 flex items-center justify-center gap-2 rounded-sm focus:outline-none focus:ring-2 focus:ring-offset-1 active:scale-[0.98]";
  const variants: any = {
    primary: "bg-sky-800 text-white hover:bg-sky-700 disabled:bg-slate-300 border border-transparent shadow-sm",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-sky-800",
    danger: "bg-red-700 text-white hover:bg-red-600 disabled:bg-red-300 shadow-sm",
    success: "bg-emerald-700 text-white hover:bg-emerald-600 disabled:bg-emerald-300 shadow-sm",
    ai: "bg-gradient-to-r from-indigo-900 to-sky-900 text-white hover:from-indigo-800 hover:to-sky-800 shadow-md border border-indigo-700",
    ghost: "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900"
  };
  return <button type={type} onClick={onClick} className={`${baseStyle} ${variants[variant]} ${className}`} disabled={disabled} title={title}>{children}</button>;
};

export const Input = ({ label, type = "text", value, onChange, placeholder, required = false }: any) => (
  <div className="mb-5 group">
    {label && <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{label} {required && <span className="text-amber-600">*</span>}</label>}
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-sm focus:outline-none focus:border-sky-600 focus:bg-white focus:ring-1 focus:ring-sky-600 transition-all placeholder-slate-400 font-medium" required={required} />
  </div>
);

export const Card = ({ children, className = '', onClick }: any) => (
  <div onClick={onClick} className={`bg-white border border-slate-200 shadow-sm rounded-sm ${className} ${onClick ? 'cursor-pointer hover:border-sky-300 hover:shadow-md transition-all duration-300' : ''}`}>{children}</div>
);

export const Badge = ({ status, isPublic, rating, isCollab }: any) => {
  const styles: any = {
    [STATUS.PENDING]: "bg-amber-50 text-amber-700 border-amber-200",
    [STATUS.APPROVED]: "bg-emerald-50 text-emerald-700 border-emerald-200",
    [STATUS.REJECTED]: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <div className="flex gap-2 flex-wrap">
      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-sm ${styles[status]}`}>{status}</span>
      {rating && <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-sm flex items-center gap-1 bg-slate-100 text-slate-700 border-slate-300"><Award className="w-3 h-3 text-amber-500" /> Grade {rating.grade} {rating.count > 1 ? `(${rating.count})` : ''}</span>}
      {isPublic && <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-sm bg-sky-50 text-sky-700 border-sky-200 flex items-center gap-1"><Globe className="w-3 h-3" /> Global</span>}
      {isCollab && <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-sm bg-indigo-50 text-indigo-700 border-indigo-200 flex items-center gap-1"><LinkIcon className="w-3 h-3" /> Collaborative</span>}
    </div>
  );
};

export const Modal = ({ isOpen, onClose, title, children }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in overflow-hidden">
      <div className="bg-white rounded-sm shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-scale-up border-t-4 border-t-sky-700">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-white z-10 sticky top-0">
          <div className="flex items-center gap-3">
             <div className="bg-sky-100 p-2 rounded-sm"><FileText className="w-5 h-5 text-sky-700" /></div>
             <h3 className="text-xl font-bold text-slate-900 tracking-tight font-sans">{title}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-8 overflow-y-auto scroll-smooth bg-slate-50/50">{children}</div>
      </div>
    </div>
  );
};

export const StatCard = ({ label, value, subtext, icon: Icon, color = "text-sky-600" }: any) => (
  <div className="bg-white p-6 rounded-sm border border-slate-200 shadow-sm flex items-start justify-between">
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</div>
      <div className="text-2xl font-black text-slate-800 tracking-tight">{value}</div>
      {subtext && <div className="text-xs text-slate-500 mt-1 font-medium">{subtext}</div>}
    </div>
    <div className={`p-3 bg-slate-50 rounded-full border border-slate-100 ${color}`}>
      <Icon className="w-5 h-5" />
    </div>
  </div>
);