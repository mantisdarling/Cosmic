import { useState, useEffect } from 'react';

export default function KeyboardShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // '?' key opens the modal
      if (e.key === '?') {
        setIsOpen((prev) => !prev);
      }
      
      // Escape closes the modal
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
      
      // '/' focuses search (handled in index.astro, but we document it here)
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isMounted || !isOpen) return null;

  const shortcuts = [
    { key: '?', desc: 'Toggle keyboard shortcuts help' },
    { key: '/', desc: 'Focus search bar (Home)' },
    { key: 'Esc', desc: 'Close modals, panels, or clear search' },
  ];

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => setIsOpen(false)}
    >
      <div 
        className="bg-[#0B0C10] border border-[#1E2333] rounded-xl p-6 w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 border-b border-[#1E2333] pb-3">
          <h2 className="text-lg font-bold text-[#E5E5E5]">Keyboard Shortcuts</h2>
          <button 
            onClick={() => setIsOpen(false)}
            className="text-[#737373] hover:text-white transition-colors p-1"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        
        <div className="space-y-3">
          {shortcuts.map(s => (
            <div key={s.key} className="flex items-center justify-between">
              <span className="text-[#A3A3A3] text-sm">{s.desc}</span>
              <kbd className="px-2 py-1 bg-[#141722] border border-[#2A3147] rounded text-xs font-mono text-[#F5A623]">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
