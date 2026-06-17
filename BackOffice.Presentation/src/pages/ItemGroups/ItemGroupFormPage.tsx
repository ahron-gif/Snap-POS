import React, { useState, useCallback, useEffect, useRef } from "react";
import Button from "../../components/ui/button/Button";
import Loader from "../../components/ui/loader/Loader";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import TreeSearchableSelect, { TreeSelectOption } from "../../components/form/TreeSearchableSelect";
import SearchableSelect from "../../components/form/SearchableSelect";
import { itemGroupService, CreateItemGroupDto, UpdateItemGroupDto, ItemGroupGridDto, ItemGroupDetailDto, STATUS_OPTIONS } from "../../services/itemGroupService";
import { useDashboardTabs } from "../../context/DashboardTabContext";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import { useTabFormCacheRead, useTabFormCacheWrite } from "../../hooks/useTabFormCache";
import { focusFirstInvalid } from "../../hooks/useFocusFirstInvalid";
import { useConfirm } from "../../components/ui/ConfirmModal";

// Props interface for tab-based navigation
interface ItemGroupFormPageProps {
  id?: string;
  isNew?: boolean;
  parentId?: string;
  embedded?: boolean;
  onClose?: () => void;
  onSaved?: () => void;
  /** When true, all inputs are disabled — page acts as a viewer, not an editor. */
  viewMode?: boolean;
  /** Injected by DashboardTabContent */
  __tabId?: string;
}

// Form data interface
interface ItemGroupFormData {
  name: string;
  parentID: string;
  status: number;
}

const initialFormData: ItemGroupFormData = {
  name: "",
  parentID: "",
  status: 1, // Default to Active
};

// Convert STATUS_OPTIONS to SelectOption format (string values)
const statusOptions = STATUS_OPTIONS.map(opt => ({
  value: opt.value.toString(),
  label: opt.label,
}));

const ItemGroupFormPage: React.FC<ItemGroupFormPageProps> = ({ id, isNew, parentId, embedded = false, onClose, onSaved, viewMode = false, __tabId }) => {
  const { openTab, closeTab, activeTabId } = useDashboardTabs();
  const { confirm, ConfirmDialog } = useConfirm();

  const isEditMode = id && !isNew;
  const isReadOnly = viewMode;

  // ── Per-tab cache: preserves state across tab switches (in-memory only) ──
  interface ItemGroupFormCache {
    formData: ItemGroupFormData;
    savedFormData: ItemGroupFormData | null;
    detailData: ItemGroupDetailDto | null;
  }
  const { initial: cachedTabState, hasCachedState } =
    useTabFormCacheRead<ItemGroupFormCache>(__tabId);

  // State
  const [formData, setFormData] = useState<ItemGroupFormData>(
    () => cachedTabState?.formData ?? initialFormData,
  );
  const [savedFormData, setSavedFormData] = useState<ItemGroupFormData | null>(
    () => cachedTabState?.savedFormData ?? null,
  );
  const [detailData, setDetailData] = useState<ItemGroupDetailDto | null>(
    () => cachedTabState?.detailData ?? null,
  );
  const hasLoadedOnceRef = useRef(hasCachedState);

  useTabFormCacheWrite<ItemGroupFormCache>(
    __tabId,
    hasLoadedOnceRef.current ? { formData, savedFormData, detailData } : null,
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemGroupOptions, setItemGroupOptions] = useState<TreeSelectOption[]>([]);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" | "info" }>({
    show: false,
    message: "",
    type: "success",
  });

  // Focus-first-invalid wiring (see useFocusFirstInvalid).
  const nameRef = useRef<HTMLDivElement | null>(null);
  const [flashedField, setFlashedField] = useState<string | null>(null);
  const ringClass = (key: string) =>
    flashedField === key ? "ring-2 ring-red-500 rounded-lg" : "";

  // Show toast
  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  }, []);

  // Load item groups for parent dropdown
  const loadItemGroups = useCallback(async () => {
    try {
      const result = await itemGroupService.getAllItemGroups();
      if (result.success && result.data) {
        const options: TreeSelectOption[] = result.data
          .filter((g: ItemGroupGridDto) => g.itemGroupID !== id) // Exclude current item group (can't be its own parent)
          .map((g: ItemGroupGridDto) => ({
            value: g.itemGroupID,
            label: g.name,
            parentId: g.parentID,
          }));
        setItemGroupOptions([{ value: "", label: "(No Parent - Root Level)", parentId: null }, ...options]);
      }
    } catch (err) {
      console.error("Error loading item groups:", err);
    }
  }, [id]);

  // Load item group for editing
  const loadItemGroup = useCallback(async () => {
    if (!isEditMode || !id) return;

    setLoading(true);
    setError(null);
    try {
      const result = await itemGroupService.getItemGroupById(id);
      if (result.success && result.data) {
        const loaded: ItemGroupFormData = {
          name: result.data.name || "",
          parentID: result.data.parentID || "",
          status: result.data.status ?? 1,
        };
        setDetailData(result.data);
        setFormData(loaded);
        setSavedFormData(loaded);
      } else {
        setError(result.message || "Failed to load item group");
      }
    } catch (err) {
      setError("An error occurred while loading item group");
      console.error(err);
    } finally {
      setLoading(false);
      hasLoadedOnceRef.current = true;
    }
  }, [isEditMode, id]);

  // Initial load
  useEffect(() => {
    loadItemGroups();
    if (hasCachedState) {
      // Per-tab cache hit: state was restored via useState initializers; skip
      // the per-record fetch and start mirroring future edits to the cache.
      hasLoadedOnceRef.current = true;
      return;
    }
    if (isEditMode) {
      loadItemGroup();
    } else if (parentId) {
      // Set parent if provided in query params (for creating child)
      setFormData(prev => ({ ...prev, parentID: parentId }));
      setSavedFormData({ ...initialFormData, parentID: parentId });
      hasLoadedOnceRef.current = true;
    } else {
      setSavedFormData(initialFormData);
      hasLoadedOnceRef.current = true;
    }
  }, [loadItemGroups, loadItemGroup, isEditMode, parentId, hasCachedState]);

  // Handle input change
  const handleChange = (field: keyof ItemGroupFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Validate + focus-first-invalid. Returns the offender's message OR null.
  const validateAndFocus = (): string | null => {
    const ok = focusFirstInvalid(
      [
        { ref: nameRef, isValid: !!formData.name.trim(), flashKey: "name" },
      ],
      setFlashedField,
    );
    if (ok) return null;
    if (!formData.name.trim()) return "Name is required";
    return null;
  };

  // Go back to list (close current tab and open list tab)
  const goBackToList = useCallback(() => {
    if (embedded) {
      onSaved?.();
      onClose?.();
      return;
    }

    // Close current tab
    if (activeTabId) {
      closeTab(activeTabId);
    }
    // Open item groups list tab
    openTab({
      component: "ItemGroupListPage",
      title: "Item Groups",
      closable: true,
    });
  }, [activeTabId, closeTab, embedded, onClose, onSaved, openTab]);

  // Save item group
  const handleSave = async (): Promise<boolean> => {
    const validationError = validateAndFocus();
    if (validationError) {
      showToast(validationError, "error");
      return false;
    }

    setSaving(true);
    try {
      if (isEditMode && id) {
        const dto: UpdateItemGroupDto = {
          itemGroupID: id,
          name: formData.name.trim(),
          parentID: formData.parentID || null,
          status: formData.status,
        };
        const result = await itemGroupService.updateItemGroup(dto);
        if (result.success) {
          showToast("Item group updated successfully", "success");
          setSavedFormData(formData);
          setTimeout(() => goBackToList(), 1000);
          return true;
        } else {
          showToast(result.message || "Failed to update item group", "error");
          return false;
        }
      } else {
        const dto: CreateItemGroupDto = {
          name: formData.name.trim(),
          parentID: formData.parentID || null,
          status: formData.status,
        };
        const result = await itemGroupService.createItemGroup(dto);
        if (result.success) {
          showToast("Item group created successfully", "success");
          setSavedFormData(formData);
          setTimeout(() => goBackToList(), 1000);
          return true;
        } else {
          showToast(result.message || "Failed to create item group", "error");
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

  useUnsavedChanges<ItemGroupFormData>({
    tabId: __tabId,
    formData,
    initialSnapshot: savedFormData,
    saveHandler: async () => {
      const ok = await handleSave();
      if (!ok) throw new Error("Could not save item group. Please fix any validation errors and try again.");
    },
  });

  // Handle cancel
  const handleCancel = () => {
    onClose?.();
    if (!embedded) {
      goBackToList();
    }
  };

  const handleDelete = useCallback(async () => {
    if (!id) return;

    const confirmed = await confirm({
      title: "Delete Item Group",
      message: `Are you sure you want to delete "${formData.name || "this item group"}"?`,
      variant: "danger",
    });
    if (!confirmed) return;

    const canDelete = await itemGroupService.canDeleteItemGroup(id);
    if (!canDelete.success || !canDelete.data) {
      showToast("This item group cannot be deleted. It may be in use.", "error");
      return;
    }

    const result = await itemGroupService.deleteItemGroup(id);
    if (!result.success) {
      showToast(result.message || "Failed to delete item group", "error");
      return;
    }

    showToast("Item group deleted successfully", "success");
    setTimeout(() => goBackToList(), 600);
  }, [confirm, formData.name, goBackToList, id, showToast]);

  const formatDate = (value: string | null | undefined): string => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const metadataTop = [
    { label: "Date Created", value: formatDate(detailData?.dateCreated) || "N/A" },
    { label: "Date Modified", value: formatDate(detailData?.dateModified) || "N/A" },
  ];

  const metadataBottom = [
    { label: "User Created", value: detailData?.userCreated?.trim() || "N/A" },
    { label: "User Modified", value: detailData?.userModified?.trim() || "N/A" },
  ];

  if (loading) {
    return (
      <Loader size="lg" label="Loading item group..." />
    );
  };

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
          {isEditMode ? "View/Edit Item Group" : "New Item Group"}
        </h1>
        <div className="flex items-center gap-2">
          {isEditMode && (
            <Button variant="danger" size="sm" onClick={handleDelete} disabled={saving}>
              Delete
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Basic Information Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-6">Basic Information</h2>

            <div className="grid grid-cols-1 gap-6">
              {/* Name */}
              <div>
                <Label htmlFor="name">
                  Name <span className="text-red-500">*</span>
                </Label>
                {/* Wrapper holds the focus-first-invalid ref; helper drills
                    into the inner <input>. */}
                <div ref={nameRef} className={ringClass("name")}>
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => {
                      handleChange("name", e.target.value);
                      if (flashedField === "name") setFlashedField(null);
                    }}
                    placeholder="Enter item group name"
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              {/* Parent Item Group */}
              <div>
                <Label htmlFor="parentID">Parent Item Group</Label>
                <TreeSearchableSelect
                  options={itemGroupOptions}
                  value={formData.parentID}
                  onChange={(value) => handleChange("parentID", value)}
                  placeholder="Select parent item group"
                />
              </div>

              {/* Status */}
              <div>
                <Label htmlFor="status">Status</Label>
                <SearchableSelect
                  options={statusOptions}
                  value={formData.status.toString()}
                  onChange={(value) => handleChange("status", parseInt(value, 10))}
                  placeholder="Select status"
                />
              </div>

            </div>
          </div>

        </div>
      </div>
      {isEditMode && detailData && (
        <div className="px-6 py-3 text-sm text-gray-500 dark:text-gray-400">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {metadataTop.map((field) => (
                <div key={field.label}>
                  <span className="mr-2">{field.label}</span>
                  <span className="text-gray-700 dark:text-gray-300">{field.value}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              {metadataBottom.map((field) => (
                <div key={field.label}>
                  <span className="mr-2">{field.label}</span>
                  <span className="text-gray-700 dark:text-gray-300">{field.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {ConfirmDialog}
    </div>
  );
};

export default ItemGroupFormPage;
