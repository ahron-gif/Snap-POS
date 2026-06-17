import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { billingService } from '../../services/billingService';
import { usePermissions } from '../../context/PermissionContext';
import type { ApiDefinition } from '../../types/billing';

const PERM_VIEW = 'admin.api_pricing.view';
const PERM_EDIT = 'admin.api_pricing.edit';

interface EditRow {
  id: number;
  defaultFreeTier: string;
  defaultRatePerCall: string;
}

/**
 * SuperAdmin-only "API Pricing" screen. Edits ApiDefinition.DefaultFreeTier
 * (one-time free quota per customer) and ApiDefinition.DefaultRatePerCall
 * (USD/call past the free quota). The credit-deduction stored proc reads these
 * defaults (with optional CustomerApiOverride and PlanApiPricing overlays).
 */
const ApiPricingPage: React.FC = () => {
  const { hasPermission } = usePermissions();
  const canView = hasPermission(PERM_VIEW);
  const canEdit = hasPermission(PERM_EDIT);

  const [defs, setDefs] = useState<ApiDefinition[]>([]);
  const [edits, setEdits] = useState<Record<number, EditRow>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await billingService.getApiDefinitions();
      if (resp.data?.isSuccess && resp.data.response) {
        setDefs(resp.data.response);
      } else {
        setError(resp.data?.message ?? 'Failed to load API definitions.');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load API definitions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (canView) load(); else setLoading(false); }, [canView, load]);

  const setField = (id: number, key: 'defaultFreeTier' | 'defaultRatePerCall', value: string) => {
    setEdits(prev => {
      const existing = prev[id] ?? defs
        .filter(d => d.id === id)
        .map(d => ({
          id,
          defaultFreeTier: String(d.defaultFreeTier),
          defaultRatePerCall: String(d.defaultRatePerCall),
        }))[0];
      return { ...prev, [id]: { ...existing, [key]: value } };
    });
  };

  const isDirty = (def: ApiDefinition) => {
    const e = edits[def.id];
    if (!e) return false;
    return (
      Number(e.defaultFreeTier) !== def.defaultFreeTier ||
      Number(e.defaultRatePerCall) !== def.defaultRatePerCall
    );
  };

  const handleSave = async (def: ApiDefinition) => {
    const e = edits[def.id];
    if (!e) return;
    const freeTier = Number(e.defaultFreeTier);
    const rate = Number(e.defaultRatePerCall);

    if (!Number.isFinite(freeTier) || freeTier < 0) {
      setError(`Free tier must be a non-negative number (${def.code}).`);
      return;
    }
    if (!Number.isFinite(rate) || rate < 0) {
      setError(`Rate per call must be a non-negative number (${def.code}).`);
      return;
    }

    setSaving(def.id);
    setError(null);
    try {
      const resp = await billingService.updateApiDefinition(def.id, {
        id: def.id,
        name: def.name,
        code: def.code,
        description: def.description,
        defaultFreeTier: freeTier,
        defaultRatePerCall: rate,
        isActive: def.isActive,
        sortOrder: def.sortOrder,
      });

      if (resp.data?.isSuccess) {
        setDefs(prev => prev.map(d => d.id === def.id
          ? { ...d, defaultFreeTier: freeTier, defaultRatePerCall: rate }
          : d
        ));
        setEdits(prev => {
          const next = { ...prev };
          delete next[def.id];
          return next;
        });
        setSavedId(def.id);
        setTimeout(() => setSavedId(curr => curr === def.id ? null : curr), 2000);
      } else {
        setError(resp.data?.message ?? 'Save failed.');
      }
    } catch (ex: any) {
      setError(ex?.response?.data?.message ?? ex?.message ?? 'Save failed.');
    } finally {
      setSaving(null);
    }
  };

  const rows = useMemo(() => defs.slice().sort((a, b) => a.sortOrder - b.sortOrder), [defs]);

  if (!canView) {
    return (
      <div className="p-6 text-sm text-gray-600 dark:text-gray-400">
        You do not have permission to view this page.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">API Pricing</h1>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          Default <b>free-tier</b> (one-time grant per customer) and <b>rate per call</b> for each metered OpenAPI
          endpoint. Per-plan overrides live on the Plan editor; per-customer overrides are managed elsewhere. Changes
          apply immediately to the credit-deduction stored procedure.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-600 dark:text-gray-400">
              <tr>
                <th className="text-left px-4 py-2">Code</th>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2 hidden md:table-cell">Description</th>
                <th className="text-right px-4 py-2">Default Free Tier</th>
                <th className="text-right px-4 py-2">Default Rate / Call (USD)</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-xs text-gray-500 dark:text-gray-400">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-xs text-gray-500 dark:text-gray-400">
                    No API definitions configured. Add one via Global Pricing.
                  </td>
                </tr>
              ) : (
                rows.map(def => {
                  const e = edits[def.id] ?? {
                    id: def.id,
                    defaultFreeTier: String(def.defaultFreeTier),
                    defaultRatePerCall: String(def.defaultRatePerCall),
                  };
                  const dirty = isDirty(def);
                  return (
                    <tr key={def.id} className="border-t border-gray-100 dark:border-gray-700">
                      <td className="px-4 py-2 font-mono text-xs text-gray-800 dark:text-gray-200">{def.code}</td>
                      <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{def.name}</td>
                      <td className="px-4 py-2 hidden md:table-cell text-xs text-gray-600 dark:text-gray-400 truncate max-w-xs">{def.description ?? '—'}</td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          disabled={!canEdit || saving === def.id}
                          value={e.defaultFreeTier}
                          onChange={ev => setField(def.id, 'defaultFreeTier', ev.target.value)}
                          className="w-24 px-2 py-1 text-right border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 tabular-nums"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          step="0.0001"
                          disabled={!canEdit || saving === def.id}
                          value={e.defaultRatePerCall}
                          onChange={ev => setField(def.id, 'defaultRatePerCall', ev.target.value)}
                          className="w-28 px-2 py-1 text-right border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 tabular-nums"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                          def.isActive
                            ? 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {def.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        {savedId === def.id ? (
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">Saved</span>
                        ) : (
                          <button
                            onClick={() => handleSave(def)}
                            disabled={!canEdit || !dirty || saving === def.id}
                            className="px-3 py-1 text-xs bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded font-medium"
                          >
                            {saving === def.id ? 'Saving…' : 'Save'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ApiPricingPage;
