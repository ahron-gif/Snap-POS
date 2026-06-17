import React, { useEffect, useState, useCallback } from 'react';
import { billingService } from '../../services/billingService';
import { useConfirm } from '../../components/ui/ConfirmModal';
import type { ApiDefinition, CreateApiDefinition, BillingConfigItem } from '../../types/billing';

// ─── API Definition Form ───

interface ApiDefFormData {
  name: string;
  code: string;
  description: string;
  defaultRatePerCall: number;
  defaultFreeTier: number;
}

const initialApiDefForm: ApiDefFormData = {
  name: '',
  code: '',
  description: '',
  defaultRatePerCall: 0,
  defaultFreeTier: 0,
};

// ─── Billing Config Edit Form ───

interface ConfigFormData {
  configKey: string;
  configValue: string;
  description: string;
}

// ─── Skeleton Row ───

const SkeletonRow: React.FC<{ cols: number }> = ({ cols }) => (
  <tr className="animate-pulse">
    {[...Array(cols)].map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
      </td>
    ))}
  </tr>
);

const GlobalPricingPage: React.FC = () => {
  const { confirm, ConfirmDialog } = useConfirm();

  // ─── API Definitions State ───
  const [apiDefs, setApiDefs] = useState<ApiDefinition[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [editingApiDef, setEditingApiDef] = useState<ApiDefinition | null>(null);
  const [apiForm, setApiForm] = useState<ApiDefFormData>(initialApiDefForm);
  const [apiSaving, setApiSaving] = useState(false);

  // ─── Billing Config State ───
  const [configs, setConfigs] = useState<BillingConfigItem[]>([]);
  const [configLoading, setConfigLoading] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configForm, setConfigForm] = useState<ConfigFormData>({ configKey: '', configValue: '', description: '' });
  const [configSaving, setConfigSaving] = useState(false);

  // ─── Toast ───
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // ─── Load API Definitions ───

  const loadApiDefs = useCallback(async () => {
    setApiLoading(true);
    try {
      const res = await billingService.getApiDefinitions();
      if (res.data.isSuccess) {
        setApiDefs(res.data.response);
      }
    } catch {
      setToast({ message: 'Failed to load API definitions', type: 'error' });
    } finally {
      setApiLoading(false);
    }
  }, []);

  // ─── Load Billing Configs ───

  const loadConfigs = useCallback(async () => {
    setConfigLoading(true);
    try {
      const res = await billingService.getBillingConfigs();
      if (res.data.isSuccess) {
        setConfigs(res.data.response);
      }
    } catch {
      setToast({ message: 'Failed to load billing configs', type: 'error' });
    } finally {
      setConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApiDefs();
    loadConfigs();
  }, [loadApiDefs, loadConfigs]);

  // ─── API Definition CRUD ───

  const openCreateApiModal = () => {
    setEditingApiDef(null);
    setApiForm(initialApiDefForm);
    setShowApiModal(true);
  };

  const openEditApiModal = (def: ApiDefinition) => {
    setEditingApiDef(def);
    setApiForm({
      name: def.name,
      code: def.code,
      description: def.description || '',
      defaultRatePerCall: def.defaultRatePerCall,
      defaultFreeTier: def.defaultFreeTier,
    });
    setShowApiModal(true);
  };

  const handleApiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiSaving(true);
    try {
      if (editingApiDef) {
        await billingService.updateApiDefinition(editingApiDef.id, {
          ...editingApiDef,
          name: apiForm.name,
          code: apiForm.code,
          description: apiForm.description || null,
          defaultRatePerCall: apiForm.defaultRatePerCall,
          defaultFreeTier: apiForm.defaultFreeTier,
        });
        setToast({ message: 'API definition updated successfully', type: 'success' });
      } else {
        const dto: CreateApiDefinition = {
          name: apiForm.name,
          code: apiForm.code,
          description: apiForm.description || undefined,
          defaultRatePerCall: apiForm.defaultRatePerCall,
          defaultFreeTier: apiForm.defaultFreeTier,
        };
        await billingService.createApiDefinition(dto);
        setToast({ message: 'API definition created successfully', type: 'success' });
      }
      setShowApiModal(false);
      loadApiDefs();
    } catch {
      setToast({ message: 'Operation failed', type: 'error' });
    } finally {
      setApiSaving(false);
    }
  };

  const handleDeleteApiDef = async (def: ApiDefinition) => {
    const ok = await confirm({
      title: 'Delete API Definition',
      message: `Are you sure you want to delete the API definition "${def.name}"? This action cannot be undone.`,
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await billingService.deleteApiDefinition(def.id);
      setToast({ message: 'API definition deleted', type: 'success' });
      loadApiDefs();
    } catch {
      setToast({ message: 'Delete failed', type: 'error' });
    }
  };

  // ─── Billing Config Edit ───

  const openConfigEditModal = (cfg: BillingConfigItem) => {
    setConfigForm({
      configKey: cfg.configKey,
      configValue: cfg.configValue,
      description: cfg.description || '',
    });
    setShowConfigModal(true);
  };

  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSaving(true);
    try {
      await billingService.updateBillingConfig({
        configKey: configForm.configKey,
        configValue: configForm.configValue,
      });
      setToast({ message: 'Config updated successfully', type: 'success' });
      setShowConfigModal(false);
      loadConfigs();
    } catch {
      setToast({ message: 'Update failed', type: 'error' });
    } finally {
      setConfigSaving(false);
    }
  };

  return (
    <div>
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Global Pricing</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage API definitions and billing configuration defaults
        </p>
      </div>

      {/* ═══════════════════ Section 1: API Definitions ═══════════════════ */}

      <div className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">API Definitions</h2>
          <button
            onClick={openCreateApiModal}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add API Definition
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Code</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Default Rate</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Default Free Tier</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Active</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {apiLoading ? (
                  [...Array(4)].map((_, i) => <SkeletonRow key={i} cols={6} />)
                ) : apiDefs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                      <p>No API definitions found</p>
                    </td>
                  </tr>
                ) : (
                  apiDefs.map((def) => (
                    <tr key={def.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{def.name}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{def.code}</td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                        ${def.defaultRatePerCall.toFixed(4)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                        {def.defaultFreeTier.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                            def.isActive
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}
                        >
                          {def.isActive ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => openEditApiModal(def)} className="text-brand-500 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300" title="Edit">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={() => handleDeleteApiDef(def)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" title="Delete">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ═══════════════════ Section 2: Billing Configuration ═══════════════════ */}

      <div className="mb-8">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Billing Configuration</h2>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Key</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Value</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Description</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {configLoading ? (
                  [...Array(3)].map((_, i) => <SkeletonRow key={i} cols={4} />)
                ) : configs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                      <p>No billing configs found</p>
                    </td>
                  </tr>
                ) : (
                  configs.map((cfg) => (
                    <tr key={cfg.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200 font-mono text-xs">{cfg.configKey}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs">{cfg.configValue}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{cfg.description || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => openConfigEditModal(cfg)} className="text-brand-500 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300" title="Edit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ═══════════════════ API Definition Modal ═══════════════════ */}

      {showApiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingApiDef ? 'Edit API Definition' : 'Add API Definition'}
              </h3>
              <button onClick={() => setShowApiModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleApiSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                  <input type="text" required value={apiForm.name} onChange={(e) => setApiForm({ ...apiForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500" placeholder="e.g. Geocoding API" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Code *</label>
                  <input type="text" required value={apiForm.code} onChange={(e) => setApiForm({ ...apiForm, code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500" placeholder="e.g. GEOCODE" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea rows={2} value={apiForm.description} onChange={(e) => setApiForm({ ...apiForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default Rate / Call ($)</label>
                  <input type="number" min={0} step={0.0001} value={apiForm.defaultRatePerCall} onChange={(e) => setApiForm({ ...apiForm, defaultRatePerCall: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default Free Tier</label>
                  <input type="number" min={0} value={apiForm.defaultFreeTier} onChange={(e) => setApiForm({ ...apiForm, defaultFreeTier: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowApiModal(false)}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
                  Cancel
                </button>
                <button type="submit" disabled={apiSaving}
                  className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2">
                  {apiSaving && (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {editingApiDef ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {ConfirmDialog}

      {/* ═══════════════════ Billing Config Edit Modal ═══════════════════ */}

      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Config</h3>
              <button onClick={() => setShowConfigModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleConfigSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key</label>
                <input type="text" disabled value={configForm.configKey}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed" />
              </div>

              {configForm.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{configForm.description}</p>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Value *</label>
                <input type="text" required value={configForm.configValue} onChange={(e) => setConfigForm({ ...configForm, configValue: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
                  Cancel
                </button>
                <button type="submit" disabled={configSaving}
                  className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2">
                  {configSaving && (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalPricingPage;
