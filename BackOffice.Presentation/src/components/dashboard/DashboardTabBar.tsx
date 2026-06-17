import React, { useRef, useState, useEffect } from 'react';
import { useDashboardTabs, DashboardTab } from '../../context/DashboardTabContext';

// Tab-strip CSS injected once at module load. Handles the VS-Code style
// dirty-dot ⇄ close-× swap on hover — can't be expressed with inline styles
// alone because it needs a real :hover rule.
if (typeof document !== 'undefined' && !document.getElementById('dashboard-tab-bar-styles')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'dashboard-tab-bar-styles';
  styleEl.textContent = `
    /* Clean tab: × fades in on tab hover */
    [data-tab-id]:hover .tab-x-clean { opacity: 1 !important; }

    /* Tab with asterisk (edit-mode OR dirty): hovering the close slot hides the
       asterisk and reveals the ×. Keyed off data-tab-asterisk so plain edit-mode
       tabs get the same hover-swap as dirty tabs. */
    [data-tab-id][data-tab-asterisk="true"] .tab-close-slot:hover .tab-dot { opacity: 0; transform: scale(0.6); }
    [data-tab-id][data-tab-asterisk="true"] .tab-close-slot:hover .tab-x { opacity: 1 !important; }

    /* Subtle pulse so the asterisk feels alive on a newly dirtied tab */
    @keyframes tab-dot-pulse {
      0%   { text-shadow: 0 0 0 rgba(234, 179, 8, 0); transform: scale(1); }
      30%  { text-shadow: 0 0 8px rgba(234, 179, 8, 0.55); transform: scale(1.18); }
      100% { text-shadow: 0 0 0 rgba(234, 179, 8, 0); transform: scale(1); }
    }
    [data-tab-id][data-tab-dirty="true"] .tab-dot { animation: tab-dot-pulse 1.6s ease-out 1; }
  `;
  document.head.appendChild(styleEl);
}

// Get tab icon based on tab type/title
const getTabIcon = (tab: DashboardTab) => {
  const title = tab.title.toLowerCase();
  if (title.includes('dashboard')) {
    return (
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.6"/>
        <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.6"/>
        <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.6"/>
        <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.6"/>
      </svg>
    );
  }
  if (title.includes('item')) {
    return (
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    );
  }
  if (title.includes('adjust') || title.includes('inventory')) {
    return (
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M12 11v6m-3-3h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    );
  }
  // Default icon
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

interface DashboardTabBarProps {
  className?: string;
}

const DashboardTabBar: React.FC<DashboardTabBarProps> = ({ className = '' }) => {
  const {
    tabs,
    activeTabId,
    setActiveTab,
    dirtyTabIds,
    requestCloseTab,
    requestCloseAllTabs,
    requestCloseOtherTabs,
  } = useDashboardTabs();
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
  const [showScrollButtons, setShowScrollButtons] = useState(false);

  // Check if scroll buttons should be shown
  useEffect(() => {
    const checkScroll = () => {
      if (tabsContainerRef.current) {
        const { scrollWidth, clientWidth } = tabsContainerRef.current;
        setShowScrollButtons(scrollWidth > clientWidth);
      }
    };

    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [tabs]);

  // Scroll active tab into view
  useEffect(() => {
    if (activeTabId && tabsContainerRef.current) {
      const activeTab = tabsContainerRef.current.querySelector(`[data-tab-id="${activeTabId}"]`);
      if (activeTab) {
        activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTabId]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (tabsContainerRef.current) {
      const scrollAmount = 200;
      tabsContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const handleTabClick = (tab: DashboardTab) => {
    setActiveTab(tab.id);
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    // requestCloseTab intercepts if the tab is dirty and shows the modal.
    void requestCloseTab(tabId);
  };

  const handleMiddleClick = (e: React.MouseEvent, tabId: string) => {
    if (e.button === 1) {
      e.preventDefault();
      void requestCloseTab(tabId);
    }
  };

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className={`dashboard-tab-bar ${className}`} style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
      <div className="flex items-center" style={{ height: '52px', padding: '0 20px', gap: '4px' }}>
        {/* Scroll Left Button */}
        {showScrollButtons && (
          <button
            onClick={() => handleScroll('left')}
            className="flex-shrink-0 px-1.5 h-full transition-colors"
            style={{ color: '#94a3b8' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Tabs Container */}
        <div
          ref={tabsContainerRef}
          className="flex-1 flex items-center overflow-x-auto"
          style={{ gap: '4px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {tabs.map((tab) => {
            const isActive = activeTabId === tab.id;
            const isDirty = dirtyTabIds.has(tab.id);
            // Asterisk appears ONLY when the tab has unsaved edits. Pulses on
            // the dirty transition; stays static until edits are saved/discarded.
            // (Phase 1 keeps `isDirty` truthy across tab switches via the
            // context-level cleanup, so switching away from an edited tab and
            // back keeps the asterisk visible.)
            const showAsterisk = isDirty;
            // Reserve `data-tab-dirty` for the dirty-only behaviors (pulse
            // animation, hover-swap to ×). Plain edit-mode tabs without changes
            // should NOT trigger the pulse, and clicking × on a clean edit tab
            // closes immediately without prompting (no changes to discard).
            return (
              <div
                key={tab.id}
                data-tab-id={tab.id}
                data-tab-dirty={isDirty ? 'true' : undefined}
                data-tab-asterisk={showAsterisk ? 'true' : undefined}
                onClick={() => handleTabClick(tab)}
                onMouseDown={(e) => handleMiddleClick(e, tab.id)}
                onContextMenu={(e) => handleContextMenu(e, tab.id)}
                title={isDirty ? `${tab.title} — unsaved changes` : undefined}
                className="group flex items-center select-none whitespace-nowrap transition-all duration-100"
                style={{
                  gap: '6px',
                  padding: '6px 11px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: isActive ? 500 : 400,
                  fontFamily: "'DM Sans', sans-serif",
                  color: isActive ? '#1e40af' : '#475569',
                  background: isActive ? '#dddeff' : 'transparent',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#0f172a'; } }}
                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#475569'; } }}
              >
                {/* Tab Icon */}
                <span style={{ opacity: isActive ? 0.7 : 0.5, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  {getTabIcon(tab)}
                </span>

                {/* Tab Title */}
                <span>{tab.title}</span>

                {/* Close / Dirty slot
                    - Clean tab: empty until hover, then × appears (VS Code pattern)
                    - Dirty tab: amber ● shown; hover swaps to × so the user can close.
                    The slot is always 16px wide so the tab width doesn't jump when
                    dirty state flips. */}
                {tab.closable && (
                  <span
                    onClick={(e) => handleCloseTab(e, tab.id)}
                    className="tab-close-slot transition-colors"
                    style={{
                      width: '16px', height: '16px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '3px',
                      lineHeight: 1,
                      cursor: 'pointer',
                      flexShrink: 0,
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.classList.add('is-hover');
                      e.currentTarget.style.background = '#e0e7ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.classList.remove('is-hover');
                      e.currentTarget.style.background = 'transparent';
                    }}
                    aria-label={isDirty ? 'Close tab (unsaved changes)' : 'Close tab'}
                  >
                    {showAsterisk ? (
                      // Edit-mode or dirty: yellow asterisk by default, × on hover via CSS.
                      // Asterisk matches IDE-style "unsaved" indicators (VS Code, Sublime).
                      // The pulse animation (in CSS below) is keyed to data-tab-dirty so a
                      // plain edit-mode tab renders the asterisk statically; the dirty
                      // transition still gets the "you just made it dirty" pulse.
                      <>
                        <span className="tab-dot" aria-hidden="true" style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '12px', height: '12px',
                          color: '#eab308',           // yellow-500
                          fontSize: '16px',
                          fontWeight: 700,
                          lineHeight: 1,
                          userSelect: 'none',
                          transition: 'transform .12s',
                        }} title="Unsaved changes">*</span>
                        <span className="tab-x" aria-hidden="true" style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#1e40af',
                          fontSize: '11px',
                          fontWeight: 600,
                          opacity: 0,
                          transition: 'opacity .12s',
                        }}>✕</span>
                      </>
                    ) : (
                      // Clean: × hidden until hover (existing behaviour).
                      <span className="tab-x-clean" aria-hidden="true" style={{
                        color: '#94a3b8',
                        fontSize: '11px',
                        fontWeight: 500,
                        opacity: 0,
                        transition: 'opacity .12s',
                      }}>✕</span>
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Scroll Right Button */}
        {showScrollButtons && (
          <button
            onClick={() => handleScroll('right')}
            className="flex-shrink-0 px-1.5 h-full transition-colors"
            style={{ color: '#94a3b8' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Close All Button */}
        {tabs.length > 1 && (
          <button
            onClick={() => { void requestCloseAllTabs(); }}
            className="flex-shrink-0 flex items-center transition-all duration-100"
            style={{
              gap: '5px',
              height: '28px',
              padding: '0 10px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              background: 'transparent',
              color: '#94a3b8',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '12px',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#fca5a5'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
            title="Close all tabs"
          >
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
            Close all
          </button>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-[9999]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={handleCloseContextMenu}
        >
          <button
            className="w-full px-4 py-1.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => { void requestCloseTab(contextMenu.tabId); }}
          >
            Close
          </button>
          <button
            className="w-full px-4 py-1.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => { void requestCloseOtherTabs(contextMenu.tabId); }}
          >
            Close Others
          </button>
          <button
            className="w-full px-4 py-1.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => { void requestCloseAllTabs(); }}
          >
            Close All
          </button>
        </div>
      )}
    </div>
  );
};

export default DashboardTabBar;
