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

  if (!isMounted) return <div style={{ width: 85, height: 28 }} />; // Placeholder for layout stability

  return (
    <button
      onClick={toggleBookmark}
      title={isBookmarked ? 'Remove from favorites' : 'Add to favorites'}
      aria-label="Bookmark Roadmap"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        height: '28px',
        padding: '0 10px',
        borderRadius: '6px',
        fontSize: '0.72rem',
        fontWeight: 600,
        fontFamily: 'inherit',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        background: isBookmarked ? 'rgba(245, 166, 35, 0.12)' : 'transparent',
        border: `1px solid ${isBookmarked ? 'rgba(245, 166, 35, 0.4)' : '#1f1f1f'}`,
        color: isBookmarked ? '#F5A623' : '#737373',
      }}
      onMouseEnter={(e) => {
        if (!isBookmarked) {
          e.currentTarget.style.color = '#A3A3A3';
          e.currentTarget.style.borderColor = '#2a2a2a';
          e.currentTarget.style.background = '#141722';
        }
      }}
      onMouseLeave={(e) => {
        if (!isBookmarked) {
          e.currentTarget.style.color = '#737373';
          e.currentTarget.style.borderColor = '#1f1f1f';
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      <span style={{ fontSize: '0.85rem', lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}>
        {isBookmarked ? '★' : '☆'}
      </span>
      <span>{isBookmarked ? 'Saved' : 'Favorite'}</span>
    </button>
  );
}
