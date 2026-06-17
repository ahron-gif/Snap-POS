import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { smtpService } from '../../services/smtpService';
import { permissionService } from '../../services/permissionService';
import type { TenantListItem } from '../../types/permission';
import type { SmtpSettingsDto, SmtpSource, SmtpStoreLookup } from '../../types/smtp';
import { GLOBAL_STORE_ID } from '../../types/smtp';
import { focusFirstInvalid } from '../../hooks/useFocusFirstInvalid';

interface FormState {
  host: string;
  port: string;
  useSsl: boolean;
  emailAddress: string;
  password: string;
  storeEmail: string;
}

const emptyForm: FormState = {
  host: '',
  port: '',
  useSsl: false,
  emailAddress: '',
  password: '',
  storeEmail: '',
};

const sourceLabel = (source: SmtpSource): { text: string; className: string } => {
  switch (source) {
    case 'store':
      return {
        text: 'Store-specific SMTP',
        className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      };
    case 'global':
      return {
        text: 'Global default',
        className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      };
    case 'appsettings':
      return {
        text: 'App Settings fallback',
        className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      };
    default:
      return {
        text: 'No configuration',
        className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
      };
  }
};

// Module-level caches survive tab switches (the dashboard keeps the component mounted
// via hidden/active class toggles, but we still defend against fresh mounts).
const tenantsCache: { data: TenantListItem[] | null } = { data: null };
const storesCache = new Map<number, SmtpStoreLookup[]>();

const SmtpSettingsPage: React.FC = () => {
  const { customerId: customerIdParam } = useParams<{ customerId: string }>();
  const navigate = useNavigate();

  const paramCustomerId = customerIdParam ? Number(customerIdParam) : null;
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(paramCustomerId);
  const customerId = paramCustomerId ?? selectedCustomerId;

  const [tenants, setTenants] = useState<TenantListItem[]>(tenantsCache.data ?? []);
  const [tenantsLoading, setTenantsLoading] = useState(tenantsCache.data == null);

  const [stores, setStores] = useState<SmtpStoreLookup[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);

  const [storeId, setStoreId] = useState<string>(GLOBAL_STORE_ID);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [serverData, setServerData] = useState<SmtpSettingsDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Abort in-flight SMTP requests when the user switches customer/store quickly
  const abortRef = useRef<AbortController | null>(null);

  // ── Tenants: load once, cache, only when no param is supplied ──────────────
  useEffect(() => {
    if (paramCustomerId) return;
    if (tenantsCache.data) {
      setTenants(tenantsCache.data);
      setTenantsLoading(false);
      return;
    }
    setTenantsLoading(true);
    permissionService
      .getTenants({ startRow: 0, endRow: 500, sortColumn: 'CustomerName', sortDirection: 'asc' })
      .then((res) => {
        if (res.data.isSuccess) {
          tenantsCache.data = res.data.response.data;
          setTenants(res.data.response.data);
        }
      })
      .catch(() => setToast({ message: 'Failed to load tenants', type: 'error' }))
      .finally(() => setTenantsLoading(false));
  }, [paramCustomerId]);

  // ── Stores: refresh when tenant changes (with cache) ───────────────────────
  useEffect(() => {
    if (!customerId) {
      setStores([]);
      return;
    }
    const cached = storesCache.get(customerId);
    if (cached) {
      setStores(cached);
      return;
    }
    setStoresLoading(true);
    smtpService
      .getStores(customerId)
      .then((res) => {
        if (res.data.isSuccess) {
          storesCache.set(customerId, res.data.response);
          setStores(res.data.response);
        }
      })
      .catch(() => setToast({ message: 'Failed to load stores', type: 'error' }))
      .finally(() => setStoresLoading(false));
  }, [customerId]);

  // ── SMTP values: reload on customer/store change, cancel prior in-flight ──
  const load = useCallback(async () => {
    if (!customerId) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const res = await smtpService.get(customerId, storeId);
      if (controller.signal.aborted) return;
      if (res.data.isSuccess && res.data.response) {
        const d = res.data.response;
        setServerData(d);
        setForm({
          host: d.host ?? '',
          port: d.port != null ? String(d.port) : '',
          useSsl: d.useSsl,
          emailAddress: d.emailAddress ?? '',
          password: d.password ?? '',
          storeEmail: d.storeEmail ?? '',
        });
      } else {
        setToast({ message: res.data.message || 'Failed to load SMTP settings', type: 'error' });
      }
    } catch (err: any) {
      if (err?.name !== 'CanceledError' && err?.code !== 'ERR_CANCELED') {
        setToast({ message: 'Failed to load SMTP settings', type: 'error' });
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [customerId, storeId]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const onChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = (): string | null => {
    if (form.host.trim() && !form.port.trim()) return 'Port is required when host is set.';
    if (form.port.trim()) {
      const p = Number(form.port);
      if (!Number.isInteger(p) || p <= 0 || p > 65535) return 'Port must be a number between 1 and 65535.';
    }
    if (form.emailAddress.trim() && !form.emailAddress.includes('@'))
      return 'Email address must be a valid email.';
    if (form.storeEmail.trim() && form.storeEmail.trim() !== '0' && !form.storeEmail.includes('@'))
      return 'Store email must be a valid email.';
    return null;
  };

  // Refs for focus-first-invalid. Each input below pulls focus when its
  // own validation rule fails (port without host, malformed email).
  const portRef = useRef<HTMLInputElement | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const storeEmailRef = useRef<HTMLInputElement | null>(null);

  const onSave = async () => {
    if (!customerId) {
      setToast({ message: 'Please select a tenant first.', type: 'error' });
      return;
    }
    const err = validate();
    if (err) {
      setToast({ message: err, type: 'error' });
      // Pick the right input to focus based on which rule fired. Order
      // matters: port is checked before emails inside `validate`.
      const portRule = !!form.host.trim() && !form.port.trim();
      const portRange = !portRule && !!form.port.trim() &&
        (() => { const p = Number(form.port); return !Number.isInteger(p) || p <= 0 || p > 65535; })();
      const emailRule = !!form.emailAddress.trim() && !form.emailAddress.includes('@');
      const storeEmailRule = !!form.storeEmail.trim() && form.storeEmail.trim() !== '0' && !form.storeEmail.includes('@');
      focusFirstInvalid([
        { ref: portRef, isValid: !portRule && !portRange },
        { ref: emailRef, isValid: !emailRule },
        { ref: storeEmailRef, isValid: !storeEmailRule },
      ]);
      return;
    }
    setSaving(true);
    try {
      const res = await smtpService.update(customerId, {
        storeId,
        host: form.host.trim(),
        port: form.port.trim() ? Number(form.port) : null,
        useSsl: form.useSsl,
        emailAddress: form.emailAddress.trim(),
        password: form.password,
        storeEmail: form.storeEmail.trim(),
      });
      if (res.data.isSuccess) {
        setToast({ message: res.data.message || 'SMTP settings saved', type: 'success' });
        load();
      } else {
        setToast({ message: res.data.message || 'Save failed', type: 'error' });
      }
    } catch {
      setToast({ message: 'Save failed', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const badge = sourceLabel(serverData?.source ?? 'none');

  const storeOptions = useMemo(
    () => [
      { value: GLOBAL_STORE_ID, label: 'Global default (all stores)' },
      ...stores.map((s) => ({
        value: s.storeId,
        label: `${s.storeName}${s.isMainStore ? ' (main)' : ''}`,
      })),
    ],
    [stores]
  );

  return (
    <div className="w-full">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          {paramCustomerId && (
            <button
              type="button"
              onClick={() => navigate('/super-admin/tenants')}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-1"
            >
              ← Back to Tenants
            </button>
          )}
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SMTP / Email Settings</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {customerId
              ? 'Per-store SMTP config resolves: Store → Global → App Settings.'
              : 'Select a tenant to view or edit its SMTP configuration.'}
          </p>
        </div>
        {customerId && serverData && (
          <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${badge.className}`}>
            Current source: {badge.text}
          </span>
        )}
      </div>

      {/* ── Pickers ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tenant</label>
          {paramCustomerId ? (
            <input
              type="text"
              value={`Tenant #${paramCustomerId}`}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-200"
            />
          ) : (
            <select
              value={selectedCustomerId ?? ''}
              onChange={(e) => {
                setSelectedCustomerId(e.target.value ? Number(e.target.value) : null);
                setStoreId(GLOBAL_STORE_ID);
              }}
              disabled={tenantsLoading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-60"
            >
              <option value="">{tenantsLoading ? 'Loading tenants…' : '— Select a tenant —'}</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.customerName}
                  {t.email ? ` — ${t.email}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Store</label>
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            disabled={!customerId || storesLoading}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-60"
          >
            {storesLoading ? (
              <option>Loading stores…</option>
            ) : (
              storeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            )}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Global = applies to every store via the <code>00000000-…-000</code> row.
          </p>
        </div>
      </div>

      {/* ── Form ────────────────────────────────────────────── */}
      {!customerId ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center text-sm text-gray-500 dark:text-gray-400">
          Pick a tenant above to edit its SMTP settings.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Outgoing mail server <span className="text-gray-400">(OptionID 123)</span>
                </label>
                <input
                  type="text"
                  value={form.host}
                  onChange={(e) => onChange('host', e.target.value)}
                  placeholder="smtp.example.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Port <span className="text-gray-400">(125)</span>
                </label>
                <input
                  ref={portRef}
                  type="number"
                  min={1}
                  max={65535}
                  value={form.port}
                  onChange={(e) => onChange('port', e.target.value)}
                  placeholder="587"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              <div className="flex items-end pb-1.5">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={form.useSsl}
                    onChange={(e) => onChange('useSsl', e.target.checked)}
                    className="rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                  />
                  Use SSL <span className="text-gray-400">(126)</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address <span className="text-gray-400">(127)</span>
                </label>
                <input
                  ref={emailRef}
                  type="email"
                  value={form.emailAddress}
                  onChange={(e) => onChange('emailAddress', e.target.value)}
                  placeholder="sender@example.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Password <span className="text-gray-400">(128)</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => onChange('password', e.target.value)}
                    placeholder="Enter password"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="xl:col-span-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Store Email <span className="text-gray-400">(834, optional — used as From address)</span>
                </label>
                <input
                  ref={storeEmailRef}
                  type="email"
                  value={form.storeEmail}
                  onChange={(e) => onChange('storeEmail', e.target.value)}
                  placeholder="store@example.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  If SMTP credentials are incomplete, this still controls the From address — sending falls back to
                  App Settings SMTP.
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {serverData?.isComplete
                ? 'Current config is complete — emails will send via these settings.'
                : 'Current config is incomplete — emails fall back to App Settings.'}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={load}
                disabled={loading || saving}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={loading || saving}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmtpSettingsPage;
