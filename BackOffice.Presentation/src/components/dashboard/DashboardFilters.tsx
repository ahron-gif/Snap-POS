import React, { useState, useRef, useEffect } from 'react';
import Flatpickr from 'react-flatpickr';
import 'flatpickr/dist/themes/light.css';
import { useStore } from '../../context/StoreContext';
import type { DashboardFilters as FilterType } from '../../services/dashboardService';

interface Props {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
}

/* ─── quick-range presets ─── */
const presets = [
  { label: 'Today', days: 0 },
  { label: '7 D', days: 7 },
  { label: '30 D', days: 30 },
  { label: '90 D', days: 90 },
  { label: 'This Year', days: -1 },      // special: Jan 1 → today
  { label: 'Last Year', days: -2 },       // special: last year range
] as const;

const toDateStr = (d: Date) => d.toISOString().split('T')[0];

const DashboardFiltersBar: React.FC<Props> = ({ filters, onFiltersChange }) => {
  const { stores, currentStore } = useStore();
  const [showPanel, setShowPanel] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Track WHERE the current date range came from so the label can show
  // "Custom Range" when the user typed dates manually, even if those dates
  // happen to match a preset (e.g. they manually picked 7 days ago → today).
  // Without this, the label silently shows "Last 7 Days" and the user can't
  // tell their custom selection took effect.
  //   - null         => no source yet (fresh page, "All Time" shown)
  //   - 'preset'     => last change came from clicking a preset chip
  //   - 'custom'     => last change came from the From/To flatpickr inputs
  const [dateSource, setDateSource] = useState<'preset' | 'custom' | null>(
    filters.dateFrom || filters.dateTo ? 'custom' : null,
  );

  // Close panel on outside click, BUT keep the panel open when the click is
  // inside flatpickr's calendar overlay. Flatpickr renders its calendar as a
  // child of <body> (not inside our panel ref), so clicking the year/month
  // selector counts as "outside" by the naive contains() check and would
  // dismiss the panel mid-edit. Whitelisting the .flatpickr-calendar
  // selector fixes that without losing the click-outside dismiss for real
  // outside clicks.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      if (panelRef.current && panelRef.current.contains(target)) return;
      if (target.closest('.flatpickr-calendar')) return;
      setShowPanel(false);
    };
    if (showPanel) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPanel]);

  /* ─── helpers ─── */
  const handleStoreChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({ ...filters, storeId: e.target.value || undefined });
  };

  const handleDateFromChange = (dates: Date[]) => {
    const d = dates[0];
    setDateSource('custom');
    onFiltersChange({ ...filters, dateFrom: d ? toDateStr(d) : undefined });
  };

  const handleDateToChange = (dates: Date[]) => {
    const d = dates[0];
    setDateSource('custom');
    onFiltersChange({ ...filters, dateTo: d ? toDateStr(d) : undefined });
  };

  const applyPreset = (preset: typeof presets[number]) => {
    const today = new Date();
    let from: Date;
    let to: Date = today;

    if (preset.days === -1) {
      // This Year
      from = new Date(today.getFullYear(), 0, 1);
    } else if (preset.days === -2) {
      // Last Year
      from = new Date(today.getFullYear() - 1, 0, 1);
      to = new Date(today.getFullYear() - 1, 11, 31);
    } else {
      from = new Date();
      from.setDate(from.getDate() - preset.days);
    }

    setDateSource('preset');
    onFiltersChange({ ...filters, dateFrom: toDateStr(from), dateTo: toDateStr(to) });
  };

  const clearDates = () => {
    setDateSource(null);
    onFiltersChange({ ...filters, dateFrom: undefined, dateTo: undefined });
  };

  const clearAll = () => {
    setDateSource(null);
    onFiltersChange({ storeId: currentStore?.storeId });
  };

  const hasDateFilters = filters.dateFrom || filters.dateTo;
  const hasAnyFilters = hasDateFilters || (filters.storeId !== currentStore?.storeId);

  /* ─── pretty date label ─── */
  const fmtDate = (s: string) =>
    new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const dateLabel = () => {
    if (filters.dateFrom && filters.dateTo) {
      const from = filters.dateFrom;
      const to = filters.dateTo;

      // Only try to identify a preset name when the user actually clicked a
      // preset. If they typed into the custom From/To fields we ALWAYS show
      // formatted dates, even when the values coincidentally match a preset,
      // so the UI clearly reflects "this is a custom range".
      if (dateSource === 'preset') {
        const today = new Date();
        const todayStr = toDateStr(today);

        if (from === todayStr && to === todayStr) return 'Today';
        const d7 = new Date(); d7.setDate(d7.getDate() - 7);
        if (from === toDateStr(d7) && to === todayStr) return 'Last 7 Days';
        const d30 = new Date(); d30.setDate(d30.getDate() - 30);
        if (from === toDateStr(d30) && to === todayStr) return 'Last 30 Days';
        const d90 = new Date(); d90.setDate(d90.getDate() - 90);
        if (from === toDateStr(d90) && to === todayStr) return 'Last 90 Days';
        const yearStart = toDateStr(new Date(today.getFullYear(), 0, 1));
        if (from === yearStart && to === todayStr) return 'This Year';
        const lastYearStart = toDateStr(new Date(today.getFullYear() - 1, 0, 1));
        const lastYearEnd = toDateStr(new Date(today.getFullYear() - 1, 11, 31));
        if (from === lastYearStart && to === lastYearEnd) return 'Last Year';
      }

      return `${fmtDate(from)} – ${fmtDate(to)}`;
    }
    if (filters.dateFrom) return `From ${fmtDate(filters.dateFrom)}`;
    if (filters.dateTo) return `To ${fmtDate(filters.dateTo)}`;
    return 'All Time';
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {/* Store selector */}
      <div className="relative">
        <select
          value={filters.storeId || ''}
          onChange={handleStoreChange}
          className="h-9 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 pl-8 pr-3 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors min-w-[150px] appearance-none cursor-pointer"
        >
          <option value="">All Stores</option>
          {stores.map(store => (
            <option key={store.storeId} value={store.storeId}>
              {store.storeName}
            </option>
          ))}
        </select>
        {/* Store icon */}
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.15c0 .415.336.75.75.75z" />
          </svg>
        </span>
        {/* Chevron */}
        <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </div>

      {/* Date range trigger button */}
      <div className="relative" ref={panelRef}>
        <button
          onClick={() => setShowPanel(!showPanel)}
          className={`h-9 rounded-xl border px-3 text-sm flex items-center gap-2 transition-colors cursor-pointer ${
            hasDateFilters
              ? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-900/20 dark:text-brand-400'
              : 'border-gray-200 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'
          } hover:border-brand-300 dark:hover:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20`}
        >
          {/* Calendar icon */}
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          <span className="whitespace-nowrap">{dateLabel()}</span>
          {/* Chevron */}
          <svg className={`w-3.5 h-3.5 transition-transform ${showPanel ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown panel */}
        {showPanel && (
          <div className="absolute right-0 top-full mt-2 z-50 w-[340px] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl p-4 space-y-4">
            {/* Quick presets */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Quick Range</label>
              <div className="flex flex-wrap gap-1.5">
                {presets.map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => { applyPreset(preset); setShowPanel(false); }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-900/30 dark:hover:text-brand-400 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100 dark:border-gray-700" />

            {/* Custom date range */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Custom Range</label>
              <div className="grid grid-cols-2 gap-3">
                {/* From date */}
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">From</label>
                  <div className="flatpickr-wrapper relative">
                    <Flatpickr
                      value={filters.dateFrom ?? ''}
                      onChange={handleDateFromChange}
                      options={{
                        dateFormat: 'Y-m-d',
                        allowInput: true,
                        maxDate: filters.dateTo || undefined,
                      }}
                      placeholder="Start date"
                      className="w-full h-9 px-3 pl-8 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors"
                    />
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </span>
                  </div>
                </div>

                {/* To date */}
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">To</label>
                  <div className="flatpickr-wrapper relative">
                    <Flatpickr
                      value={filters.dateTo ?? ''}
                      onChange={handleDateToChange}
                      options={{
                        dateFormat: 'Y-m-d',
                        allowInput: true,
                        minDate: filters.dateFrom || undefined,
                      }}
                      placeholder="End date"
                      className="w-full h-9 px-3 pl-8 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors"
                    />
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            {hasDateFilters && (
              <>
                <div className="border-t border-gray-100 dark:border-gray-700" />
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => { clearDates(); setShowPanel(false); }}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    Clear Dates
                  </button>
                  <button
                    onClick={() => setShowPanel(false)}
                    className="px-4 py-1.5 text-xs font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Clear all button */}
      {hasAnyFilters && (
        <button
          onClick={clearAll}
          className="h-9 px-2.5 rounded-xl text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
          title="Reset all filters"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default DashboardFiltersBar;
