import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { API_ENDPOINTS } from '../../constants/api';
import { useAuthHeaders } from '../../hooks/useAuthHeaders';

// ─── Types ────────────────────────────────────────────────────────────────
// Mirrors BackOffice.Application.DTOs.Mian.License.LicenseDto.
// Every field is nullable so a missing element on the legacy XML round-trips
// correctly (untouched on save).
type StoreInfo = {
  storeID: string;
  // Friendly name from dbo.Store.StoreName (NOT in the encrypted blob —
  // server enriches the GET response, save ignores it).
  storeName?: string | null;
  address?: string | null;
  cityStateZip?: string | null;
  country?: string | null;
  phone1?: string | null;
  phone2?: string | null;
  fax?: string | null;
  logoBase64?: string | null;
};

type License = {
  companyName?: string | null;
  newCompanyName?: string | null;
  applicationName?: string | null;
  // dataSoftUser / dataSoftPassword are intentionally omitted — the API
  // doesn't return them (would expose the master desktop super-user
  // credentials) and the modal has no UI to set them. The encrypted blob
  // preserves the existing values on save.
  appType?: number | null;
  versionType?: number | null;
  expDate?: string | null;
  beginDate?: string | null;
  days?: number | null;
  expired?: boolean | null;
  computersNo?: number | null;
  boCompNo?: number | null;
  storesNo?: number | null;
  pocketPCsNo?: number | null;
  storeType?: number | null;
  multiplelocation?: boolean | null;
  accountPayable?: boolean | null;
  approveCost?: boolean | null;
  reorderWizard?: boolean | null;
  restockingWizard?: boolean | null;
  purchaseOrder?: boolean | null;
  saleOrder?: boolean | null;
  resellers?: string | null;
  web?: boolean | null;
  phoneOrder?: boolean | null;
  email?: boolean | null;
  pocketPC?: boolean | null;
  dailyProfitReport?: string | null;
  loyalty?: boolean | null;
  scanReceiveOrder?: string | null;
  stores: StoreInfo[];
};

// StoreType enum — matches DataSoft.StoreType in the desktop app.
const STORE_TYPE_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Food' },
  { value: 1, label: 'Books' },
  { value: 2, label: 'Apparel' },
  { value: 3, label: 'Regular' },
];

// AppType — legacy combo on FrmStartWz binds .SelectedIndex directly to
// re.AppType, so this MUST match the desktop CmbAppType item order in
// FrmStartWz.resx, which is exactly two items:
//   0 = Business Management
//   1 = Point Of Sale
// If you ever extend the legacy combo, keep this list in lock-step.
const APP_TYPE_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Business Management' },
  { value: 1, label: 'Point Of Sale' },
];

type Props = {
  customerId: number;
  customerName: string;
  onClose: () => void;
  onToast: (message: string, type: 'success' | 'error') => void;
};

const emptyLicense = (): License => ({ stores: [] });

// Convert "2030-01-01T00:00:00" → "2030-01-01" for <input type="date">.
// Backend serializes as ISO date-time with offset; we drop the time component.
const dateForInput = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// "" → null (so PUT clears the field rather than sending the empty string).
const dateFromInput = (input: string): string | null => {
  if (!input) return null;
  // Send as YYYY-MM-DDT00:00:00 so the server parses it without timezone
  // ambiguity. The legacy XSD type is xs:dateTime.
  return `${input}T00:00:00`;
};

const LicenseSetupModal: React.FC<Props> = ({ customerId, customerName, onClose, onToast }) => {
  const { getAuthHeaders } = useAuthHeaders();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [license, setLicense] = useState<License>(emptyLicense());
  // FrmStartWz only edits the first store on the wizard page; we keep the
  // same scope here. Additional stores ride along untouched on save.
  const [activeStoreIdx, setActiveStoreIdx] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(API_ENDPOINTS.SUPERADMIN_CUSTOMERS.LICENSE_GET(customerId), {
        headers: getAuthHeaders(),
      });
      const data: License = res.data?.response ?? res.data?.Response ?? null;
      if (data) {
        setLicense({ ...data, stores: data.stores ?? [] });
      } else {
        setLicense(emptyLicense());
      }
    } catch (err: unknown) {
      // 404 = no row yet, start from blank — that's a valid state, not an
      // error to the user.
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status === 404) {
        setLicense(emptyLicense());
      } else {
        onToast('Failed to load license data.', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [customerId, getAuthHeaders, onToast]);

  useEffect(() => {
    load();
  }, [load]);

  const update = <K extends keyof License>(key: K, value: License[K]) =>
    setLicense((prev) => ({ ...prev, [key]: value }));

  const updateStore = <K extends keyof StoreInfo>(key: K, value: StoreInfo[K]) =>
    setLicense((prev) => {
      const stores = [...prev.stores];
      if (stores.length === 0) {
        // First-time setup — create a placeholder row. StoreID is required
        // server-side; UI should pick a real store from the tenant DB on
        // first save, but for editing-existing the row already exists.
        stores.push({ storeID: '00000000-0000-0000-0000-000000000000' });
      }
      stores[activeStoreIdx] = { ...stores[activeStoreIdx], [key]: value };
      return { ...prev, stores };
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.put(
        API_ENDPOINTS.SUPERADMIN_CUSTOMERS.LICENSE_UPDATE(customerId),
        license,
        { headers: getAuthHeaders() }
      );

      // Re-fetch so the user sees the persisted value. This proves the save
      // round-tripped through the encrypted blob without having to close +
      // reopen the modal. If the desktop BackOffice still shows old data
      // after this succeeds, the desktop's GlobalDataAccess.EncDateRow is
      // cached at startup — it needs a restart to pick up the change.
      await load();

      onToast(
        'License saved. The desktop BackOffice caches this at startup — restart it to see the change there.',
        'success'
      );
      // Stay open so the operator can edit further stores / fields.
    } catch {
      onToast('Failed to save license.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const activeStore: StoreInfo = license.stores[activeStoreIdx] ?? {
    storeID: '00000000-0000-0000-0000-000000000000',
  };

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-5xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              RDT Systems Installation Setup
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Tenant: <span className="font-medium">{customerName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500 dark:text-gray-400">
            Loading license…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* ─── Left + middle: Store + App info ─────────────────── */}
              <fieldset className="lg:col-span-2 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <legend className="px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Store information
                </legend>

                {/*
                  Store selector — the encrypted blob holds one StoreData row
                  per StoreID, and the desktop FrmStartWz only ever shows the
                  row matching the user's logged-in store. Without this
                  picker we'd always be looking at stores[0], which is a
                  different row from what the desktop user sees → looks like
                  a data mismatch even though the underlying blob is correct.
                */}
                {license.stores.length > 1 && (
                  <div className="mb-3">
                    <LField label={`Store (${license.stores.length} total)`}>
                      <select
                        value={activeStoreIdx}
                        onChange={(e) => setActiveStoreIdx(Number(e.target.value))}
                        className={inputCls}
                      >
                        {license.stores.map((s, idx) => {
                          // Preferred label = real StoreName from dbo.Store.
                          // Fall back to address/city/country if name is
                          // missing (rare — happens on tenants where the
                          // Store table row was never named), then to a
                          // short StoreID prefix as last resort so EVERY
                          // entry is uniquely selectable.
                          const shortId = s.storeID.split('-')[0];
                          let label: string;
                          if (s.storeName && s.storeName.trim().length > 0) {
                            label = s.storeName;
                          } else {
                            const addrBits = [s.address, s.cityStateZip, s.country]
                              .filter(Boolean);
                            label = addrBits.length > 0
                              ? addrBits.join(' · ')
                              : `(unnamed store ${shortId})`;
                          }
                          return (
                            <option key={`${s.storeID}-${idx}`} value={idx}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                    </LField>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <LField label="Company Name">
                    <input
                      type="text"
                      value={license.companyName ?? ''}
                      onChange={(e) => update('companyName', e.target.value || null)}
                      className={inputCls}
                    />
                  </LField>
                  <LField label="Address">
                    <input
                      type="text"
                      value={activeStore.address ?? ''}
                      onChange={(e) => updateStore('address', e.target.value || null)}
                      className={inputCls}
                    />
                  </LField>
                  <LField label="City, State, Zip">
                    <input
                      type="text"
                      value={activeStore.cityStateZip ?? ''}
                      onChange={(e) => updateStore('cityStateZip', e.target.value || null)}
                      className={inputCls}
                    />
                  </LField>
                  <LField label="Country">
                    <input
                      type="text"
                      value={activeStore.country ?? ''}
                      onChange={(e) => updateStore('country', e.target.value || null)}
                      className={inputCls}
                    />
                  </LField>
                  <LField label="Phone 1">
                    <input
                      type="text"
                      value={activeStore.phone1 ?? ''}
                      onChange={(e) => updateStore('phone1', e.target.value || null)}
                      className={inputCls}
                    />
                  </LField>
                  <LField label="Phone 2">
                    <input
                      type="text"
                      value={activeStore.phone2 ?? ''}
                      onChange={(e) => updateStore('phone2', e.target.value || null)}
                      className={inputCls}
                    />
                  </LField>
                  <LField label="Fax">
                    <input
                      type="text"
                      value={activeStore.fax ?? ''}
                      onChange={(e) => updateStore('fax', e.target.value || null)}
                      className={inputCls}
                    />
                  </LField>
                </div>

                <hr className="my-4 border-gray-200 dark:border-gray-700" />

                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Application information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <LField label="App Type">
                    <select
                      value={license.appType ?? 0}
                      onChange={(e) => update('appType', Number(e.target.value))}
                      className={inputCls}
                    >
                      {APP_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </LField>
                  <LField label="Registers Num">
                    <input
                      type="number"
                      min={0}
                      value={license.computersNo ?? 0}
                      onChange={(e) => update('computersNo', Number(e.target.value))}
                      className={inputCls}
                    />
                  </LField>
                  <LField label="Exp Date">
                    <input
                      type="date"
                      value={dateForInput(license.expDate)}
                      onChange={(e) => update('expDate', dateFromInput(e.target.value))}
                      className={inputCls}
                    />
                  </LField>
                  <LField label="Back Office Comp Num">
                    <input
                      type="number"
                      min={0}
                      value={license.boCompNo ?? 0}
                      onChange={(e) => update('boCompNo', Number(e.target.value))}
                      className={inputCls}
                    />
                  </LField>
                  <LField label="Store Type">
                    <select
                      value={license.storeType ?? 3}
                      onChange={(e) => update('storeType', Number(e.target.value))}
                      className={inputCls}
                    >
                      {STORE_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </LField>
                  <LField label="Pocket PCs Num">
                    <input
                      type="number"
                      min={0}
                      value={license.pocketPCsNo ?? 0}
                      onChange={(e) => update('pocketPCsNo', Number(e.target.value))}
                      className={inputCls}
                    />
                  </LField>
                  <LField label="Stores Num">
                    <input
                      type="number"
                      min={0}
                      value={license.storesNo ?? 0}
                      onChange={(e) => update('storesNo', Number(e.target.value))}
                      className={inputCls}
                    />
                  </LField>
                </div>
              </fieldset>

              {/* ─── Right: Language + Modules ───────────────────────── */}
              <div className="space-y-4">
                <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <legend className="px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Allow Modules
                  </legend>
                  <div className="space-y-1.5">
                    <ModCheck
                      label="Approve Cost"
                      checked={!!license.approveCost}
                      onChange={(v) => update('approveCost', v)}
                    />
                    <ModCheck
                      label="Multiplelocation"
                      checked={!!license.multiplelocation}
                      onChange={(v) => update('multiplelocation', v)}
                    />
                    <ModCheck
                      label="Account Payable"
                      checked={!!license.accountPayable}
                      onChange={(v) => update('accountPayable', v)}
                    />
                    <ModCheck
                      label="Reorder Wizard"
                      checked={!!license.reorderWizard}
                      onChange={(v) => update('reorderWizard', v)}
                    />
                    <ModCheck
                      label="Restocking Wizard"
                      checked={!!license.restockingWizard}
                      onChange={(v) => update('restockingWizard', v)}
                    />
                    <ModCheck
                      label="Purchase Order"
                      checked={!!license.purchaseOrder}
                      onChange={(v) => update('purchaseOrder', v)}
                    />
                    <ModCheck
                      label="Sales Order"
                      checked={!!license.saleOrder}
                      onChange={(v) => update('saleOrder', v)}
                    />
                    {/* Resellers is xs:string in the legacy XSD; we send
                        "True"/"False" so the desktop still reads it correctly. */}
                    <ModCheck
                      label="Resellers"
                      checked={license.resellers === 'True' || license.resellers === 'true'}
                      onChange={(v) => update('resellers', v ? 'True' : 'False')}
                    />
                    <ModCheck
                      label="Phone Order"
                      checked={!!license.phoneOrder}
                      onChange={(v) => update('phoneOrder', v)}
                    />
                    <ModCheck label="Web" checked={!!license.web} onChange={(v) => update('web', v)} />
                    <ModCheck
                      label="Email"
                      checked={!!license.email}
                      onChange={(v) => update('email', v)}
                    />
                    <ModCheck
                      label="Pocket PC"
                      checked={!!license.pocketPC}
                      onChange={(v) => update('pocketPC', v)}
                    />
                    {/* DailyProfitReport is xs:string in the XSD — same pattern as Resellers. */}
                    <ModCheck
                      label="Daily Profit Report"
                      checked={
                        license.dailyProfitReport === 'True' ||
                        license.dailyProfitReport === 'true'
                      }
                      onChange={(v) =>
                        update('dailyProfitReport', v ? 'True' : 'False')
                      }
                    />
                    <ModCheck
                      label="Loyalty"
                      checked={!!license.loyalty}
                      onChange={(v) => update('loyalty', v)}
                    />
                  </div>
                </fieldset>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white font-medium"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// ─── tiny helpers ─────────────────────────────────────────────────────────

const inputCls =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500';

const LField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
      {label}
    </label>
    {children}
  </div>
);

const ModCheck: React.FC<{
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <label className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300 py-0.5">
    <span>{label}</span>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="w-4 h-4 text-brand-500 rounded border-gray-300 dark:border-gray-600 focus:ring-brand-500"
    />
  </label>
);

export default LicenseSetupModal;
