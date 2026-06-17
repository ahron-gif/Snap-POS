import React, { useState, useCallback, useEffect, useRef } from "react";
import Button from "../../components/ui/button/Button";
import Loader from "../../components/ui/loader/Loader";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import SearchableSelect, { SelectOption } from "../../components/form/SearchableSelect";
import { manufacturerService, CreateManufacturerDto, UpdateManufacturerDto, STATUS_OPTIONS } from "../../services/manufacturerService";
import { useDashboardTabs } from "../../context/DashboardTabContext";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import { useTabFormCacheRead, useTabFormCacheWrite } from "../../hooks/useTabFormCache";
import { focusFirstInvalid } from "../../hooks/useFocusFirstInvalid";
import { useConfirm } from "../../components/ui/ConfirmModal";

// Props interface for tab-based or embedded-panel navigation
interface ManufacturerFormPageProps {
  id?: string;
  isNew?: boolean;
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
interface ManufacturerFormData {
  manufacturerName: string;
  manufacturerNo: string;
  status: number;
}

const initialFormData: ManufacturerFormData = {
  manufacturerName: "",
  manufacturerNo: "",
  status: 1, // Default to Active
};

// Convert STATUS_OPTIONS to SelectOption format
const statusSelectOptions: SelectOption[] = STATUS_OPTIONS.map((opt) => ({
  value: opt.value.toString(),
  label: opt.label,
}));

const ManufacturerFormPage: React.FC<ManufacturerFormPageProps> = ({ id, isNew, viewMode = false, embedded = false, onClose, onSaved, __tabId }) => {
  const { openTab, closeTab, activeTabId } = useDashboardTabs();

  const isEditMode = id && !isNew;
  const isReadOnly = viewMode;
  const { confirm, ConfirmDialog } = useConfirm();

  // ── Per-tab cache: preserves state across tab switches (in-memory only) ──
  interface ManufacturerFormCache {
    formData: ManufacturerFormData;
    savedFormData: ManufacturerFormData | null;
    loadedDateModified: string | null;
  }
  const { initial: cachedTabState, hasCachedState } =
    useTabFormCacheRead<ManufacturerFormCache>(__tabId);

  // State
  const [formData, setFormData] = useState<ManufacturerFormData>(
    () => cachedTabState?.formData ?? initialFormData,
  );
  const [savedFormData, setSavedFormData] = useState<ManufacturerFormData | null>(
    () => cachedTabState?.savedFormData ?? null,
  );
  // DateModified loaded from GET — sent back on update so the server's optimistic-
  // concurrency check passes.
  const [loadedDateModified, setLoadedDateModified] = useState<string | null>(
    () => cachedTabState?.loadedDateModified ?? null,
  );
  const hasLoadedOnceRef = useRef(hasCachedState);

  useTabFormCacheWrite<ManufacturerFormCache>(
    __tabId,
    hasLoadedOnceRef.current ? { formData, savedFormData, loadedDateModified } : null,
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" | "info" }>({
    show: false,
    message: "",
    type: "success",
  });

  // Focus-first-invalid wiring: refs for required inputs + flash state.
  // The wrapper-div ref is needed because InputField doesn't forwardRef;
  // the helper drills into the first focusable descendant.
  const manufacturerNameRef = useRef<HTMLDivElement | null>(null);
  const [flashedField, setFlashedField] = useState<string | null>(null);
  const ringClass = (key: string) =>
    flashedField === key ? "ring-2 ring-red-500 rounded-lg" : "";

  // Show toast
  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  }, []);

  // Load manufacturer for editing
  const loadManufacturer = useCallback(async () => {
    if (!isEditMode || !id) return;

    setLoading(true);
    setError(null);
    try {
      const result = await manufacturerService.getManufacturerById(id);
      if (result.success && result.data) {
        setLoadedDateModified(result.data.dateModified);
        const loaded: ManufacturerFormData = {
          manufacturerName: result.data.manufacturerName || "",
          manufacturerNo: result.data.manufacturerNo || "",
          status: result.data.status ?? 1,
        };
        setFormData(loaded);
        setSavedFormData(loaded);
      } else {
        setError(result.message || "Failed to load manufacturer");
      }
    } catch (err) {
      setError("An error occurred while loading manufacturer");
      console.error(err);
    } finally {
      setLoading(false);
      hasLoadedOnceRef.current = true;
    }
  }, [isEditMode, id]);

  // Initial load
  useEffect(() => {
    // Per-tab cache hit: state was restored via useState initializers; skip the
    // per-record fetch and start the cache-write effect by flagging loaded.
    if (hasCachedState) {
      hasLoadedOnceRef.current = true;
      return;
    }
    if (isEditMode) {
      loadManufacturer();
    } else {
      setSavedFormData(initialFormData);
      hasLoadedOnceRef.current = true;
    }
  }, [loadManufacturer, isEditMode, hasCachedState]);

  // Handle input change
  const handleChange = (field: keyof ManufacturerFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Required-field validation. Returns the offender's message OR null.
  // Side effects (focus + scroll + flash) live in the focusFirstInvalid
  // call so the form's save handler can keep its existing return shape.
  const validateAndFocus = (): string | null => {
    const ok = focusFirstInvalid(
      [
        {
          ref: manufacturerNameRef,
          isValid: !!formData.manufacturerName.trim(),
          flashKey: "manufacturerName",
        },
      ],
      setFlashedField,
    );
    if (ok) return null;
    if (!formData.manufacturerName.trim()) return "Manufacturer Name is required";
    return null;
  };

  // Close the form. Embedded panel mode defers to the parent via onSaved/onClose;
  // otherwise this is the legacy tab-navigation path.
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
      component: "ManufacturerListPage",
      title: "Manufacturers",
      closable: true,
    });
  }, [activeTabId, closeTab, embedded, onClose, onSaved, openTab]);

  // Save manufacturer
  const handleSave = async (): Promise<boolean> => {
    const validationError = validateAndFocus();
    if (validationError) {
      showToast(validationError, "error");
      return false;
    }

    setSaving(true);
    try {
      if (isEditMode && id) {
        const dto: UpdateManufacturerDto = {
          manufacturerID: id,
          manufacturerName: formData.manufacturerName.trim(),
          manufacturerNo: formData.manufacturerNo.trim() || null,
          status: formData.status,
          dateModified: loadedDateModified,
        };
        console.log('[ManufacturerForm] Saving update with DTO:', dto);
        const result = await manufacturerService.updateManufacturer(dto);
        console.log('[ManufacturerForm] Update result:', result);
        if (result.success) {
          showToast("Manufacturer updated successfully", "success");
          setSavedFormData(formData);
          setTimeout(() => goBackToList(), 1000);
          return true;
        } else {
          const errorMsg = result.message || "Failed to update manufacturer";
          const errorDetails = result.errors ? ` (${result.errors.join(', ')})` : '';
          showToast(`${errorMsg}${errorDetails}`, "error");
          return false;
        }
      } else {
        const dto: CreateManufacturerDto = {
          manufacturerName: formData.manufacturerName.trim(),
          manufacturerNo: formData.manufacturerNo.trim() || null,
          status: formData.status,
        };
        const result = await manufacturerService.createManufacturer(dto);
        if (result.success) {
          showToast("Manufacturer created successfully", "success");
          setSavedFormData(formData);
          setTimeout(() => goBackToList(), 1000);
          return true;
        } else {
          showToast(result.message || "Failed to create manufacturer", "error");
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
  };

  useUnsavedChanges<ManufacturerFormData>({
    tabId: __tabId,
    formData,
    initialSnapshot: savedFormData,
    saveHandler: async () => {
      const ok = await handleSave();
      if (!ok) throw new Error("Could not save manufacturer. Please fix any validation errors and try again.");
    },
  });

  // Handle cancel
  const handleCancel = () => {
    if (embedded) {
      onClose?.();
      return;
    }
    goBackToList();
  };

  // Delete from the edit panel. Mirrors ItemGroupFormPage:
  // confirm → canDelete pre-check → delete → toast → back to list.
  const handleDelete = useCallback(async () => {
    if (!id) return;

    const confirmed = await confirm({
      title: "Delete Manufacturer",
      message: `Are you sure you want to delete "${formData.manufacturerName.trim() || "this manufacturer"}"?`,
      variant: "danger",
    });
    if (!confirmed) return;

    const canDelete = await manufacturerService.canDeleteManufacturer(id);
    if (!canDelete.success || !canDelete.data) {
      showToast(canDelete.message || "This manufacturer cannot be deleted. It may be in use.", "error");
      return;
    }

    const result = await manufacturerService.deleteManufacturer(id);
    if (!result.success) {
      showToast(result.message || "Failed to delete manufacturer", "error");
      return;
    }

    showToast("Manufacturer deleted successfully", "success");
    setTimeout(() => goBackToList(), 600);
  }, [confirm, formData.manufacturerName, goBackToList, id, showToast]);

  if (loading) {
    return (
      <Loader size="lg" label="Loading manufacturer..." />
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Toast notification */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
          toast.type === "success" ? "bg-green-500" : toast.type === "error" ? "bg-red-500" : "bg-brand-500"
        } text-white`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white">
          {isReadOnly ? "View Manufacturer" : isEditMode ? "Edit Manufacturer" : "New Manufacturer"}
        </h1>
        <div className="flex items-center gap-2">
          {/* WEB-187: Delete available in edit mode (matches Item Groups side-panel layout). */}
          {isEditMode && !isReadOnly && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleDelete}
              disabled={saving}
            >
              Delete
            </Button>
          )}
          {!isReadOnly && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
          >
            {isReadOnly ? "Close" : "Cancel"}
          </Button>
        </div>
      </div>

      {/* ConfirmDialog from useConfirm — renders inline; invisible until invoked. */}
      {ConfirmDialog}

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Form Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-6">Manufacturer Information</h2>

            <div className="space-y-6">
              {/* Manufacturer Name */}
              <div>
                <Label htmlFor="manufacturerName">
                  Manufacturer Name {!isReadOnly && <span className="text-red-500">*</span>}
                </Label>
                {/* Wrapper holds the ref (InputField doesn't forwardRef);
                    helper drills into the inner <input> for focus. */}
                <div ref={manufacturerNameRef} className={ringClass("manufacturerName")}>
                  <Input
                    id="manufacturerName"
                    type="text"
                    value={formData.manufacturerName}
                    onChange={(e) => {
                      handleChange("manufacturerName", e.target.value);
                      if (flashedField === "manufacturerName") setFlashedField(null);
                    }}
                    placeholder="Enter manufacturer name"
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              {/* Manufacturer No */}
              <div>
                <Label htmlFor="manufacturerNo">Manufacturer No</Label>
                <Input
                  id="manufacturerNo"
                  type="text"
                  value={formData.manufacturerNo}
                  onChange={(e) => handleChange("manufacturerNo", e.target.value)}
                  placeholder="Enter manufacturer number"
                  disabled={isReadOnly}
                />
              </div>

              {/* Status */}
              <div>
                <Label htmlFor="status">Status</Label>
                <SearchableSelect
                  options={statusSelectOptions}
                  value={formData.status.toString()}
                  onChange={(value) => handleChange("status", value !== "" ? parseInt(value) : 1)}
                  placeholder="Select status"
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

export default ManufacturerFormPage;
