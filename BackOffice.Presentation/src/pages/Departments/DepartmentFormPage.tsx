import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Button from "../../components/ui/button/Button";
import Loader from "../../components/ui/loader/Loader";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import SearchableSelect, { SelectOption } from "../../components/form/SearchableSelect";
import Checkbox from "../../components/form/input/Checkbox";
import { departmentService, CreateDepartmentDto, UpdateDepartmentDto, DepartmentDetailDto } from "../../services/departmentService";
import { lookupService, DepartmentLookupDto, TaxLookupDto } from "../../services/lookupService";
import { useDashboardTabs } from "../../context/DashboardTabContext";
import { useIsFoodStore } from "../../hooks/useIsFoodStore";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import { useTabFormCacheRead, useTabFormCacheWrite } from "../../hooks/useTabFormCache";
import { focusFirstInvalid } from "../../hooks/useFocusFirstInvalid";
import { useConfirm } from "../../components/ui/ConfirmModal";

// Props interface for tab-based or embedded-panel navigation
interface DepartmentFormPageProps {
  id?: string;
  isNew?: boolean;
  parentId?: string;
  viewMode?: boolean;
  /** WEB-187: when true, render as a side-panel embed (no tab navigation on save/cancel). */
  embedded?: boolean;
  /** Called when the form should close itself (Cancel, or after Delete). */
  onClose?: () => void;
  /** Called after a successful Save so the parent list can refresh. */
  onSaved?: () => void;
  /** Injected by DashboardTabContent */
  __tabId?: string;
}

// Form data interface
interface DepartmentFormData {
  name: string;
  description: string;
  parentDepartmentID: string;
  defaultMarkup: number | null;
  defaultMarkupA: number | null;
  defaultMarkupB: number | null;
  defaultMarkupC: number | null;
  defaultMarkupD: number | null;
  roundUp: number;
  roundUpA: number | null;
  roundUpB: number | null;
  roundUpC: number | null;
  roundUpD: number | null;
  roundValue: number | null;
  roundValueA: number | null;
  roundValueB: number | null;
  roundValueC: number | null;
  roundValueD: number | null;
  defaultCogsAccount: number | null;
  defaultIncomeAccount: number | null;
  defaultTaxNo: string | null;
  isDefaultTaxInclude: boolean;
  isDefaultFoodStampable: boolean;
  isDefaultDiscountable: boolean;
  defaultProfitCalculation: number | null;
  departmentNo: string;
  discountID: string;
}

const initialFormData: DepartmentFormData = {
  name: "",
  description: "",
  parentDepartmentID: "",
  defaultMarkup: null,
  defaultMarkupA: null,
  defaultMarkupB: null,
  defaultMarkupC: null,
  defaultMarkupD: null,
  roundUp: 0,
  roundUpA: null,
  roundUpB: null,
  roundUpC: null,
  roundUpD: null,
  roundValue: null,
  roundValueA: null,
  roundValueB: null,
  roundValueC: null,
  roundValueD: null,
  defaultCogsAccount: null,
  defaultIncomeAccount: null,
  defaultTaxNo: null,
  isDefaultTaxInclude: false,
  isDefaultFoodStampable: false,
  isDefaultDiscountable: false,
  defaultProfitCalculation: null,
  departmentNo: "",
  discountID: "",
};

// Round up options
const ROUND_UP_OPTIONS: SelectOption[] = [
  { value: "0", label: "None" },
  { value: "1", label: "Round Up" },
  { value: "2", label: "Round Down" },
];

const DepartmentFormPage: React.FC<DepartmentFormPageProps> = ({ id, isNew, parentId, viewMode = false, embedded = false, onClose, onSaved, __tabId }) => {
  const { openTab, closeTab, activeTabId } = useDashboardTabs();

  const isEditMode = id && !isNew;
  const isReadOnly = viewMode;
  const isFoodStore = useIsFoodStore();
  const { confirm, ConfirmDialog } = useConfirm();

  // ── Per-tab cache: preserves state across tab switches (in-memory only) ──
  interface DepartmentFormCache {
    formData: DepartmentFormData;
    savedFormData: DepartmentFormData | null;
    loadedDateModified: string | null;
  }
  const { initial: cachedTabState, hasCachedState } =
    useTabFormCacheRead<DepartmentFormCache>(__tabId);

  // State
  const [formData, setFormData] = useState<DepartmentFormData>(
    () => cachedTabState?.formData ?? initialFormData,
  );
  const [savedFormData, setSavedFormData] = useState<DepartmentFormData | null>(
    () => cachedTabState?.savedFormData ?? null,
  );
  // DateModified loaded from GET — sent back on update so SP_DepartmentStoreUpdate's
  // optimistic-concurrency WHERE clause matches the row.
  const [loadedDateModified, setLoadedDateModified] = useState<string | null>(
    () => cachedTabState?.loadedDateModified ?? null,
  );
  const hasLoadedOnceRef = useRef(hasCachedState);

  // Mirror state into the per-tab cache so tab switches don't wipe edits.
  useTabFormCacheWrite<DepartmentFormCache>(
    __tabId,
    hasLoadedOnceRef.current ? { formData, savedFormData, loadedDateModified } : null,
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [departmentOptions, setDepartmentOptions] = useState<SelectOption[]>([]);
  const [taxOptions, setTaxOptions] = useState<SelectOption[]>([]);

  // Focus-first-invalid wiring (see useFocusFirstInvalid).
  const nameRef = useRef<HTMLDivElement | null>(null);
  const [flashedField, setFlashedField] = useState<string | null>(null);
  const ringClass = (key: string) =>
    flashedField === key ? "ring-2 ring-red-500 rounded-lg" : "";
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" | "info" }>({
    show: false,
    message: "",
    type: "success",
  });

  // Show toast
  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  }, []);

  // Build hierarchical department options with path names
  const buildDepartmentTree = useCallback((departments: DepartmentLookupDto[], currentId?: string): SelectOption[] => {
    const idToName = new Map<string, string>();
    departments.forEach(d => idToName.set(d.departmentStoreID, d.name));

    const getFullPath = (dept: DepartmentLookupDto): string => {
      const path: string[] = [dept.name];
      let parentId = dept.parentDepartmentID;
      while (parentId && idToName.has(parentId)) {
        path.unshift(idToName.get(parentId)!);
        const parent = departments.find(d => d.departmentStoreID === parentId);
        parentId = parent?.parentDepartmentID ?? null;
      }
      return path.join(" > ");
    };

    return departments
      .filter(d => d.departmentStoreID !== currentId) // Exclude current department (can't be its own parent)
      .map(d => ({
        value: d.departmentStoreID,
        label: getFullPath(d),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  // Load departments for parent dropdown
  const loadDepartments = useCallback(async () => {
    try {
      const result = await lookupService.getDepartments();
      if (result.success && result.data) {
        const options = buildDepartmentTree(result.data, isEditMode ? id : undefined);
        setDepartmentOptions([{ value: "", label: "(No Parent - Root Level)" }, ...options]);
      }
    } catch (err) {
      console.error("Error loading departments:", err);
    }
  }, [buildDepartmentTree, isEditMode, id]);

  // Load tax groups for the Taxable-row dropdown (mirrors LuTax in old FrmDepartment.vb)
  const loadTaxes = useCallback(async () => {
    try {
      const result = await lookupService.getTaxes();
      if (result.success && result.data) {
        const options: SelectOption[] = result.data.map((t: TaxLookupDto) => ({
          value: t.taxID,
          label: t.taxName,
        }));
        setTaxOptions([{ value: "", label: "(None)" }, ...options]);
      }
    } catch (err) {
      console.error("Error loading taxes:", err);
    }
  }, []);

  // Load department for editing
  const loadDepartment = useCallback(async () => {
    if (!isEditMode || !id) return;

    setLoading(true);
    setError(null);
    try {
      const result = await departmentService.getDepartmentById(id);
      if (result.success && result.data) {
        const dept = result.data;
        setLoadedDateModified(dept.dateModified);
        setFormData({
          name: dept.name,
          description: dept.description || "",
          parentDepartmentID: dept.parentDepartmentID || "",
          defaultMarkup: dept.defaultMarkup,
          defaultMarkupA: dept.defaultMarkupA,
          defaultMarkupB: dept.defaultMarkupB,
          defaultMarkupC: dept.defaultMarkupC,
          defaultMarkupD: dept.defaultMarkupD,
          roundUp: dept.roundUp,
          roundUpA: dept.roundUpA,
          roundUpB: dept.roundUpB,
          roundUpC: dept.roundUpC,
          roundUpD: dept.roundUpD,
          roundValue: dept.roundValue,
          roundValueA: dept.roundValueA,
          roundValueB: dept.roundValueB,
          roundValueC: dept.roundValueC,
          roundValueD: dept.roundValueD,
          defaultCogsAccount: dept.defaultCogsAccount,
          defaultIncomeAccount: dept.defaultIncomeAccount,
          defaultTaxNo: dept.defaultTaxNo,
          isDefaultTaxInclude: dept.isDefaultTaxInclude ?? false,
          isDefaultFoodStampable: dept.isDefaultFoodStampable ?? false,
          isDefaultDiscountable: dept.isDefaultDiscountable ?? false,
          defaultProfitCalculation: dept.defaultProfitCalculation,
          departmentNo: dept.departmentNo ?? "",
          discountID: dept.discountID || "",
        });
        setSavedFormData({
          name: dept.name,
          description: dept.description || "",
          parentDepartmentID: dept.parentDepartmentID || "",
          defaultMarkup: dept.defaultMarkup,
          defaultMarkupA: dept.defaultMarkupA,
          defaultMarkupB: dept.defaultMarkupB,
          defaultMarkupC: dept.defaultMarkupC,
          defaultMarkupD: dept.defaultMarkupD,
          roundUp: dept.roundUp,
          roundUpA: dept.roundUpA,
          roundUpB: dept.roundUpB,
          roundUpC: dept.roundUpC,
          roundUpD: dept.roundUpD,
          roundValue: dept.roundValue,
          roundValueA: dept.roundValueA,
          roundValueB: dept.roundValueB,
          roundValueC: dept.roundValueC,
          roundValueD: dept.roundValueD,
          defaultCogsAccount: dept.defaultCogsAccount,
          defaultIncomeAccount: dept.defaultIncomeAccount,
          defaultTaxNo: dept.defaultTaxNo,
          isDefaultTaxInclude: dept.isDefaultTaxInclude ?? false,
          isDefaultFoodStampable: dept.isDefaultFoodStampable ?? false,
          isDefaultDiscountable: dept.isDefaultDiscountable ?? false,
          defaultProfitCalculation: dept.defaultProfitCalculation,
          departmentNo: dept.departmentNo ?? "",
          discountID: dept.discountID || "",
        });
      } else {
        setError(result.message || "Failed to load department");
      }
    } catch (err) {
      setError("An error occurred while loading department");
      console.error(err);
    } finally {
      setLoading(false);
      hasLoadedOnceRef.current = true;
    }
  }, [isEditMode, id]);

  useEffect(() => {
    // Lookups (departments + taxes) are cheap and id-independent, so always
    // run them — even on a cache-hit remount the parent dropdown options
    // need to be present. Only the per-record fetch is gated.
    loadDepartments();
    loadTaxes();
    if (hasCachedState) {
      // Per-tab cache hit: formData + savedFormData + loadedDateModified were
      // restored via useState initializers. Skip the per-record fetch and
      // flag loaded so the cache-write effect starts mirroring future edits.
      hasLoadedOnceRef.current = true;
      return;
    }
    if (isEditMode) {
      loadDepartment();
    } else if (parentId) {
      // Pre-select parent if adding child
      setFormData(prev => ({ ...prev, parentDepartmentID: parentId }));
      setSavedFormData({ ...initialFormData, parentDepartmentID: parentId });
      hasLoadedOnceRef.current = true;
    } else {
      setSavedFormData(initialFormData);
      hasLoadedOnceRef.current = true;
    }
  }, [loadDepartments, loadTaxes, loadDepartment, isEditMode, parentId, hasCachedState]);

  // Handle form field changes
  const handleChange = useCallback((field: keyof DepartmentFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Close the form. When embedded as a side panel, defer to the parent via
  // onSaved+onClose. Otherwise close the current tab and re-open the list tab
  // (the legacy tab-navigation flow).
  const goBackToList = useCallback(() => {
    if (embedded) {
      onSaved?.();
      onClose?.();
      return;
    }
    if (activeTabId) {
      closeTab(activeTabId);
    }
    openTab({
      component: "DepartmentListPage",
      title: "Departments",
      closable: true,
    });
  }, [activeTabId, closeTab, embedded, onClose, onSaved, openTab]);

  // Handle save
  const handleSave = useCallback(async (): Promise<boolean> => {
    // Validate required fields with focus-first-invalid behaviour.
    const valid = focusFirstInvalid(
      [{ ref: nameRef, isValid: !!formData.name.trim(), flashKey: "name" }],
      setFlashedField,
    );
    if (!valid) {
      showToast("Department name is required", "error");
      return false;
    }

    // Check if name already exists
    const nameExistsResult = await departmentService.departmentNameExists(
      formData.name.trim(),
      isEditMode ? id : undefined
    );
    if (nameExistsResult.success && nameExistsResult.data) {
      showToast("A department with this name already exists", "error");
      return false;
    }

    setSaving(true);
    try {
      if (isEditMode && id) {
        const updateDto: UpdateDepartmentDto = {
          departmentStoreID: id,
          dateModified: loadedDateModified,
          name: formData.name.trim(),
          description: formData.description || null,
          parentDepartmentID: formData.parentDepartmentID || null,
          defaultMarkup: formData.defaultMarkup,
          defaultMarkupA: formData.defaultMarkupA,
          defaultMarkupB: formData.defaultMarkupB,
          defaultMarkupC: formData.defaultMarkupC,
          defaultMarkupD: formData.defaultMarkupD,
          roundUp: formData.roundUp,
          roundUpA: formData.roundUpA,
          roundUpB: formData.roundUpB,
          roundUpC: formData.roundUpC,
          roundUpD: formData.roundUpD,
          roundValue: formData.roundValue,
          roundValueA: formData.roundValueA,
          roundValueB: formData.roundValueB,
          roundValueC: formData.roundValueC,
          roundValueD: formData.roundValueD,
          defaultCogsAccount: formData.defaultCogsAccount,
          defaultIncomeAccount: formData.defaultIncomeAccount,
          defaultTaxNo: formData.defaultTaxNo,
          isDefaultTaxInclude: formData.isDefaultTaxInclude,
          isDefaultFoodStampable: formData.isDefaultFoodStampable,
          isDefaultDiscountable: formData.isDefaultDiscountable,
          defaultProfitCalculation: formData.defaultProfitCalculation,
          departmentNo: formData.departmentNo.trim() || null,
          discountID: formData.discountID || null,
        };

        const result = await departmentService.updateDepartment(updateDto);
        if (result.success) {
          showToast("Department updated successfully", "success");
          setSavedFormData(formData);
          setTimeout(() => goBackToList(), 1000);
          return true;
        } else {
          showToast(result.message || "Failed to update department", "error");
          return false;
        }
      } else {
        const createDto: CreateDepartmentDto = {
          name: formData.name.trim(),
          description: formData.description || null,
          parentDepartmentID: formData.parentDepartmentID || null,
          defaultMarkup: formData.defaultMarkup,
          defaultMarkupA: formData.defaultMarkupA,
          defaultMarkupB: formData.defaultMarkupB,
          defaultMarkupC: formData.defaultMarkupC,
          defaultMarkupD: formData.defaultMarkupD,
          roundUp: formData.roundUp,
          roundUpA: formData.roundUpA,
          roundUpB: formData.roundUpB,
          roundUpC: formData.roundUpC,
          roundUpD: formData.roundUpD,
          roundValue: formData.roundValue,
          roundValueA: formData.roundValueA,
          roundValueB: formData.roundValueB,
          roundValueC: formData.roundValueC,
          roundValueD: formData.roundValueD,
          defaultCogsAccount: formData.defaultCogsAccount,
          defaultIncomeAccount: formData.defaultIncomeAccount,
          defaultTaxNo: formData.defaultTaxNo,
          isDefaultTaxInclude: formData.isDefaultTaxInclude,
          isDefaultFoodStampable: formData.isDefaultFoodStampable,
          isDefaultDiscountable: formData.isDefaultDiscountable,
          defaultProfitCalculation: formData.defaultProfitCalculation,
          departmentNo: formData.departmentNo.trim() || null,
          discountID: formData.discountID || null,
        };

        const result = await departmentService.createDepartment(createDto);
        if (result.success) {
          showToast("Department created successfully", "success");
          setSavedFormData(formData);
          setTimeout(() => goBackToList(), 1000);
          return true;
        } else {
          showToast(result.message || "Failed to create department", "error");
          return false;
        }
      }
    } catch (err) {
      showToast("An error occurred while saving", "error");
      console.error(err);
      return false;
    } finally {
      setSaving(false);
    }
    return false;
  }, [formData, isEditMode, id, showToast, goBackToList]);

  useUnsavedChanges<DepartmentFormData>({
    tabId: __tabId,
    formData,
    initialSnapshot: savedFormData,
    saveHandler: async () => {
      const ok = await handleSave();
      if (!ok) throw new Error("Could not save department. Please fix any validation errors and try again.");
    },
  });

  // Handle cancel
  const handleCancel = useCallback(() => {
    // When embedded, just close the panel — no list reload needed (no changes were saved).
    if (embedded) {
      onClose?.();
      return;
    }
    goBackToList();
  }, [embedded, goBackToList, onClose]);

  // Delete the department from the edit panel. Mirrors ItemGroupFormPage's
  // handleDelete: confirm → canDelete pre-check → delete → toast → back to list.
  const handleDelete = useCallback(async () => {
    if (!id) return;

    const confirmed = await confirm({
      title: "Delete Department",
      message: `Are you sure you want to delete "${formData.name?.trim() || "this department"}"?`,
      variant: "danger",
    });
    if (!confirmed) return;

    const canDelete = await departmentService.canDeleteDepartment(id);
    if (!canDelete.success || !canDelete.data) {
      showToast(canDelete.message || "This department cannot be deleted. It may be in use.", "error");
      return;
    }

    const result = await departmentService.deleteDepartment(id);
    if (!result.success) {
      showToast(result.message || "Failed to delete department", "error");
      return;
    }

    showToast("Department deleted successfully", "success");
    setTimeout(() => goBackToList(), 600);
  }, [confirm, formData.name, goBackToList, id, showToast]);

  if (loading) {
    return (
      <Loader size="lg" />
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-red-600 mb-4">{error}</div>
        <button
          onClick={() => goBackToList()}
          className="px-4 py-2 bg-brand-500 text-white rounded hover:bg-brand-600"
        >
          Back to Departments
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 bg-gray-50">
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[300px] p-4">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              toast.type === "success" ? "bg-green-100" : toast.type === "error" ? "bg-red-100" : "bg-brand-50"
            }`}>
              {toast.type === "success" && (
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {toast.type === "error" && (
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <span className="text-sm text-gray-700">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          {isReadOnly ? "View Department" : isEditMode ? "Edit Department" : "New Department"}
        </h1>
        <div className="flex gap-2">
          {/* WEB-187: Delete available in edit mode (matches Item Groups side-panel layout). */}
          {isEditMode && !isReadOnly && (
            <Button
              onClick={handleDelete}
              variant="danger"
              disabled={saving}
            >
              Delete
            </Button>
          )}
          {!isReadOnly && (
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-brand-500 text-white hover:bg-brand-600"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          )}
          <Button
            onClick={handleCancel}
            variant="outline"
            className="border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            {isReadOnly ? "Close" : "Cancel"}
          </Button>
        </div>
      </div>

      {/* ConfirmDialog from useConfirm — renders inline; nothing visible until invoked. */}
      {ConfirmDialog}

      {/* Form */}
      <div className="flex-1 overflow-auto">
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Basic Info Section */}
          <div className="border-b pb-4">
            <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Name {!isReadOnly && "*"}</Label>
                {/* Wrapper holds the focus-first-invalid ref. */}
                <div ref={nameRef} className={ringClass("name")}>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => {
                      handleChange("name", e.target.value);
                      if (flashedField === "name") setFlashedField(null);
                    }}
                    placeholder="Enter department name"
                    disabled={isReadOnly}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  placeholder="Enter description"
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label htmlFor="parentDepartment">Parent Department</Label>
                <SearchableSelect
                  options={departmentOptions}
                  value={formData.parentDepartmentID}
                  onChange={(value) => handleChange("parentDepartmentID", value)}
                  placeholder="Select parent department..."
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label htmlFor="departmentNo">Department Number</Label>
                <Input
                  id="departmentNo"
                  value={formData.departmentNo}
                  onChange={(e) => handleChange("departmentNo", e.target.value)}
                  placeholder="Enter department number"
                  disabled={isReadOnly}
                />
              </div>
            </div>
          </div>

          {/* Markup & Round Up Section */}
          <div className="border-b pb-4">
            <h2 className="text-lg font-semibold mb-4">Default Markup & Rounding</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <Label htmlFor="defaultMarkup">Default Markup %</Label>
                <Input
                  id="defaultMarkup"
                  type="number"
                  step={0.01}
                  value={formData.defaultMarkup?.toString() || ""}
                  onChange={(e) => handleChange("defaultMarkup", e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="0.00"
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label htmlFor="defaultMarkupA">Markup A %</Label>
                <Input
                  id="defaultMarkupA"
                  type="number"
                  step={0.01}
                  value={formData.defaultMarkupA?.toString() || ""}
                  onChange={(e) => handleChange("defaultMarkupA", e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="0.00"
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label htmlFor="defaultMarkupB">Markup B %</Label>
                <Input
                  id="defaultMarkupB"
                  type="number"
                  step={0.01}
                  value={formData.defaultMarkupB?.toString() || ""}
                  onChange={(e) => handleChange("defaultMarkupB", e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="0.00"
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label htmlFor="defaultMarkupC">Markup C %</Label>
                <Input
                  id="defaultMarkupC"
                  type="number"
                  step={0.01}
                  value={formData.defaultMarkupC?.toString() || ""}
                  onChange={(e) => handleChange("defaultMarkupC", e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="0.00"
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label htmlFor="defaultMarkupD">Markup D %</Label>
                <Input
                  id="defaultMarkupD"
                  type="number"
                  step={0.01}
                  value={formData.defaultMarkupD?.toString() || ""}
                  onChange={(e) => handleChange("defaultMarkupD", e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="0.00"
                  disabled={isReadOnly}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-4">
              <div>
                <Label htmlFor="roundUp">Round Up</Label>
                <SearchableSelect
                  options={ROUND_UP_OPTIONS}
                  value={formData.roundUp.toString()}
                  onChange={(value) => handleChange("roundUp", parseInt(value))}
                  placeholder="Select..."
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label htmlFor="roundUpA">Round Up A</Label>
                <SearchableSelect
                  options={ROUND_UP_OPTIONS}
                  value={formData.roundUpA?.toString() ?? ""}
                  onChange={(value) => handleChange("roundUpA", value === "" ? null : parseInt(value))}
                  placeholder="Select..."
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label htmlFor="roundUpB">Round Up B</Label>
                <SearchableSelect
                  options={ROUND_UP_OPTIONS}
                  value={formData.roundUpB?.toString() ?? ""}
                  onChange={(value) => handleChange("roundUpB", value === "" ? null : parseInt(value))}
                  placeholder="Select..."
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label htmlFor="roundUpC">Round Up C</Label>
                <SearchableSelect
                  options={ROUND_UP_OPTIONS}
                  value={formData.roundUpC?.toString() ?? ""}
                  onChange={(value) => handleChange("roundUpC", value === "" ? null : parseInt(value))}
                  placeholder="Select..."
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label htmlFor="roundUpD">Round Up D</Label>
                <SearchableSelect
                  options={ROUND_UP_OPTIONS}
                  value={formData.roundUpD?.toString() ?? ""}
                  onChange={(value) => handleChange("roundUpD", value === "" ? null : parseInt(value))}
                  placeholder="Select..."
                  disabled={isReadOnly}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-4">
              <div>
                <Label htmlFor="roundValue">Round Value</Label>
                <Input
                  id="roundValue"
                  type="number"
                  step={0.01}
                  value={formData.roundValue?.toString() || ""}
                  onChange={(e) => handleChange("roundValue", e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="0.00"
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label htmlFor="roundValueA">Round Value A</Label>
                <Input
                  id="roundValueA"
                  type="number"
                  step={0.01}
                  value={formData.roundValueA?.toString() || ""}
                  onChange={(e) => handleChange("roundValueA", e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="0.00"
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label htmlFor="roundValueB">Round Value B</Label>
                <Input
                  id="roundValueB"
                  type="number"
                  step={0.01}
                  value={formData.roundValueB?.toString() || ""}
                  onChange={(e) => handleChange("roundValueB", e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="0.00"
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label htmlFor="roundValueC">Round Value C</Label>
                <Input
                  id="roundValueC"
                  type="number"
                  step={0.01}
                  value={formData.roundValueC?.toString() || ""}
                  onChange={(e) => handleChange("roundValueC", e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="0.00"
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label htmlFor="roundValueD">Round Value D</Label>
                <Input
                  id="roundValueD"
                  type="number"
                  step={0.01}
                  value={formData.roundValueD?.toString() || ""}
                  onChange={(e) => handleChange("roundValueD", e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="0.00"
                  disabled={isReadOnly}
                />
              </div>
            </div>
          </div>

          {/* Default Settings Section */}
          <div className="border-b pb-4">
            <h2 className="text-lg font-semibold mb-4">Default Item Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Taxable checkbox + tax group dropdown (matches LuTax in old backoffice) */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Checkbox
                    id="isDefaultTaxInclude"
                    checked={formData.isDefaultTaxInclude}
                    onChange={(checked) => handleChange("isDefaultTaxInclude", checked)}
                    disabled={isReadOnly}
                  />
                  <Label htmlFor="isDefaultTaxInclude" className="cursor-pointer">
                    Taxable
                  </Label>
                </div>
                <SearchableSelect
                  options={taxOptions}
                  value={formData.defaultTaxNo ?? ""}
                  onChange={(value) => handleChange("defaultTaxNo", value || null)}
                  placeholder="Select tax group..."
                  disabled={isReadOnly || !formData.isDefaultTaxInclude}
                />
              </div>

              {/* Food Stampable — only visible for food stores */}
              {isFoodStore && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="isDefaultFoodStampable"
                    checked={formData.isDefaultFoodStampable}
                    onChange={(checked) => handleChange("isDefaultFoodStampable", checked)}
                    disabled={isReadOnly}
                  />
                  <Label htmlFor="isDefaultFoodStampable" className="cursor-pointer">
                    Food Stampable
                  </Label>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Checkbox
                  id="isDefaultDiscountable"
                  checked={formData.isDefaultDiscountable}
                  onChange={(checked) => handleChange("isDefaultDiscountable", checked)}
                  disabled={isReadOnly}
                />
                <Label htmlFor="isDefaultDiscountable" className="cursor-pointer">
                  Discountable
                </Label>
              </div>
            </div>
          </div>

          {/* Accounting Section */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Accounting</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="defaultCogsAccount">Default COGS Account</Label>
                <Input
                  id="defaultCogsAccount"
                  type="number"
                  value={formData.defaultCogsAccount?.toString() ?? ""}
                  onChange={(e) => handleChange("defaultCogsAccount", e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Enter COGS account"
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label htmlFor="defaultIncomeAccount">Default Income Account</Label>
                <Input
                  id="defaultIncomeAccount"
                  type="number"
                  value={formData.defaultIncomeAccount?.toString() ?? ""}
                  onChange={(e) => handleChange("defaultIncomeAccount", e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Enter income account"
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label htmlFor="defaultProfitCalculation">Default Profit Calculation</Label>
                <Input
                  id="defaultProfitCalculation"
                  type="number"
                  value={formData.defaultProfitCalculation?.toString() || ""}
                  onChange={(e) => handleChange("defaultProfitCalculation", e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Enter profit calculation"
                  disabled={isReadOnly}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DepartmentFormPage;
