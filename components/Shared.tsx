import React from 'react';

// Badge Component - Solid, high contrast
export const Badge = ({ children, color = 'blue', className = '' }: { children: React.ReactNode, color?: string, className?: string }) => {
  const colors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-800 border border-blue-200',
    green: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    yellow: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
    red: 'bg-red-100 text-red-800 border border-red-200',
    gray: 'bg-slate-100 text-slate-700 border border-slate-200',
    amber: 'bg-amber-100 text-amber-800 border border-amber-200',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-sm text-[10px] uppercase tracking-wider font-bold ${colors[color] || colors.gray} ${className}`}>
      {children}
    </span>
  );
};

// Button Component - Sharp edges, corporate feel
export const Button = ({ 
  children, 
  variant = 'primary', 
  onClick, 
  type = 'button', 
  className = '',
  disabled = false
}: { 
  children: React.ReactNode, 
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost', 
  onClick?: () => void,
  type?: 'button' | 'submit',
  className?: string,
  disabled?: boolean
}) => {
  const base = "px-5 py-2.5 rounded font-semibold transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed text-sm tracking-wide uppercase shadow-sm";
  
  const variants = {
    primary: "bg-eprom-blue text-white hover:bg-blue-700 border border-blue-700 hover:shadow-md",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 hover:text-slate-900",
    danger: "bg-white text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300",
    ghost: "bg-transparent text-slate-500 hover:text-eprom-blue hover:bg-slate-100 shadow-none",
  };

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

// Input Component
export const Input = ({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) => (
  <div className="mb-5">
    {label && <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">{label}</label>}
    <input 
      {...props} 
      className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded text-slate-900 placeholder-slate-400 focus:outline-none focus:border-eprom-blue focus:ring-1 focus:ring-eprom-blue transition-all input-base"
    />
  </div>
);

// Textarea Component
export const Textarea = ({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) => (
  <div className="mb-5">
    {label && <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">{label}</label>}
    <textarea 
      {...props} 
      className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded text-slate-900 placeholder-slate-400 focus:outline-none focus:border-eprom-blue focus:ring-1 focus:ring-eprom-blue transition-all input-base"
    />
  </div>
);

// Select Component
export const Select = ({ label, options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string, options: string[] }) => (
  <div className="mb-5">
    {label && <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">{label}</label>}
    <select 
      {...props} 
      className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:border-eprom-blue focus:ring-1 focus:ring-eprom-blue transition-all appearance-none input-base"
    >
      <option value="" className="text-slate-500">Select an option</option>
      {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  </div>
);

// Card Component - Clean white with shadow
export const Card = ({ children, className = '', onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) => (
  <div onClick={onClick} className={`bg-white rounded-lg border border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_16px_rgba(0,0,0,0.06)] transition-shadow duration-300 ${className}`}>
    {children}
  </div>
);