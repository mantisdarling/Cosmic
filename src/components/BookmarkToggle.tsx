import { useState, useEffect, useCallback } from 'react';

interface BookmarkToggleProps {
  roadmapId: string;
}

const STORAGE_KEY = 'cosmic-bookmarks';

function getBookmarks(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveBookmarks(bookmarks: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...bookmarks]));
    // Dispatch a custom event so other components (like the filter) can react
    window.dispatchEvent(new Event('cosmic-bookmarks-updated'));
  } catch {}
}

export default function BookmarkToggle({ roadmapId }: BookmarkToggleProps) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const checkBookmarkStatus = () => {
      const bookmarks = getBookmarks();
      setIsBookmarked(bookmarks.has(roadmapId));
    };

    checkBookmarkStatus();
    
    // Listen for cross-component or cross-tab updates
    window.addEventListener('cosmic-bookmarks-updated', checkBookmarkStatus);
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY) checkBookmarkStatus();
    });

    return () => {
      window.removeEventListener('cosmic-bookmarks-updated', checkBookmarkStatus);
    };
  }, [roadmapId]);

  const toggleBookmark = useCallback((event: React.MouseEvent) => {
    event.preventDefault(); // Prevent navigating to the roadmap
    event.stopPropagation(); // Prevent card click

    const bookmarks = getBookmarks();
    if (bookmarks.has(roadmapId)) {
      bookmarks.delete(roadmapId);
      setIsBookmarked(false);
    } else {
      bookmarks.add(roadmapId);
      setIsBookmarked(true);
    }
    saveBookmarks(bookmarks);
  }, [roadmapId]);

  if (!isMounted) return <div className="w-8 h-8" />; // Placeholder for layout stability

  return (
    <button
      onClick={toggleBookmark}
      title={isBookmarked ? 'Remove from favorites' : 'Add to favorites'}
      className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center bg-[#10121A] border border-[#2A3147] hover:bg-[#1B1F30] transition-all hover:scale-105 shadow-sm"
      aria-label="Bookmark Roadmap"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={isBookmarked ? '#F5A623' : 'none'}
        stroke={isBookmarked ? '#F5A623' : '#737373'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-colors duration-200"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  );
}
