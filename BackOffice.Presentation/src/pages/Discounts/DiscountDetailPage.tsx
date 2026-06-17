import React, { useState, useEffect, useCallback } from "react";
import Button from "../../components/ui/button/Button";
import Loader from "../../components/ui/loader/Loader";
import Label from "../../components/form/Label";
import { useAuthHeaders } from "../../hooks/useAuthHeaders";
import { useDashboardTabs } from "../../context/DashboardTabContext";
import { API_ENDPOINTS } from "../../constants/api";
import axios from "axios";

// ── Props ─────────────────────────────────────────────────────────────────────

interface DiscountDetailPageProps {
  id: string;
}

// ── Reusable display components ───────────────────────────────────────────────

const Section: React.FC<{
  title: string;
  children: React.ReactNode;
  className?: string;
  badge?: React.ReactNode;
}> = ({ title, children, className = "", badge }) => (
  <div
    className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 shadow-sm ${className}`}
  >
    <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
      <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-200 uppercase tracking-wider">
        {title}
      </h3>
      {badge}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const DisplayField: React.FC<{
  label: string;
  value: string | number | boolean | null | undefined;
  type?: "text" | "currency" | "number" | "boolean" | "date" | "percent";
  className?: string;
}> = ({ label, value, type = "text", className = "" }) => {
  const formatValue = () => {
    if (value === null || value === undefined || value === "") return "—";
    switch (type) {
      case "currency":
        return `$${Number(value).toFixed(2)}`;
      case "number":
        return Number(value).toLocaleString();
      case "boolean":
        return value ? "Yes" : "No";
      case "date":
        return value
          ? new Date(String(value)).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "—";
      case "percent":
        return `${Number(value).toFixed(2)}%`;
      default:
        return String(value);
    }
  };

  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0">
        {label}
      </Label>
      <div className="text-sm font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700/30 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-600 min-h-[36px] flex items-center">
        {formatValue()}
      </div>
    </div>
  );
};

const Badge: React.FC<{ active: boolean; label: string }> = ({
  active,
  label,
}) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
      active
        ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        : "bg-gray-50 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
    }`}
  >
    {active ? (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
      </svg>
    ) : (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    )}
    {label}
  </span>
);

const StatusBadge: React.FC<{ status: number | null }> = ({ status }) => {
  const isActive = status === 1 || status === 0;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
        isActive
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-green-500" : "bg-red-500"}`} />
      {isActive ? "Active" : "Inactive"}
    </span>
  );
};

// ── Filter scope labels ───────────────────────────────────────────────────────

const FILTER_LABELS: Record<number, string> = {
  0: "All",
  1: "Include Selected",
  2: "Exclude Selected",
};

// ── Main Component ────────────────────────────────────────────────────────────

const DiscountDetailPage: React.FC<DiscountDetailPageProps> = ({ id }) => {
  const { openTab, closeTab, activeTabId } = useDashboardTabs();
  const { getAuthHeaders } = useAuthHeaders();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lookup data for resolving names
  const [itemNames, setItemNames] = useState<Map<string, string>>(new Map());
  const [deptNames, setDeptNames] = useState<Map<string, string>>(new Map());
  const [brandNames, setBrandNames] = useState<Map<string, string>>(new Map());
  const [storeNames, setStoreNames] = useState<Map<string, string>>(new Map());
  const [tenderNames, setTenderNames] = useState<Map<string, string>>(new Map());

  // Active tab for filter section
  const [activeFilterTab, setActiveFilterTab] = useState<string>("items");

  // ── Load discount data ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const headers = getAuthHeaders();
        const res = await axios.get(API_ENDPOINTS.DISCOUNTS.GET_BY_ID(id), { headers });

        if (!res.data?.isSuccess || !res.data?.response) {
          setError("Discount not found");
          return;
        }
        setData(res.data.response);
      } catch (err) {
        console.error("Error loading discount:", err);
        setError("Failed to load discount details");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id, getAuthHeaders]);

  // ── Load lookup names for related selections ─────────────────────────────────
  useEffect(() => {
    if (!data) return;
    const headers = getAuthHeaders();
    const paginatedOpts = { headers, params: { pageNumber: 1, pageSize: 9999 } };

    const extract = (res: any) => {
      if (!res?.data?.isSuccess) return [];
      const d = res.data.response;
      return Array.isArray(d) ? d : d?.data || [];
    };

    const loadNames = async () => {
      try {
        const [itemsRes, deptsRes, brandsRes, storesRes, tendersRes] = await Promise.all([
          data.selectedItemIds?.length > 0
            ? axios.get(API_ENDPOINTS.ITEMS.GET_ITEMS_QUICK_LIST, paginatedOpts).catch(() => null)
            : null,
          data.selectedDepartmentIds?.length > 0
            ? axios.get(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_DEPARTMENTS, { headers }).catch(() => null)
            : null,
          data.selectedBrandIds?.length > 0
            ? axios.get(API_ENDPOINTS.MANUFACTURERS.GET_ALL_MANUFACTURERS, paginatedOpts).catch(() => null)
            : null,
          data.selectedStoreIds?.length > 0
            ? axios.get(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES, { headers }).catch(() => null)
            : null,
          data.selectedTenderIds?.length > 0
            ? axios.get(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_TENDERS, { headers }).catch(() => null)
            : null,
        ]);

        if (itemsRes) {
          const m = new Map<string, string>();
          extract(itemsRes).forEach((i: any) => {
            m.set(String(i.itemID || i.ItemID || i.itemStoreID || "").toLowerCase(), i.name || i.Name || "");
          });
          setItemNames(m);
        }
        if (deptsRes) {
          const m = new Map<string, string>();
          extract(deptsRes).forEach((d: any) => {
            m.set(String(d.departmentStoreID || d.DepartmentStoreID || "").toLowerCase(), d.name || d.Name || "");
          });
          setDeptNames(m);
        }
        if (brandsRes) {
          const m = new Map<string, string>();
          extract(brandsRes).forEach((b: any) => {
            m.set(String(b.manufacturerID || b.ManufacturerID || "").toLowerCase(), b.manufacturerName || b.ManufacturerName || b.name || "");
          });
          setBrandNames(m);
        }
        if (storesRes) {
          const m = new Map<string, string>();
          extract(storesRes).forEach((s: any) => {
            m.set(String(s.storeID || s.StoreID || "").toLowerCase(), s.storeName || s.StoreName || s.name || "");
          });
          setStoreNames(m);
        }
        if (tendersRes) {
          const m = new Map<string, string>();
          extract(tendersRes).forEach((t: any) => {
            m.set(String(t.tenderID ?? t.TenderID ?? "").toLowerCase(), t.tenderName || t.TenderName || t.name || "");
          });
          setTenderNames(m);
        }
      } catch (err) {
        console.error("Error loading lookup names:", err);
      }
    };
    loadNames();
  }, [data, getAuthHeaders]);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const goBackToList = useCallback(() => {
    if (activeTabId) closeTab(activeTabId);
    openTab({ component: "DiscountListPage", title: "Discounts", closable: true });
  }, [activeTabId, closeTab, openTab]);

  const goToEdit = useCallback(() => {
    if (activeTabId) closeTab(activeTabId);
    openTab({
      component: "DiscountFormPage",
      title: `Edit: ${data?.name || "Discount"}`,
      closable: true,
      props: { id },
    });
  }, [activeTabId, closeTab, openTab, id, data]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const resolveNames = (ids: string[] | null, nameMap: Map<string, string>) => {
    if (!ids || ids.length === 0) return [];
    return ids.map((rawId) => {
      const key = String(rawId).toLowerCase();
      return nameMap.get(key) || rawId;
    });
  };

  const getTierInfo = (tierNum: 1 | 2 | 3) => {
    if (!data) return null;
    const min = data[`minTotalSale${tierNum === 1 ? "" : tierNum}`];
    const pct = data[`percentsDiscount${tierNum === 1 ? "" : tierNum}`];
    const amt = data[`amountDiscount${tierNum === 1 ? "" : tierNum}`];
    if (!pct && !amt) return null;
    return { min, pct, amt };
  };

  // ── Loading / Error ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader size="lg" label="Loading discount details..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
        <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{error || "Discount not found"}</p>
        <Button variant="outline" size="sm" onClick={goBackToList}>
          Back to Discounts
        </Button>
      </div>
    );
  }

  // ── Filter sections data ────────────────────────────────────────────────────
  const filterTabs = [
    {
      key: "items",
      label: "Items",
      filterValue: data.discountItem ?? 0,
      ids: data.selectedItemIds || [],
      names: itemNames,
    },
    {
      key: "departments",
      label: "Departments",
      filterValue: data.discountDepartment ?? 0,
      ids: data.selectedDepartmentIds || [],
      names: deptNames,
    },
    {
      key: "brands",
      label: "Brands",
      filterValue: data.discountBrand ?? 0,
      ids: data.selectedBrandIds || [],
      names: brandNames,
    },
    {
      key: "stores",
      label: "Stores",
      filterValue: data.discountStore ?? 0,
      ids: data.selectedStoreIds || [],
      names: storeNames,
    },
    {
      key: "tenders",
      label: "Tenders",
      filterValue: null,
      ids: data.selectedTenderIds || [],
      names: tenderNames,
    },
  ];
  const activeFilter = filterTabs.find((f) => f.key === activeFilterTab) || filterTabs[0];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="discount-detail-page h-full flex flex-col">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={goBackToList}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Discount Details</h1>
          {data.name && (
            <span className="text-sm text-gray-500 dark:text-gray-400">— {data.name}</span>
          )}
          <StatusBadge status={data.status} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goBackToList}>
            Back
          </Button>
          <Button variant="primary" size="sm" onClick={goToEdit}>
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit Discount
          </Button>
        </div>
      </div>

      {/* ─── Content ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-950">
        <div className="max-w-[1400px] mx-auto space-y-6">
          {/* ── Row 1: Basic Info + Discount Tiers ──────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Basic Information */}
            <Section title="Basic Information" className="xl:col-span-4">
              <div className="space-y-4">
                <DisplayField label="Name" value={data.name} />
                <DisplayField label="Discount Code" value={data.upcDiscount || data.upcdiscount} />
                <div className="grid grid-cols-2 gap-3">
                  <DisplayField label="Start Date" value={data.startDate} type="date" />
                  <DisplayField label="End Date" value={data.endDate} type="date" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <DisplayField label="Balance Over (Days)" value={data.clearDays} type="number" />
                  <DisplayField label="Max Discount" value={data.maxAmount} type="currency" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <DisplayField label="Date Created" value={data.dateCreated} type="date" />
                  <DisplayField label="Date Modified" value={data.dateModified} type="date" />
                </div>
              </div>
            </Section>

            {/* Discount Tiers + Options */}
            <div className="xl:col-span-8 space-y-4">
              {/* 3 Tier cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {([1, 2, 3] as const).map((num) => {
                  const tier = getTierInfo(num);
                  const isEmpty = !tier;
                  return (
                    <Section
                      key={num}
                      title={`Discount Tier ${num}`}
                      badge={
                        <span
                          className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-xs font-bold ${
                            isEmpty
                              ? "bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500"
                              : "bg-brand-50 text-brand-600 dark:bg-brand-900 dark:text-brand-300"
                          }`}
                        >
                          {num}
                        </span>
                      }
                    >
                      {isEmpty ? (
                        <p className="text-sm text-gray-400 dark:text-gray-500 italic text-center py-4">
                          Not configured
                        </p>
                      ) : (
                        <div className="space-y-3">
                          <DisplayField label="Min Total Sale" value={tier.min} type="currency" />
                          {tier.pct ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <DisplayField label="Percent Discount" value={tier.pct} type="percent" />
                              </div>
                              <div className="pt-5">
                                <span className="inline-flex items-center justify-center h-7 px-2 rounded bg-brand-50 text-brand-700 text-xs font-semibold dark:bg-brand-900/30 dark:text-brand-400">
                                  %
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <DisplayField label="Amount Discount" value={tier.amt} type="currency" />
                              </div>
                              <div className="pt-5">
                                <span className="inline-flex items-center justify-center h-7 px-2 rounded bg-green-50 text-green-700 text-xs font-semibold dark:bg-green-900/30 dark:text-green-400">
                                  $
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </Section>
                  );
                })}
              </div>

              {/* Options */}
              <Section title="Options">
                <div className="flex flex-wrap gap-2">
                  <Badge active={!!data.reqPaswrd} label="Password Required" />
                  <Badge active={!!data.salesItem} label="Include Sale Item" />
                  <Badge active={!!data.discountItems} label="Not Discount Items" />
                  <Badge active={!!data.includeGiftCard} label="Gift Card" />
                  <Badge active={!!data.selectedItem} label="Highlighted Only" />
                  <Badge active={!!data.autoAssign} label="Auto Assign" />
                  <Badge active={!!data.clearBalance} label="Clear Balance" />
                </div>
              </Section>
            </div>
          </div>

          {/* ── Row 2: Filter Scope & Selections ───────────────────────── */}
          <Section title="Filter Scope & Selections">
            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700 -mx-5 px-5 -mt-5 mb-5">
              <div className="flex">
                {filterTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveFilterTab(tab.key)}
                    className={`relative px-5 py-2.5 text-sm font-medium transition-colors ${
                      activeFilterTab === tab.key
                        ? "text-brand-600 dark:text-brand-400"
                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {tab.label}
                      {tab.ids.length > 0 && (
                        <span className="inline-flex items-center justify-center h-4 min-w-[18px] px-1 rounded-full bg-brand-100 text-brand-700 text-[10px] font-semibold dark:bg-brand-900 dark:text-brand-300">
                          {tab.ids.length}
                        </span>
                      )}
                    </span>
                    {activeFilterTab === tab.key && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Filter scope info */}
              {activeFilter.filterValue !== null && (
                <div className="lg:col-span-3">
                  <Label className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                    {activeFilter.label} Filter
                  </Label>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        activeFilter.filterValue === 0
                          ? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                          : activeFilter.filterValue === 1
                          ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      {FILTER_LABELS[activeFilter.filterValue] || "All"}
                    </span>
                  </div>
                </div>
              )}

              {/* Selected items list */}
              <div className={activeFilter.filterValue !== null ? "lg:col-span-9" : "lg:col-span-12"}>
                {activeFilter.ids.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-sm text-gray-400 dark:text-gray-500">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    No {activeFilter.label.toLowerCase()} selected
                  </div>
                ) : (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="max-h-[280px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                          <tr>
                            <th className="w-10 px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">#</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                              Name
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {resolveNames(activeFilter.ids, activeFilter.names).map(
                            (name, idx) => (
                              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <td className="w-10 px-3 py-2 text-xs text-gray-400">{idx + 1}</td>
                                <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{name}</td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
                      {activeFilter.ids.length} {activeFilter.label.toLowerCase()} selected
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
};

export default DiscountDetailPage;
