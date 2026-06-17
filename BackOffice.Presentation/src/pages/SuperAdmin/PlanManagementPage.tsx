import React, { useEffect, useState, useCallback } from 'react';
import { permissionService } from '../../services/permissionService';
import { billingService } from '../../services/billingService';
import { useConfirm } from '../../components/ui/ConfirmModal';
import type { Plan, CreatePlanDto, UpdatePlanDto, RegistryModule } from '../../types/permission';
import {
  PlanTier,
  PlanTierLabel,
  BillingCycle,
  BillingCycleLabel,
  type PlanDetail,
  type PlanAppPricing,
  type PlanApiPricing,
  type PlanFeature,
  type ApiDefinition,
} from '../../types/billing';

// ─── Types ───

interface PlanFormData {
  name: string;
  code: string;
  description: string;
  tier: string; // stored as string in form, converted to number on submit
  maxUsers: number;
  billingCycle: string; // stored as string in form for select element
  price: string; // stored as string in form
  sortOrder: number;
  isActive: boolean;
  moduleIds: number[];
}

type ModalTab = 'details' | 'app-pricing' | 'api-pricing' | 'features';

const TIER_OPTIONS = [
  { value: PlanTier.Starter, label: PlanTierLabel[PlanTier.Starter] },
  { value: PlanTier.Pro, label: PlanTierLabel[PlanTier.Pro] },
  { value: PlanTier.Business, label: PlanTierLabel[PlanTier.Business] },
  { value: PlanTier.Enterprise, label: PlanTierLabel[PlanTier.Enterprise] },
];

const PRICING_MODELS: { value: PlanAppPricing['pricingModel']; label: string }[] = [
  { value: 'per_user', label: 'Per User' },
  { value: 'per_device', label: 'Per Device' },
  { value: 'flat', label: 'Flat' },
];

const FEATURE_CATEGORIES = [
  'general',
  'web_app',
  'pos',
  'picking',
  'price_change',
  'open_api',
  'smartkart_pay',
] as const;

const APP_DEFINITIONS = [
  { id: 1, name: 'Web App' },
  { id: 2, name: 'POS' },
  { id: 3, name: 'Picking' },
  { id: 4, name: 'Price Change' },
  { id: 5, name: 'Smartkart Pay' },
];

const initialForm: PlanFormData = {
  name: '',
  code: '',
  description: '',
  tier: '',
  maxUsers: 5,
  billingCycle: '0',
  price: '',
  sortOrder: 0,
  isActive: true,
  moduleIds: [],
};

// ─── Skeleton ───

const SkeletonRow: React.FC = () => (
  <tr className="animate-pulse">
    {[...Array(6)].map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
      </td>
    ))}
  </tr>
);

// ─── Spinner ───

const Spinner: React.FC = () => (
  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

// ─── Shared input classes ───

const inputCls =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500';
const selectCls = inputCls;
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

// ══════════════════════════════════════════════════════
// AppPricingsTab
// ══════════════════════════════════════════════════════

const AppPricingsTab: React.FC<{
  planId: number;
  initial: PlanAppPricing[];
  onToast: (msg: string, type: 'success' | 'error') => void;
}> = ({ planId, initial, onToast }) => {
  const [rows, setRows] = useState<PlanAppPricing[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Seed rows from initial data; ensure every app has a row
    const map = new Map(initial.map((r) => [r.appId, r]));
    const merged = APP_DEFINITIONS.map((app) => {
      const existing = map.get(app.id);
      if (existing) return { ...existing };
      return {
        id: 0,
        planId,
        appId: app.id,
        appName: app.name,
        pricingModel: 'per_user' as const,
        pricePerUnit: 0,
        freeUnits: 0,
        maxUnits: null,
        isIncluded: false,
      } satisfies PlanAppPricing;
    });
    setRows(merged);
  }, [initial, planId]);

  const update = (idx: number, patch: Partial<PlanAppPricing>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await billingService.updatePlanAppPricings(planId, rows);
      onToast('App pricings saved', 'success');
    } catch {
      onToast('Failed to save app pricings', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">App</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Model</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">Price/Unit</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">Free Units</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">Max Units</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300">Included</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {rows.map((row, idx) => (
              <tr key={row.appId}>
                <td className="px-3 py-2 text-gray-800 dark:text-gray-200 whitespace-nowrap">{row.appName}</td>
                <td className="px-3 py-2">
                  <select value={row.pricingModel} onChange={(e) => update(idx, { pricingModel: e.target.value as PlanAppPricing['pricingModel'] })} className={selectCls}>
                    {PRICING_MODELS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input type="number" min={0} step={0.01} value={row.pricePerUnit} onChange={(e) => update(idx, { pricePerUnit: Number(e.target.value) })} className={inputCls + ' text-right'} />
                </td>
                <td className="px-3 py-2">
                  <input type="number" min={0} value={row.freeUnits} onChange={(e) => update(idx, { freeUnits: Number(e.target.value) })} className={inputCls + ' text-right'} />
                </td>
                <td className="px-3 py-2">
                  <input type="number" min={0} value={row.maxUnits ?? ''} onChange={(e) => update(idx, { maxUnits: e.target.value === '' ? null : Number(e.target.value) })} placeholder="unlimited" className={inputCls + ' text-right'} />
                </td>
                <td className="px-3 py-2 text-center">
                  <input type="checkbox" checked={row.isIncluded} onChange={(e) => update(idx, { isIncluded: e.target.checked })} className="rounded border-gray-300 text-brand-500 focus:ring-brand-500" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2">
          {saving && <Spinner />}
          Save App Pricings
        </button>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════
// ApiPricingsTab
// ══════════════════════════════════════════════════════

const ApiPricingsTab: React.FC<{
  planId: number;
  initial: PlanApiPricing[];
  onToast: (msg: string, type: 'success' | 'error') => void;
}> = ({ planId, initial, onToast }) => {
  const [apiDefs, setApiDefs] = useState<ApiDefinition[]>([]);
  const [rows, setRows] = useState<PlanApiPricing[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingDefs, setLoadingDefs] = useState(true);

  useEffect(() => {
    billingService
      .getApiDefinitions()
      .then((res) => {
        if (res.data.isSuccess) setApiDefs(res.data.response);
      })
      .catch(() => {})
      .finally(() => setLoadingDefs(false));
  }, []);

  useEffect(() => {
    if (apiDefs.length === 0) return;
    const map = new Map(initial.map((r) => [r.apiDefinitionId, r]));
    const merged = apiDefs.map((def) => {
      const existing = map.get(def.id);
      if (existing) return { ...existing };
      return {
        id: 0,
        planId,
        apiDefinitionId: def.id,
        apiName: def.name,
        ratePerCall: def.defaultRatePerCall,
        freeTierCalls: def.defaultFreeTier,
        maxCallsPerMonth: null,
        isIncluded: false,
      } satisfies PlanApiPricing;
    });
    setRows(merged);
  }, [apiDefs, initial, planId]);

  const update = (idx: number, patch: Partial<PlanApiPricing>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await billingService.updatePlanApiPricings(planId, rows);
      onToast('API pricings saved', 'success');
    } catch {
      onToast('Failed to save API pricings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loadingDefs) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400 text-sm">
        <Spinner />
        <span className="ml-2">Loading API definitions...</span>
      </div>
    );
  }

  if (apiDefs.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">No API definitions found. Create them first.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">API</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">Rate/Call</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">Free Tier</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">Max Calls/Mo</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300">Included</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {rows.map((row, idx) => (
              <tr key={row.apiDefinitionId}>
                <td className="px-3 py-2 text-gray-800 dark:text-gray-200 whitespace-nowrap">{row.apiName}</td>
                <td className="px-3 py-2">
                  <input type="number" min={0} step={0.0001} value={row.ratePerCall} onChange={(e) => update(idx, { ratePerCall: Number(e.target.value) })} className={inputCls + ' text-right'} />
                </td>
                <td className="px-3 py-2">
                  <input type="number" min={0} value={row.freeTierCalls} onChange={(e) => update(idx, { freeTierCalls: Number(e.target.value) })} className={inputCls + ' text-right'} />
                </td>
                <td className="px-3 py-2">
                  <input type="number" min={0} value={row.maxCallsPerMonth ?? ''} onChange={(e) => update(idx, { maxCallsPerMonth: e.target.value === '' ? null : Number(e.target.value) })} placeholder="unlimited" className={inputCls + ' text-right'} />
                </td>
                <td className="px-3 py-2 text-center">
                  <input type="checkbox" checked={row.isIncluded} onChange={(e) => update(idx, { isIncluded: e.target.checked })} className="rounded border-gray-300 text-brand-500 focus:ring-brand-500" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2">
          {saving && <Spinner />}
          Save API Pricings
        </button>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════
// FeaturesTab
// ══════════════════════════════════════════════════════

const emptyFeature = (planId: number, sortOrder: number): PlanFeature => ({
  id: 0,
  planId,
  appId: null,
  category: 'general',
  featureName: '',
  description: null,
  isEnabled: true,
  sortOrder,
});

const FeaturesTab: React.FC<{
  planId: number;
  initial: PlanFeature[];
  onToast: (msg: string, type: 'success' | 'error') => void;
}> = ({ planId, initial, onToast }) => {
  const [rows, setRows] = useState<PlanFeature[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRows(initial.length > 0 ? initial.map((r) => ({ ...r })) : []);
  }, [initial]);

  const update = (idx: number, patch: Partial<PlanFeature>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    const maxSort = rows.reduce((max, r) => Math.max(max, r.sortOrder), 0);
    setRows((prev) => [...prev, emptyFeature(planId, maxSort + 1)]);
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    const valid = rows.filter((r) => r.featureName.trim() !== '');
    setSaving(true);
    try {
      await billingService.updatePlanFeatures(planId, valid);
      onToast('Features saved', 'success');
    } catch {
      onToast('Failed to save features', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
        {rows.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">No features yet. Add one below.</p>
        )}
        {rows.map((row, idx) => (
          <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-2">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Category</label>
                  <select value={row.category} onChange={(e) => update(idx, { category: e.target.value })} className={selectCls}>
                    {FEATURE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Feature Name *</label>
                  <input type="text" value={row.featureName} onChange={(e) => update(idx, { featureName: e.target.value })} className={inputCls} placeholder="e.g. Barcode Scanning" />
                </div>
              </div>
              <button onClick={() => removeRow(idx)} className="mt-6 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" title="Remove">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <input type="text" value={row.description ?? ''} onChange={(e) => update(idx, { description: e.target.value || null })} className={inputCls} placeholder="Optional description" />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={row.isEnabled} onChange={(e) => update(idx, { isEnabled: e.target.checked })} className="rounded border-gray-300 text-brand-500 focus:ring-brand-500" />
                Enabled
              </label>
              <div className="flex items-center gap-2">
                <label className={labelCls + ' mb-0'}>Sort</label>
                <input type="number" min={0} value={row.sortOrder} onChange={(e) => update(idx, { sortOrder: Number(e.target.value) })} className={inputCls + ' w-20 text-right'} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between">
        <button onClick={addRow} type="button" className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Feature
        </button>
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2">
          {saving && <Spinner />}
          Save Features
        </button>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════

const PlanManagementPage: React.FC = () => {
  const { confirm, ConfirmDialog } = useConfirm();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [formData, setFormData] = useState<PlanFormData>(initialForm);
  const [modules, setModules] = useState<RegistryModule[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // New state for tabs and plan detail
  const [activeTab, setActiveTab] = useState<ModalTab>('details');
  const [planDetail, setPlanDetail] = useState<PlanDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Load available modules for plan assignment
  useEffect(() => {
    permissionService.getModuleTree().then((res) => {
      if (res.data.isSuccess) {
        setModules(res.data.response);
      }
    }).catch(() => { /* ignore */ });
  }, []);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean> = {
        startRow: page * pageSize,
        endRow: (page + 1) * pageSize,
        sortColumn: 'Name',
        sortDirection: 'asc',
      };
      if (search.trim()) {
        params.customGridSearchText = search.trim();
        params.customGridSearchColumns = 'Name,Code';
      }
      const response = await permissionService.getPlans(params);
      if (response.data.isSuccess) {
        setPlans(response.data.response.data);
        setTotalRecords(response.data.response.totalRecords);
      }
    } catch {
      showToast('Failed to load plans', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  const loadPlanDetail = async (planId: number) => {
    setLoadingDetail(true);
    try {
      const res = await billingService.getPlanDetail(planId);
      if (res.data.isSuccess) {
        setPlanDetail(res.data.response);
      }
    } catch {
      // detail load failed – tabs will just show empty state
    } finally {
      setLoadingDetail(false);
    }
  };

  const openCreateModal = () => {
    setEditingPlan(null);
    setFormData(initialForm);
    setActiveTab('details');
    setPlanDetail(null);
    setShowModal(true);
  };

  const openEditModal = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      code: plan.code,
      description: plan.description || '',
      tier: '',
      maxUsers: plan.maxUsers,
      billingCycle: String(plan.billingCycle ?? 0),
      price: String(plan.price ?? ''),
      sortOrder: 0,
      isActive: plan.isActive,
      moduleIds: plan.moduleIds || [],
    });
    setActiveTab('details');
    setPlanDetail(null);
    setShowModal(true);
    // Load full detail for tabs
    loadPlanDetail(plan.id);
  };

  // When plan detail loads, backfill tier/sortOrder into formData
  useEffect(() => {
    if (planDetail && editingPlan) {
      setFormData((prev) => ({
        ...prev,
        tier: planDetail.tier != null ? String(planDetail.tier) : '',
        sortOrder: planDetail.sortOrder || 0,
        description: planDetail.description || prev.description,
        billingCycle: String(planDetail.billingCycle ?? 0),
        price: String(planDetail.price ?? prev.price),
      }));
    }
  }, [planDetail, editingPlan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const tierValue = formData.tier !== '' ? Number(formData.tier) : null;
      const submitData = {
        ...formData,
        tier: tierValue,
        billingCycle: Number(formData.billingCycle),
        price: Number(formData.price),
      };
      if (editingPlan) {
        const dto: UpdatePlanDto = { id: editingPlan.id, ...submitData };
        await permissionService.updatePlan(editingPlan.id, dto);
        showToast('Plan updated successfully', 'success');
      } else {
        const dto: CreatePlanDto = { ...submitData };
        const res = await permissionService.createPlan(dto);
        showToast('Plan created successfully', 'success');
        // If create returned an id, switch to edit mode so tabs become available
        if (res?.data?.isSuccess && res.data.response) {
          const newId = typeof res.data.response === 'number' ? res.data.response : (res.data.response as unknown as { id: number }).id;
          if (newId) {
            const newPlan: Plan = {
              id: newId,
              ...formData,
              billingCycle: Number(formData.billingCycle),
              price: Number(formData.price),
            } as Plan;
            setEditingPlan(newPlan);
            loadPlanDetail(newId);
          }
        }
      }
      loadPlans();
    } catch {
      showToast('Operation failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (plan: Plan) => {
    const ok = await confirm({
      title: 'Delete Plan',
      message: `Are you sure you want to delete the plan "${plan.name}"? This action cannot be undone.`,
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await permissionService.deletePlan(plan.id);
      showToast('Plan deleted successfully', 'success');
      loadPlans();
    } catch {
      showToast('Delete failed', 'error');
    }
  };

  const toggleModule = (moduleId: number) => {
    setFormData((prev) => ({
      ...prev,
      moduleIds: prev.moduleIds.includes(moduleId)
        ? prev.moduleIds.filter((id) => id !== moduleId)
        : [...prev.moduleIds, moduleId],
    }));
  };

  const totalPages = Math.ceil(totalRecords / pageSize);

  const hasPlanId = !!editingPlan;

  const tabs: { key: ModalTab; label: string; disabled: boolean }[] = [
    { key: 'details', label: 'Details', disabled: false },
    { key: 'app-pricing', label: 'App Pricings', disabled: !hasPlanId },
    { key: 'api-pricing', label: 'API Pricings', disabled: !hasPlanId },
    { key: 'features', label: 'Features', disabled: !hasPlanId },
  ];

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Plan Management</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Create and manage subscription plans with module assignments
        </p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search plans..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="w-full sm:w-72 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Plan
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Code</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Max Users</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Price</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Active</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
              ) : plans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <p>No plans found</p>
                  </td>
                </tr>
              ) : (
                plans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{plan.name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{plan.code}</td>
                    <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{plan.maxUsers}</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">${plan.price?.toFixed(2) ?? '0.00'} ({BillingCycleLabel[plan.billingCycle] ?? 'Monthly'})</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                          plan.isActive
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {plan.isActive ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => openEditModal(plan)} className="text-brand-500 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300" title="Edit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => handleDelete(plan)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" title="Delete">
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

        {totalRecords > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <span className="text-xs text-gray-600 dark:text-gray-400">
              Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalRecords)} of {totalRecords}
            </span>
            <div className="flex gap-1">
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-3 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700">Prev</button>
              <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="px-3 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Plan Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingPlan ? 'Edit Plan' : 'Add Plan'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 px-5">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => !tab.disabled && setActiveTab(tab.key)}
                  disabled={tab.disabled}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === tab.key
                      ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                      : tab.disabled
                      ? 'border-transparent text-gray-400 dark:text-gray-600 cursor-not-allowed'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="p-5 overflow-y-auto flex-1">
              {/* Loading overlay for detail */}
              {loadingDetail && activeTab !== 'details' && (
                <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400 text-sm">
                  <Spinner />
                  <span className="ml-2">Loading plan details...</span>
                </div>
              )}

              {/* Details tab */}
              {activeTab === 'details' && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Name *</label>
                      <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={inputCls} placeholder="e.g. Professional" />
                    </div>
                    <div>
                      <label className={labelCls}>Code *</label>
                      <input type="text" required value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        className={inputCls} placeholder="e.g. PRO" />
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Description</label>
                    <textarea rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className={inputCls + ' resize-none'} placeholder="Brief description of this plan" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Tier</label>
                      <select value={formData.tier} onChange={(e) => setFormData({ ...formData, tier: e.target.value })} className={selectCls}>
                        <option value="">-- None --</option>
                        {TIER_OPTIONS.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Sort Order</label>
                      <input type="number" min={0} value={formData.sortOrder} onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
                        className={inputCls} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Max Users</label>
                      <input type="number" min={1} value={formData.maxUsers} onChange={(e) => setFormData({ ...formData, maxUsers: Number(e.target.value) })}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Billing Cycle</label>
                      <select value={formData.billingCycle} onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value })} className={selectCls}>
                        <option value={BillingCycle.Monthly}>{BillingCycleLabel[BillingCycle.Monthly]}</option>
                        <option value={BillingCycle.Yearly}>{BillingCycleLabel[BillingCycle.Yearly]}</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Price ($)</label>
                      <input type="number" min={0} step={0.01} value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        className={inputCls} placeholder="0.00" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="planIsActive" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="rounded border-gray-300 text-brand-500 focus:ring-brand-500" />
                    <label htmlFor="planIsActive" className="text-sm text-gray-700 dark:text-gray-300">Active</label>
                  </div>

                  {/* Module assignment */}
                  {modules.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Included Modules</label>
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                        {modules.map((mod) => (
                          <label key={mod.moduleId} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.moduleIds.includes(mod.moduleId)}
                              onChange={() => toggleModule(mod.moduleId)}
                              className="rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">{mod.moduleName}</span>
                            <span className="text-xs text-gray-400">({mod.screens?.length || 0} screens)</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={() => setShowModal(false)}
                      className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
                      Cancel
                    </button>
                    <button type="submit" disabled={saving}
                      className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2">
                      {saving && <Spinner />}
                      {editingPlan ? 'Update' : 'Create'}
                    </button>
                  </div>
                </form>
              )}

              {/* App Pricings tab */}
              {activeTab === 'app-pricing' && editingPlan && !loadingDetail && (
                <AppPricingsTab
                  planId={editingPlan.id}
                  initial={planDetail?.appPricings ?? []}
                  onToast={showToast}
                />
              )}

              {/* API Pricings tab */}
              {activeTab === 'api-pricing' && editingPlan && !loadingDetail && (
                <ApiPricingsTab
                  planId={editingPlan.id}
                  initial={planDetail?.apiPricings ?? []}
                  onToast={showToast}
                />
              )}

              {/* Features tab */}
              {activeTab === 'features' && editingPlan && !loadingDetail && (
                <FeaturesTab
                  planId={editingPlan.id}
                  initial={planDetail?.features ?? []}
                  onToast={showToast}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {ConfirmDialog}
    </div>
  );
};

export default PlanManagementPage;
