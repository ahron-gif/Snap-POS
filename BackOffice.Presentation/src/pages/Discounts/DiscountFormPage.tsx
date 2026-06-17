import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { focusFirstInvalid } from "../../hooks/useFocusFirstInvalid";
import Button from "../../components/ui/button/Button";
import Loader from "../../components/ui/loader/Loader";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Checkbox from "../../components/form/input/Checkbox";
import Radio from "../../components/form/input/Radio";
import Switch from "../../components/form/switch/Switch";
import { useAuthHeaders } from "../../hooks/useAuthHeaders";
import { useDashboardTabs } from "../../context/DashboardTabContext";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import { useTabFormCacheRead, useTabFormCacheWrite } from "../../hooks/useTabFormCache";
import { API_ENDPOINTS } from "../../constants/api";
import axios from "axios";
import SaleTimesModal from "./SaleTimesModal";
import ImportItemsModal, { type ImportedItem } from "./ImportItemsModal";

// Combined "barcode — name" label for the discount item list (matches the
// desktop, which shows Barcode + Name). Falls back gracefully when a part is missing.
const itemLabel = (barcode?: string | null, name?: string | null, modelNo?: string | null): string => {
  const bc = (barcode || "").trim();
  const nm = (name || "").trim() || (modelNo || "").trim();
  if (bc && nm) return `${bc} — ${nm}`;
  return bc || nm || "(no name)";
};

// ── Interfaces ──────────────────────────────────────────────────────────────

interface DiscountFormPageProps {
  id?: string;
  isNew?: boolean;
  viewMode?: boolean;
  /** Injected by the tab renderer — required for the unsaved-changes guard. */
  __tabId?: string;
}

interface SaleTimeRule {
  day: string;
  enabled: boolean;
  fromTime: string;
  toTime: string;
}

interface DiscountFormData {
  name: string;
  code: string;
  assignByDate: boolean;
  startDate: string;
  endDate: string;
  passwordRequired: boolean;
  includeSaleItem: boolean;
  includeNotDiscountItems: boolean;
  giftCard: boolean;
  highlightedItemOnly: boolean;
  autoAssign: boolean;
  notValidWithBalanceOverDays: number | null;
  maxDiscountAmount: number | null;
  // Discount tiers
  minTotalSale1: number | null;
  discountType1: "amount" | "percent";
  discountValue1: number | null;
  minTotalSale2: number | null;
  discountType2: "amount" | "percent";
  discountValue2: number | null;
  minTotalSale3: number | null;
  discountType3: "amount" | "percent";
  discountValue3: number | null;
  // Filter scope (0=All, 1=Include, 2=Exclude) — mirrors VB DiscountItem/DiscountDepartment/DiscountBrand/DiscountStore
  itemFilter: number;
  departmentFilter: number;
  brandFilter: number;
  storeFilter: number;
  // Selections
  selectedItems: Set<string>;
  selectedDepartments: Set<string>;
  selectedBrands: Set<string>;
  selectedStores: Set<string>;
  selectedTenders: Set<string>;
  // Sale times
  saleTimes: SaleTimeRule[];
}

type FilterTab = "items" | "departments" | "brands" | "stores" | "tenders";

interface LookupRecord {
  id: string;
  name: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_SALE_TIMES: SaleTimeRule[] = [
  { day: "Sunday", enabled: false, fromTime: "00:00", toTime: "00:00" },
  { day: "Monday", enabled: false, fromTime: "00:00", toTime: "00:00" },
  { day: "Tuesday", enabled: false, fromTime: "00:00", toTime: "00:00" },
  { day: "Wednesday", enabled: false, fromTime: "00:00", toTime: "00:00" },
  { day: "Thursday", enabled: false, fromTime: "00:00", toTime: "00:00" },
  { day: "Friday", enabled: false, fromTime: "00:00", toTime: "00:00" },
  { day: "Saturday", enabled: false, fromTime: "00:00", toTime: "00:00" },
];

const initialFormData: DiscountFormData = {
  name: "",
  code: "",
  assignByDate: true,
  startDate: new Date().toISOString().split("T")[0],
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  passwordRequired: false,
  includeSaleItem: false,
  includeNotDiscountItems: false,
  giftCard: false,
  highlightedItemOnly: false,
  autoAssign: false,
  notValidWithBalanceOverDays: null,
  maxDiscountAmount: null,
  minTotalSale1: null,
  discountType1: "amount",
  discountValue1: null,
  minTotalSale2: null,
  discountType2: "amount",
  discountValue2: null,
  minTotalSale3: null,
  discountType3: "amount",
  discountValue3: null,
  itemFilter: 0,
  departmentFilter: 0,
  brandFilter: 0,
  storeFilter: 0,
  selectedItems: new Set(),
  selectedDepartments: new Set(),
  selectedBrands: new Set(),
  selectedStores: new Set(),
  selectedTenders: new Set(),
  saleTimes: [...DEFAULT_SALE_TIMES],
};

// ── Component ───────────────────────────────────────────────────────────────

const DiscountFormPage: React.FC<DiscountFormPageProps> = ({
  id,
  isNew,
  viewMode = false,
  __tabId,
}) => {
  const { openTab, closeTab, activeTabId } = useDashboardTabs();
  const { getAuthHeaders } = useAuthHeaders();

  const isEditMode = id && !isNew;
  const isReadOnly = viewMode;

  // ── Per-tab cache: preserves state across tab switches (in-memory only) ──
  interface DiscountFormCache {
    formData: DiscountFormData;
    savedFormData: DiscountFormData;
  }
  const { initial: cachedTabState, hasCachedState } =
    useTabFormCacheRead<DiscountFormCache>(__tabId);

  // ── State ─────────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState<DiscountFormData>(
    () => cachedTabState?.formData ?? initialFormData,
  );
  // Mirrors the last-saved baseline so useUnsavedChanges can diff and show the
  // Save/Discard modal when the user closes the tab with pending edits.
  const [savedFormData, setSavedFormData] = useState<DiscountFormData>(
    () => cachedTabState?.savedFormData ?? initialFormData,
  );
  const hasLoadedOnceRef = useRef(hasCachedState);

  useTabFormCacheWrite<DiscountFormCache>(
    __tabId,
    hasLoadedOnceRef.current ? { formData, savedFormData } : null,
  );

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<FilterTab>("items");
  const [showSaleTimesModal, setShowSaleTimesModal] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");

  // Lookup data
  // Resolved {id,name} for already-selected items (from edit load) that aren't on
  // a loaded page — lets the Items tab pin prior selections at the top of the list.
  const [selectedItemRecords, setSelectedItemRecords] = useState<LookupRecord[]>([]);
  // Ids we've already tried to resolve (incl. ones with no match) so we never
  // re-fetch them in a loop.
  const resolvedAttemptRef = useRef<Set<string>>(new Set());
  // "Import Items" dialog (desktop ImportItem parity).
  const [showImportModal, setShowImportModal] = useState(false);
  const [departmentsList, setDepartmentsList] = useState<LookupRecord[]>([]);
  const [brandsList, setBrandsList] = useState<LookupRecord[]>([]);
  const [storesList, setStoresList] = useState<LookupRecord[]>([]);
  const [tendersList, setTendersList] = useState<LookupRecord[]>([]);

  // Toast
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error" | "info";
  }>({ show: false, message: "", type: "success" });

  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "success") => {
      setToast({ show: true, message, type });
      setTimeout(
        () => setToast({ show: false, message: "", type: "success" }),
        4000
      );
    },
    []
  );

  // ── Load lookup data ──────────────────────────────────────────────────────
  useEffect(() => {
    const loadLookups = async () => {
      try {
        const headers = getAuthHeaders();
        // Items & Manufacturers (grid) endpoints bind [FromQuery] PaginationGridDto on
        // the backend, which paginates on startRow/endRow — NOT pageNumber/pageSize.
        // Passing the wrong keys left endRow=0 → zero rows (empty lists). Request the
        // full set so the scope checklist matches the desktop BackOffice (loads all
        // items / brands for include/exclude selection).
        const paginatedOpts = { headers, params: { startRow: 0, endRow: 100000 } };

        // The Stores lookup is GetStoresByUser([FromQuery] Guid userId): it returns
        // empty without the caller's local user id. Resolve it the same way the report
        // pages do (localStorage userData.localUserId).
        let localUserId = "";
        try {
          const ud = localStorage.getItem("userData");
          if (ud) localUserId = JSON.parse(ud).localUserId || "";
        } catch {
          /* ignore */
        }

        // NOTE: Items are NOT loaded here — they can number in the tens of thousands
        // and preloading + rendering them froze the page. Items load server-side via
        // loadItems() (small page + debounced search) below.
        const [deptsRes, brandsRes, storesRes, tendersRes] = await Promise.all([
          // Departments: SystemLookups endpoint (non-paginated)
          axios.get(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_DEPARTMENTS, { headers }).catch(() => null),
          // Brands = Manufacturers (grid endpoint, paginated via PaginationGridDto)
          axios.get(API_ENDPOINTS.MANUFACTURERS.GET_ALL_MANUFACTURERS, paginatedOpts).catch(() => null),
          // Stores: GetStoresByUser — requires userId
          axios.get(`${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES}?userId=${localUserId}`, { headers }).catch(() => null),
          // Tenders: SystemLookups endpoint (non-paginated)
          axios.get(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_TENDERS, { headers }).catch(() => null),
        ]);

        // Extract array from API response — handles both direct array and paginated { data: [] }
        const extract = (res: any) => {
          if (!res?.data?.isSuccess) return [];
          const d = res.data.response;
          return Array.isArray(d) ? d : d?.data || [];
        };

        // Departments: id = departmentStoreID, name = name
        setDepartmentsList(
          extract(deptsRes).map((d: any) => ({
            id: String(d.departmentStoreID || d.DepartmentStoreID || d.departmentID || d.DepartmentID || d.id || ""),
            name: d.name || d.Name || d.departmentName || d.DepartmentName || "",
          }))
        );

        // Brands = Manufacturers: id = manufacturerID, name = manufacturerName
        setBrandsList(
          extract(brandsRes).map((m: any) => ({
            id: String(m.manufacturerID || m.ManufacturerID || m.id || ""),
            name: m.manufacturerName || m.ManufacturerName || m.name || m.Name || "",
          }))
        );

        // Stores: id = storeID, name = storeName
        setStoresList(
          extract(storesRes).map((s: any) => ({
            id: String(s.storeID || s.StoreID || s.id || ""),
            name: s.storeName || s.StoreName || s.name || s.Name || "",
          }))
        );

        // Tenders: id = tenderID, name = tenderName
        setTendersList(
          extract(tendersRes).map((t: any) => ({
            id: String(t.tenderID ?? t.TenderID ?? t.id ?? ""),
            name: t.tenderName || t.TenderName || t.name || t.Name || "",
          }))
        );
      } catch (err) {
        console.error("Error loading lookups:", err);
      }
    };
    loadLookups();
  }, [getAuthHeaders]);

  // Resolve names for already-selected items that aren't on a loaded page, so the
  // Items tab can pin prior selections at the top (the headline pain when editing
  // a discount with thousands of items). Batched, and each id is attempted once.
  useEffect(() => {
    if (activeFilterTab !== "items") return;
    const known = new Set<string>(selectedItemRecords.map((r) => r.id));
    const missing = Array.from(formData.selectedItems).filter(
      (id) => id && !known.has(id) && !resolvedAttemptRef.current.has(id)
    );
    if (missing.length === 0) return;
    missing.forEach((id) => resolvedAttemptRef.current.add(id));

    let cancelled = false;
    (async () => {
      try {
        const headers = getAuthHeaders();
        const chunkSize = 500;
        const resolved: LookupRecord[] = [];
        for (let i = 0; i < missing.length; i += chunkSize) {
          const chunk = missing.slice(i, i + chunkSize);
          const res = await axios.post(API_ENDPOINTS.SYSTEM_LOOKUPS.ITEMS_BY_IDS, chunk, { headers });
          const r = res?.data?.isSuccess ? (res.data.response ?? res.data.Response) : null;
          const arr: any[] = Array.isArray(r) ? r : [];
          for (const it of arr) {
            const name = (it.name ?? it.Name ?? "").toString().trim();
            const modelNo = (it.modelNo ?? it.ModelNo ?? "").toString().trim();
            const upc = (it.barcode ?? it.Barcode ?? it.upc ?? it.UPC ?? "").toString().trim();
            resolved.push({
              id: String(it.itemID ?? it.ItemID ?? it.id ?? ""),
              name: itemLabel(upc, name, modelNo),
            });
          }
        }
        if (!cancelled && resolved.length) {
          setSelectedItemRecords((prev) => {
            const seen = new Set(prev.map((r) => r.id));
            return [...prev, ...resolved.filter((r) => r.id && !seen.has(r.id))];
          });
        }
      } catch {
        // best-effort — unresolved ids simply fall back to showing the id
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeFilterTab, formData.selectedItems, selectedItemRecords, getAuthHeaders]);

  // ── Load existing discount (Edit/View mode) ─────────────────────────────
  useEffect(() => {
    if (!id || isNew) return;
    // Per-tab cache hit: state restored via useState initializers. Skip the
    // fetch so the user's edits aren't overwritten with the API baseline.
    if (hasCachedState) {
      hasLoadedOnceRef.current = true;
      return;
    }

    const loadDiscount = async () => {
      setLoading(true);
      try {
        const headers = getAuthHeaders();
        // Use the proper GetById endpoint
        const res = await axios.get(API_ENDPOINTS.DISCOUNTS.GET_BY_ID(id), { headers });

        if (!res.data?.isSuccess || !res.data?.response) {
          showToast("Discount not found", "error");
          return;
        }

        const d = res.data.response;

        // Compute the loaded state once, then commit to both formData (current)
        // and savedFormData (baseline for the unsaved-changes diff) so the form
        // opens clean and dirty kicks in only when the user actually edits.
        const loaded: DiscountFormData = {
          ...initialFormData,
          name: d.name || "",
          code: d.upcDiscount || d.upcdiscount || "",
          assignByDate: !!(d.startDate || d.endDate),
          startDate: d.startDate ? new Date(d.startDate).toISOString().split("T")[0] : "",
          endDate: d.endDate ? new Date(d.endDate).toISOString().split("T")[0] : "",
          passwordRequired: !!d.reqPaswrd,
          includeSaleItem: !!d.salesItem,
          includeNotDiscountItems: !!d.discountItems,
          giftCard: !!d.includeGiftCard,
          highlightedItemOnly: !!d.selectedItem,
          autoAssign: !!d.autoAssign,
          notValidWithBalanceOverDays: d.clearDays ?? null,
          maxDiscountAmount: d.maxAmount ?? null,
          // Tier 1
          minTotalSale1: d.minTotalSale ?? null,
          discountType1: d.percentsDiscount ? "percent" : "amount",
          discountValue1: d.percentsDiscount || d.amountDiscount || null,
          // Tier 2
          minTotalSale2: d.minTotalSale2 ?? null,
          discountType2: d.percentsDiscount2 ? "percent" : "amount",
          discountValue2: d.percentsDiscount2 || d.amountDiscount2 || null,
          // Tier 3
          minTotalSale3: d.minTotalSale3 ?? null,
          discountType3: d.percentsDiscount3 ? "percent" : "amount",
          discountValue3: d.percentsDiscount3 || d.amountDiscount3 || null,
          // Filters
          itemFilter: d.discountItem ?? 0,
          departmentFilter: d.discountDepartment ?? 0,
          brandFilter: d.discountBrand ?? 0,
          storeFilter: d.discountStore ?? 0,
          // Related selections (pre-fill from backend)
          selectedItems: new Set<string>((d.selectedItemIds || []).map((id: string) => String(id))),
          selectedDepartments: new Set<string>((d.selectedDepartmentIds || []).map((id: string) => String(id))),
          selectedBrands: new Set<string>((d.selectedBrandIds || []).map((id: string) => String(id))),
          selectedStores: new Set<string>((d.selectedStoreIds || []).map((id: string) => String(id))),
          selectedTenders: new Set<string>((d.selectedTenderIds || []).map((id: string) => String(id))),
        };
        setFormData(loaded);
        setSavedFormData(loaded);
      } catch (err) {
        console.error("Error loading discount:", err);
        showToast("Failed to load discount", "error");
      } finally {
        setLoading(false);
        hasLoadedOnceRef.current = true;
      }
    };
    loadDiscount();
  }, [id, isNew, hasCachedState, getAuthHeaders, showToast]);

  // For new-mode tabs there's no load path to flip hasLoadedOnceRef. Seed it
  // on first render so cache writes begin capturing user edits immediately.
  useEffect(() => {
    if (isNew && !hasCachedState) {
      hasLoadedOnceRef.current = true;
    }
  }, [isNew, hasCachedState]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const goBackToList = useCallback(() => {
    if (activeTabId) closeTab(activeTabId);
    openTab({ component: "DiscountListPage", title: "Discounts", closable: true });
  }, [activeTabId, closeTab, openTab]);

  // Focus-first-invalid wiring. Wrapper-div refs hold the focus targets;
  // the helper drills into the first focusable descendant.
  const nameRef = useRef<HTMLDivElement | null>(null);
  const value1Ref = useRef<HTMLDivElement | null>(null);
  const [flashedField, setFlashedField] = useState<string | null>(null);
  const ringClass = (key: string) =>
    flashedField === key ? "ring-2 ring-red-500 rounded-lg" : "";

  // ── Validation (mirrors VB CanSave) ───────────────────────────────────────
  const canSave = useCallback((): boolean => {
    const ok = focusFirstInvalid(
      [
        { ref: nameRef, isValid: !!formData.name.trim(), flashKey: "name" },
        {
          ref: value1Ref,
          isValid:
            formData.discountValue1 !== null ||
            formData.discountValue2 !== null ||
            formData.discountValue3 !== null,
          flashKey: "value1",
        },
      ],
      setFlashedField,
    );
    if (!ok) {
      if (!formData.name.trim()) {
        showToast("Please enter a discount name", "error");
      } else {
        showToast("Please enter at least one discount amount or percentage", "error");
      }
      return false;
    }
    // Max 500 items selected (from VB)
    if (formData.selectedItems.size > 500) {
      showToast("Maximum 500 items can be selected", "error");
      return false;
    }
    return true;
  }, [formData, showToast]);

  // ── Save (mirrors VB BtOk_Click + SaveRelated) ───────────────────────────
  const handleSave = useCallback(async () => {
    if (!canSave()) return;

    setSaving(true);
    try {
      const headers = getAuthHeaders();
      const fd = formData;

      // Build payload matching the Discount entity
      const payload: Record<string, any> = {
        name: fd.name.trim(),
        upcDiscount: fd.code || null,
        startDate: fd.assignByDate && fd.startDate ? fd.startDate : null,
        endDate: fd.assignByDate && fd.endDate ? fd.endDate : null,
        reqPaswrd: fd.passwordRequired,
        salesItem: fd.includeSaleItem,
        discountItems: fd.includeNotDiscountItems,
        includeGiftCard: fd.giftCard,
        selectedItem: fd.highlightedItemOnly,
        autoAssign: fd.autoAssign,
        clearDays: fd.notValidWithBalanceOverDays,
        maxAmount: fd.maxDiscountAmount,
        // Tier 1
        minTotalSale: fd.minTotalSale1,
        amountDiscount: fd.discountType1 === "amount" ? fd.discountValue1 : null,
        percentsDiscount: fd.discountType1 === "percent" ? fd.discountValue1 : null,
        // Tier 2
        minTotalSale2: fd.minTotalSale2,
        amountDiscount2: fd.discountType2 === "amount" ? fd.discountValue2 : null,
        percentsDiscount2: fd.discountType2 === "percent" ? fd.discountValue2 : null,
        // Tier 3
        minTotalSale3: fd.minTotalSale3,
        amountDiscount3: fd.discountType3 === "amount" ? fd.discountValue3 : null,
        percentsDiscount3: fd.discountType3 === "percent" ? fd.discountValue3 : null,
        // Filter scopes
        discountItem: fd.itemFilter,
        discountDepartment: fd.departmentFilter,
        discountBrand: fd.brandFilter,
        discountStore: fd.storeFilter,
        // Related selections
        selectedItemIds: fd.itemFilter > 0 ? Array.from(fd.selectedItems) : [],
        selectedDepartmentIds: fd.departmentFilter > 0 ? Array.from(fd.selectedDepartments) : [],
        selectedBrandIds: fd.brandFilter > 0 ? Array.from(fd.selectedBrands) : [],
        selectedStoreIds: fd.storeFilter > 0 ? Array.from(fd.selectedStores) : [],
        // Tenders are int-keyed (Tender.TenderID); the selection set holds them
        // as strings, so send them as numbers to match the int[] the API expects.
        selectedTenderIds: Array.from(fd.selectedTenders).map(Number),
      };

      if (isEditMode && id) {
        // Include DiscountID in payload for PUT endpoint validation
        payload.discountID = id;
        await axios.put(API_ENDPOINTS.DISCOUNTS.UPDATE(id), payload, { headers });
        showToast("Discount updated successfully", "success");
      } else {
        await axios.post(API_ENDPOINTS.DISCOUNTS.CREATE, payload, { headers });
        showToast("Discount created successfully", "success");
      }

      // Align the baseline with current state so the unsaved-changes guard
      // doesn't fire when the tab closes via goBackToList immediately after.
      setSavedFormData(fd);

      setTimeout(goBackToList, 800);
    } catch (err: any) {
      console.error("Error saving discount:", err);
      const msg = err?.response?.data?.message || "Failed to save discount";
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }, [formData, canSave, isEditMode, id, getAuthHeaders, showToast, goBackToList]);

  // ── Unsaved-changes guard ─────────────────────────────────────────────────
  // Reports dirty state (current formData vs last-saved `savedFormData`) up to
  // the DashboardTabContext so closing the tab with edits triggers the
  // Save/Discard modal. The default JSON.stringify comparator would serialize
  // our Set<string> fields to "{}" and miss edits — we normalize Sets to
  // sorted arrays before diffing so selecting/deselecting items, departments,
  // brands, stores, or tenders flips dirty correctly.
  useUnsavedChanges<DiscountFormData>({
    tabId: __tabId,
    formData,
    initialSnapshot: savedFormData,
    enabled: !loading && !isReadOnly,
    compare: (a, b) => {
      const norm = (d: DiscountFormData) => ({
        ...d,
        selectedItems: Array.from(d.selectedItems).sort(),
        selectedDepartments: Array.from(d.selectedDepartments).sort(),
        selectedBrands: Array.from(d.selectedBrands).sort(),
        selectedStores: Array.from(d.selectedStores).sort(),
        selectedTenders: Array.from(d.selectedTenders).sort(),
      });
      return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
    },
    saveHandler: async () => {
      // handleSave returns void; surface a failure to the modal via throw if
      // validation blocks the save (so the modal stays open with the error).
      if (!canSave()) {
        throw new Error("Please fix the validation errors before saving.");
      }
      await handleSave();
    },
  });

  // ── Field helpers ─────────────────────────────────────────────────────────
  const handleChange = useCallback(
    (field: keyof DiscountFormData, value: any) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const toggleSelection = useCallback(
    (field: "selectedItems" | "selectedDepartments" | "selectedBrands" | "selectedStores" | "selectedTenders", itemId: string) => {
      setFormData((prev) => {
        const s = new Set(prev[field]);
        s.has(itemId) ? s.delete(itemId) : s.add(itemId);
        return { ...prev, [field]: s };
      });
    },
    []
  );

  const handleSelectAll = useCallback(
    (field: "selectedItems" | "selectedDepartments" | "selectedBrands" | "selectedStores" | "selectedTenders", allIds: string[]) => {
      setFormData((prev) => {
        const all = allIds.every((id) => prev[field].has(id));
        return { ...prev, [field]: all ? new Set<string>() : new Set(allIds) };
      });
    },
    []
  );

  // Add items chosen in the Import Items dialog to the discount selection,
  // carrying their "Barcode — Name" label so they display immediately.
  const handleImportItems = useCallback((items: ImportedItem[]) => {
    if (!items.length) return;
    setSelectedItemRecords((prev) => {
      const seen = new Set(prev.map((r) => r.id));
      const add = items
        .filter((i) => i.itemId && !seen.has(i.itemId))
        .map((i) => ({ id: i.itemId, name: itemLabel(i.barcode, i.name) }));
      return [...prev, ...add];
    });
    // Don't let the resolve effect re-fetch these — we already have their names.
    items.forEach((i) => { if (i.itemId) resolvedAttemptRef.current.add(i.itemId); });
    setFormData((prev) => {
      const s = new Set(prev.selectedItems);
      items.forEach((i) => { if (i.itemId) s.add(i.itemId); });
      return { ...prev, selectedItems: s };
    });
  }, []);

  // ── Filter scope: VB rule — only ONE filter allowed per discount ──────────
  // When Items filter > 0, disable Brands & Departments (and vice versa)
  const handleFilterChange = useCallback(
    (filterField: "itemFilter" | "departmentFilter" | "brandFilter" | "storeFilter", value: number) => {
      setFormData((prev) => {
        const next = { ...prev, [filterField]: value };
        // VB rule: only one of items/departments/brands can be active
        if (value > 0) {
          if (filterField === "itemFilter") {
            next.departmentFilter = 0;
            next.brandFilter = 0;
          } else if (filterField === "departmentFilter") {
            next.itemFilter = 0;
            next.brandFilter = 0;
          } else if (filterField === "brandFilter") {
            next.itemFilter = 0;
            next.departmentFilter = 0;
          }
        }
        return next;
      });
    },
    []
  );

  // ── Filter data for current tab ───────────────────────────────────────────
  const currentFilterData = useMemo(() => {
    const q = filterSearch.toLowerCase();
    // Pin selected rows to the top so prior selections are immediately visible.
    const selectedFirst = (recs: LookupRecord[], set: Set<string>): LookupRecord[] =>
      set.size === 0 ? recs : [...recs.filter((r) => set.has(r.id)), ...recs.filter((r) => !set.has(r.id))];

    switch (activeFilterTab) {
      case "items": {
        // Desktop parity: the Items tab shows ONLY the items on the discount
        // (built via the Import Items dialog), as "Barcode — Name" — NOT the full
        // 9,000-item catalog. Names are resolved by id (selectedItemRecords) or
        // carried in from the import. Search filters this short list client-side.
        const sel = formData.selectedItems;
        const nameById = new Map<string, string>();
        selectedItemRecords.forEach((r) => nameById.set(r.id, r.name)); // resolved "Barcode — Name"
        let records = Array.from(sel).map((id) => ({ id, name: nameById.get(id) || id }));
        const qi = filterSearch.trim().toLowerCase();
        if (qi) records = records.filter((r) => r.name.toLowerCase().includes(qi));
        records.sort((a, b) => a.name.localeCompare(b.name));
        return { records, selectedSet: sel, selectionField: "selectedItems" as const, filterField: "itemFilter" as const, filterValue: formData.itemFilter, disabled: formData.departmentFilter > 0 || formData.brandFilter > 0 };
      }
      case "departments":
        return { records: selectedFirst(departmentsList.filter((d) => !q || d.name.toLowerCase().includes(q)), formData.selectedDepartments), selectedSet: formData.selectedDepartments, selectionField: "selectedDepartments" as const, filterField: "departmentFilter" as const, filterValue: formData.departmentFilter, disabled: formData.itemFilter > 0 || formData.brandFilter > 0 };
      case "brands":
        return { records: selectedFirst(brandsList.filter((b) => !q || b.name.toLowerCase().includes(q)), formData.selectedBrands), selectedSet: formData.selectedBrands, selectionField: "selectedBrands" as const, filterField: "brandFilter" as const, filterValue: formData.brandFilter, disabled: formData.itemFilter > 0 || formData.departmentFilter > 0 };
      case "stores":
        return { records: selectedFirst(storesList.filter((s) => !q || s.name.toLowerCase().includes(q)), formData.selectedStores), selectedSet: formData.selectedStores, selectionField: "selectedStores" as const, filterField: "storeFilter" as const, filterValue: formData.storeFilter, disabled: false };
      case "tenders":
        return { records: selectedFirst(tendersList.filter((t) => !q || t.name.toLowerCase().includes(q)), formData.selectedTenders), selectedSet: formData.selectedTenders, selectionField: "selectedTenders" as const, filterField: null as any, filterValue: 0, disabled: false };
    }
  }, [activeFilterTab, filterSearch, selectedItemRecords, departmentsList, brandsList, storesList, tendersList, formData]);

  // The selection list is only meaningful when this tab's filter is the ACTIVE
  // one (Include/Exclude). When it's "All" (0) or disabled because another
  // filter is active, any checks would be silently dropped on save
  // (selectedXIds are only sent when discountX > 0). So lock the list in those
  // cases — mirrors the desktop, which disables the whole tab page unless the
  // filter is on. Tenders have no filter mode and are always selectable.
  const selectionLocked =
    !!currentFilterData?.filterField &&
    ((currentFilterData?.disabled ?? false) || currentFilterData?.filterValue === 0);
  // True only for the "All (0), no other filter active" case — used to nudge the
  // user to pick Include/Exclude (the mutual-exclusion case shows its own note).
  const selectionLockedByMode =
    selectionLocked && !(currentFilterData?.disabled ?? false);

  const activeSaleTimesCount = useMemo(() => formData.saleTimes.filter((t) => t.enabled).length, [formData.saleTimes]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader size="lg" label="Loading discount..." />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="discount-form-page h-full flex flex-col">
      {/* Toast */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[320px] max-w-[400px] animate-slide-in dark:bg-gray-800 dark:border-gray-700">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${toast.type === "success" ? "bg-green-100" : toast.type === "error" ? "bg-red-100" : "bg-brand-50"}`}>
                {toast.type === "success" && <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>}
                {toast.type === "error" && <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>}
                {toast.type === "info" && <svg className="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              </div>
              <p className="flex-1 text-sm font-medium text-gray-900 dark:text-white">{toast.message}</p>
              <button onClick={() => setToast({ show: false, message: "", type: "success" })} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={goBackToList} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isReadOnly ? "View Discount" : isEditMode ? "Edit Discount" : "New Discount"}
          </h1>
          {formData.name && (
            <span className="text-sm text-gray-500 dark:text-gray-400">— {formData.name}</span>
          )}
        </div>
        {!isReadOnly && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goBackToList} disabled={saving}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : isEditMode ? "Update Discount" : "Save Discount"}
            </Button>
          </div>
        )}
      </div>

      {/* ─── Content ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-950">
        <div className="max-w-[1400px] mx-auto space-y-6">

          {/* ── Row 1: Basic Info + Discount Tiers ──────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

            {/* Basic Information Card */}
            <div className="xl:col-span-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Basic Information</h2>
              </div>
              <div className="p-5 space-y-4">
                {/* Name */}
                <div>
                  <Label htmlFor="discount-name">Name <span className="text-red-500">*</span></Label>
                  <div ref={nameRef} className={ringClass("name")}>
                    <Input id="discount-name" value={formData.name} onChange={(e) => { handleChange("name", e.target.value); if (flashedField === "name") setFlashedField(null); }} placeholder="Enter discount name" disabled={isReadOnly} />
                  </div>
                </div>

                {/* Code */}
                <div>
                  <Label htmlFor="discount-code">Code</Label>
                  <div className="flex gap-2">
                    <Input id="discount-code" value={formData.code} onChange={(e) => handleChange("code", e.target.value)} placeholder="Auto-generated" disabled={isReadOnly} />
                    {!isReadOnly && (
                      <button type="button" onClick={() => handleChange("code", String(Math.floor(10001 + Math.random() * 89999)))} className="flex-shrink-0 h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" title="Generate code">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Assign By Date toggle */}
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="mb-0">Assign By Date</Label>
                    <Switch label="" defaultChecked={formData.assignByDate} onChange={(checked) => { handleChange("assignByDate", checked); if (!checked) { handleChange("startDate", ""); handleChange("endDate", ""); } }} disabled={isReadOnly} />
                  </div>
                  {formData.assignByDate && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="start-date" className="text-xs">Start Date</Label>
                        <Input id="start-date" type="date" value={formData.startDate} onChange={(e) => handleChange("startDate", e.target.value)} disabled={isReadOnly} />
                      </div>
                      <div>
                        <Label htmlFor="end-date" className="text-xs">End Date</Label>
                        <Input id="end-date" type="date" value={formData.endDate} onChange={(e) => handleChange("endDate", e.target.value)} disabled={isReadOnly} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Sale Times */}
                <button type="button" onClick={() => setShowSaleTimesModal(true)} disabled={isReadOnly} className="w-full flex items-center justify-between h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Set Sale Times
                  </span>
                  {activeSaleTimesCount > 0 && (
                    <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-brand-100 text-brand-700 text-xs font-medium dark:bg-brand-900 dark:text-brand-300">{activeSaleTimesCount}</span>
                  )}
                </button>

                {/* Balance & Max */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="balance-days" className="text-xs">Balance Over (Days)</Label>
                    <Input id="balance-days" type="number" min="0" value={formData.notValidWithBalanceOverDays ?? ""} onChange={(e) => handleChange("notValidWithBalanceOverDays", e.target.value ? parseInt(e.target.value) : null)} placeholder="0" disabled={isReadOnly} />
                  </div>
                  <div>
                    <Label htmlFor="max-amount" className="text-xs">Max Discount ($)</Label>
                    <Input id="max-amount" type="number" min="0" step={0.01} value={formData.maxDiscountAmount ?? ""} onChange={(e) => handleChange("maxDiscountAmount", e.target.value ? parseFloat(e.target.value) : null)} placeholder="$0.00" disabled={isReadOnly} />
                  </div>
                </div>
              </div>
            </div>

            {/* Discount Tiers + Options */}
            <div className="xl:col-span-8">
              {/* 3 Discount cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {([1, 2, 3] as const).map((num) => {
                  const typeKey = `discountType${num}` as keyof DiscountFormData;
                  const valueKey = `discountValue${num}` as keyof DiscountFormData;
                  const minKey = `minTotalSale${num}` as keyof DiscountFormData;
                  const curType = formData[typeKey] as "amount" | "percent";
                  const curVal = formData[valueKey] as number | null;
                  const curMin = formData[minKey] as number | null;

                  return (
                    <div key={num} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                      <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Discount {num}</h2>
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-brand-50 text-brand-600 text-xs font-bold dark:bg-brand-900 dark:text-brand-300">{num}</span>
                      </div>
                      <div className="p-5 space-y-4">
                        <div>
                          <Label className="text-xs">Min Total Sale</Label>
                          <Input type="number" min="0" step={0.01} value={curMin ?? ""} onChange={(e) => handleChange(minKey, e.target.value ? parseFloat(e.target.value) : null)} placeholder="$0.00" disabled={isReadOnly} />
                        </div>
                        <div>
                          <Label className="text-xs mb-2">Type</Label>
                          <div className="flex gap-4">
                            <Radio id={`disc-${num}-amount`} name={`discountType${num}`} value="amount" checked={curType === "amount"} label="Amount ($)" onChange={() => { handleChange(typeKey, "amount"); handleChange(valueKey, null); }} disabled={isReadOnly} />
                            <Radio id={`disc-${num}-percent`} name={`discountType${num}`} value="percent" checked={curType === "percent"} label="Percent (%)" onChange={() => { handleChange(typeKey, "percent"); handleChange(valueKey, null); }} disabled={isReadOnly} />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">{curType === "amount" ? "Amount ($)" : "Percent (%)"}</Label>
                          {/* Discount #1's value input is the focus target
                              when "at least one discount" validation fails. */}
                          <div ref={num === 1 ? value1Ref : undefined} className={num === 1 ? ringClass("value1") : ""}>
                            <Input type="number" min="0" max={curType === "percent" ? "100" : undefined} step={curType === "percent" ? 0.1 : 0.01} value={curVal ?? ""} onChange={(e) => { handleChange(valueKey, e.target.value ? parseFloat(e.target.value) : null); if (num === 1 && flashedField === "value1") setFlashedField(null); }} placeholder={curType === "amount" ? "$0.00" : "0%"} disabled={isReadOnly} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Options */}
              <div className="mt-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Options</h2>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4">
                    <Checkbox label="Password Required" checked={formData.passwordRequired} onChange={(c) => handleChange("passwordRequired", c)} disabled={isReadOnly} />
                    <Checkbox label="Include Sale Item" checked={formData.includeSaleItem} onChange={(c) => handleChange("includeSaleItem", c)} disabled={isReadOnly} />
                    <Checkbox label="Not Discount Items" checked={formData.includeNotDiscountItems} onChange={(c) => handleChange("includeNotDiscountItems", c)} disabled={isReadOnly} />
                    <Checkbox label="Gift Card" checked={formData.giftCard} onChange={(c) => handleChange("giftCard", c)} disabled={isReadOnly} />
                    <Checkbox label="Highlighted Only" checked={formData.highlightedItemOnly} onChange={(c) => handleChange("highlightedItemOnly", c)} disabled={isReadOnly} />
                    <Checkbox label="Auto Assign" checked={formData.autoAssign} onChange={(c) => handleChange("autoAssign", c)} disabled={isReadOnly} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Row 2: Filter Scope & Data Selection ────────────────────── */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Filter Scope & Data Selection</h2>
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Only one filter allowed per discount (Items / Departments / Brands)</span>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <div className="flex">
                {([
                  { key: "items" as FilterTab, label: "Items", cnt: formData.selectedItems.size },
                  { key: "departments" as FilterTab, label: "Departments", cnt: formData.selectedDepartments.size },
                  { key: "brands" as FilterTab, label: "Brands", cnt: formData.selectedBrands.size },
                  { key: "stores" as FilterTab, label: "Stores", cnt: formData.selectedStores.size },
                  { key: "tenders" as FilterTab, label: "Tenders", cnt: formData.selectedTenders.size },
                ]).map((tab) => {
                  const isDisabledTab = tab.key !== "stores" && tab.key !== "tenders" && currentFilterData.disabled && activeFilterTab !== tab.key;
                  return (
                    <button key={tab.key} onClick={() => { setActiveFilterTab(tab.key); setFilterSearch(""); }}
                      className={`relative px-5 py-2.5 text-sm font-medium transition-colors ${isDisabledTab ? "text-gray-300 dark:text-gray-600" : activeFilterTab === tab.key ? "text-brand-600 dark:text-brand-400" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"}`}>
                      <span className="flex items-center gap-1.5">
                        {tab.label}
                        {tab.cnt > 0 && <span className="inline-flex items-center justify-center h-4 min-w-[18px] px-1 rounded-full bg-brand-100 text-brand-700 text-[10px] font-semibold dark:bg-brand-900 dark:text-brand-300">{tab.cnt}</span>}
                      </span>
                      {activeFilterTab === tab.key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Radio filter (not for tenders) */}
                {activeFilterTab !== "tenders" && currentFilterData.filterField && (
                  <div className="lg:col-span-3">
                    <div className="space-y-3">
                      <Label className="text-xs uppercase tracking-wide text-gray-500 mb-0">{activeFilterTab} Filter</Label>
                      {currentFilterData.disabled ? (
                        <p className="text-xs text-amber-600 dark:text-amber-400">Disabled — another filter is active</p>
                      ) : (
                        <div className="space-y-2.5">
                          <Radio id={`${activeFilterTab}-all`} name={`${activeFilterTab}Filter`} value="0" checked={currentFilterData.filterValue === 0} label={`All ${activeFilterTab}`} onChange={() => handleFilterChange(currentFilterData.filterField!, 0)} disabled={isReadOnly} />
                          <Radio id={`${activeFilterTab}-include`} name={`${activeFilterTab}Filter`} value="1" checked={currentFilterData.filterValue === 1} label="Include Selected" onChange={() => handleFilterChange(currentFilterData.filterField!, 1)} disabled={isReadOnly} />
                          <Radio id={`${activeFilterTab}-exclude`} name={`${activeFilterTab}Filter`} value="2" checked={currentFilterData.filterValue === 2} label="Exclude Selected" onChange={() => handleFilterChange(currentFilterData.filterField!, 2)} disabled={isReadOnly} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Data list */}
                <div className={activeFilterTab === "tenders" ? "lg:col-span-12" : "lg:col-span-9"}>
                  {/* Search + Select All */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative flex-1">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      <input type="text" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} placeholder={`Search ${activeFilterTab}...`} className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-300 transition-colors" disabled={isReadOnly} />
                    </div>
                    {!isReadOnly && !selectionLocked && activeFilterTab === "items" && (
                      <button type="button" onClick={() => setShowImportModal(true)} className="h-9 px-3 rounded-lg border border-brand-300 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-800 text-xs font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors whitespace-nowrap inline-flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                        Import Items
                      </button>
                    )}
                    {!isReadOnly && !selectionLocked && currentFilterData.records.length > 0 && (
                      <button type="button" onClick={() => handleSelectAll(currentFilterData.selectionField, currentFilterData.records.map((r) => r.id))} className="h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors whitespace-nowrap">
                        {currentFilterData.records.length > 0 && currentFilterData.records.every((r) => currentFilterData.selectedSet.has(r.id)) ? (activeFilterTab === "items" ? "Clear All" : "Deselect All") : "Select All"}
                      </button>
                    )}
                  </div>

                  {/* Nudge: list is locked until the user turns this filter on. */}
                  {selectionLockedByMode && (
                    <div className="mb-3 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                      Choose <strong>Include Selected</strong> or <strong>Exclude Selected</strong> to pick {activeFilterTab}.
                    </div>
                  )}

                  {/* Grid */}
                  <div className={`border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${selectionLocked ? "opacity-50" : ""}`}>
                    <div className="max-h-[300px] overflow-y-auto">
                      {currentFilterData.records.length === 0 ? (
                        <div className="flex items-center justify-center py-12 text-sm text-gray-500 dark:text-gray-400">
                          {activeFilterTab === "items"
                            ? "No items added yet — click “Import Items” to add some."
                            : `No ${activeFilterTab} found`}
                        </div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                            <tr>
                              <th className="w-10 px-3 py-2"><span className="sr-only">Select</span></th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Name</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {currentFilterData.records.map((record) => {
                              const sel = currentFilterData.selectedSet.has(record.id);
                              const rowLocked = isReadOnly || selectionLocked;
                              return (
                                <tr key={record.id} onClick={() => { if (!rowLocked) toggleSelection(currentFilterData.selectionField, record.id); }} className={`transition-colors ${rowLocked ? "cursor-default" : "cursor-pointer"} ${sel ? "bg-brand-50 dark:bg-brand-900/20" : rowLocked ? "" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}>
                                  <td className="w-10 px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                    <Checkbox checked={sel} onChange={() => { if (!rowLocked) toggleSelection(currentFilterData.selectionField, record.id); }} disabled={rowLocked} />
                                  </td>
                                  <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{record.name}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {activeFilterTab === "items"
                      ? `${currentFilterData.selectedSet.size} item${currentFilterData.selectedSet.size === 1 ? "" : "s"} selected`
                      : `${currentFilterData.selectedSet.size} of ${currentFilterData.records.length} selected`}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sale Times Modal */}
      {showSaleTimesModal && (
        <SaleTimesModal saleTimes={formData.saleTimes} onSave={(t) => { handleChange("saleTimes", t); setShowSaleTimesModal(false); }} onClose={() => setShowSaleTimesModal(false)} disabled={isReadOnly} />
      )}

      {/* Import Items Modal (desktop ImportItem parity) */}
      <ImportItemsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportItems}
        storeId={null}
        departments={departmentsList}
        brands={brandsList}
        getAuthHeaders={getAuthHeaders}
        existingIds={formData.selectedItems}
      />

      <style>{`
        .animate-slide-in { animation: slideInFromRight 0.3s ease-out; }
        @keyframes slideInFromRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
    </div>
  );
};

export default DiscountFormPage;
