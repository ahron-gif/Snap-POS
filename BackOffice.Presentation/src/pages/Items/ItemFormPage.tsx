import React, { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges"
import Button from "../../components/ui/button/Button"
import Loader from "../../components/ui/loader/Loader"
import Input from "../../components/form/input/InputField"
import Label from "../../components/form/Label"
import SearchableSelect, { SelectOption } from "../../components/form/SearchableSelect"
import { TreeSelectOption } from "../../components/form/TreeSearchableSelect"
import Checkbox from "../../components/form/input/Checkbox"
import Radio from "../../components/form/input/Radio"
import TextArea from "../../components/form/input/TextArea"
import MultiSelect from "../../components/form/MultiSelect"
import ConfirmDialog from "../../components/common/ConfirmDialog"
import Tooltip from "../../components/common/Tooltip"
import Flatpickr from "react-flatpickr"
import "flatpickr/dist/themes/light.css"
import { useDashboardTabs } from "../../context/DashboardTabContext"
import { useStore } from "../../context/StoreContext"
import { usePermissions } from "../../context/PermissionContext"
import { useIsFoodStore } from "../../hooks/useIsFoodStore"
import { useStoreType } from "../../hooks/useStoreType"
import MatrixEditor from "../../components/Items/MatrixEditor/MatrixEditor"
import { itemService, CreateItemDto, DepartmentDefaultsDto } from "../../services/itemService"
import { lookupService, LookupDto, DepartmentLookupDto, ItemsLookupValueDto, ItemGroupLookupDto, ManufacturerLookupDto, ExtraChargeItemLookupDto, AppItemLookupDto, TaxLookupDto, MixAndMatchLookupDto, SupplierLookupDto, LOOKUP_VALUE_TYPES } from "../../services/lookupService"
import { departmentService } from "../../services/departmentService"
import { manufacturerService } from "../../services/manufacturerService"
import { itemGroupService } from "../../services/itemGroupService"
import { Modal } from "../../components/ui/modal"
import { useItemSectionLayout } from "../../hooks/useItemSectionLayout"
import PrintLabelsDialog from "../LabelDesigner/components/PrintLabelsDialog"
import {
    coerceItemNumber,
    formatMoneyTypedFromNumber,
    formatQtyTypedFromNumber,
    parseMoneyTypedInput,
    parseQtyTypedInput,
} from "../../utils/numericInputUtils"
import "./item_detail_v6.css"

/** Snapshot of the items grid when this edit tab was opened — drives the vitals-bar record pager. */
export interface ItemListNavigationState {
    totalCount: number
    itemStoreIds: string[]
    itemTitles: string[]
    /** 0-based index of the current row within `itemStoreIds` / `itemTitles` */
    index: number
}

// Props interface for tab-based navigation
interface ItemFormPageProps {
    id?: string
    isNew?: boolean
    copyData?: any // Pre-filled data from Copy Item feature
    _refreshKey?: number // Set by tab system when re-opening an existing tab to trigger data reload
    __tabId?: string // Injected by dashboard tab shell — keys unsaved-changes + updateTabProps (item pager)
    /** When set (e.g. opened from Item List), prev/next move within the loaded grid rows. */
    itemListNavigation?: ItemListNavigationState
}

// Tab type definition
type TabKey = "general" | "sales" | "specials" | "vendor" | "extra" | "customFields"

interface Tab {
    key: TabKey
    label: string
    shortcut: string
}

const TABS: Tab[] = [
    { key: "general", label: "General", shortcut: "F2" },
    { key: "sales", label: "Sales", shortcut: "F3" },
    { key: "specials", label: "Specials", shortcut: "F4" },
    { key: "vendor", label: "Vendor", shortcut: "F5" },
    { key: "extra", label: "Extra", shortcut: "F6" },
    { key: "customFields", label: "Custom Fields", shortcut: "" },
]

// Form data interface
interface ItemFormData {
    name: string
    upc: string
    alternateCode: string
    description: string
    itemType: string
    department: string
    subDepartment: string
    subSubDepartment: string
    units: string
    measure: string
    size: string
    upcType: string
    location: string
    groups: string[]
    listPrice: number
    markdownPrice: number
    usuallyOrderedIn: string
    usuallySoldIn: string
    lastCaseNetCostEnabled: boolean
    lastCaseNetCost: number
    caseQty: number
    cost: number
    caseCode: string
    taxable: boolean
    taxableRate: string
    discountable: boolean
    foodStamp: boolean
    wic: boolean
    tare: string
    setPricesForCase: boolean
    price: number
    profitMargin: number
    markup: number
    casePrice: number
    caseProfitMargin: number
    caseMarkup: number
    mtdQty: string
    mtdAmount: number
    ptdQty: string
    ptdAmount: number
    ytdQty: string
    ytdAmount: number
    mtdReturnQty: string
    ptdReturnQty: string
    ytdReturnQty: string
    averageCost: number
    onHand: number
    onOrder: number
    onTransferOrder: number
    onSaleOrder: number
    reorderPoint: number
    restockLevel: number
    saleType: string
    specialsCost: string
    regularPrice: number
    // === Standard sale type fields (backend: salePrice, minForSale, saleMax, saleMin, specialBuy) ===
    stdPrice: number
    stdMargin: number
    stdMarkup: number
    stdMinTotal: number
    stdMaxQty: number
    stdMinQty: number
    stdAssignDate: boolean
    stdFromDate: string
    stdToDate: string
    stdMemberOnly: boolean
    // === Break Down sale type fields (backend: specialPrice, specialBuy for itemCount) ===
    bdItemCount: number
    bdPrice: number
    bdMargin: number
    bdMarkup: number
    bdMinTotal: number
    bdMaxQty: number
    bdAssignDate: boolean
    bdFromDate: string
    bdToDate: string
    // === Mix & Match sale type fields ===
    mixMatchSelection: string
    mixMatchQty: number
    mixMatchAmount: number
    mmMinTotal: number
    mmAssignDate: boolean
    mmFromDate: string
    mmToDate: string
    // === Combined sale type fields (backend: salePrice, pkgPrice) ===
    cmbSalePrice: number
    cmbSaleMargin: number
    cmbSaleMarkup: number
    cmbPkgPrice: number
    cmbPkgFor: string
    cmbPkgMargin: number
    cmbPkgMarkup: number
    cmbMinTotal: number
    cmbMaxQty: number
    cmbAssignDate: boolean
    cmbFromDate: string
    cmbToDate: string
    // Future Pricing
    newPrice: number
    dateEffective: string
    vendors: VendorItem[]
    averageDeliveryDelay: string
    vendorItemCode: string
    extraCharge1: string
    extraCharge2: string
    extraCharge3: string
    extraInfo1: string
    extraInfo2: string
    saveToAllStores: boolean
    selectedStore: string
    upcCodes: string[]
    sellOnWeb: boolean
    webPrice: number
    webCasePrice: number
    appButton: string[]
    customerCode: string
    matrix1: string
    matrix2: string
    imageData: string | null
    manufacturer: string
    partNo: string
    pattern: string
    customField1: string
    customField2: string
    customField3: string
    customField4: string
    customField5: string
    customField6: string
    customField7: string
    customField8: string
    customField9: string
    customField10: string
    // Lock Markup toggle (VB.NET Lock Markup mode)
    lockMarkup: boolean
    // Days for return
    daysForReturn: number
}

// Confirm dialog state type
interface ConfirmDialogState {
    isOpen: boolean
    title: string
    message: string | React.ReactNode
    type: "warning" | "info" | "error" | "confirm"
    buttons: { label: string; variant: "primary" | "danger" | "secondary" | "outline"; value: string }[]
    onResult: (result: string) => void
}

interface VendorItem {
    id: string
    mainSupplier: boolean
    grossCost: number
    caseQty: number
    pcCost: number
    name: string
}

type DepartmentAddLevel = "root" | "sub" | "subSub"

const normDeptId = (id: string | null | undefined) => (id ?? "").trim().toLowerCase()

/** Split a stored department ID into root / sub / sub-sub for the cascading dropdowns. */
function resolveDepartmentHierarchy(
    departmentId: string,
    options: TreeSelectOption[],
): { root: string; sub: string; subSub: string } {
    if (!departmentId) return { root: "", sub: "", subSub: "" }
    const chain: string[] = []
    let current: string | null = departmentId
    const visited = new Set<string>()
    while (current && !visited.has(normDeptId(current))) {
        visited.add(normDeptId(current))
        chain.unshift(current)
        const opt = options.find((o) => normDeptId(o.value) === normDeptId(current))
        current = opt?.parentId || null
    }
    if (chain.length === 0) return { root: "", sub: "", subSub: "" }
    if (chain.length === 1) return { root: chain[0], sub: "", subSub: "" }
    if (chain.length === 2) return { root: chain[0], sub: chain[1], subSub: "" }
    return { root: chain[0], sub: chain[1], subSub: chain[chain.length - 1] }
}

function getLeafDepartmentId(data: Pick<ItemFormData, "department" | "subDepartment" | "subSubDepartment">): string {
    return data.subSubDepartment?.trim() || data.subDepartment?.trim() || data.department?.trim() || ""
}

const initialFormData: ItemFormData = {
    name: "",
    upc: "",
    alternateCode: "",
    description: "",
    itemType: "0",
    department: "",
    subDepartment: "",
    subSubDepartment: "",
    units: "",
    measure: "",
    size: "",
    upcType: "Standard",
    location: "",
    groups: [],
    listPrice: 0,
    markdownPrice: 0,
    usuallyOrderedIn: "Cases",
    usuallySoldIn: "Cases",
    lastCaseNetCostEnabled: true,
    lastCaseNetCost: 0,
    caseQty: 0,
    cost: 0,
    caseCode: "",
    taxable: false,
    taxableRate: "",
    discountable: false,
    foodStamp: false,
    wic: false,
    tare: "",
    setPricesForCase: true,
    price: 0,
    profitMargin: 0,
    markup: 0,
    casePrice: 0,
    caseProfitMargin: 0,
    caseMarkup: 0,
    mtdQty: "",
    mtdAmount: 0,
    ptdQty: "",
    ptdAmount: 0,
    ytdQty: "",
    ytdAmount: 0,
    mtdReturnQty: "",
    ptdReturnQty: "",
    ytdReturnQty: "",
    averageCost: 0,
    onHand: 0,
    onOrder: 0,
    onTransferOrder: 0,
    onSaleOrder: 0,
    reorderPoint: 0,
    restockLevel: 0,
    saleType: "noSale",
    specialsCost: "$0.00 / $0.00",
    regularPrice: 0,
    // Standard sale type fields
    stdPrice: 0,
    stdMargin: 0,
    stdMarkup: 0,
    stdMinTotal: 0,
    stdMaxQty: 0,
    stdMinQty: 0,
    stdAssignDate: true,
    stdFromDate: new Date().toISOString().split('T')[0],
    stdToDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    stdMemberOnly: false,
    // Break Down sale type fields
    bdItemCount: 0,
    bdPrice: 0,
    bdMargin: 0,
    bdMarkup: 0,
    bdMinTotal: 0,
    bdMaxQty: 0,
    bdAssignDate: true,
    bdFromDate: new Date().toISOString().split('T')[0],
    bdToDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    // Mix & Match sale type fields
    mixMatchSelection: "",
    mixMatchQty: 0,
    mixMatchAmount: 0,
    mmMinTotal: 0,
    mmAssignDate: true,
    mmFromDate: new Date().toISOString().split('T')[0],
    mmToDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    // Combined sale type fields
    cmbSalePrice: 0,
    cmbSaleMargin: 0,
    cmbSaleMarkup: 0,
    cmbPkgPrice: 0,
    cmbPkgFor: "",
    cmbPkgMargin: 0,
    cmbPkgMarkup: 0,
    cmbMinTotal: 0,
    cmbMaxQty: 0,
    cmbAssignDate: true,
    cmbFromDate: new Date().toISOString().split('T')[0],
    cmbToDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    // Future Pricing
    newPrice: 0,
    dateEffective: "",
    vendors: [],
    averageDeliveryDelay: "",
    vendorItemCode: "",
    extraCharge1: "",
    extraCharge2: "",
    extraCharge3: "",
    extraInfo1: "",
    extraInfo2: "",
    saveToAllStores: false,
    selectedStore: "",
    upcCodes: [],
    sellOnWeb: true,
    webPrice: 0,
    webCasePrice: 0,
    appButton: [],
    customerCode: "",
    matrix1: "",
    matrix2: "",
    imageData: null,
    manufacturer: "",
    partNo: "",
    pattern: "",
    customField1: "",
    customField2: "",
    customField3: "",
    customField4: "",
    customField5: "",
    customField6: "",
    customField7: "",
    customField8: "",
    customField9: "",
    customField10: "",
    lockMarkup: false,
    daysForReturn: 0,
}

// Dropdown options - centralized for consistency
// Fallback Item Type options if API fails
const DEFAULT_ITEM_TYPE_OPTIONS: SelectOption[] = [
    { value: "0", label: "Standard" },
    { value: "1", label: "Weight" },
    { value: "2", label: "Matrix" },
    { value: "3", label: "Matrix Child" },
    { value: "4", label: "Service" },
    { value: "5", label: "Tag Along" },
]

const UPC_TYPE_OPTIONS: SelectOption[] = [
    { value: "Standard", label: "Standard" },
    { value: "Random Weight", label: "Random Weight" },
    { value: "Coupon", label: "Coupon" },
]

// Measure values from SystemValues table (SystemTableNo = 52)
// Value = SystemValueNo (int), matches ItemMain.Meaasure column
const MEASURE_OPTIONS: SelectOption[] = [
    { value: "1", label: "Oz." },
    { value: "2", label: "Lb." },
    { value: "3", label: "Pc." },
    { value: "4", label: "Bag" },
    { value: "5", label: "Kg." },
    { value: "6", label: "Gr." },
    { value: "7", label: "Lt" },
    { value: "8", label: "Gll" },
    { value: "9", label: "Cnt." },
    { value: "10", label: "Bx." },
    { value: "11", label: "Ml." },
    { value: "12", label: "Pack" },
    { value: "13", label: "Pair" },
    { value: "14", label: "Sq. Ft." },
    { value: "15", label: "Tray" },
    { value: "16", label: "Bunch" },
    { value: "17", label: "Fl oz" },
    { value: "18", label: "Pt" },
    { value: "19", label: "Qt" },
    { value: "20", label: "Ml" },
    { value: "21", label: "Ft" },
    { value: "22", label: "SQ ft" },
    { value: "23", label: "Pk" },
    { value: "24", label: "Ct" },
    { value: "25", label: "SQ Yd" },
    { value: "26", label: "Inch" },
]

// UOM Type options for "Usually Ordered In" / "Usually Sold In"
// Values match SystemValues UOMType table (returned as strings from the DB view)
// DB stores integers: Pieces=0, Dozens=1, Cases=2, Lb=3
const ORDER_UNIT_OPTIONS: SelectOption[] = [
    { value: "Pieces", label: "Pieces" },
    { value: "Dozens", label: "Dozens" },
    { value: "Cases", label: "Cases" },
    { value: "Lb", label: "Lb" },
]

// Icon components
const PlusIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
    </svg>
)

const CloseIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
)

const SearchIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
)

// Reusable components
const ActionButtonGroup: React.FC<{ onAdd?: () => void; onRemove?: () => void }> = ({ onAdd, onRemove }) => (
    <div className="flex items-center gap-1">
        <button
            type="button"
            onClick={onAdd}
            className="p-1.5 rounded-md text-green-600 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-900/20 transition-colors"
        >
            <PlusIcon />
        </button>
        <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded-md text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors"
        >
            <CloseIcon />
        </button>
    </div>
)

const Section: React.FC<{
    title: React.ReactNode
    children: React.ReactNode
    className?: string
    collapsible?: boolean
    isOpen?: boolean
    onToggle?: () => void
}> = ({ title, children, className = "", collapsible = false, isOpen = true, onToggle }) => {
    const headerContent =
        typeof title === "string" ? (
            <h3 className="text-xs font-semibold uppercase tracking-wider">{title}</h3>
        ) : (
            title
        )

    return (
        <div className={`adv item-detail-v6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 shadow-card ${className}`}>
            {collapsible && onToggle ? (
                <button
                    type="button"
                    className="w-full flex items-center justify-between item-detail-v6-toggle-summary"
                    onClick={onToggle}
                    aria-expanded={isOpen}
                >
                    <div className="flex-1 text-left">{headerContent}</div>
                    <span className={`item-detail-v6-toggle-chevron ${isOpen ? "open" : ""}`} aria-hidden="true">
                        ▶
                    </span>
                </button>
            ) : (
                <div className="item-detail-v6-adv-summary">{headerContent}</div>
            )}
            {!collapsible || isOpen ? (
                <div className={collapsible ? "item-detail-v6-toggle-body" : "adv-body"}>{children}</div>
            ) : null}
        </div>
    )
}

/**
 * Section card with persistent collapse/drag-reorder state (per user, cross-device).
 * Header is clickable to toggle; a drag-dot handle allows reordering within a column.
 */
interface CollapsibleCardProps {
    sectionId: string
    title: React.ReactNode
    subText?: React.ReactNode
    collapsed: boolean
    onToggle: () => void
    onDragStart?: (id: string) => void
    onDragOver?: (id: string, e: React.DragEvent) => void
    onDrop?: (id: string) => void
    onDragEnd?: () => void
    draggingId?: string | null
    dragOverId?: string | null
    /** CSS flex `order` value — drives visual reordering inside the column. */
    order?: number
    className?: string
    bodyClassName?: string
    footer?: React.ReactNode
    children?: React.ReactNode
}

const CollapsibleCard: React.FC<CollapsibleCardProps> = ({
    sectionId,
    title,
    subText,
    collapsed,
    onToggle,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    draggingId,
    dragOverId,
    order,
    className = "",
    bodyClassName = "card-body",
    footer,
    children,
}) => {
    const isDragging = draggingId === sectionId
    const isDragOver = dragOverId === sectionId && !isDragging

    return (
        <div
            className={`card${isDragging ? " dragging" : ""}${isDragOver ? " drag-over" : ""} ${className}`}
            data-section-id={sectionId}
            style={order !== undefined ? { order } : undefined}
            onDragOver={onDragOver ? (e) => { e.preventDefault(); onDragOver(sectionId, e) } : undefined}
            onDrop={onDrop ? (e) => { e.preventDefault(); onDrop(sectionId) } : undefined}
        >
            <div
                className="card-hdr collapsible"
                onClick={onToggle}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle() } }}
                aria-expanded={!collapsed}
            >
                <div style={{ display: "flex", alignItems: "center", minWidth: 0, flex: 1 }}>
                    {onDragStart && (
                        <span
                            className="drag-dot"
                            draggable
                            onDragStart={(e) => {
                                e.stopPropagation()
                                e.dataTransfer.effectAllowed = "move"
                                // Required by Firefox to start a drag.
                                try { e.dataTransfer.setData("text/plain", sectionId) } catch { /* ignore */ }
                                onDragStart(sectionId)
                            }}
                            onDragEnd={(e) => {
                                e.stopPropagation()
                                // Cleans up dragging/drag-over state when the
                                // user drops outside any card target.
                                onDragEnd?.()
                            }}
                            onClick={(e) => e.stopPropagation()}
                            title="Drag to reorder"
                            aria-label="Drag to reorder"
                        >
                            ⋮⋮
                        </span>
                    )}
                    <span className={`chev ${collapsed ? "" : "open"}`} aria-hidden="true">▶</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        {title}
                    </span>
                </div>
                {subText && <span className="cs">{subText}</span>}
            </div>
            {!collapsed && (
                <>
                    <div className={bodyClassName}>{children}</div>
                    {footer}
                </>
            )}
        </div>
    )
}

/**
 * Jira-style pill picker for Item Groups.
 * - Shows selected groups as inline pills.
 * - Typing filters a menu anchored to the cursor.
 * - Unknown queries can be added as a new group ("Create ...").
 */
interface GroupPillPickerProps {
    options: { value: string; label: string }[]
    selectedIds: string[]
    onChange: (ids: string[]) => void
    onCreate?: (name: string) => Promise<string | null> | string | null
    disabled?: boolean
    placeholder?: string
}

const GroupPillPicker: React.FC<GroupPillPickerProps> = ({
    options,
    selectedIds,
    onChange,
    onCreate,
    disabled,
    placeholder = "Type to find or create a group…",
}) => {
    const [query, setQuery] = useState("")
    const [open, setOpen] = useState(false)
    const wrapRef = useRef<HTMLDivElement | null>(null)
    const inputRef = useRef<HTMLInputElement | null>(null)

    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", onDocClick)
        return () => document.removeEventListener("mousedown", onDocClick)
    }, [])

    const selectedOptions = selectedIds
        .filter(Boolean)
        .map((id) => options.find((o) => o.value === id))
        .filter(Boolean) as { value: string; label: string }[]

    const q = query.trim().toLowerCase()
    const filtered = options.filter(
        (o) => !selectedIds.includes(o.value) && (!q || o.label.toLowerCase().includes(q)),
    )
    const canCreate =
        !!onCreate &&
        !!q &&
        !options.some((o) => o.label.toLowerCase() === q) &&
        !selectedOptions.some((o) => o.label.toLowerCase() === q)

    const addId = (id: string) => {
        if (!selectedIds.includes(id)) onChange([...selectedIds, id])
        setQuery("")
        setOpen(true)
        inputRef.current?.focus()
    }

    const removeId = (id: string) => onChange(selectedIds.filter((x) => x !== id))

    const handleCreate = async () => {
        if (!onCreate) return
        const result = await onCreate(query.trim())
        if (result) addId(result)
    }

    return (
        <div className="grp-field" ref={wrapRef} onClick={() => !disabled && inputRef.current?.focus()}>
            {selectedOptions.map((o) => (
                <span key={o.value} className="grp-pill">
                    {o.label}
                    {!disabled && (
                        <span
                            className="rm"
                            onClick={(e) => { e.stopPropagation(); removeId(o.value) }}
                            aria-label={`Remove ${o.label}`}
                        >
                            ×
                        </span>
                    )}
                </span>
            ))}
            <input
                ref={inputRef}
                className="grp-input"
                disabled={disabled}
                value={query}
                placeholder={selectedOptions.length ? "" : placeholder}
                onFocus={() => setOpen(true)}
                onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault()
                        if (filtered[0]) addId(filtered[0].value)
                        else if (canCreate) handleCreate()
                    } else if (e.key === "Backspace" && !query && selectedOptions.length) {
                        removeId(selectedOptions[selectedOptions.length - 1].value)
                    }
                }}
            />
            {open && !disabled && (filtered.length > 0 || canCreate) && (
                <div className="grp-menu">
                    {filtered.slice(0, 8).map((o) => (
                        <div
                            key={o.value}
                            className="grp-item"
                            onClick={(e) => { e.stopPropagation(); addId(o.value) }}
                        >
                            <span>{o.label}</span>
                        </div>
                    ))}
                    {canCreate && (
                        <div
                            className="grp-item new"
                            onClick={(e) => { e.stopPropagation(); handleCreate() }}
                        >
                            <span>+ Create "{query.trim()}"</span>
                            <span className="badge">NEW</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

/** Barcode / code-row input with a Generate-code button on the right. */
const CodeRow: React.FC<{
    label: string
    value: string
    onChange: (v: string) => void
    onBlur?: (v: string) => void
    onGenerate?: () => void | Promise<unknown>
    generateTitle?: string
    placeholder?: string
    disabled?: boolean
    inputId?: string
    required?: boolean
    hasError?: boolean
}> = ({ label, value, onChange, onBlur, onGenerate, generateTitle, placeholder = "--", disabled, inputId, required = false, hasError = false }) => {
    const [isGenerating, setIsGenerating] = React.useState(false)
    const handleGenerateClick = async () => {
        if (!onGenerate || isGenerating) return
        try {
            setIsGenerating(true)
            await onGenerate()
        } finally {
            setIsGenerating(false)
        }
    }
    return (
        <div className={`fg code-row ${hasError ? "field-invalid-group" : ""}`}>
            <label>
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="code-row-wrap">
                <Input
                    id={inputId}
                    type="text"
                    value={value}
                    // Block "." in code fields (UPC, Case, Pkg, Model, Style).
                    // Decimal points are nonsensical for these — UPCs are integer
                    // digit strings; model/style numbers can have letters and
                    // dashes but never decimals. We strip dots both on keystroke
                    // (preventDefault for instant feedback) and on the value
                    // itself (covers paste, IME, programmatic input).
                    onKeyDown={(e) => {
                        if (e.key === ".") e.preventDefault()
                    }}
                    onChange={(e) => onChange(e.target.value.replace(/\./g, ""))}
                    onBlur={onBlur ? (e) => onBlur(e.target.value.replace(/\./g, "")) : undefined}
                    className={`inp w-full ${hasError ? "field-invalid-input" : ""}`}
                    placeholder={placeholder}
                    disabled={disabled || isGenerating}
                    error={hasError}
                />
                {onGenerate && !disabled && (
                    <button
                        type="button"
                        className="code-gen-btn"
                        onClick={handleGenerateClick}
                        disabled={isGenerating}
                        title={isGenerating ? "Generating..." : (generateTitle || "Generate")}
                        aria-label={isGenerating ? "Generating" : (generateTitle || "Generate")}
                        aria-busy={isGenerating}
                    >
                        {isGenerating ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
                                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="42 18" opacity="0.85"/>
                            </svg>
                        ) : (
                            /* Barcode-style generate icon (matches v8.5 mockup) */
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <path d="M4 5v14M7 5v14M10 5v14M13 5v14M17 5v14M20 5v14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                            </svg>
                        )}
                    </button>
                )}
            </div>
        </div>
    )
}

const FormRow: React.FC<{
    label: string
    children: React.ReactNode
    labelClassName?: string
    inline?: boolean
    /**
     * Optional symbol rendered inside the input on the LEFT side
     * (e.g. `$`). Uses the existing `.px[data-p="…"]` CSS hook from
     * item_detail_v6.css so the styling matches all the other money fields
     * on the page. Pass for any field whose value is a currency amount.
     */
    prefix?: string
    /**
     * Optional symbol rendered inside the input on the RIGHT side
     * (e.g. `%`). Uses the existing `.sx[data-s="…"]` CSS hook. Pass for
     * percent / ratio fields.
     */
    suffix?: string
}> = ({ label, children, labelClassName = "", inline = false, prefix, suffix }) => {
    // Compose the affix wrapper around children. If both prefix and suffix
    // are passed we nest them: px wraps sx (the CSS uses absolute
    // positioning so nesting is safe). The vast majority of cases pass
    // only one.
    let wrapped: React.ReactNode = children
    if (suffix) {
        wrapped = <div className="sx" data-s={suffix}>{wrapped}</div>
    }
    if (prefix) {
        wrapped = <div className="px" data-p={prefix}>{wrapped}</div>
    }
    return (
        <div className={`${inline ? "flex items-center gap-2" : "space-y-1"}`}>
            <Label className={`text-xs text-gray-600 dark:text-gray-400 ${inline ? "whitespace-nowrap min-w-[80px]" : ""} ${labelClassName}`}>
                {label}
            </Label>
            <div className="flex-1">{wrapped}</div>
        </div>
    )
}

// Full-screen image viewer used by the item form's image tile. Closes on ESC or backdrop click.
const ImagePreviewLightbox: React.FC<{ src: string; onClose: () => void }> = ({ src, onClose }) => {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [onClose])
    return (
        <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onClose() }}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
                title="Close (Esc)"
                aria-label="Close preview"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18" />
                    <path d="M6 6l12 12" />
                </svg>
            </button>
            <img
                src={src}
                alt=""
                onClick={(e) => e.stopPropagation()}
                className="max-w-[95vw] max-h-[95vh] object-contain rounded shadow-2xl"
            />
        </div>
    )
}

// Shape of the per-tab snapshot we write to DashboardTabContext.getTabState.
// Restoring these on remount lets the form survive tab switches without
// re-fetching from the API or losing the user's in-progress edits.
interface ItemFormCachedState {
    formData: ItemFormData
    savedFormData: ItemFormData
    currentItemId: string | null
    originalBarcode: string
    originalModelNumber: string
    originalName: string
    originalUpcCodes: string[]
    hasFetched: boolean
}

const ItemFormPage: React.FC<ItemFormPageProps> = ({ id, isNew, copyData, _refreshKey, __tabId, itemListNavigation }) => {
    const { openTab, closeTab, activeTabId, updateTabProps, getTabState, setTabState } = useDashboardTabs()

    // Read any per-tab snapshot exactly once at first render. The snapshot is
    // populated by a useEffect below whenever the form state changes; on a
    // subsequent mount (after a tab-switch unmount), this initializer restores
    // formData/savedFormData/etc. so the user sees their edits with no fetch.
    // The variable is intentionally bound at the closure level so the useState
    // initializers below can read it without re-evaluating.
    const cachedTabState = __tabId ? getTabState<ItemFormCachedState>(__tabId) : undefined
    const { currentStore, stores, isLoadingStores, loadStores } = useStore()
    const { hasPermission, isSuperAdmin, isTenantAdmin, loading: permissionsLoading, loaded: permissionsLoaded } = usePermissions()
    // Tenant-wide StoreType drives several show/hide rules across this
    // form (mirrors the legacy FrmItems checks against
    // GlobalDataAccess.EncDateRow.StoreType). isFoodStore kept as an
    // alias so existing references keep working without churn.
    const { storeType: _storeType, isFood, isBooks, isApparel, hasLoaded: tenantSetupLoaded } = useStoreType()
    void _storeType
    const isFoodStore = isFood
    // Belt-and-braces fallback: if the new hook ever fails (e.g. tenant
    // setup endpoint is offline), keep the old heuristic path alive.
    const isFoodStoreLegacy = useIsFoodStore()
    void isFoodStoreLegacy

    const isEditMode = id && !isNew
    const [activeTab, setActiveTab] = useState<TabKey>("general")

    // Section layout: per-user, cross-device collapsed state + cross-column
    // drag-reorder. Outer array index = visual column (0, 1, 2 — left to right).
    const SECTION_COLUMNS = useMemo<string[][]>(
        () => [
            ["identity", "organization"],
            ["pricing", "specials"],
            ["vendor", "variants", "channels", "stats"],
        ],
        [],
    )
    const sectionLayout = useItemSectionLayout(SECTION_COLUMNS)
    const [draggingSection, setDraggingSection] = useState<string | null>(null)
    const [dragOverSection, setDragOverSection] = useState<string | null>(null)

    const handleSectionDragStart = useCallback((id: string) => {
        setDraggingSection(id)
    }, [])
    const handleSectionDragOver = useCallback((id: string, _e: React.DragEvent) => {
        setDragOverSection(id)
    }, [])
    const handleSectionDrop = useCallback((targetId: string) => {
        if (draggingSection && draggingSection !== targetId) {
            sectionLayout.reorderByDrag(draggingSection, targetId)
        }
        setDraggingSection(null)
        setDragOverSection(null)
    }, [draggingSection, sectionLayout])
    // Cleans up the visual dragging/drag-over state when the user releases
    // the drag outside any card (otherwise the source stays semi-transparent).
    const handleSectionDragEnd = useCallback(() => {
        setDraggingSection(null)
        setDragOverSection(null)
    }, [])

    // Per-store code-label overrides (fallback to defaults until store settings expose these).
    // Shape matches the old back-office label scheme so the UI reads familiar.
    // Books-store override: surface the Model field as ISBN. Mirrors the
    // legacy FrmItems "If StoreType = Books Then lblModel.Text = 'ISBN'"
    // swap. Falls back to the per-store override (if set) and finally the
    // generic default.
    const storeCodeLabels = useMemo(() => ({
        pkg: (currentStore as unknown as Record<string, string | undefined>)?.pkgCodeLabel || "Pkg Code",
        model:
            (currentStore as unknown as Record<string, string | undefined>)?.modelLabel
            || (isBooks ? "ISBN" : "Model Number"),
        style: (currentStore as unknown as Record<string, string | undefined>)?.styleLabel || "Style No",
    }), [currentStore, isBooks])

    // Sequential code generator backed by SP_GetNewNumber on the server.
    // Mirrors the legacy back-office AutoCreateUPC / AutoCreateModel loop in
    // FrmItemsNew.vb / FrmItems.vb: ask the SP for the next number, fall back to
    // the configured seed (10001 for UPC/Case/Pkg/Style, 1001 for Model), and
    // the server retries until the generated value is unique.
    const generateBarcode = useCallback(
        async (codeType: "upc" | "case" | "pkg" | "model" | "style"): Promise<string | null> => {
            try {
                const result = await itemService.generateCode(codeType, currentStore?.storeId)
                if (result.success && result.data) {
                    return result.data
                }
                console.error("Failed to generate code:", result.message)
                return null
            } catch (err) {
                console.error("Error generating code:", err)
                return null
            }
        },
        [currentStore?.storeId],
    )


    const [formData, setFormData] = useState<ItemFormData>(() => cachedTabState?.formData ?? initialFormData)
    const [invalidFieldIds, setInvalidFieldIds] = useState<Set<string>>(new Set())
    const [isLoading, setIsLoading] = useState(false)
    // Subtle in-flight flag for prev/next navigation — drives the pager
    // spinner without blanking the form behind a full-screen loader.
    const [isNavigatingItem, setIsNavigatingItem] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    // In-memory cache of item DTOs + image URLs, keyed by itemStoreID.
    // Lets prev/next render previously-viewed items instantly with no fetch.
    const itemCacheRef = useRef<Map<string, any>>(new Map())
    const imageCacheRef = useRef<Map<string, string | null>>(new Map())
    // True once we've populated the form at least once for this tab. Used
    // to suppress the full-page loader on subsequent loads (navigation).
    // Initialized from the cached snapshot so a remount after a tab switch
    // doesn't trigger a full-page loader if the data is already in hand.
    const hasLoadedOnceRef = useRef(cachedTabState?.hasFetched ?? false)
    // Tracks the previous id we loaded so we can distinguish a prev/next
    // navigation (silent, keep current item visible) from a fresh load.
    const prevLoadedIdRef = useRef<string | null>(null)

    // Collapsible sub-card inside the right column (Pricing section)
    const [isPricingSectionOpen, setIsPricingSectionOpen] = useState(true)
    const [isVendorCardOpen, setIsVendorCardOpen] = useState(true)
    const [isCustomFieldsOpen, setIsCustomFieldsOpen] = useState(false)
    const [isExtraFieldsOpen, setIsExtraFieldsOpen] = useState(false)
    const [barcodeError, setBarcodeError] = useState<string | null>(null)
    const [isCheckingBarcode, setIsCheckingBarcode] = useState(false)
    const [currentItemId, setCurrentItemId] = useState<string | null>(() => cachedTabState?.currentItemId ?? null) // Store itemId for barcode validation
    const [printLabelDialogOpen, setPrintLabelDialogOpen] = useState(false)
    const [originalBarcode, setOriginalBarcode] = useState<string>(() => cachedTabState?.originalBarcode ?? "") // Store original barcode to skip validation if unchanged
    const [originalModelNumber, setOriginalModelNumber] = useState<string>(() => cachedTabState?.originalModelNumber ?? "") // Store original model number to skip validation if unchanged
    const [originalName, setOriginalName] = useState<string>(() => cachedTabState?.originalName ?? "") // Store original name to skip validation if unchanged
    const [originalUpcCodes, setOriginalUpcCodes] = useState<string[]>(() => cachedTabState?.originalUpcCodes ?? []) // Store original alias barcodes to skip validation if unchanged

    // Unsaved changes tracking
    const [savedFormData, setSavedFormData] = useState<ItemFormData>(() => cachedTabState?.savedFormData ?? initialFormData)
    const isDirty = useMemo(() => JSON.stringify(formData) !== JSON.stringify(savedFormData), [formData, savedFormData])

    // Confirm dialog state
    const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
        isOpen: false,
        title: "",
        message: "",
        type: "confirm",
        buttons: [],
        onResult: () => { },
    })

    // Department raw data for defaults (isTaxable, isFoodStampable, isDiscount from department)
    const [departmentRawData, setDepartmentRawData] = useState<DepartmentLookupDto[]>([])

    // Permission-based field access (matching old VB.NET BO_Item* permissions)
    // These map to the new permission system keys
    const canChangePrice = isSuperAdmin || isTenantAdmin || hasPermission("inventory.item_list.edit") || hasPermission("ITEMS_LIST.ChangePrice") || hasPermission("BO_ItemChangePrice")
    const canChangeCost = isSuperAdmin || isTenantAdmin || hasPermission("inventory.item_list.edit") || hasPermission("ITEMS_LIST.ChangeCost") || hasPermission("BO_ItemChangeCost")
    const canChangeDepartment = isSuperAdmin || isTenantAdmin || hasPermission("inventory.item_list.edit") || hasPermission("ITEMS_LIST.ChangeDepartment") || hasPermission("BO_ItemChangeDep")
    const canChangeGroup = isSuperAdmin || isTenantAdmin || hasPermission("inventory.item_list.edit") || hasPermission("ITEMS_LIST.ChangeGroup") || hasPermission("BO_ItemChangeGroup")
    const canAssignSpecialPrice = isSuperAdmin || isTenantAdmin || hasPermission("inventory.item_list.edit") || hasPermission("ITEMS_LIST.AssignSpecialPrice") || hasPermission("BO_ItemAssSpecialPrice")
    const canShowCost = isSuperAdmin || isTenantAdmin || hasPermission("inventory.item_list.view") || hasPermission("ITEMS_LIST.ShowCost") || hasPermission("BO_ItemShowCost")
    const canEdit = isSuperAdmin || isTenantAdmin || hasPermission("inventory.item_list.edit") || hasPermission("ITEMS_LIST.Edit") || hasPermission("BO_ItemsEdit")
    const canAdd = isSuperAdmin || isTenantAdmin || hasPermission("inventory.item_list.create") || hasPermission("ITEMS_LIST.Create") || hasPermission("BO_ItemsAdd")

    // Lookup data state
    const [itemTypeOptions, setItemTypeOptions] = useState<SelectOption[]>(DEFAULT_ITEM_TYPE_OPTIONS)
    const [departmentOptions, setDepartmentOptions] = useState<TreeSelectOption[]>([])
    const [isLoadingLookups, setIsLoadingLookups] = useState(false)

    // Items Lookup Values state (Manufacturer, Pattern, Custom Fields)
    const [manufacturerOptions, setManufacturerOptions] = useState<SelectOption[]>([])
    const [patternOptions, setPatternOptions] = useState<SelectOption[]>([])
    const [customFieldOptions, setCustomFieldOptions] = useState<{ [key: number]: SelectOption[] }>({
        1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [], 10: []
    })

    // Item Groups state (hierarchical tree structure like departments)
    const [itemGroupOptions, setItemGroupOptions] = useState<TreeSelectOption[]>([])

    // Extra Charge Items state (for Extra Charge 1, 2, 3 dropdowns)
    const [extraChargeOptions, setExtraChargeOptions] = useState<SelectOption[]>([])

    // Tax options state (for Tax dropdown next to Taxable checkbox)
    const [taxOptions, setTaxOptions] = useState<SelectOption[]>([])

    // App Button options state
    const [appButtonOptions, setAppButtonOptions] = useState<SelectOption[]>([])

    // Supplier options state (for Vendor tab supplier dropdown)
    const [supplierOptions, setSupplierOptions] = useState<SelectOption[]>([])

    // Snapshot of the GET response from edit-load. Used by buildPayload to round-trip
    // fields the form has no UI for (PriceA-D, CogsAccount, IncomeAccount, etc.) so they
    // don't get nulled on save and pollute the audit log.
    const loadedItemRef = useRef<any>(null)

    // Mix & Match options state
    const [mixAndMatchData, setMixAndMatchData] = useState<MixAndMatchLookupDto[]>([])
    const mixAndMatchDataRef = useRef<MixAndMatchLookupDto[]>([])
    const [mixAndMatchOptions, setMixAndMatchOptions] = useState<SelectOption[]>([])
    const [showMixMatchModal, setShowMixMatchModal] = useState(false)

    // Quick-Add modal states for Department, Brand, Group, Pattern
    const [showAddDepartmentModal, setShowAddDepartmentModal] = useState(false)
    const [departmentAddLevel, setDepartmentAddLevel] = useState<DepartmentAddLevel>("root")
    const [isSavingDepartment, setIsSavingDepartment] = useState(false)
    const [deptModalData, setDeptModalData] = useState({
        name: "",
        description: "",
        departmentNo: "",
        parentDepartmentID: "",
        defaultMarkup: "",
        roundUp: "0",
        roundValue: "",
        isDefaultTaxInclude: true,
        defaultTaxNo: "",
        isDefaultFoodStampable: true,
        isDefaultDiscountable: true,
    })

    const [showAddBrandModal, setShowAddBrandModal] = useState(false)
    const [addBrandName, setAddBrandName] = useState("")
    const [isSavingBrand, setIsSavingBrand] = useState(false)

    const [showAddPatternModal, setShowAddPatternModal] = useState(false)
    const [addPatternName, setAddPatternName] = useState("")
    const [isSavingPattern, setIsSavingPattern] = useState(false)

    const [showAddGroupModal, setShowAddGroupModal] = useState(false)
    const [addGroupName, setAddGroupName] = useState("")
    const [addGroupParent, setAddGroupParent] = useState("")
    const [isSavingGroup, setIsSavingGroup] = useState(false)

    // No sale type cache needed — each sale type has its own independent fields

    // #66: Model Number inline validation
    const [modelNumberError, setModelNumberError] = useState<string | null>(null)
    const [isCheckingModelNumber, setIsCheckingModelNumber] = useState(false)

    // #67: Item Name duplicate inline validation
    const [nameWarning, setNameWarning] = useState<string | null>(null)
    const [isCheckingName, setIsCheckingName] = useState(false)

    // #68: Alias barcode validation
    const [aliasErrors, setAliasErrors] = useState<{ [index: number]: string | null }>({})

    // Pricing last modified info (read-only display)
    const [lastPriceChangeDate, setLastPriceChangeDate] = useState<string>("")
    const [lastModifiedByUser, setLastModifiedByUser] = useState<string>("")

    // Store options from global context - converted to SelectOption format
    const storeOptions: SelectOption[] = stores.map(store => ({
        value: store.storeId,
        label: store.storeName,
    }))

    // Force reload stores if not available
    useEffect(() => {
        if (stores.length === 0 && !isLoadingStores) {
            loadStores()
        }
    }, [stores.length, isLoadingStores, loadStores])

    // F-key tab navigation (F2=General, F3=Sales, F4=Specials, F5=Vendor, F6=Extra)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const fKeyMap: Record<string, TabKey> = {
                F2: "general",
                F3: "sales",
                F4: "specials",
                F5: "vendor",
                F6: "extra",
            }
            if (fKeyMap[e.key]) {
                e.preventDefault()
                setActiveTab(fKeyMap[e.key])
            }
        }
        document.addEventListener("keydown", handleKeyDown)
        return () => document.removeEventListener("keydown", handleKeyDown)
    }, [])

    // Name and Barcode autocomplete suggestions state
    const [showNameSuggestions, setShowNameSuggestions] = useState(false)
    const [showBarcodeSuggestions, setShowBarcodeSuggestions] = useState(false)
    const [nameSuggestions, setNameSuggestions] = useState<{ name: string; barcode: string }[]>([])
    const [barcodeSuggestions, setBarcodeSuggestions] = useState<{ name: string; barcode: string }[]>([])

    // Toast notification state
    const [toast, setToast] = useState<{
        show: boolean
        message: string
        type: "success" | "error" | "info"
        title: string
    }>({
        show: false,
        message: "",
        type: "success",
        title: "",
    })

    // Image upload state
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [isUploadingImage, setIsUploadingImage] = useState(false)
    const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
    const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
    const [imageLoadError, setImageLoadError] = useState(false)
    const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false)
    const fileInputRef = React.useRef<HTMLInputElement>(null)
    // Clear the broken-image flag whenever a new image source is set
    React.useEffect(() => {
        setImageLoadError(false)
    }, [imagePreview, uploadedImageUrl])

    // Toast notification function
    const showToast = (title: string, message: string, type: "success" | "error" | "info" = "success") => {
        setToast({ show: true, message, type, title })
        // Auto hide after 5 seconds
        setTimeout(() => {
            setToast({ show: false, message: "", type: "success", title: "" })
        }, 5000)
    }

    // Close toast manually
    const closeToast = () => {
        setToast({ show: false, message: "", type: "success", title: "" })
    }

    /** Gray read-only derived cost field (PC in Case mode, Case in Piece mode) until blur / Escape / mode change */
    const [derivedCostInlineWarn, setDerivedCostInlineWarn] = useState<"pc" | "case" | null>(null)

    const holdDerivedReadOnlyGray = useCallback((which: "pc" | "case") => {
        setDerivedCostInlineWarn(which)
    }, [])

    const clearDerivedReadOnlyGray = useCallback(() => {
        setDerivedCostInlineWarn(null)
    }, [])

    useEffect(() => {
        setDerivedCostInlineWarn(null)
    }, [formData.setPricesForCase])

    const handleDerivedReadOnlyKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>, opts: { readonly: boolean; disabled: boolean; which: "pc" | "case" }) => {
            if (!opts.readonly || opts.disabled) return
            if (e.ctrlKey || e.metaKey || e.altKey) return
            const k = e.key
            if (k === "Escape") {
                clearDerivedReadOnlyGray()
                return
            }
            if (k === "Tab" || k === "Enter") return
            if (k === "ArrowLeft" || k === "ArrowRight" || k === "Home" || k === "End") return
            if (k.length === 1 || k === "Backspace" || k === "Delete" || k === "ArrowUp" || k === "ArrowDown") {
                e.preventDefault()
                holdDerivedReadOnlyGray(opts.which)
            }
        },
        [holdDerivedReadOnlyGray, clearDerivedReadOnlyGray],
    )

    // Image upload handlers
    const handleImageClick = () => {
        fileInputRef.current?.click()
    }

    const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        if (!allowedTypes.includes(file.type)) {
            showToast('Invalid File', 'Please select a valid image file (JPEG, PNG, GIF, or WebP)', 'error')
            return
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showToast('File Too Large', 'Image size must be less than 5MB', 'error')
            return
        }

        // Store the file for upload after save
        setSelectedImageFile(file)

        // Show preview immediately
        const reader = new FileReader()
        reader.onloadend = () => {
            setImagePreview(reader.result as string)
        }
        reader.readAsDataURL(file)

        // Reset the input so the same file can be selected again
        event.target.value = ''
    }

    const handleRemoveImage = async () => {
        // If editing an item that already has an image persisted on the server, remove it there too.
        const hadServerImage = !!uploadedImageUrl && !selectedImageFile
        if (hadServerImage && isEditMode && currentItemId) {
            try {
                const result = await itemService.deleteImage(currentItemId, 1)
                if (!result.success) {
                    showToast('Delete Failed', result.message || 'Could not delete image from server.', 'error')
                    return
                }
            } catch (err) {
                console.error('Error deleting image:', err)
                showToast('Delete Failed', 'Could not delete image from server.', 'error')
                return
            }
        }
        setImagePreview(null)
        setUploadedImageUrl(null)
        setSelectedImageFile(null)
        setIsImagePreviewOpen(false)
        handleInputChange('imageData', null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    // Load lookup data on component mount
    useEffect(() => {
        loadLookupData()
    }, [])

    // When item was saved with a sub/sub-sub department ID in departmentID, split into three dropdowns
    useEffect(() => {
        if (departmentOptions.length === 0 || !formData.department) return
        const leafId =
            formData.subSubDepartment || formData.subDepartment || formData.department
        const h = resolveDepartmentHierarchy(leafId, departmentOptions)
        setFormData((prev) => {
            if (
                normDeptId(prev.department) === normDeptId(h.root) &&
                normDeptId(prev.subDepartment) === normDeptId(h.sub) &&
                normDeptId(prev.subSubDepartment) === normDeptId(h.subSub)
            ) {
                return prev
            }
            return {
                ...prev,
                department: h.root,
                subDepartment: h.sub,
                subSubDepartment: h.subSub,
            }
        })
    }, [departmentOptions, currentItemId])

    const departmentPathLabel = useMemo(() => {
        const parts: string[] = []
        const push = (id: string) => {
            const opt = departmentOptions.find((o) => normDeptId(o.value) === normDeptId(id))
            if (opt?.label) parts.push(opt.label)
        }
        if (formData.department) push(formData.department)
        if (formData.subDepartment) push(formData.subDepartment)
        if (formData.subSubDepartment) push(formData.subSubDepartment)
        return parts.join(" › ")
    }, [
        departmentOptions,
        formData.department,
        formData.subDepartment,
        formData.subSubDepartment,
    ])

    const selectedDepartmentLeafId = useMemo(
        () => getLeafDepartmentId(formData),
        [formData.department, formData.subDepartment, formData.subSubDepartment],
    )

    // Only top-level (main) departments for the Department dropdown. A department
    // is a root when it has no parent, or its parent isn't itself a known department
    // (orphaned parent → treat as root). Sub / sub-sub levels get their own cascading
    // dropdowns below, shown only when the chosen level actually has children.
    const rootDepartmentOptions = useMemo(
        () =>
            departmentOptions
                .filter((o) => {
                    const p = normDeptId(o.parentId)
                    return !p || !departmentOptions.some((d) => normDeptId(d.value) === p)
                })
                .map((o) => ({ value: o.value, label: o.label })),
        [departmentOptions],
    )

    // Set selected store from global context when it changes or when stores load
    useEffect(() => {
        // If we have a currentStore from context and no store is selected in form, use it
        if (currentStore && !formData.selectedStore) {
            setFormData(prev => {
                const next = { ...prev, selectedStore: currentStore.storeId }
                queueMicrotask(() => {
                    setSavedFormData(next)
                })
                return next
            })
        }
        // If no currentStore but we have stores available, select the first one
        else if (!currentStore && !formData.selectedStore && stores.length > 0) {
            setFormData(prev => {
                const next = { ...prev, selectedStore: stores[0].storeId }
                queueMicrotask(() => {
                    setSavedFormData(next)
                })
                return next
            })
        }
    }, [currentStore, stores, formData.selectedStore])

    // Load Extra Charge Items when store changes
    useEffect(() => {
        const loadExtraChargeItems = async () => {
            if (!currentStore?.storeId) {
                setExtraChargeOptions([])
                return
            }

            try {
                const extraChargeResponse = await lookupService.getExtraChargeItems(currentStore.storeId)
                if (extraChargeResponse.success && extraChargeResponse.data) {
                    const ecOptions: SelectOption[] = extraChargeResponse.data.map((item: ExtraChargeItemLookupDto) => ({
                        value: String(item.itemStoreID).toLowerCase(),
                        label: `${item.name} - $${item.price.toFixed(2)}`,
                    }))
                    setExtraChargeOptions(ecOptions)
                } else {
                    setExtraChargeOptions([])
                }
            } catch (e) {
                console.error("Error loading extra charge items:", e)
                setExtraChargeOptions([])
            }
        }

        loadExtraChargeItems()
    }, [currentStore])

    const loadLookupData = async () => {
        setIsLoadingLookups(true)
        try {
            // Load Item Types
            const itemTypesResponse = await lookupService.getItemTypes()
            if (itemTypesResponse.success && itemTypesResponse.data) {
                const options: SelectOption[] = itemTypesResponse.data.map((item: LookupDto) => ({
                    value: item.value.toString(),
                    label: item.label,
                }))
                setItemTypeOptions(options)
            }

            // Load Departments (hierarchical tree structure)
            const departmentsResponse = await lookupService.getDepartments()
            if (departmentsResponse.success && departmentsResponse.data) {
                // Store raw department data for auto-setting defaults on department change
                setDepartmentRawData(departmentsResponse.data)
                // Build tree-style options with parent-child relationships
                const deptOptions: TreeSelectOption[] = departmentsResponse.data.map((dept: DepartmentLookupDto) => ({
                    value: dept.departmentStoreID,
                    label: dept.name,
                    parentId: dept.parentDepartmentID,
                }))
                setDepartmentOptions(deptOptions)
            }

            // Load Item Groups (hierarchical tree structure like departments)
            const itemGroupsResponse = await lookupService.getItemGroups()
            if (itemGroupsResponse.success && itemGroupsResponse.data) {
                // Build tree-style options with parent-child relationships
                const groupOptions: TreeSelectOption[] = itemGroupsResponse.data.map((group: ItemGroupLookupDto) => ({
                    value: group.itemGroupID,
                    label: group.name,
                    parentId: group.parentID,
                }))
                setItemGroupOptions(groupOptions)
            }

            // Load Manufacturers from dedicated endpoint
            const manufacturersResponse = await lookupService.getManufacturers()
            if (manufacturersResponse.success && manufacturersResponse.data) {
                const mfgOptions: SelectOption[] = manufacturersResponse.data.map((mfg: ManufacturerLookupDto) => ({
                    value: mfg.manufacturerID,
                    label: mfg.manufacturerName,
                }))
                setManufacturerOptions(mfgOptions)
            }

            // Load Items Lookup Values (Pattern, Custom Fields) - Manufacturer now loaded separately
            const lookupValuesResponse = await lookupService.getItemsLookupValues()
            if (lookupValuesResponse.success && lookupValuesResponse.data) {
                // Group by valueType
                const patterns: SelectOption[] = []
                const customFields: { [key: number]: SelectOption[] } = {
                    1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [], 10: []
                }

                lookupValuesResponse.data.forEach((item: ItemsLookupValueDto) => {
                    const option: SelectOption = {
                        value: item.valueID,
                        label: item.valueName,
                    }

                    if (item.valueType === LOOKUP_VALUE_TYPES.PATTERN) {
                        patterns.push(option)
                    } else if (item.valueType >= 1 && item.valueType <= 10) {
                        customFields[item.valueType].push(option)
                    }
                })

                setPatternOptions(patterns)
                setCustomFieldOptions(customFields)
            }

            // Extra Charge Items will be loaded separately when store is selected

            // Load App Items for App Button dropdown
            const appItemsResponse = await lookupService.getAppItems()
            if (appItemsResponse.success && appItemsResponse.data) {
                const appOpts: SelectOption[] = appItemsResponse.data.map((item: AppItemLookupDto) => ({
                    value: item.id.toString(),
                    label: item.appName,
                }))
                setAppButtonOptions(appOpts)
            }

            // Load Tax options for Tax dropdown next to Taxable checkbox
            const taxResponse = await lookupService.getTaxes()
            if (taxResponse.success && taxResponse.data) {
                const taxOpts: SelectOption[] = taxResponse.data.map((tax: TaxLookupDto) => ({
                    value: tax.taxID,
                    label: tax.taxName,
                }))
                setTaxOptions(taxOpts)
            }

            // Load Supplier options for Vendor tab dropdown
            const suppliersResponse = await lookupService.getSuppliers()
            if (suppliersResponse.success && suppliersResponse.data) {
                const suppOpts: SelectOption[] = suppliersResponse.data.map((s: SupplierLookupDto) => ({
                    value: s.supplierID,
                    label: s.name,
                }))
                setSupplierOptions(suppOpts)
            }

            // Load Mix & Match options for Specials tab dropdown
            const mixMatchResponse = await lookupService.getMixAndMatches()
            if (mixMatchResponse.success && mixMatchResponse.data) {
                setMixAndMatchData(mixMatchResponse.data)
                mixAndMatchDataRef.current = mixMatchResponse.data
                const mmOpts: SelectOption[] = mixMatchResponse.data.map((mm: MixAndMatchLookupDto) => ({
                    value: mm.mixAndMatchID,
                    label: mm.name,
                }))
                setMixAndMatchOptions(mmOpts)
            }
        } catch (error) {
            console.error("Error loading lookup data:", error)
        } finally {
            setIsLoadingLookups(false)
        }
    }

    // Load item data if in edit mode
    // _refreshKey changes when the tab is re-opened, triggering a data reload
    useEffect(() => {
        if (isEditMode && id) {
            // Cache hit (remount after a tab switch): the form already has
            // the user's in-progress state plus the loaded baseline restored
            // from getTabState. Skip the API call and the state reset —
            // re-fetching would discard the user's edits and waste a request.
            // The hasLoadedOnceRef seed at the top of the component reflects
            // this: it's true when the cache restored on this mount.
            // _refreshKey changes still force a reload (intentional bust).
            if (cachedTabState && hasLoadedOnceRef.current && _refreshKey === undefined) {
                prevLoadedIdRef.current = id
                return
            }
            // Prev/next navigation re-renders this component with a different
            // `id` while keeping the tab mounted. In that case keep the
            // current form visible (no blanking, no full-page loader) and
            // just swap fields in once the new item resolves.
            const isPrevNextNavigation =
                hasLoadedOnceRef.current &&
                prevLoadedIdRef.current !== null &&
                prevLoadedIdRef.current !== id
            if (isPrevNextNavigation) {
                // Only clear in-progress image-upload artefacts so they don't
                // bleed across records; everything else swaps atomically
                // when loadItemData completes.
                setImagePreview(null)
                setSelectedImageFile(null)
                setBarcodeError(null)
                loadItemData(id, { silent: true })
            } else {
                // Reset all item-specific state before loading to prevent stale data
                setFormData(initialFormData)
                setSavedFormData(initialFormData)
                setCurrentItemId(null)
                setOriginalBarcode("")
                setOriginalModelNumber("")
                setOriginalName("")
                setOriginalUpcCodes([])
                setBarcodeError(null)
                setImagePreview(null)
                setUploadedImageUrl(null)
                setSelectedImageFile(null)
                setActiveTab("general")
                loadedItemRef.current = null
                loadItemData(id)
            }
        } else if (isNew) {
            loadedItemRef.current = null
            // New items have no API fetch, so flip the "loaded once" flag here
            // so the per-tab cache-write effect (which gates on this ref) can
            // begin capturing snapshots of the user's edits.
            hasLoadedOnceRef.current = true
        }
    }, [isEditMode, id, isNew, _refreshKey])

    // Fallback: populate Mix & Match fields if ref was empty during loadItemData (lookups loaded after item)
    useEffect(() => {
        if (formData.mixMatchSelection && mixAndMatchData.length > 0 && formData.mixMatchQty === 0 && formData.mixMatchAmount === 0) {
            const selId = formData.mixMatchSelection.toLowerCase()
            const selected = mixAndMatchData.find(mm => mm.mixAndMatchID?.toLowerCase() === selId)
            if (selected && (selected.qty || selected.amount)) {
                setFormData(prev => {
                    const next = {
                        ...prev,
                        mixMatchQty: selected.qty || 0,
                        mixMatchAmount: selected.amount || 0,
                    }
                    queueMicrotask(() => {
                        setSavedFormData(next)
                    })
                    return next
                })
            }
        }
    }, [formData.mixMatchSelection, mixAndMatchData])

    // Pre-fill form with copy data when copying an item
    useEffect(() => {
        if (isNew && copyData) {
            const item = copyData
            // Do NOT set currentItemId - this is a new item
            setCurrentItemId(null)
            // New barcode, so no original to compare against
            setOriginalBarcode("")

            setFormData({
                ...initialFormData,
                // === General Tab ===
                name: item.name || "",
                upc: item.barcodeNumber || "",
                alternateCode: item.modalNumber || "",
                description: item.description || "",
                size: item.size || "",
                itemType: (item.itemType ?? 0).toString(),
                department: item.departmentID || "",
                location: item.binLocation || "",
                customerCode: item.customerCode || "",
                matrix1: item.styleNo || item.matrix1 || "",
                matrix2: item.customInteger1 != null ? item.customInteger1.toString() : (item.matrix2 || ""),
                caseCode: item.caseCode || "",
                upcType: item.barcodeType || "Standard",

                // === Sales Tab ===
                cost: coerceItemNumber(item.cost),
                price: coerceItemNumber(item.price),
                listPrice: coerceItemNumber(item.listPrice),
                caseQty: Math.trunc(coerceItemNumber(item.caseQty)),
                casePrice: coerceItemNumber(item.casePrice),
                setPricesForCase: item.priceByCase || false,
                lastCaseNetCostEnabled: item.costByCase || false,
                lastCaseNetCost: coerceItemNumber(item.cs_Cost ?? item.cS_Cost ?? item.Cs_Cost),
                taxable: item.isTaxable || false,
                discountable: item.isDiscount || false,
                foodStamp: item.isFoodStampable || false,
                wic: item.isWIC || false,
                markup: item.markup || 0,
                profitMargin: item.margin || 0,
                onHand: 0, // Reset inventory for copy
                onOrder: 0, // Reset for copy
                onTransferOrder: 0, // Reset for copy
                reorderPoint: item.reorderPoint || 0,
                restockLevel: item.restockLevel || 0,
                usuallyOrderedIn: item.prefOrderBy || "Cases",
                usuallySoldIn: item.prefSaleBy || "Cases",

                // === Specials Tab (copy basic data into standard fields as default) ===
                stdPrice: item.regSPPrice || 0,
                stdFromDate: item.sP_From ? new Date(item.sP_From).toISOString().split('T')[0] : initialFormData.stdFromDate,
                stdToDate: item.sP_To ? new Date(item.sP_To).toISOString().split('T')[0] : initialFormData.stdToDate,

                // === Vendor Tab ===
                vendorItemCode: item.itemSupplies?.[0]?.itemCode || item.supplier_Item_Code || "",
                averageDeliveryDelay: item.itemSupplies?.[0]?.averageDeliveryDelay?.toString() || "",

                // === Extra Tab ===
                extraInfo1: item.extraInfo || item.extName || "",
                extraInfo2: item.extraInfo2 || "",
                extraCharge1: item.extraCharge1 ? String(item.extraCharge1).toLowerCase() : "",
                extraCharge2: item.extraCharge2 ? String(item.extraCharge2).toLowerCase() : "",
                extraCharge3: item.extraCharge3 ? String(item.extraCharge3).toLowerCase() : "",
                sellOnWeb: item.sellOnWeb === true,
                webPrice: item.webPrice || 0,
                webCasePrice: item.webCasePrice || 0,
                upcCodes: item.itemAlias ? item.itemAlias.split(",").map((s: string) => s.trim()).filter((s: string) => s) : [],

                // === Custom Fields Tab ===
                customField1: item.customField1 || "",
                customField2: item.customField2 || "",
                customField3: item.customField3 || "",
                customField4: item.customField4 || "",
                customField5: item.customField5 || "",
                customField6: item.customField6 || "",
                customField7: item.customField7 || "",
                customField8: item.customField8 || "",
                customField9: item.customField9 || "",
                customField10: item.customField10 || "",
            })

            // Load the original item's image if it exists
            const originalItemId = item._originalItemId || item.itemID || item.itemId
            if (originalItemId) {
                itemService.getImageUrl(originalItemId, 1).then((imageResponse) => {
                    if (imageResponse.success && imageResponse.data?.imageUrl) {
                        setUploadedImageUrl(imageResponse.data.imageUrl)
                    }
                }).catch(() => {
                    // Image copy is not critical
                })
            }
        }
    }, [isNew, copyData])

    // Resolve custom field string names to GUIDs after lookup options load
    // The API returns custom field values as display names (e.g., "GGGGGG")
    // but the SearchableSelect needs GUID values that match the option's value property
    useEffect(() => {
        // Only run if we have custom field options loaded
        const hasOptions = Object.values(customFieldOptions).some(opts => opts.length > 0)
        if (!hasOptions) return

        const updates: Partial<ItemFormData> = {}
        let hasUpdates = false

        for (let i = 1; i <= 10; i++) {
            const fieldKey = `customField${i}` as keyof ItemFormData
            const currentValue = formData[fieldKey] as string
            if (!currentValue) continue

            const options = customFieldOptions[i] || []
            // Check if value already matches an option's value (it's already a GUID)
            const matchByValue = options.find(opt => opt.value === currentValue)
            if (matchByValue) continue

            // Value is a display name - find the matching option by label
            const matchByLabel = options.find(opt => opt.label === currentValue)
            if (matchByLabel) {
                (updates as any)[fieldKey] = matchByLabel.value
                hasUpdates = true
            }
        }

        if (hasUpdates) {
            setFormData(prev => {
                const next = { ...prev, ...updates }
                queueMicrotask(() => {
                    setSavedFormData(next)
                })
                return next
            })
        }
    }, [customFieldOptions, formData.customField1, formData.customField2, formData.customField3, formData.customField4, formData.customField5, formData.customField6, formData.customField7, formData.customField8, formData.customField9, formData.customField10])

    const loadItemData = async (id: string, options: { silent?: boolean } = {}) => {
        const { silent = false } = options
        // Cache hit → skip the fetch and the spinner entirely. Sequential
        // prev/next on already-viewed items renders with no indicator at all.
        const cachedItem = itemCacheRef.current.get(id)
        if (!cachedItem) {
            if (silent) setIsNavigatingItem(true)
            else setIsLoading(true)
        }
        try {
            const response = cachedItem
                ? { success: true, data: cachedItem } as { success: boolean; data: any; message?: string }
                : await itemService.getItem(id)
            if (response.success && response.data) {
                if (!cachedItem) itemCacheRef.current.set(id, response.data)
                // Map API response to form data
                const item = response.data
                // Snapshot for round-trip preservation of unmanaged fields.
                loadedItemRef.current = item

                // DEBUG: Log critical fields to verify API response field names
                console.log("[ItemFormPage] API item fields:", {
                    pkgQty: item.pkgQty, saleType: item.saleType,
                    future_SP_Price: item.future_SP_Price, future_SP_From: item.future_SP_From,
                    regSPPrice: item.regSPPrice, cs_Cost: item.cs_Cost,
                    caseQty: item.caseQty, cost: item.cost, priceByCase: item.priceByCase,
                    pkgPrice: item.pkgPrice, regPkgPrice: item.regPkgPrice,
                    pkg_Price_Margin: item.pkg_Price_Margin, pkg_Price_Markup: item.pkg_Price_Markup,
                    salePrice: item.salePrice
                })

                // Store itemId and original barcode for validation purposes
                const itemId = item.itemId || item.itemID || item.itemNo || null
                setCurrentItemId(itemId)
                setOriginalBarcode(item.barcodeNumber || "")
                setOriginalModelNumber(item.modalNumber || "")
                setOriginalName(item.name || "")
                // Store original alias barcodes (so we skip validation for existing ones)
                setOriginalUpcCodes(item.itemAlias ? item.itemAlias.split(",").map((s: string) => s.trim()).filter((s: string) => s) : [])

                // Helper to parse SP_Price which may be string or number
                const parseSPPrice = (val: any): number => {
                    if (val === null || val === undefined) return 0
                    if (typeof val === "number") return val
                    return parseFloat(String(val).replace("$", "").replace(",", "")) || 0
                }

                // Reverse map sale type from number to string
                const saleTypeReverseMap: Record<number, string> = {
                    0: "noSale",
                    1: "standard",
                    2: "breakDown",
                    3: "mixMatch",
                    4: "combined",
                }

                const mappedLoaded: ItemFormData = {
                    ...initialFormData,
                    // === General Tab ===
                    name: item.name || "",
                    upc: item.barcodeNumber || "",
                    alternateCode: item.modalNumber || "",
                    description: item.description || "",
                    size: item.size || "",
                    itemType: (item.itemType ?? 0).toString(),
                    department: item.departmentID || "",
                    units: item.units != null ? item.units.toString() : "",
                    measure: item.meaasure != null ? item.meaasure.toString() : "",
                    location: item.binLocation || "",
                    upcType: item.barcodeType || "Standard",
                    caseCode: item.caseCode || "",
                    manufacturer: item.manufacturerID || "",
                    partNo: item.manufacturerPartNo || "",
                    pattern: item.patternId || "",

                    // === Sales Tab ===
                    cost: coerceItemNumber(item.cost),
                    price: coerceItemNumber(item.price),
                    listPrice: coerceItemNumber(item.listPrice),
                    markdownPrice: coerceItemNumber(item.markdown),
                    caseQty: Math.trunc(coerceItemNumber(item.caseQty)),
                    casePrice: coerceItemNumber(item.casePrice),
                    setPricesForCase: item.priceByCase || false,
                    lastCaseNetCostEnabled: item.costByCase || false,
                    lastCaseNetCost: coerceItemNumber(item.cs_Cost ?? item.cS_Cost ?? item.Cs_Cost),
                    taxable: item.isTaxable || false,
                    taxableRate: item.taxID || "",
                    discountable: item.isDiscount || false,
                    foodStamp: item.isFoodStampable || false,
                    wic: item.isWIC || false,
                    tare: item.tare != null ? item.tare.toString() : "",
                    markup: item.markup || 0,
                    profitMargin: item.margin || 0,
                    // Compute case-level margins from loaded data
                    caseProfitMargin: (() => {
                        const cp = item.casePrice || 0
                        const cc = item.cs_Cost || item.cS_Cost || item.Cs_Cost || 0
                        return cp > 0 && cc > 0 ? parseFloat(((cp - cc) * 100 / cp).toFixed(2)) : 0
                    })(),
                    caseMarkup: (() => {
                        const cp = item.casePrice || 0
                        const cq = item.caseQty || 0
                        const pc = item.cost || 0
                        if (cp > 0 && cq > 0 && pc > 0) {
                            const pppc = cp / cq
                            return parseFloat(((pppc - pc) * 100 / pc).toFixed(2))
                        }
                        return 0
                    })(),
                    onHand: item.onHand || 0,
                    onOrder: item.onOrder || 0,
                    onTransferOrder: item.onTransferOrder || 0,
                    reorderPoint: item.reorderPoint || 0,
                    restockLevel: item.restockLevel || 0,
                    averageCost: item.avgCost || item.aVGCost || item.AVGCost || 0,
                    usuallyOrderedIn: item.prefOrderBy || "Cases",
                    usuallySoldIn: item.prefSaleBy || "Cases",
                    // MTD / PTD / YTD stats
                    mtdQty: item.mtD_Pc_Qty != null ? item.mtD_Pc_Qty.toString() : "",
                    mtdAmount: item.mtd || 0,
                    ptdQty: item.ptD_Pc_Qty != null ? item.ptD_Pc_Qty.toString() : "",
                    ptdAmount: item.ptd || 0,
                    ytdQty: item.ytD_Pc_Qty != null ? item.ytD_Pc_Qty.toString() : "",
                    ytdAmount: item.ytd || 0,

                    // === Specials Tab ===
                    saleType: saleTypeReverseMap[item.saleType ?? 0] || "noSale",
                    specialsCost: (() => {
                        const caseCost = item.cs_Cost || item.cS_Cost || item.Cs_Cost || 0
                        const caseQtyVal = item.caseQty || 1
                        const pieceCost = (caseCost > 0 && caseQtyVal > 0) ? parseFloat((caseCost / caseQtyVal).toFixed(2)) : (item.cost || 0)
                        return `$${caseCost.toFixed(2)} / $${pieceCost.toFixed(2)}`
                    })(),
                    regularPrice: item.price || 0,

                    // All sale types populated from shared backend fields (matches VB.NET behavior)
                    ...(() => {
                        const caseCost = item.cs_Cost || item.cS_Cost || item.Cs_Cost || 0
                        const caseQtyVal = item.caseQty || 1
                        const pieceCost = (caseCost > 0 && caseQtyVal > 0) ? parseFloat((caseCost / caseQtyVal).toFixed(2)) : (item.cost || 0)
                        const fromDate = (item.sP_From || item.sp_From || item.SP_From) ? new Date(item.sP_From || item.sp_From || item.SP_From).toISOString().split("T")[0] : ""
                        const toDate = (item.sP_To || item.sp_To || item.SP_To) ? new Date(item.sP_To || item.sp_To || item.SP_To).toISOString().split("T")[0] : ""
                        const saleTypeStr = saleTypeReverseMap[item.saleType ?? 0] || "noSale"

                        // === Standard: backend SalePrice ===
                        const stdSalePrice = item.salePrice || 0
                        const stdResult: Partial<ItemFormData> = {
                            stdPrice: stdSalePrice,
                            stdMargin: stdSalePrice > 0 ? parseFloat(((stdSalePrice - pieceCost) * 100 / stdSalePrice).toFixed(2)) : 0,
                            stdMarkup: (stdSalePrice > 0 && pieceCost > 0) ? parseFloat(((stdSalePrice - pieceCost) * 100 / pieceCost).toFixed(2)) : 0,
                            stdMinTotal: item.minForSale || 0,
                            stdMaxQty: item.saleMax || 0,
                            stdMinQty: item.saleMin || 0,
                            stdAssignDate: item.assignDate || false,
                            stdFromDate: fromDate || initialFormData.stdFromDate,
                            stdToDate: toDate || initialFormData.stdToDate,
                            // memberOnly only applies when saleType is standard (specialBuy=1 means member-only)
                            stdMemberOnly: saleTypeStr === "standard" && item.specialBuy === 1,
                        }

                        // === Break Down: backend SpecialPrice (total), SpecialBuy (item count) ===
                        const bdTotalPrice = item.specialPrice || 0
                        const bdItemCnt = item.specialBuy || 0
                        const bdPricePerPiece = (bdItemCnt > 0 && bdTotalPrice > 0) ? bdTotalPrice / bdItemCnt : 0
                        const bdResult: Partial<ItemFormData> = {
                            bdItemCount: bdItemCnt,
                            bdPrice: bdTotalPrice,
                            bdMargin: bdPricePerPiece > 0 ? parseFloat(((bdPricePerPiece - pieceCost) * 100 / bdPricePerPiece).toFixed(2)) : 0,
                            bdMarkup: (bdPricePerPiece > 0 && pieceCost > 0) ? parseFloat(((bdPricePerPiece - pieceCost) * 100 / pieceCost).toFixed(2)) : 0,
                            bdMinTotal: item.minForSale || 0,
                            bdMaxQty: item.saleMax || 0,
                            bdAssignDate: item.assignDate || false,
                            bdFromDate: fromDate || initialFormData.bdFromDate,
                            bdToDate: toDate || initialFormData.bdToDate,
                        }

                        // === Mix & Match ===
                        const mmConfig = (() => {
                            if (!item.mixAndMatchID) return null
                            const mmId = item.mixAndMatchID.toLowerCase()
                            return mixAndMatchDataRef.current.find(mm => mm.mixAndMatchID?.toLowerCase() === mmId) || null
                        })()
                        const mmResult: Partial<ItemFormData> = {
                            mixMatchSelection: item.mixAndMatchID || "",
                            mixMatchQty: mmConfig?.qty || 0,
                            mixMatchAmount: mmConfig?.amount || 0,
                            mmMinTotal: item.minForSale || 0,
                            mmAssignDate: item.assignDate || false,
                            mmFromDate: fromDate || initialFormData.mmFromDate,
                            mmToDate: toDate || initialFormData.mmToDate,
                        }

                        // === Combined: Sale Price row = salePrice, Pkg row = specialBuy (qty) / specialPrice (amount) ===
                        // VB.NET "Pkg Price" label = quantity, "For" label = total amount
                        const cmbSaleP = item.salePrice || 0
                        // For Pkg row: use pkgQty/pkgPrice if available (true combined item), else fall back to specialBuy/specialPrice
                        const cmbPkgQty = item.pkgQty || item.specialBuy || 0
                        const cmbPkgAmount = item.pkgPrice || item.specialPrice || 0
                        const cmbPkgPricePerUnit = (cmbPkgQty > 0 && cmbPkgAmount > 0) ? cmbPkgAmount / cmbPkgQty : 0
                        const cmbResult: Partial<ItemFormData> = {
                            cmbSalePrice: cmbSaleP,
                            cmbSaleMargin: cmbSaleP > 0 ? parseFloat(((cmbSaleP - pieceCost) * 100 / cmbSaleP).toFixed(2)) : 0,
                            cmbSaleMarkup: (cmbSaleP > 0 && pieceCost > 0) ? parseFloat(((cmbSaleP - pieceCost) * 100 / pieceCost).toFixed(2)) : 0,
                            cmbPkgPrice: cmbPkgQty,  // "Pkg Price" field = quantity
                            cmbPkgFor: cmbPkgAmount > 0 ? cmbPkgAmount.toString() : "",  // "For" field = total amount
                            cmbPkgMargin: cmbPkgPricePerUnit > 0 ? parseFloat(((cmbPkgPricePerUnit - pieceCost) * 100 / cmbPkgPricePerUnit).toFixed(2)) : 0,
                            cmbPkgMarkup: (cmbPkgPricePerUnit > 0 && pieceCost > 0) ? parseFloat(((cmbPkgPricePerUnit - pieceCost) * 100 / pieceCost).toFixed(2)) : 0,
                            cmbMinTotal: item.minForSale || 0,
                            cmbMaxQty: item.saleMax || 0,
                            cmbAssignDate: item.assignDate || false,
                            cmbFromDate: fromDate || initialFormData.cmbFromDate,
                            cmbToDate: toDate || initialFormData.cmbToDate,
                        }

                        return { ...stdResult, ...bdResult, ...mmResult, ...cmbResult }
                    })(),
                    // Future Pricing - from view (Future_SP_Price) or ItemStore (NewPrice/NewPriceDate)
                    // View field: Future_SP_Price → JSON future_SP_Price (string)
                    // The backend also populates from ItemStore.NewPrice if view didn't have it
                    newPrice: parseSPPrice(item.future_SP_Price || item.futureSPPrice || item.Future_SP_Price),
                    dateEffective: (() => {
                        const dateVal = item.future_SP_From || item.futureSPFrom || item.Future_SP_From
                        if (!dateVal) return ""
                        try {
                            return new Date(dateVal).toISOString().split("T")[0]
                        } catch {
                            return ""
                        }
                    })(),

                    // === Vendor Tab ===
                    vendorItemCode: item.itemSupplies?.[0]?.itemCode || item.supplier_Item_Code || item.Supplier_Item_Code || "",
                    averageDeliveryDelay: item.itemSupplies?.[0]?.averageDeliveryDelay?.toString() || "",

                    // === Vendor Tab - Load vendors from API response ===
                    vendors: item.itemSupplies?.map((v: any) => ({
                        id: v.supplierNo,
                        mainSupplier: v.isMainSupplier,
                        grossCost: v.grossCost || 0,
                        caseQty: v.qtyPerCase || 0,
                        pcCost: v.totalCost || 0,
                        name: v.supplierName || "",
                    })) || [],

                    // === Groups - Load group assignments from API response ===
                    groups: item.itemToGroups?.map((g: any) => g.itemGroupID) || [],

                    // === Extra Tab ===
                    extraInfo1: item.extraInfo || item.extName || "",
                    extraInfo2: item.extraInfo2 || "",
                    extraCharge1: item.extraCharge1 ? String(item.extraCharge1).toLowerCase() : "",
                    extraCharge2: item.extraCharge2 ? String(item.extraCharge2).toLowerCase() : "",
                    extraCharge3: item.extraCharge3 ? String(item.extraCharge3).toLowerCase() : "",
                    customerCode: item.customerCode || "",
                    matrix1: item.styleNo || "",
                    matrix2: item.customInteger1 != null ? item.customInteger1.toString() : "",
                    sellOnWeb: item.sellOnWeb === true,
                    webPrice: item.webPrice || 0,
                    webCasePrice: item.webCasePrice || 0,
                    upcCodes: item.itemAlias ? item.itemAlias.split(",").map((s: string) => s.trim()).filter((s: string) => s) : [],

                    // === Extra Tab - App Button (decode bitmask to selected IDs) ===
                    appButton: (() => {
                        const bitmask = item.addToApp || item.AddToApp || 0
                        if (!bitmask) return []
                        const selected: string[] = []
                        for (let bit = 0; bit < 32; bit++) {
                            if ((bitmask & (1 << bit)) > 0) {
                                selected.push((bit + 1).toString())
                            }
                        }
                        return selected
                    })(),

                    // === Custom Fields Tab ===
                    customField1: item.customField1 || "",
                    customField2: item.customField2 || "",
                    customField3: item.customField3 || "",
                    customField4: item.customField4 || "",
                    customField5: item.customField5 || "",
                    customField6: item.customField6 || "",
                    customField7: item.customField7 || "",
                    customField8: item.customField8 || "",
                    customField9: item.customField9 || "",
                    customField10: item.customField10 || "",

                    // === Store ===
                    selectedStore: item.storeNo || "",
                    // Lock Markup toggle (not saved in DB, always starts off)
                    lockMarkup: false,
                    // Days for return
                    daysForReturn: item.daysForReturn || 0,
                }

                if (!mappedLoaded.selectedStore) {
                    if (currentStore?.storeId) {
                        mappedLoaded.selectedStore = currentStore.storeId
                    } else if (stores.length > 0) {
                        mappedLoaded.selectedStore = stores[0].storeId
                    }
                }
                setFormData(mappedLoaded)
                setSavedFormData(mappedLoaded)

                // Populate pricing "last modified" info
                if (item.lastPriceChange) {
                    try {
                        const d = new Date(item.lastPriceChange)
                        setLastPriceChangeDate(d.toLocaleString())
                    } catch { setLastPriceChangeDate("") }
                } else if (item.itemStoreDateModified) {
                    try {
                        const d = new Date(item.itemStoreDateModified)
                        setLastPriceChangeDate(d.toLocaleString())
                    } catch { setLastPriceChangeDate("") }
                }
                setLastModifiedByUser(item.lastModifiedByUser || "")

                // Load the item's image if it exists. Cache the URL so
                // revisiting via prev/next doesn't refetch.
                if (itemId) {
                    const cachedUrl = imageCacheRef.current.get(itemId)
                    if (cachedUrl !== undefined) {
                        setUploadedImageUrl(cachedUrl)
                    } else {
                        try {
                            const imageResponse = await itemService.getImageUrl(itemId, 1)
                            const url = imageResponse.success && imageResponse.data?.imageUrl
                                ? imageResponse.data.imageUrl
                                : null
                            imageCacheRef.current.set(itemId, url)
                            setUploadedImageUrl(url)
                        } catch (imageErr) {
                            console.error("Error loading item image:", imageErr)
                        }
                    }
                }
            } else {
                showToast("Load Failed", response.message || "Failed to load item", "error")
            }
        } catch (err) {
            showToast("Load Failed", "An error occurred while loading the item", "error")
            console.error("Error loading item:", err)
        } finally {
            if (!cachedItem) {
                if (silent) setIsNavigatingItem(false)
                else setIsLoading(false)
            }
            hasLoadedOnceRef.current = true
            prevLoadedIdRef.current = id
        }
    }

    // Check if barcode exists in database
    const checkBarcodeExists = useCallback(async (barcodeNumber: string) => {
        if (!barcodeNumber.trim()) {
            setBarcodeError(null)
            return
        }

        // In edit mode, skip validation if barcode hasn't changed (case-insensitive, trimmed)
        if (isEditMode && barcodeNumber.trim().toLowerCase() === originalBarcode.trim().toLowerCase()) {
            setBarcodeError(null)
            return
        }

        setIsCheckingBarcode(true)
        setBarcodeError(null)

        try {
            // In edit mode, always pass excludeItemId so the backend skips the current item
            const excludeItemId = isEditMode && currentItemId ? currentItemId : undefined
            const response = await itemService.barcodeExists(barcodeNumber.trim(), excludeItemId)

            if (response.success && response.data === true) {
                setBarcodeError(`Barcode '${barcodeNumber}' already exists in the system.`)
            } else {
                setBarcodeError(null)
            }
        } catch (err) {
            console.error("Error checking barcode:", err)
        } finally {
            setIsCheckingBarcode(false)
        }
    }, [isEditMode, currentItemId, originalBarcode])

    const handleInputChange = useCallback((field: keyof ItemFormData, value: any) => {
        let v = value
        const f = field as string
        if (
            f === "cost" ||
            f === "price" ||
            f === "newPrice" ||
            f === "listPrice" ||
            f === "lastCaseNetCost" ||
            f === "casePrice" ||
            f === "profitMargin" ||
            f === "markup" ||
            f === "caseProfitMargin" ||
            f === "caseMarkup" ||
            f === "markdownPrice" ||
            f === "regPkgPrice" ||
            f === "regPkgMargin"
        ) {
            v = coerceItemNumber(value)
        }
        if (f === "caseQty" || f === "regPkgQty") {
            v = Math.trunc(coerceItemNumber(value))
        }

        setFormData((prev) => ({ ...prev, [field]: v }))

        // Clear required/error highlight when user edits a field.
        const fieldIdMap: Partial<Record<keyof ItemFormData, string>> = {
            name: "field-item-name",
            upc: "field-upc",
            alternateCode: "field-model",
            department: "field-department",
        }
        const mappedFieldId = fieldIdMap[field]
        if (mappedFieldId) {
            setInvalidFieldIds((prev) => {
                if (!prev.has(mappedFieldId)) return prev
                const next = new Set(prev)
                next.delete(mappedFieldId)
                return next
            })
        }

        // Clear barcode error when user changes barcode
        if (field === "upc") setBarcodeError(null)
        // Clear model number error when user changes it
        if (field === "alternateCode") setModelNumberError(null)
    }, [])

    // #66: Check if model number (alternate code) already exists
    const checkModelNumberExists = useCallback(async (modalNumber: string) => {
        if (!modalNumber.trim()) {
            setModelNumberError(null)
            return
        }

        // In edit mode, skip if model number hasn't changed from the original
        if (isEditMode && modalNumber.trim().toLowerCase() === originalModelNumber.trim().toLowerCase()) {
            setModelNumberError(null)
            return
        }

        setIsCheckingModelNumber(true)
        setModelNumberError(null)
        try {
            const excludeItemId = isEditMode && currentItemId ? currentItemId : undefined
            const response = await itemService.modelNumberExists(modalNumber.trim(), excludeItemId)
            if (response.success && response.data === true) {
                setModelNumberError(`Model number '${modalNumber}' already exists.`)
            } else {
                setModelNumberError(null)
            }
        } catch (err) {
            console.error("Error checking model number:", err)
        } finally {
            setIsCheckingModelNumber(false)
        }
    }, [isEditMode, currentItemId, originalModelNumber])

    // #67: Check if item name already exists (warning, not blocking)
    const checkItemNameExists = useCallback(async (name: string) => {
        if (!name.trim() || name.length < 3) {
            setNameWarning(null)
            return
        }

        // In edit mode, skip if name hasn't changed from the original
        if (isEditMode && name.trim().toLowerCase() === originalName.trim().toLowerCase()) {
            setNameWarning(null)
            return
        }

        setIsCheckingName(true)
        setNameWarning(null)
        try {
            const excludeItemId = isEditMode && currentItemId ? currentItemId : undefined
            const response = await itemService.itemNameExists(name.trim(), excludeItemId)
            if (response.success && response.data === true) {
                setNameWarning(`An item with name '${name}' already exists.`)
            } else {
                setNameWarning(null)
            }
        } catch (err) {
            console.error("Error checking item name:", err)
        } finally {
            setIsCheckingName(false)
        }
    }, [isEditMode, currentItemId, originalName])

    // #68: Check if alias barcode already exists
    const checkAliasBarcodeExists = useCallback(async (barcodeNumber: string, index: number) => {
        if (!barcodeNumber.trim()) {
            setAliasErrors(prev => ({ ...prev, [index]: null }))
            return
        }

        // In edit mode, skip validation if this barcode was already an alias of this item (unchanged)
        if (isEditMode && originalUpcCodes.some(code => code.trim().toLowerCase() === barcodeNumber.trim().toLowerCase())) {
            setAliasErrors(prev => ({ ...prev, [index]: null }))
            return
        }

        // Also skip if this barcode matches the item's own main barcode (it's the same item)
        if (isEditMode && barcodeNumber.trim().toLowerCase() === originalBarcode.trim().toLowerCase()) {
            setAliasErrors(prev => ({ ...prev, [index]: null }))
            return
        }

        try {
            // Pass excludeItemId so backend can exclude the current item's own aliases
            const excludeItemId = isEditMode && currentItemId ? currentItemId : undefined
            const response = await itemService.aliasBarcodeExists(barcodeNumber.trim(), undefined, excludeItemId)
            if (response.success && response.data === true) {
                setAliasErrors(prev => ({ ...prev, [index]: `Barcode '${barcodeNumber}' already exists.` }))
            } else {
                setAliasErrors(prev => ({ ...prev, [index]: null }))
            }
        } catch (err) {
            console.error("Error checking alias barcode:", err)
        }
    }, [isEditMode, currentItemId, originalBarcode, originalUpcCodes])

    // ===== Pricing Calculation Helpers (matching old VB.NET FrmItems.vb) =====
    // Profit Margin % = (Price - Cost) * 100 / Price
    const calcMargin = (price: number, cost: number): number => {
        if (price === 0) return 0
        return parseFloat(((price - cost) * 100 / price).toFixed(2))
    }
    // Markup % = (Price - Cost) * 100 / Cost
    const calcMarkup = (price: number, cost: number): number => {
        if (cost === 0) return 0
        return parseFloat(((price - cost) * 100 / cost).toFixed(2))
    }
    // Price from Markup = Cost + (Cost * Markup / 100)
    const calcPriceFromMarkup = (cost: number, markup: number): number => {
        return parseFloat((cost + (cost * markup / 100)).toFixed(2))
    }
    // Price from Margin = Cost / (1 - Margin/100)
    const calcPriceFromMargin = (cost: number, margin: number): number => {
        if (margin >= 100) return 0
        return parseFloat((cost / (1 - margin / 100)).toFixed(2))
    }
    // Get the effective cost for pricing calculations (depends on PriceByCase and CostByCase)
    const getEffectiveCost = (data: ItemFormData): number => {
        if (data.setPricesForCase) {
            return data.lastCaseNetCost // Use case cost when pricing by case
        }
        // Always derive piece cost from case cost / case qty when available (matches VB.NET)
        if (data.lastCaseNetCost > 0 && data.caseQty > 0) {
            return parseFloat((data.lastCaseNetCost / data.caseQty).toFixed(2))
        }
        return data.cost
    }
    // Get piece cost for Specials tab calculations — VB.NET always uses piece cost
    // (never case cost) for specials margin/markup, regardless of PriceByCase flag
    const getSpecialsCost = (data: ItemFormData): number => {
        if (data.lastCaseNetCost > 0 && data.caseQty > 0) {
            return parseFloat((data.lastCaseNetCost / data.caseQty).toFixed(2))
        }
        return data.cost
    }
    // Case Profit Margin = (CasePrice - CaseCost) * 100 / CasePrice
    const calcCaseMargin = (casePrice: number, caseCost: number): number => {
        if (casePrice === 0 || caseCost === 0) return 0
        return parseFloat(((casePrice - caseCost) * 100 / casePrice).toFixed(2))
    }
    // Case Markup = (CasePrice/CaseQty - PieceCost) * 100 / PieceCost (per-piece basis)
    const calcCaseMarkup = (casePrice: number, caseQty: number, pieceCost: number): number => {
        if (pieceCost === 0 || caseQty === 0 || casePrice === 0) return 0
        const pricePerPiece = casePrice / caseQty
        return parseFloat(((pricePerPiece - pieceCost) * 100 / pieceCost).toFixed(2))
    }

    // Recalculate all margins and markups based on current form data
    const recalcAllMarginsAndMarkups = useCallback((data: ItemFormData): Partial<ItemFormData> => {
        const cost = getEffectiveCost(data)
        const updates: Partial<ItemFormData> = {}

        // Piece-level profit margin and markup
        updates.profitMargin = calcMargin(data.price, cost)
        updates.markup = calcMarkup(data.price, cost)

        // Case-level profit margin and markup
        updates.caseProfitMargin = calcCaseMargin(data.casePrice, data.lastCaseNetCost)
        updates.caseMarkup = calcCaseMarkup(data.casePrice, data.caseQty, data.cost)

        return updates
    }, [])

    // Convert form data to API DTO
    const mapFormDataToDto = (): CreateItemDto => {
        // Use the selected store from form data, or fallback to currentStore from context
        const storeNo = formData.selectedStore || currentStore?.storeId || ""

        // Map barcode type string to number
        const barcodeTypeMap: Record<string, number> = {
            "Standard": 0,
            "Random Weight": 1,
            "Coupon": 2,
        }

        // Map sale type string to number for API
        // Case Special piggy-backs on the Standard sale path (saleType=1) with setPricesForCase=true.
        const saleTypeMap: Record<string, number> = {
            "noSale": 0,
            "standard": 1,
            "breakDown": 2,
            "mixMatch": 3,
            "combined": 4,
            "caseSpecial": 1,
        }

        return {
            // Include itemId for edit mode to exclude from barcode uniqueness check
            itemId: isEditMode && currentItemId ? currentItemId : undefined,

            // ItemMain properties
            name: formData.name,
            barcodeNumber: formData.upc,
            modalNumber: formData.alternateCode || undefined,
            description: formData.description || undefined,
            caseCode: formData.caseCode || undefined,
            caseQty: formData.caseQty || undefined,
            cs_Cost: formData.lastCaseNetCost || undefined,
            barcodeType: barcodeTypeMap[formData.upcType] || 0,
            itemType: parseInt(formData.itemType) || 0,
            priceByCase: formData.setPricesForCase,
            costByCase: formData.lastCaseNetCostEnabled,
            size: formData.size || undefined,
            extraInfo: formData.extraInfo1?.trim() || null,
            extraInfo2: formData.extraInfo2?.trim() || null,
            customerCode: formData.customerCode || undefined,
            styleNo: formData.matrix1 || undefined,
            customInteger1: formData.matrix2 ? parseInt(formData.matrix2) || undefined : undefined,
            units: formData.units ? parseInt(formData.units) || undefined : undefined,
            measure: formData.measure ? parseInt(formData.measure) || undefined : undefined,
            manufacturerID: formData.manufacturer?.trim() || null,
            manufacturerPartNo: formData.partNo || undefined,
            // App Button - encode selected app IDs to bitmask
            addToApp: formData.appButton.length > 0
                ? formData.appButton.reduce((bitmask, appId) => {
                    const id = parseInt(appId)
                    if (id > 0) return bitmask | (1 << (id - 1))
                    return bitmask
                }, 0)
                : undefined,
            // Custom Fields - GUID lookups; null when not selected
            customField1: formData.customField1?.trim() || null,
            customField2: formData.customField2?.trim() || null,
            customField3: formData.customField3?.trim() || null,
            customField4: formData.customField4?.trim() || null,
            customField5: formData.customField5?.trim() || null,
            customField6: formData.customField6?.trim() || null,
            customField7: formData.customField7?.trim() || null,
            customField8: formData.customField8?.trim() || null,
            customField9: formData.customField9?.trim() || null,
            customField10: formData.customField10?.trim() || null,

            // ItemStore properties
            storeNo: storeNo,
            departmentID: getLeafDepartmentId(formData) || null,
            isDiscount: formData.discountable,
            isTaxable: formData.taxable,
            taxID: formData.taxableRate?.trim() || null,
            isFoodStampable: formData.foodStamp,
            isWIC: formData.wic,
            cost: formData.cost,
            listPrice: formData.listPrice,
            price: formData.price,
            // Round-trip fields the form has no UI for: send the snapshot value so the
            // backend save is a no-op for them and they don't pollute the audit log.
            priceA: loadedItemRef.current?.priceA ?? undefined,
            priceB: loadedItemRef.current?.priceB ?? undefined,
            priceC: loadedItemRef.current?.priceC ?? undefined,
            priceD: loadedItemRef.current?.priceD ?? undefined,
            cogsAccount: loadedItemRef.current?.cogsAccount ?? undefined,
            incomeAccount: loadedItemRef.current?.incomeAccount ?? undefined,
            specialBuyFromDate: loadedItemRef.current?.specialBuyFromDate ?? undefined,
            specialBuyToDate: loadedItemRef.current?.specialBuyToDate ?? undefined,
            commissionQty: loadedItemRef.current?.commissionQty ?? undefined,
            profitCalculation: loadedItemRef.current?.profitCalculation ?? 0,
            commissionType: loadedItemRef.current?.commissionType ?? 0,
            onHand: formData.onHand,
            onOrder: formData.onOrder,
            onTransferOrder: formData.onTransferOrder,
            reorderPoint: formData.reorderPoint,
            restockLevel: formData.restockLevel,
            binLocation: formData.location || undefined,
            casePrice: formData.casePrice || undefined,
            tare: formData.tare ? parseFloat(formData.tare) || undefined : undefined,
            // UOMType: Pieces=0, Dozens=1, Cases=2, Lb=3
            prefOrderBy: ({ "Pieces": 0, "Dozens": 1, "Cases": 2, "Lb": 3 } as Record<string, number>)[formData.usuallyOrderedIn] ?? 0,
            prefSaleBy: ({ "Pieces": 0, "Dozens": 1, "Cases": 2, "Lb": 3 } as Record<string, number>)[formData.usuallySoldIn] ?? 0,

            // Extra Charge fields - GUID lookups; null when not selected
            extraCharge1: formData.extraCharge1?.trim() || null,
            extraCharge2: formData.extraCharge2?.trim() || null,
            extraCharge3: formData.extraCharge3?.trim() || null,

            // Sale / Specials properties - read from active sale type's fields.
            // Send undefined (omitted from JSON) when the form has no sale type set,
            // so the backend's partial-update doesn't overwrite an existing DB value.
            saleType: formData.saleType ? saleTypeMap[formData.saleType] : undefined,
            salePrice: formData.saleType === "standard" ? (formData.stdPrice || undefined)
                : formData.saleType === "combined" ? (formData.cmbSalePrice || undefined)
                    : undefined,
            saleStartDate: formData.saleType === "standard" ? (formData.stdFromDate || undefined)
                : formData.saleType === "breakDown" ? (formData.bdFromDate || undefined)
                    : formData.saleType === "mixMatch" ? (formData.mmFromDate || undefined)
                        : formData.saleType === "combined" ? (formData.cmbFromDate || undefined)
                            : undefined,
            saleEndDate: formData.saleType === "standard" ? (formData.stdToDate || undefined)
                : formData.saleType === "breakDown" ? (formData.bdToDate || undefined)
                    : formData.saleType === "mixMatch" ? (formData.mmToDate || undefined)
                        : formData.saleType === "combined" ? (formData.cmbToDate || undefined)
                            : undefined,
            saleMin: formData.saleType === "standard" ? (formData.stdMinQty || undefined) : undefined,
            saleMax: formData.saleType === "standard" ? (formData.stdMaxQty || undefined)
                : formData.saleType === "breakDown" ? (formData.bdMaxQty || undefined)
                    : formData.saleType === "combined" ? (formData.cmbMaxQty || undefined)
                        : undefined,
            minForSale: formData.saleType === "standard" ? (formData.stdMinTotal || undefined)
                : formData.saleType === "breakDown" ? (formData.bdMinTotal || undefined)
                    : formData.saleType === "mixMatch" ? (formData.mmMinTotal || undefined)
                        : formData.saleType === "combined" ? (formData.cmbMinTotal || undefined)
                            : undefined,
            assignDate: formData.saleType === "standard" ? formData.stdAssignDate
                : formData.saleType === "breakDown" ? formData.bdAssignDate
                    : formData.saleType === "mixMatch" ? formData.mmAssignDate
                        : formData.saleType === "combined" ? formData.cmbAssignDate
                            : undefined,
            // specialBuy: Break Down = itemCount, Combined = pkg qty, Standard = memberOnly flag.
            // Send undefined for unrelated sale types so backend partial-update preserves existing DB value.
            specialBuy: formData.saleType === "breakDown" ? (formData.bdItemCount || 0)
                : formData.saleType === "combined" ? (formData.cmbPkgPrice || 0)
                    : formData.saleType === "standard" ? (formData.stdMemberOnly ? 1 : 0)
                        : undefined,
            // specialPrice: Break Down = total special price, Combined = pkg total amount
            specialPrice: formData.saleType === "breakDown" ? (formData.bdPrice || undefined)
                : formData.saleType === "combined" ? (parseFloat(formData.cmbPkgFor) || undefined)
                    : undefined,
            // pkgPrice = total amount (cmbPkgFor), pkgQty = quantity (cmbPkgPrice)
            pkgPrice: formData.saleType === "combined" ? (parseFloat(formData.cmbPkgFor) || undefined) : undefined,
            pkgQty: formData.saleType === "combined" ? (formData.cmbPkgPrice || undefined) : undefined,
            sellOnWeb: formData.sellOnWeb,
            webPrice: formData.webPrice,
            webCasePrice: formData.webCasePrice,
            daysForReturn: formData.daysForReturn || undefined,
            // Future pricing (maps to ItemStore.NewPrice / ItemStore.NewPriceDate via C# CreateItemDto)
            newPrice: formData.newPrice || undefined,
            newPriceDate: formData.dateEffective || undefined,
            // Markup and margin
            markup: formData.markup || undefined,
            margin: formData.profitMargin || undefined,
            // Pattern - GUID lookup; null when not selected
            pattern: formData.pattern?.trim() || null,

            // Map vendors to itemSupplies (filter out vendors without a selected supplier)
            itemSupplies: formData.vendors.filter(v => v.id && v.id.trim() !== "").length > 0
                ? formData.vendors.filter(v => v.id && v.id.trim() !== "").map(v => ({
                    supplierNo: v.id,
                    isMainSupplier: v.mainSupplier,
                    grossCost: v.grossCost,
                    totalCost: v.grossCost,
                    qtyPerCase: v.caseQty,
                    averageDeliveryDelay: formData.averageDeliveryDelay ? parseInt(formData.averageDeliveryDelay) : undefined,
                    itemCode: formData.vendorItemCode || undefined,
                })) : undefined,
            // Map groups to itemToGroups
            itemToGroups: formData.groups.filter(g => g).length > 0 ? formData.groups.filter(g => g).map(g => ({
                itemGroupID: g,
            })) : undefined,
            // Map upcCodes to itemAliases
            itemAliases: formData.upcCodes.filter(code => code).length > 0 ? formData.upcCodes.filter(code => code).map((code) => ({
                barcodeNumber: code,
            })) : undefined,
        }
    }

    type ValidationIssue = {
        message: string
        fieldId?: string
        tab?: TabKey
    }

    // fieldId → sectionId map. Each field on the General tab lives inside
    // one of the collapsible cards (`CollapsibleCard sectionId=...`). When
    // a section is collapsed, the card body isn't rendered, so
    // `getElementById(issue.fieldId)` returns null and focus silently
    // fails. The effect below expands the owning section first, then
    // defers focus until React has committed and painted the new render.
    //
    // Memoized so the focus-effect's dependency array doesn't churn on
    // every re-render of this enormous component (which would re-run the
    // effect spuriously and clobber a focus that already landed).
    const fieldIdToSectionId = useMemo<Record<string, string>>(() => ({
        "field-item-name": "identity",
        "field-upc": "identity",
        "field-model": "identity",
        "field-department": "organization",
        "field-case-qty": "pricing",
    }), [])

    // Pending-focus signal driven by `navigateToField`. Holds the field
    // we want to focus + a nonce so re-marking the same field re-fires
    // the effect (Set membership alone doesn't change identity, so we
    // can't drive the effect off `invalidFieldIds` directly).
    const [pendingFocus, setPendingFocus] = useState<{ fieldId: string; nonce: number } | null>(null)

    const navigateToField = useCallback((issue: ValidationIssue) => {
        if (issue.tab) {
            setActiveTab(issue.tab)
        }
        if (!issue.fieldId) return
        setInvalidFieldIds((prev) => new Set(prev).add(issue.fieldId!))
        // The effect below picks this up on the next render: it expands
        // the owning section (idempotent — safe even if already open)
        // and then waits two animation frames before focusing, so React
        // has guaranteed-committed the expansion by the time we read
        // the DOM.
        setPendingFocus({ fieldId: issue.fieldId, nonce: Date.now() })
    }, [])

    // Declarative expansion + scroll + focus. Driven by `pendingFocus`,
    // not by an imperative setTimeout chain — the effect runs *after*
    // React commits, so the previous race (focus fired before the
    // section's body was in the DOM) is gone.
    useEffect(() => {
        if (!pendingFocus) return
        const { fieldId } = pendingFocus
        const sectionId = fieldIdToSectionId[fieldId]

        // Always-call form: setCollapsed(false) is idempotent. We don't
        // read `sectionLayout.collapsed[sectionId]` first because that
        // snapshot can lag behind the user's most recent toggle while
        // the persist debounce is still in flight.
        if (sectionId) sectionLayout.setCollapsed(sectionId, false)

        // Belt-and-braces: scroll to the section card immediately (its
        // wrapper has data-section-id and is always in the DOM regardless
        // of collapsed state). Even if the field-level focus below races,
        // the user at least sees the right section.
        if (sectionId) {
            const card = document.querySelector(`[data-section-id="${sectionId}"]`)
            card?.scrollIntoView({ behavior: "smooth", block: "center" })
        }

        // Two rAFs guarantee: first commits the expansion → second runs
        // after the browser has painted the newly-mounted body. By then
        // `getElementById` will resolve to the actual input wrapper.
        let raf2 = 0
        const raf1 = requestAnimationFrame(() => {
            raf2 = requestAnimationFrame(() => {
                const el = document.getElementById(fieldId)
                if (!el) return
                el.scrollIntoView({ behavior: "smooth", block: "center" })
                const focusTarget = el.matches("input, textarea, select, button, [tabindex]")
                    ? (el as HTMLElement)
                    : el.querySelector<HTMLElement>("input, textarea, select, button, [tabindex]")
                focusTarget?.focus()
            })
        })
        return () => {
            cancelAnimationFrame(raf1)
            if (raf2) cancelAnimationFrame(raf2)
        }
    }, [pendingFocus, fieldIdToSectionId, sectionLayout])

    const mapApiValidationIssue = useCallback((rawMessage: string): ValidationIssue | null => {
        const msg = (rawMessage || "").toLowerCase()

        if (msg.includes("item name is required")) {
            return { message: "Enter an item name.", fieldId: "field-item-name", tab: "general" }
        }
        if (msg.includes("barcode/upc is required") || msg.includes("barcode") && msg.includes("required")) {
            return { message: "Enter a barcode/UPC.", fieldId: "field-upc", tab: "general" }
        }
        if (msg.includes("department is required")) {
            return { message: "Select a department.", fieldId: "field-department", tab: "general" }
        }

        return null
    }, [])

    // ===== Comprehensive Validation (matching old VB.NET FrmItems.vb CanSave) =====
    const validateForm = (): ValidationIssue | null => {
        // #1: Item name is required
        if (!formData.name.trim()) {
            return { message: "Enter an item name.", fieldId: "field-item-name", tab: "general" }
        }
        // #2: Barcode/UPC is required
        if (!formData.upc.trim()) {
            return { message: "Enter a barcode/UPC.", fieldId: "field-upc", tab: "general" }
        }
        // #3: Barcode uniqueness (already checked async, but block save if error exists)
        if (barcodeError) {
            return { message: barcodeError, fieldId: "field-upc", tab: "general" }
        }
        // #5: Model Number uniqueness (already checked async, but block save if error exists)
        if (modelNumberError) {
            return { message: modelNumberError, fieldId: "field-model", tab: "general" }
        }

        // #66: Alias barcode errors block save
        const hasAliasErrors = Object.values(aliasErrors).some(err => err !== null)
        if (hasAliasErrors) {
            return { message: "Fix alias barcode errors before saving.", tab: "extra" }
        }

        // #67: Vendor without supplier selected
        const vendorsWithoutSupplier = formData.vendors.filter(v => !v.id || v.id.trim() === "")
        if (vendorsWithoutSupplier.length > 0) {
            return { message: "Select a supplier for each vendor row, or remove empty rows.", tab: "vendor" }
        }

        // #10: Restock Level < Reorder Point check
        if (formData.restockLevel > 0 && formData.reorderPoint > 0 && formData.restockLevel < formData.reorderPoint) {
            return { message: "Restock Level cannot be less than Reorder Point.", tab: "vendor" }
        }

        // #6: Case Qty = 0 when Case Cost ≠ 0 → "Case Qty Can't be Zero"
        if (formData.lastCaseNetCostEnabled && formData.lastCaseNetCost > 0 && formData.caseQty === 0) {
            return { message: "Case Qty can't be zero when Case Cost is set.", fieldId: "field-case-qty", tab: "general" }
        }
        // #7: PriceByCase ON but CaseQty = 0 → "Valid_Price_By_Case"
        if (formData.setPricesForCase && formData.caseQty === 0) {
            return { message: "Set Case Qty when 'Set Prices for Case' is enabled.", fieldId: "field-case-qty", tab: "general" }
        }
        // Price/Cost basic validations
        if (formData.price < 0) {
            return { message: "Price cannot be negative.", tab: "general" }
        }
        if (formData.cost < 0) {
            return { message: "Cost cannot be negative.", tab: "general" }
        }
        return null
    }

    // ===== Sale Type Validations (matching old VB.NET FrmItems.vb CanSaveSales) =====
    const validateSalesTab = (): string | null => {
        if (formData.saleType === "noSale") return null

        // #13: Standard sale - price must be > 0
        if (formData.saleType === "standard") {
            if (formData.stdPrice <= 0) {
                return "Special Price must be greater than zero for Standard sale type"
            }
            if (formData.stdAssignDate) {
                if (!formData.stdFromDate) return "Start date is required when Assign Date is checked"
                if (!formData.stdToDate) return "End date is required when Assign Date is checked"
                if (formData.stdFromDate > formData.stdToDate) return "Start date cannot be after end date"
            }
        }

        // #14: Breakdown sale - item count and price must be > 0
        if (formData.saleType === "breakDown") {
            if (formData.bdItemCount <= 0) {
                return "Item Count must be greater than zero for Break Down sale type"
            }
            if (formData.bdPrice <= 0) {
                return "Special Price must be greater than zero for Break Down sale type"
            }
            if (formData.bdAssignDate) {
                if (!formData.bdFromDate) return "Start date is required when Assign Date is checked"
                if (!formData.bdToDate) return "End date is required when Assign Date is checked"
                if (formData.bdFromDate > formData.bdToDate) return "Start date cannot be after end date"
            }
        }

        // #15: Combined sale - sale price must be > 0
        if (formData.saleType === "combined") {
            if (formData.cmbSalePrice <= 0) {
                return "Sale Price must be greater than zero for Combined sale type"
            }
            if (formData.cmbAssignDate) {
                if (!formData.cmbFromDate) return "Start date is required when Assign Date is checked"
                if (!formData.cmbToDate) return "End date is required when Assign Date is checked"
                if (formData.cmbFromDate > formData.cmbToDate) return "Start date cannot be after end date"
            }
        }

        // #16: Mix & Match - must have a selection
        if (formData.saleType === "mixMatch") {
            if (!formData.mixMatchSelection) {
                return "Please select a Mix & Match group"
            }
            if (formData.mmAssignDate) {
                if (!formData.mmFromDate) return "Start date is required when Assign Date is checked"
                if (!formData.mmToDate) return "End date is required when Assign Date is checked"
                if (formData.mmFromDate > formData.mmToDate) return "Start date cannot be after end date"
            }
        }

        return null
    }

    // ===== Date Effective validation (Future Pricing - must be in the future) =====
    const validateFuturePricing = (): string | null => {
        if (formData.newPrice > 0 && formData.dateEffective) {
            const today = new Date().toISOString().split('T')[0]
            if (formData.dateEffective <= today) {
                return "Date Effective must be a future date"
            }
        }
        if (formData.newPrice > 0 && !formData.dateEffective) {
            return "Date Effective is required when New Price is set"
        }
        return null
    }

    // Show a confirmation dialog and return a promise that resolves with the result
    const showConfirmDialog = (
        title: string,
        message: string | React.ReactNode,
        type: "warning" | "info" | "error" | "confirm" = "warning",
        buttons: ConfirmDialogState["buttons"] = [
            { label: "Yes", variant: "primary", value: "yes" },
            { label: "No", variant: "outline", value: "no" },
        ]
    ): Promise<string> => {
        return new Promise((resolve) => {
            setConfirmDialog({
                isOpen: true,
                title,
                message,
                type,
                buttons,
                onResult: (result: string) => {
                    setConfirmDialog(prev => ({ ...prev, isOpen: false }))
                    resolve(result)
                },
            })
        })
    }

    const saveItem = async (navigateAfterSave: boolean): Promise<boolean> => {
        // Run basic validations
        const validationIssue = validateForm()
        if (validationIssue) {
            showToast("Validation Error", validationIssue.message, "error")
            navigateToField(validationIssue)
            return false
        }

        // Run sales tab validations
        const salesError = validateSalesTab()
        if (salesError) {
            showToast("Sales Validation", salesError, "error")
            setActiveTab("specials")
            return false
        }

        // Run future pricing validation
        const futurePricingError = validateFuturePricing()
        if (futurePricingError) {
            showToast("Future Pricing", futurePricingError, "error")
            setActiveTab("specials")
            return false
        }

        // #8/#18: Cost > Price warning → YesNo confirmation dialog
        const effectiveCost = getEffectiveCost(formData)
        if (effectiveCost > 0 && formData.price > 0 && effectiveCost > formData.price) {
            const result = await showConfirmDialog(
                "Cost Exceeds Price",
                `The cost ($${effectiveCost.toFixed(2)}) is greater than the price ($${formData.price.toFixed(2)}). This item will sell at a loss. Do you want to continue?`,
                "warning"
            )
            if (result !== "yes") return false
        }

        // #9/#19: Price = 0 warning → YesNo confirmation dialog
        if (formData.price === 0) {
            const result = await showConfirmDialog(
                "Price is Zero",
                "The price is $0.00. Are you sure you want to save this item with a zero price?",
                "warning"
            )
            if (result !== "yes") return false
        }

        // #23: Multi-store save confirmation
        if (formData.saveToAllStores && stores.length > 1) {
            const result = await showConfirmDialog(
                "Save to All Stores",
                `This will save the item to all ${stores.length} stores. Are you sure you want to proceed?`,
                "confirm",
                [
                    { label: "Save to All", variant: "primary", value: "yes" },
                    { label: "Current Store Only", variant: "secondary", value: "current" },
                    { label: "Cancel", variant: "outline", value: "cancel" },
                ]
            )
            if (result === "cancel") return false
            if (result === "current") {
                // Temporarily override saveToAllStores for this save
                handleInputChange("saveToAllStores", false)
            }
        }

        setIsSaving(true)

        try {
            const fullDto = mapFormDataToDto()
            
            // For edit mode, send the full DTO - the backend will use if-comparisons to only update changed fields
            const response = isEditMode
                ? await itemService.updateItem(fullDto)
                : await itemService.addItem(fullDto)

            if (response.success && response.data) {
                // Handle both camelCase (itemId) and PascalCase (itemID) from API response
                const savedItemId = response.data.itemId || response.data.itemID

                // Upload image to S3 if one was selected
                if (selectedImageFile && savedItemId) {
                    setIsUploadingImage(true)
                    try {
                        const imageResult = await itemService.uploadImage(selectedImageFile, savedItemId, 1)
                        if (imageResult.success && imageResult.data) {
                            setUploadedImageUrl(imageResult.data.imageUrl)
                            setSelectedImageFile(null)
                            showToast("Success", `Item and image ${isEditMode ? 'updated' : 'saved'} successfully!`, "success")
                        } else {
                            // Item saved but image upload failed
                            showToast("Partial Success", `Item ${isEditMode ? 'updated' : 'saved'} but image upload failed. You can try uploading the image again later.`, "info")
                        }
                    } catch (imageError) {
                        console.error("Error uploading image:", imageError)
                        showToast("Partial Success", `Item ${isEditMode ? 'updated' : 'saved'} but image upload failed.`, "info")
                    } finally {
                        setIsUploadingImage(false)
                    }
                } else {
                    showToast("Success", response.message || `Item ${isEditMode ? 'updated' : 'saved'} successfully!`, "success")
                }

                // Mark form as clean after successful save
                setSavedFormData(formData)

                // #11/#12: Handle API error responses for unique constraint violations
                if (navigateAfterSave) {
                    // Short delay to show success message then go back to list
                    setTimeout(() => goBackToList(), 1500)
                }
                return true
            } else {
                // Check for specific error types from the API
                const errorMessage = response.errors && response.errors.length > 0
                    ? response.errors.join(", ")
                    : response.message || `Failed to ${isEditMode ? 'update' : 'save'} item`

                const mappedIssue = mapApiValidationIssue(errorMessage)
                if (mappedIssue) {
                    showToast("Validation Error", mappedIssue.message, "error")
                    navigateToField(mappedIssue)
                    return false
                }

                // #11: Company Code unique constraint error
                if (errorMessage.toLowerCase().includes("company code") || errorMessage.toLowerCase().includes("unique constraint") || errorMessage.toLowerCase().includes("duplicate")) {
                    showToast("Duplicate Error", "A duplicate value was detected. Please check barcode, company code, or other unique fields.", "error")
                }
                // #12: UPC index violation
                else if (errorMessage.toLowerCase().includes("upc") || errorMessage.toLowerCase().includes("barcode") || errorMessage.toLowerCase().includes("index violation")) {
                    showToast("Barcode Error", "This barcode/UPC already exists in the system. Please use a different barcode.", "error")
                }
                else {
                    showToast(`Failed to ${isEditMode ? 'update' : 'add'} item`, errorMessage, "error")
                }
                return false
            }
        } catch (err) {
            showToast("Error", `An error occurred while ${isEditMode ? 'updating' : 'saving'} the item`, "error")
            console.error("Error saving item:", err)
            return false
        } finally {
            setIsSaving(false)
        }
    }

    // Go back to list (close current tab and open list tab)
    const goBackToList = useCallback(() => {
        if (activeTabId) {
            closeTab(activeTabId)
        }
        openTab({
            component: "ItemListPage",
            title: "Item List",
            closable: true,
        })
    }, [activeTabId, closeTab, openTab])

    // After each successful load, prefetch the immediate prev/next item DTOs
    // in the background so the next click is served from cache — zero spinner.
    useEffect(() => {
        if (!isEditMode || !id || !itemListNavigation) return
        const { itemStoreIds, index } = itemListNavigation
        const neighbors = [itemStoreIds[index - 1], itemStoreIds[index + 1]]
            .filter((s): s is string => !!s && !itemCacheRef.current.has(s))
        if (neighbors.length === 0) return
        let cancelled = false
        for (const nid of neighbors) {
            itemService.getItem(nid).then(r => {
                if (cancelled) return
                if (r.success && r.data) itemCacheRef.current.set(nid, r.data)
            }).catch(() => { /* prefetch failure is silent — actual click will retry */ })
        }
        return () => { cancelled = true }
    }, [id, isEditMode, itemListNavigation])

    /** Prev/next within rows loaded in the grid when this tab was opened (unsaved guard). */
    const navigateAdjacentItem = useCallback(
        async (delta: -1 | 1) => {
            if (!itemListNavigation || !__tabId) return
            const nextIndex = itemListNavigation.index + delta
            if (nextIndex < 0 || nextIndex >= itemListNavigation.itemStoreIds.length) return

            const applyNav = () => {
                const nextId = itemListNavigation.itemStoreIds[nextIndex]
                const nextTitle = itemListNavigation.itemTitles[nextIndex] || "Item"
                updateTabProps(
                    __tabId,
                    {
                        id: nextId,
                        itemListNavigation: {
                            ...itemListNavigation,
                            index: nextIndex,
                        },
                    },
                    { title: `Edit: ${nextTitle}` },
                )
            }

            if (isDirty) {
                const result = await showConfirmDialog(
                    "Unsaved Changes",
                    "You have unsaved changes. Save before opening another item?",
                    "warning",
                    [
                        { label: "Save", variant: "primary", value: "save" },
                        { label: "Discard", variant: "danger", value: "discard" },
                        { label: "Cancel", variant: "outline", value: "cancel" },
                    ],
                )
                if (result === "cancel") return
                if (result === "save") {
                    const ok = await saveItem(false)
                    if (!ok) return
                }
            }
            applyNav()
        },
        [itemListNavigation, __tabId, isDirty, updateTabProps, saveItem, showConfirmDialog],
    )

    const handleSave = useCallback(async () => {
        await saveItem(true)
    }, [formData, goBackToList, selectedImageFile])

    // Save without navigating away (matches HTML "Save" button)
    const handleSaveOnly = useCallback(async () => {
        await saveItem(false)
    }, [formData, selectedImageFile])

    // ── Unsaved-changes wiring ─────────────────────────────────────────────
    // Reports dirty state (current formData vs last-saved `savedFormData`) to
    // DashboardTabContext so the tab strip shows the amber dirty dot and the
    // close-tab guard can intercept ✕ clicks. The registered saveHandler is
    // invoked when the user clicks "Save Changes" in the unsaved-changes modal.
    //
    // `saveItem(false)` already updates `savedFormData` on success (see the
    // `setSavedFormData(formData)` call inside saveItem), so the dirty flag
    // clears automatically without an explicit markSaved() call.
    useUnsavedChanges<ItemFormData>({
        tabId: __tabId,
        formData,
        initialSnapshot: savedFormData,
        enabled: !isLoading,
        saveHandler: async () => {
            const ok = await saveItem(false)
            if (!ok) {
                // Re-throw so the modal stays open and surfaces the error inline.
                throw new Error("Could not save item. Please fix any validation errors and try again.")
            }
        },
    })

    // ── Per-tab state cache (survives tab-switch unmount/remount) ──────────
    // Persists the form state into DashboardTabContext.setTabState so a
    // subsequent mount of the same tab id restores via the useState initializers
    // at the top of this component. Cache is in-memory only — page reload
    // starts fresh. Cache entry is cleared automatically when the tab is
    // removed from `tabs[]` (close, close-all, close-others, workspace replace).
    //
    // Only fires after the initial fetch completes so we don't cache a half-
    // loaded snapshot (which would defeat the API-skip on remount).
    useEffect(() => {
        if (!__tabId) return
        if (!hasLoadedOnceRef.current) return
        setTabState<ItemFormCachedState>(__tabId, {
            formData,
            savedFormData,
            currentItemId,
            originalBarcode,
            originalModelNumber,
            originalName,
            originalUpcCodes,
            hasFetched: true,
        })
    }, [
        __tabId,
        formData,
        savedFormData,
        currentItemId,
        originalBarcode,
        originalModelNumber,
        originalName,
        originalUpcCodes,
        setTabState,
    ])

    const handleSaveAndNew = useCallback(async () => {
        const success = await saveItem(false)
        if (success) {
            setFormData(initialFormData)
            setSavedFormData(initialFormData)
            setActiveTab("general")
            // Clear image state for new item
            setImagePreview(null)
            setUploadedImageUrl(null)
            setSelectedImageFile(null)
            showToast("Success", "Item saved successfully! You can add another item.", "success")
        }
    }, [formData, selectedImageFile])

    // Duplicate (UI-only button wired to the existing "copyData pre-fill" mechanism)
    const handleDuplicate = useCallback(() => {
        const copyPayload = {
            // === General Tab ===
            name: formData.name,
            barcodeNumber: formData.upc,
            modalNumber: formData.alternateCode,
            description: formData.description,
            size: formData.size,
            itemType: parseInt(formData.itemType) || 0,
            departmentID: getLeafDepartmentId(formData),
            binLocation: formData.location,
            customerCode: formData.customerCode,
            styleNo: formData.matrix1,
            matrix2: formData.matrix2,
            caseCode: formData.caseCode,
            barcodeType: formData.upcType,

            // === Sales Tab ===
            cost: formData.cost,
            price: formData.price,
            listPrice: formData.listPrice,
            caseQty: formData.caseQty,
            casePrice: formData.casePrice,
            priceByCase: formData.setPricesForCase,
            costByCase: formData.lastCaseNetCostEnabled,
            markup: formData.markup,
            margin: formData.profitMargin,
            reorderPoint: formData.reorderPoint,
            restockLevel: formData.restockLevel,
            prefOrderBy: formData.usuallyOrderedIn,
            prefSaleBy: formData.usuallySoldIn,

            // === Specials Tab (standard defaults only, matches current copy prefill behavior) ===
            regSPPrice: formData.stdPrice,
            sP_From: formData.stdFromDate,
            sP_To: formData.stdToDate,

            // === Vendor Tab ===
            itemSupplies: [
                {
                    itemCode: formData.vendorItemCode,
                    averageDeliveryDelay: formData.averageDeliveryDelay,
                },
            ],

            // === Extra Tab ===
            extraInfo: formData.extraInfo1,
            extraInfo2: formData.extraInfo2,
            extraCharge1: formData.extraCharge1,
            extraCharge2: formData.extraCharge2,
            extraCharge3: formData.extraCharge3,
            sellOnWeb: formData.sellOnWeb,
            webPrice: formData.webPrice,
            webCasePrice: formData.webCasePrice,
            itemAlias: formData.upcCodes.join(","),

            // === Custom Fields ===
            customField1: formData.customField1,
            customField2: formData.customField2,
            customField3: formData.customField3,
            customField4: formData.customField4,
            customField5: formData.customField5,
            customField6: formData.customField6,
            customField7: formData.customField7,
            customField8: formData.customField8,
            customField9: formData.customField9,
            customField10: formData.customField10,

            // Used by the prefill to load original image (best-effort)
            _originalItemId: currentItemId || id,
        }

        openTab({
            component: "ItemFormPage",
            title: `Copy: ${formData.name || "Item"}`,
            closable: true,
            editMode: true,
            props: { isNew: true, copyData: copyPayload },
        })
    }, [openTab, formData, currentItemId, id])

    // #20: Unsaved changes on close/cancel → Yes/No/Cancel dialog
    const handleCancel = useCallback(async () => {
        if (isDirty) {
            const result = await showConfirmDialog(
                "Unsaved Changes",
                "You have unsaved changes. Do you want to save before leaving?",
                "warning",
                [
                    { label: "Save & Close", variant: "primary", value: "save" },
                    { label: "Discard", variant: "danger", value: "discard" },
                    { label: "Cancel", variant: "outline", value: "cancel" },
                ]
            )
            if (result === "save") {
                const success = await saveItem(true)
                if (!success) return // Don't close if save failed
            } else if (result === "discard") {
                goBackToList()
            }
            // "cancel" → do nothing, stay on the form
        } else {
            goBackToList()
        }
    }, [goBackToList, isDirty])

    // #55: Department change → auto-set Taxable, FoodStamp, Discountable from department defaults
    // #21: Department markup confirmation
    // #22/#43: Department roundup price calculation
    // In VB.NET this was handled in DepartmentChanged() sub
    const [currentDeptDefaults, setCurrentDeptDefaults] = useState<DepartmentDefaultsDto | null>(null)

    const applyDepartmentDefaults = useCallback(async (departmentId: string) => {
        if (!departmentId) {
            setCurrentDeptDefaults(null)
            return
        }

        try {
            const response = await itemService.getDepartmentDefaults(departmentId)
            if (response.success && response.data) {
                const deptDefaults = response.data
                setCurrentDeptDefaults(deptDefaults)

                // #55: Auto-set Taxable, FoodStamp, Discountable from department defaults (new items only)
                if (!isEditMode) {
                    if (deptDefaults.isDefaultTaxInclude != null) {
                        handleInputChange("taxable", deptDefaults.isDefaultTaxInclude)
                    }
                    if (deptDefaults.defaultTaxNo) {
                        handleInputChange("taxableRate", deptDefaults.defaultTaxNo)
                    }
                    if (deptDefaults.isDefaultFoodStampable != null) {
                        handleInputChange("foodStamp", deptDefaults.isDefaultFoodStampable)
                    }
                    if (deptDefaults.isDefaultDiscountable != null) {
                        handleInputChange("discountable", deptDefaults.isDefaultDiscountable)
                    }
                }

                // #21: If department has a default markup, offer to apply it
                if (deptDefaults.defaultMarkup != null && deptDefaults.defaultMarkup > 0 && formData.cost > 0) {
                    const result = await showConfirmDialog(
                        "Apply Department Markup",
                        `Department "${deptDefaults.name}" has a default markup of ${deptDefaults.defaultMarkup}%. Apply this markup to calculate the price?`,
                        "confirm"
                    )
                    if (result === "yes") {
                        const cost = getEffectiveCost(formData)
                        let newPrice = calcPriceFromMarkup(cost, Number(deptDefaults.defaultMarkup))

                        // #43/#22: Apply department roundup if configured
                        if (deptDefaults.roundUp > 0 && deptDefaults.roundValue != null && Number(deptDefaults.roundValue) > 0) {
                            newPrice = applyRoundUp(newPrice, deptDefaults.roundUp, Number(deptDefaults.roundValue))

                            showToast("Price Rounded", `Price rounded to $${newPrice.toFixed(2)} using department roundup rules`, "info")
                        }

                        handleInputChange("price", newPrice)
                        handleInputChange("markup", Number(deptDefaults.defaultMarkup))
                        handleInputChange("profitMargin", calcMargin(newPrice, cost))
                    }
                }
            }
        } catch (err) {
            console.error("Error loading department defaults:", err)
        }
    }, [handleInputChange, isEditMode, formData.cost, showConfirmDialog, showToast])

    /** Pick any node in the department tree; splits into root / sub / sub-sub and loads defaults from the leaf. */
    const handleDepartmentTreePick = useCallback(
        async (pickedId: string) => {
            if (!pickedId) {
                handleInputChange("department", "")
                handleInputChange("subDepartment", "")
                handleInputChange("subSubDepartment", "")
                setCurrentDeptDefaults(null)
                return
            }
            const h = resolveDepartmentHierarchy(pickedId, departmentOptions)
            handleInputChange("department", h.root)
            handleInputChange("subDepartment", h.sub)
            handleInputChange("subSubDepartment", h.subSub)
            await applyDepartmentDefaults(
                getLeafDepartmentId({
                    department: h.root,
                    subDepartment: h.sub,
                    subSubDepartment: h.subSub,
                }),
            )
        },
        [departmentOptions, handleInputChange, applyDepartmentDefaults],
    )

    const handleDepartmentChange = useCallback(
        async (departmentId: string) => {
            handleInputChange("department", departmentId)
            handleInputChange("subDepartment", "")
            handleInputChange("subSubDepartment", "")
            await applyDepartmentDefaults(departmentId)
        },
        [handleInputChange, applyDepartmentDefaults],
    )

    // #43: Department roundup price calculation
    // RoundUp types from old VB.NET: 0=None, 1=Round Up to X9, 2=Round Up to X5, 3=Round to nearest RoundValue
    const applyRoundUp = (price: number, roundUpType: number, roundValue: number): number => {
        if (roundUpType === 0 || price <= 0) return price

        if (roundUpType === 1) {
            // Round up to end in .X9 (e.g., 1.49, 2.99)
            const cents = Math.ceil(price * 100)
            const lastDigit = cents % 10
            if (lastDigit !== 9) {
                return (cents + (9 - lastDigit)) / 100
            }
            return price
        }

        if (roundUpType === 2) {
            // Round up to end in .X5
            const cents = Math.ceil(price * 100)
            const lastDigit = cents % 10
            if (lastDigit <= 5) {
                return (cents + (5 - lastDigit)) / 100
            } else {
                return (cents + (15 - lastDigit)) / 100
            }
        }

        if (roundUpType === 3 && roundValue > 0) {
            // Round to nearest roundValue
            return parseFloat((Math.ceil(price / roundValue) * roundValue).toFixed(2))
        }

        return price
    }

    // #72/#73: Store switching with unsaved changes check + data reload
    const handleStoreChange = useCallback(async (newStoreId: string) => {
        if (newStoreId === formData.selectedStore) return

        // #72: If there are unsaved changes, confirm before switching stores
        if (isDirty) {
            const result = await showConfirmDialog(
                "Unsaved Changes",
                "You have unsaved changes. Switching stores will discard these changes. Do you want to continue?",
                "warning",
                [
                    { label: "Save First", variant: "primary", value: "save" },
                    { label: "Discard & Switch", variant: "danger", value: "discard" },
                    { label: "Cancel", variant: "outline", value: "cancel" },
                ]
            )
            if (result === "save") {
                const success = await saveItem(false)
                if (!success) return // Don't switch if save failed
            } else if (result === "cancel") {
                return // Stay on current store
            }
            // "discard" → proceed to switch
        }

        handleInputChange("selectedStore", newStoreId)

        // #73: In edit mode, reload item data for the new store
        if (isEditMode && id) {
            // The item might have different store-specific data
            // Reload item data with the new store context
            loadItemData(id)
        }
    }, [formData.selectedStore, isDirty, isEditMode, id, handleInputChange])

    // #50: "Usually Ordered In" = Cases → auto-check CostByCase
    const handleOrderedInChange = useCallback((value: string) => {
        handleInputChange("usuallyOrderedIn", value)
        if (value === "Cases" && !formData.lastCaseNetCostEnabled) {
            handleInputChange("lastCaseNetCostEnabled", true)
        }
    }, [handleInputChange, formData.lastCaseNetCostEnabled])

    /** Select all when focused value is exactly zero (avoids appending digits after a lone "0" on number inputs). */
    const focusSelectIfNumericZero = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
        const v = e.target.value
        if (!v) return
        const n = parseFloat(v)
        if (!Number.isFinite(n) || n !== 0) return
        if (!/[1-9]/.test(v)) {
            e.currentTarget.select()
        }
    }, [])

    // #48: Lock Markup toggle - when enabled, changing cost recalculates price to maintain markup
    const handleCostChangeWithLockMarkup = useCallback((newCost: number) => {
        handleInputChange("cost", newCost)
        // Piece mode: case net cost is derived (PC × case qty) so it stays in sync for save / case pricing.
        if (!formData.setPricesForCase && formData.caseQty > 0) {
            handleInputChange("lastCaseNetCost", parseFloat((newCost * formData.caseQty).toFixed(2)))
        }
        const effCost = formData.setPricesForCase ? formData.lastCaseNetCost : newCost

        if (formData.lockMarkup) {
            // Lock Markup mode: cost changes → price recalculates to maintain markup percentage
            const newPrice = calcPriceFromMarkup(effCost, formData.markup)
            handleInputChange("price", newPrice)
            handleInputChange("profitMargin", calcMargin(newPrice, effCost))
        } else {
            // Normal mode: cost changes → margin/markup recalculate
            handleInputChange("profitMargin", calcMargin(formData.price, effCost))
            handleInputChange("markup", calcMarkup(formData.price, effCost))
        }
        handleInputChange("caseMarkup", calcCaseMarkup(formData.casePrice, formData.caseQty, newCost))
    }, [handleInputChange, formData.setPricesForCase, formData.lastCaseNetCost, formData.lockMarkup, formData.markup, formData.price, formData.casePrice, formData.caseQty])

    // #51-54: Sale type toggle — each type has independent fields, just switch the view
    const handleSaleTypeChange = useCallback((newSaleType: string) => {
        handleInputChange("saleType", newSaleType)
    }, [handleInputChange])

    // Break Down: price change → recalc margin/markup (pricePerPiece = bdPrice / bdItemCount)
    const handleBdPriceChange = useCallback((price: number) => {
        handleInputChange("bdPrice", price)
        const cost = getSpecialsCost(formData)
        const itemCnt = formData.bdItemCount || 1
        const pricePerPiece = price / itemCnt
        handleInputChange("bdMargin", calcMargin(pricePerPiece, cost))
        handleInputChange("bdMarkup", calcMarkup(pricePerPiece, cost))
    }, [handleInputChange, formData])

    // Standard: price change → recalc margin/markup
    const handleStdPriceChange = useCallback((price: number) => {
        handleInputChange("stdPrice", price)
        const cost = getSpecialsCost(formData)
        handleInputChange("stdMargin", calcMargin(price, cost))
        handleInputChange("stdMarkup", calcMarkup(price, cost))
    }, [handleInputChange, formData])

    // Combined: sale price change → recalc margin/markup
    const handleCmbSalePriceChange = useCallback((price: number) => {
        handleInputChange("cmbSalePrice", price)
        const cost = getSpecialsCost(formData)
        handleInputChange("cmbSaleMargin", calcMargin(price, cost))
        handleInputChange("cmbSaleMarkup", calcMarkup(price, cost))
    }, [handleInputChange, formData])

    // Combined: pkg qty change ("Pkg Price" field = quantity) → recalc margin/markup
    const handleCmbPkgQtyChange = useCallback((qty: number) => {
        handleInputChange("cmbPkgPrice", qty)
        const totalAmount = parseFloat(formData.cmbPkgFor) || 0
        if (qty > 0 && totalAmount > 0) {
            const pricePerUnit = totalAmount / qty
            const cost = getSpecialsCost(formData)
            handleInputChange("cmbPkgMargin", calcMargin(pricePerUnit, cost))
            handleInputChange("cmbPkgMarkup", calcMarkup(pricePerUnit, cost))
        }
    }, [handleInputChange, formData])

    // #64: BO_ItemsShow view permission - if user doesn't have view permission, show access denied
    const canView = isSuperAdmin || isTenantAdmin || hasPermission("inventory.item_list.view") || hasPermission("ITEMS_LIST.View") || hasPermission("BO_ItemsShow")

    // Debug: log permission state to help diagnose Access Denied issues
    if (!canView && permissionsLoaded) {
        console.warn("[ItemFormPage] Access Denied debug:", { isSuperAdmin, isTenantAdmin, permissionsLoaded, permissionsLoading, canView, hasInventoryItemListView: hasPermission("inventory.item_list.view"), hasITEMS_LIST_View: hasPermission("ITEMS_LIST.View"), hasBO_ItemsShow: hasPermission("BO_ItemsShow") })
    }

    // #25/#76: Add supplier with confirmation
    const handleAddSupplier = useCallback(async () => {
        // In a full implementation, this would open a supplier picker dialog
        // For now, add a blank supplier row with confirmation
        if (formData.vendors.length > 0) {
            const result = await showConfirmDialog(
                "Add Supplier",
                "Add another supplier to this item? The first supplier is typically the main supplier.",
                "confirm"
            )
            if (result !== "yes") return
        }
        const newVendor: VendorItem = {
            id: "",
            mainSupplier: formData.vendors.length === 0, // First vendor is main by default
            grossCost: 0,
            caseQty: formData.caseQty || 0,
            pcCost: 0,
            name: "",
        }
        handleInputChange("vendors", [...formData.vendors, newVendor])
    }, [formData.vendors, formData.caseQty, handleInputChange])

    // #76: Remove supplier with confirmation
    const handleRemoveSupplier = useCallback(async (index: number) => {
        const vendor = formData.vendors[index]
        const vendorName = vendor.name || `Supplier ${index + 1}`
        const result = await showConfirmDialog(
            "Remove Supplier",
            `Are you sure you want to remove "${vendorName}" from this item?`,
            "warning"
        )
        if (result !== "yes") return

        const updatedVendors = formData.vendors.filter((_, i) => i !== index)
        // If we removed the main supplier, make the first remaining one main
        if (vendor.mainSupplier && updatedVendors.length > 0) {
            updatedVendors[0].mainSupplier = true
        }
        handleInputChange("vendors", updatedVendors)
    }, [formData.vendors, handleInputChange])

    // #26: Add alias UPC code with confirmation for duplicates
    const handleAddAlias = useCallback(async () => {
        handleInputChange("upcCodes", [...formData.upcCodes, ""])
    }, [formData.upcCodes, handleInputChange])

    // Remove alias with confirmation
    const handleRemoveAlias = useCallback(async (index: number) => {
        const code = formData.upcCodes[index]
        if (code) {
            const result = await showConfirmDialog(
                "Remove UPC Code",
                `Remove UPC code "${code}" from this item?`,
                "warning"
            )
            if (result !== "yes") return
        }
        const newCodes = formData.upcCodes.filter((_, i) => i !== index)
        handleInputChange("upcCodes", newCodes)
        // Clean up alias errors for removed index
        setAliasErrors(prev => {
            const updated = { ...prev }
            delete updated[index]
            return updated
        })
    }, [formData.upcCodes, handleInputChange])

    // #79: Add text to name - appends text (like brand, size) to the item name
    const handleAddTextToName = useCallback(() => {
        const parts: string[] = []
        // Build descriptive name from selected values
        const brandOption = manufacturerOptions.find(opt => opt.value === formData.manufacturer)
        if (brandOption) parts.push(brandOption.label)
        if (formData.size) parts.push(formData.size)
        const measureOption = MEASURE_OPTIONS.find(opt => opt.value === formData.measure)
        if (measureOption && formData.units) parts.push(`${formData.units} ${measureOption.label}`)

        if (parts.length > 0) {
            const currentName = formData.name.trim()
            const textToAdd = parts.join(" ")
            // Only add if not already at the end
            if (!currentName.endsWith(textToAdd)) {
                handleInputChange("name", currentName ? `${currentName} ${textToAdd}` : textToAdd)
            }
        }
    }, [formData.manufacturer, formData.size, formData.measure, formData.units, formData.name, handleInputChange, manufacturerOptions])

    // #75/#24: Matrix support - handle item type change with confirmation for Matrix types
    const handleItemTypeChange = useCallback(async (newType: string) => {
        const oldType = formData.itemType

        // #24: Switching to/from Matrix type requires confirmation (data changes may occur)
        if ((newType === "2" || newType === "3") && oldType !== "2" && oldType !== "3") {
            const result = await showConfirmDialog(
                "Change to Matrix Type",
                newType === "2"
                    ? "Changing to Matrix type will make this item a parent matrix. Matrix children can inherit properties from this item. Continue?"
                    : "Changing to Matrix Child will link this item to a parent matrix. Continue?",
                "confirm"
            )
            if (result !== "yes") return
        }

        // Switching from Matrix back to Standard
        if ((oldType === "2" || oldType === "3") && newType !== "2" && newType !== "3") {
            const result = await showConfirmDialog(
                "Change from Matrix Type",
                "Changing from a Matrix type may affect linked items. Are you sure?",
                "warning"
            )
            if (result !== "yes") return
        }

        handleInputChange("itemType", newType)
    }, [formData.itemType, handleInputChange])

    // Computed: is this a matrix item?
    const isMatrixParent = formData.itemType === "2"
    const isMatrixChild = formData.itemType === "3"

    // --- StoreType / ItemType show-hide rules (port of FrmItems) -------------
    //
    // Item-type encoding used inside this form (NOT the desktop's enum):
    //   "0" Standard | "1" Weight | "2" Matrix | "3" Matrix Child
    //   "4" Service  | "5" Tag Along
    //
    // Filter the dropdown options by StoreType:
    //   • Food / Books — hide Matrix + Matrix Child (apparel-specific)
    //   • Apparel / Regular — show everything
    const filteredItemTypeOptions = useMemo(() => {
        const hideMatrix = isFood || isBooks
        if (!hideMatrix) return itemTypeOptions
        return itemTypeOptions.filter(opt => opt.value !== "2" && opt.value !== "3")
    }, [itemTypeOptions, isFood, isBooks])

    // Item-type dropdown is read-only when:
    //   • The item is already a Matrix Child — its type is dictated by its
    //     parent matrix; changing it would orphan the link.
    //   • The item is an existing Tag-Along that's already in use elsewhere
    //     (covered conservatively by "edit-mode + currently TagAlong"). The
    //     desktop blocks switching to avoid breaking the rows that reference it.
    const itemTypeLocked = useMemo(() => {
        if (formData.itemType === "3") return true
        if (isEditMode && formData.itemType === "5") return true
        return false
    }, [formData.itemType, isEditMode])

    // Convenience flags used by section/checkbox visibility below.
    const isServiceItem = formData.itemType === "4"
    const isTagAlongItem = formData.itemType === "5"

    // Apparel default: brand-new items should start as Matrix so the
    // variants grid shows up by default. Only fires once tenant setup
    // has loaded (so we don't flip the user's choice on a transient
    // null) and only for fresh creates (not edits, not copies). A ref
    // guards against re-firing if the user later picks something else.
    const appliedApparelDefaultRef = useRef(false)
    useEffect(() => {
        if (!tenantSetupLoaded) return
        if (!isNew || isEditMode) return
        if (!isApparel) return
        if (appliedApparelDefaultRef.current) return
        // Only switch if still on the factory default — don't clobber
        // an explicit user choice or a copy-source value.
        if (formData.itemType !== "0") {
            appliedApparelDefaultRef.current = true
            return
        }
        handleInputChange("itemType", "2")
        appliedApparelDefaultRef.current = true
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tenantSetupLoaded, isApparel, isNew, isEditMode])

    const handlePrintLabel = useCallback(() => {
        if (!id) {
            showToast("Print Label", "Please save the item first before printing a label.", "info")
            return
        }
        setPrintLabelDialogOpen(true)
    }, [id])

    // Render General Tab
    const renderGeneralTab = () => (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Identity Content (Column 1 - Card 1) — v8.5 layout: name + desc full-width, then 2 code cols + image on right */}
            <div className="lg:col-span-4 space-y-2">
                <div className={`fg ${invalidFieldIds.has("field-item-name") ? "field-invalid-group" : ""}`}>
                    <label>
                        Item Name
                        <span className="text-red-500 ml-1">*</span>
                    </label>
                    <div className="relative">
                        <Input
                            id="field-item-name"
                            type="text"
                            value={formData.name}
                            onChange={(e) => {
                                handleInputChange("name", e.target.value)
                                setNameWarning(null)
                                if (e.target.value.length >= 2) {
                                    setShowNameSuggestions(true)
                                } else {
                                    setShowNameSuggestions(false)
                                }
                            }}
                            onFocus={() => formData.name.length >= 2 && setShowNameSuggestions(true)}
                            onBlur={(e) => {
                                setTimeout(() => setShowNameSuggestions(false), 200)
                                checkItemNameExists(e.target.value)
                            }}
                            className={`inp w-full font-medium text-[13.5px] ${invalidFieldIds.has("field-item-name") ? "field-invalid-input" : ""}`}
                            placeholder="Item name"
                            error={invalidFieldIds.has("field-item-name")}
                        />
                        {showNameSuggestions && nameSuggestions.length > 0 && (
                            <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                                {nameSuggestions.map((item, index) => (
                                    <div
                                        key={index}
                                        className="px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                                        onMouseDown={() => {
                                            handleInputChange("name", item.name)
                                            handleInputChange("upc", item.barcode)
                                            setShowNameSuggestions(false)
                                        }}
                                    >
                                        <div className="font-medium">{item.name}</div>
                                        <div className="text-xs text-gray-500">{item.barcode}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="fg">
                    <label>Description</label>
                    <TextArea
                        value={formData.description}
                        onChange={(value) => handleInputChange("description", value)}
                        rows={2}
                        placeholder="Enter description..."
                    />
                </div>

                {/* Codes span 3 rows on the left; image square on the right spans those 3 rows */}
                <div className="identity-grid">
                    <div className="identity-grid-codes">
                        <CodeRow
                            label="UPC Code"
                            value={formData.upc}
                            inputId="field-upc"
                            required
                            hasError={invalidFieldIds.has("field-upc")}
                            onChange={(v) => handleInputChange("upc", v)}
                            onBlur={(v) => checkBarcodeExists(v)}
                            onGenerate={async () => {
                                const code = await generateBarcode("upc")
                                if (code) handleInputChange("upc", code)
                            }}
                            generateTitle="Generate a new UPC-A barcode"
                        />
                        <div className="fr">
                            <CodeRow
                                label="Case Code"
                                value={formData.caseCode}
                                onChange={(v) => handleInputChange("caseCode", v)}
                                onGenerate={async () => {
                                    const code = await generateBarcode("case")
                                    if (code) handleInputChange("caseCode", code)
                                }}
                                generateTitle="Generate a new case code"
                            />
                            <CodeRow
                                label={storeCodeLabels.pkg}
                                value={(formData as unknown as Record<string, string>).pkgCode || ""}
                                onChange={(v) => handleInputChange("pkgCode" as keyof ItemFormData, v)}
                                onGenerate={async () => {
                                    const code = await generateBarcode("pkg")
                                    if (code) handleInputChange("pkgCode" as keyof ItemFormData, code)
                                }}
                                generateTitle="Generate a new package code"
                            />
                        </div>
                        <div className="fr">
                            <CodeRow
                                label={storeCodeLabels.model}
                                value={formData.alternateCode}
                                inputId="field-model"
                                hasError={invalidFieldIds.has("field-model")}
                                onChange={(v) => handleInputChange("alternateCode", v)}
                                onBlur={(v) => checkModelNumberExists(v)}
                                onGenerate={async () => {
                                    const code = await generateBarcode("model")
                                    if (code) handleInputChange("alternateCode", code)
                                }}
                                generateTitle="Generate a new model number"
                            />
                            <CodeRow
                                label={storeCodeLabels.style}
                                value={formData.matrix1}
                                onChange={(v) => handleInputChange("matrix1", v)}
                                onGenerate={async () => {
                                    const code = await generateBarcode("style")
                                    if (code) handleInputChange("matrix1", code)
                                }}
                                generateTitle="Generate a new style number"
                            />
                        </div>
                    </div>
                    {(() => {
                        const hasImage = !!(imagePreview || uploadedImageUrl) && !imageLoadError
                        const imgSrc = imagePreview || uploadedImageUrl || ""
                        return (
                            <div
                                className={`imgup identity-img${hasImage ? "" : " imgup-empty"}`}
                                onClick={hasImage ? undefined : handleImageClick}
                                onDoubleClick={hasImage ? () => setIsImagePreviewOpen(true) : undefined}
                                title={hasImage ? "Double-click to preview" : "Click to upload an image"}
                                onDragOver={(e) => { e.preventDefault() }}
                                onDrop={(e) => {
                                    e.preventDefault()
                                    const file = e.dataTransfer.files?.[0]
                                    if (file && handleImageChange) {
                                        const fakeEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>
                                        handleImageChange(fakeEvent)
                                    }
                                }}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleImageChange}
                                    accept="image/jpeg,image/png,image/gif,image/webp"
                                    className="hidden"
                                />
                                {hasImage ? (
                                    <div className="relative w-full h-full group">
                                        <img
                                            src={imgSrc}
                                            alt=""
                                            className="w-full h-full object-contain rounded"
                                            onError={() => setImageLoadError(true)}
                                        />
                                        {/* Change / delete controls — visible on hover so they don't clutter the thumbnail. */}
                                        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); handleImageClick() }}
                                                disabled={isUploadingImage}
                                                title="Change image"
                                                className="p-1 rounded bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 shadow border border-gray-200 dark:border-gray-600 disabled:opacity-50"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5" />
                                                    <path d="M17.5 3.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 8.5-8.5z" />
                                                </svg>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); handleRemoveImage() }}
                                                disabled={isUploadingImage}
                                                title="Delete image"
                                                className="p-1 rounded bg-white/90 dark:bg-gray-800/90 hover:bg-red-50 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 shadow border border-gray-200 dark:border-gray-600 disabled:opacity-50"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M3 6h18" />
                                                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                                </svg>
                                            </button>
                                        </div>
                                        {isUploadingImage && (
                                            <div className="absolute inset-0 bg-white/70 dark:bg-gray-800/70 flex items-center justify-center rounded">
                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/><circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        <span style={{fontSize: "11px"}}>Upload image</span>
                                    </>
                                )}
                            </div>
                        )
                    })()}
                    {isImagePreviewOpen && (imagePreview || uploadedImageUrl) && (
                        <ImagePreviewLightbox
                            src={imagePreview || uploadedImageUrl || ""}
                            onClose={() => setIsImagePreviewOpen(false)}
                        />
                    )}
                </div>
            </div>

            {/* Organization & Attributes Content (Column 1 - Card 2) */}
            <div className="lg:col-span-4 space-y-4">
                <div className="fr">
                    <div className="fg">
                        <label>Item Type</label>
                        <SearchableSelect
                            options={filteredItemTypeOptions}
                            value={formData.itemType}
                            onChange={(value) => handleItemTypeChange(value)}
                            placeholder="Select Type"
                            loading={isLoadingLookups}
                            disabled={itemTypeLocked}
                        />
                    </div>
                    <div className="fg">
                        <label>UPC Type</label>
                        <SearchableSelect
                            options={UPC_TYPE_OPTIONS}
                            value={formData.upcType}
                            onChange={(value) => handleInputChange("upcType", value)}
                            placeholder="Select UPC Type"
                        />
                    </div>
                </div>
                <div className={`fg ${invalidFieldIds.has("field-department") ? "field-invalid-group" : ""}`} id="field-department">
                    <div className="fg-lbl-row">
                        <label>Department</label>
                        <button type="button" className="addnew-link" onClick={() => openAddDepartmentModal("root")}>+ Add new</button>
                    </div>
                    <SearchableSelect
                        options={rootDepartmentOptions}
                        value={formData.department}
                        placeholder="Select Department"
                        onChange={(value) => handleDepartmentTreePick(value)}
                        loading={isLoadingLookups}
                        disabled={isEditMode ? !canChangeDepartment : false}
                        className={invalidFieldIds.has("field-department") ? "field-invalid-select" : ""}
                    />
                </div>
                {/* Cascading Sub-Department → Sub-Sub-Department */}
                {formData.department && (() => {
                    const subDeptOptions = departmentOptions
                        .filter(o => normDeptId(o.parentId) === normDeptId(formData.department))
                        .map(o => ({ value: o.value, label: o.label }))
                    const currentSub = formData.subDepartment || ""
                    const subSubOptions = currentSub
                        ? departmentOptions
                            .filter(o => normDeptId(o.parentId) === normDeptId(currentSub))
                            .map(o => ({ value: o.value, label: o.label }))
                        : []
                    const currentSubSub = formData.subSubDepartment || ""
                    return (
                        <>
                            {subDeptOptions.length > 0 && (
                            <div className="fg subdept-row">
                                <div className="fg-lbl-row">
                                    <label className="lbl-sub">Sub-Department</label>
                                    <button type="button" className="addnew-link" onClick={() => openAddDepartmentModal("sub")}>+ Add new</button>
                                </div>
                                <SearchableSelect
                                    options={[{ value: "", label: "(None)" }, ...subDeptOptions]}
                                    value={currentSub}
                                    placeholder="Select sub-department"
                                    onChange={(v) => {
                                        handleInputChange("subDepartment", v)
                                        handleInputChange("subSubDepartment", "")
                                        if (v) {
                                            void applyDepartmentDefaults(v)
                                        } else if (formData.department) {
                                            void applyDepartmentDefaults(formData.department)
                                        }
                                    }}
                                />
                            </div>
                            )}
                            {currentSub && subSubOptions.length > 0 && (
                                <div className="fg subdept-row">
                                    <div className="fg-lbl-row">
                                        <label className="lbl-sub">Sub-Sub-Department</label>
                                        <button type="button" className="addnew-link" onClick={() => openAddDepartmentModal("subSub")}>+ Add new</button>
                                    </div>
                                    <SearchableSelect
                                        options={[{ value: "", label: "(None)" }, ...subSubOptions]}
                                        value={currentSubSub}
                                        placeholder="Select sub-sub-department"
                                        onChange={(v) => {
                                            handleInputChange("subSubDepartment", v)
                                            const leaf = v || formData.subDepartment || formData.department
                                            if (leaf) void applyDepartmentDefaults(leaf)
                                        }}
                                    />
                                </div>
                            )}
                        </>
                    )
                })()}
                <div className="fg">
                    <div className="fg-lbl-row">
                        {/* Books-store caption swap: same field, different
                            label — mirrors legacy FrmItems lblManufacturer. */}
                        <label>{isBooks ? "Author / Brand" : "Manufacturer / Brand"}</label>
                        <button type="button" className="addnew-link" onClick={() => setShowAddBrandModal(true)}>+ Add new</button>
                    </div>
                    <SearchableSelect
                        options={manufacturerOptions}
                        value={formData.manufacturer}
                        placeholder="e.g. FIT RITE"
                        onChange={(value) => handleInputChange("manufacturer", value)}
                        loading={isLoadingLookups}
                    />
                </div>
                <div className="fg">
                    <div className="fg-lbl-row">
                        <label>Groups</label>
                        <button
                            type="button"
                            className="addnew-link"
                            onClick={() => {
                                // Focus the Groups input — typing any new value then Enter will add it as a new group pill
                                const input = document.querySelector<HTMLInputElement>(".grp-field .grp-input")
                                if (input) { input.focus() }
                            }}
                            title="Type a name and press Enter to add a new group"
                        >
                            + Add new
                        </button>
                    </div>
                    <GroupPillPicker
                        options={itemGroupOptions.map(g => ({ value: g.value, label: g.label }))}
                        selectedIds={formData.groups.filter(Boolean)}
                        disabled={isEditMode ? !canChangeGroup : false}
                        onChange={(ids) => handleInputChange("groups", ids)}
                        onCreate={(name) => {
                            // Inline add: create a pending option with a temporary id; it'll be persisted server-side on Save
                            const trimmed = name.trim()
                            if (!trimmed) return null
                            // Avoid duplicate by case-insensitive label
                            const existing = itemGroupOptions.find(g => g.label.toLowerCase() === trimmed.toLowerCase())
                            if (existing) return existing.value
                            const tempId = `__new_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
                            const newOption: TreeSelectOption = { value: tempId, label: trimmed, parentId: null }
                            setItemGroupOptions(prev => [...prev, newOption])
                            return tempId
                        }}
                    />
                </div>
                <div className="sdash" />
                <div className="fr">
                    <div className="fg">
                        <label>Units / Measure</label>
                        <div style={{display: "flex", gap: "4px"}}>
                            <Input
                                type="text"
                                value={formData.units}
                                onChange={(e) => handleInputChange("units", e.target.value)}
                                className="inp w-[40%]"
                                placeholder="--"
                            />
                            <SearchableSelect
                                options={MEASURE_OPTIONS}
                                value={formData.measure}
                                placeholder="Select"
                                onChange={(value) => handleInputChange("measure", value)}
                            />
                        </div>
                    </div>
                    <div className="fg">
                        <label>Size</label>
                        <Input
                            type="text"
                            value={formData.size}
                            onChange={(e) => handleInputChange("size", e.target.value)}
                            className="inp w-full"
                            placeholder="--"
                        />
                    </div>
                </div>
                <div className="fr">
                    <div className="fg">
                        <label>Bin / Location</label>
                        <Input
                            id="field-location"
                            type="text"
                            value={formData.location}
                            onChange={(e) => handleInputChange("location", e.target.value)}
                            className="inp w-full"
                            placeholder="Bin location"
                        />
                    </div>
                    <div className="fg">
                        <label>Style No</label>
                        <Input
                            type="text"
                            value={formData.matrix1}
                            onChange={(e) => handleInputChange("matrix1", e.target.value)}
                            className="inp w-full"
                            placeholder="--"
                        />
                    </div>
                </div>
                <div className="sdiv" />
                <div className="tog-group attr-toggles">
                    <label className="tog" style={{ gap: 6 }}>
                        <input
                            type="checkbox"
                            checked={formData.taxable}
                            onChange={(e) => handleInputChange("taxable", e.target.checked)}
                        />
                        Taxable
                        {formData.taxable && (() => {
                            const rateLabel = taxOptions.find(o => o.value === formData.taxableRate)?.label || "from Dept"
                            return (
                                <span
                                    className="taxable-rate-ro"
                                    title="Tax rate is read-only — it is inherited from the item's Department. Edit the Department to change the rate."
                                    aria-label="Taxable rate (read only)"
                                >
                                    <span className="info">i</span>
                                    {rateLabel}
                                </span>
                            )
                        })()}
                    </label>
                    <label className="tog">
                        <input
                            type="checkbox"
                            checked={formData.discountable}
                            onChange={(e) => handleInputChange("discountable", e.target.checked)}
                        />
                        Discountable
                    </label>
                    {/* Food-only flags. The desktop hides these entirely
                        for non-Food stores (FrmItems chkFoodStamp.Visible
                        = StoreType.Food); we do the same so the toggles
                        don't confuse non-grocery users. */}
                    {isFood && (
                        <>
                            <label className="tog">
                                <input
                                    type="checkbox"
                                    checked={formData.foodStamp}
                                    onChange={(e) => handleInputChange("foodStamp", e.target.checked)}
                                />
                                Food Stamp
                            </label>
                            <label className="tog">
                                <input
                                    type="checkbox"
                                    checked={formData.wic}
                                    onChange={(e) => handleInputChange("wic", e.target.checked)}
                                />
                                WIC
                            </label>
                        </>
                    )}
                    <label className="tog">
                        <input
                            type="checkbox"
                            checked={(formData as unknown as Record<string, unknown>).printWeightOnLabel as boolean || false}
                            onChange={(e) => handleInputChange("printWeightOnLabel" as keyof ItemFormData, e.target.checked)}
                        />
                        UPC + Weight
                    </label>
                    <label className="tog">
                        <input
                            type="checkbox"
                            checked={!!(formData as unknown as Record<string, boolean>).ds}
                            onChange={(e) => handleInputChange("ds" as keyof ItemFormData, e.target.checked)}
                        />
                        DS
                    </label>
                </div>
            </div>

            {/* Right Column - Cost & Pricing (v8.5 redesign) */}
            <div className="lg:col-span-8 space-y-3">
                {/* ── Define Cost By: Case / Piece segmented toggle ── */}
                <div className="pricing-seg-row">
                    <span className="pricing-seg-label">Define Cost By:</span>
                    <div className="pricing-seg">
                        <button
                            type="button"
                            className={`pricing-seg-btn${formData.setPricesForCase ? " on" : ""}`}
                            onClick={() => {
                                handleInputChange("setPricesForCase", true)
                                handleInputChange("usuallySoldIn", "Cases")
                                const cost = formData.lastCaseNetCost
                                handleInputChange("profitMargin", calcMargin(formData.price, cost))
                                handleInputChange("markup", calcMarkup(formData.price, cost))
                            }}
                        >Case</button>
                        <button
                            type="button"
                            className={`pricing-seg-btn${!formData.setPricesForCase ? " on" : ""}`}
                            onClick={() => {
                                handleInputChange("setPricesForCase", false)
                                handleInputChange("usuallySoldIn", "Pieces")
                                const cost = formData.cost
                                handleInputChange("profitMargin", calcMargin(formData.price, cost))
                                handleInputChange("markup", calcMarkup(formData.price, cost))
                            }}
                        >Piece</button>
                    </div>
                </div>

                {/* ── Cost breakdown inline row — order swaps with Case/Piece toggle ── */}
                {(() => {
                    // Case mode: edit case cost + qty → PC cost is derived. Piece mode: edit PC + qty → case cost is derived.
                    const caseMode = formData.setPricesForCase
                    const costFieldDisabled = isEditMode ? !canChangeCost : false
                    const caseCostField = (
                        <div className="fg" key="case-cost">
                            <label>Case Cost</label>
                            <div className="px" data-p="$">
                                {!caseMode ? (
                                    <Input
                                        id="field-case-cost"
                                        type="text"
                                        inputMode="decimal"
                                        value={
                                            canShowCost
                                                ? formatMoneyTypedFromNumber(coerceItemNumber(formData.lastCaseNetCost))
                                                : ""
                                        }
                                        onFocus={focusSelectIfNumericZero}
                                        onChange={(e) => {
                                            const caseCost = parseMoneyTypedInput(e.target.value)
                                            handleInputChange("lastCaseNetCost", caseCost)
                                            if (formData.caseQty > 0) {
                                                const pieceCost = parseFloat((caseCost / formData.caseQty).toFixed(2))
                                                handleInputChange("cost", pieceCost)
                                                const effCost = formData.setPricesForCase ? caseCost : pieceCost
                                                if (formData.lockMarkup) {
                                                    const newPrice = calcPriceFromMarkup(effCost, formData.markup)
                                                    handleInputChange("price", newPrice)
                                                    handleInputChange("profitMargin", calcMargin(newPrice, effCost))
                                                } else {
                                                    handleInputChange("profitMargin", calcMargin(formData.price, effCost))
                                                    handleInputChange("markup", calcMarkup(formData.price, effCost))
                                                }
                                            }
                                        }}
                                        className={`inp w-full transition-colors duration-150 ${
                                            derivedCostInlineWarn === "case" ? "!bg-gray-200 dark:!bg-gray-700" : ""
                                        }`}
                                        placeholder={canShowCost ? "0.00" : "***"}
                                        readOnly
                                        disabled={costFieldDisabled}
                                        onBlur={clearDerivedReadOnlyGray}
                                        onKeyDown={(e) =>
                                            handleDerivedReadOnlyKeyDown(e, {
                                                readonly: true,
                                                disabled: costFieldDisabled,
                                                which: "case",
                                            })
                                        }
                                    />
                                ) : (
                                    <Input
                                        id="field-case-cost"
                                        type="text"
                                        inputMode="decimal"
                                        value={
                                            canShowCost
                                                ? formatMoneyTypedFromNumber(coerceItemNumber(formData.lastCaseNetCost))
                                                : ""
                                        }
                                        onFocus={focusSelectIfNumericZero}
                                        onChange={(e) => {
                                            const caseCost = parseMoneyTypedInput(e.target.value)
                                            handleInputChange("lastCaseNetCost", caseCost)
                                            if (formData.caseQty > 0) {
                                                const pieceCost = parseFloat((caseCost / formData.caseQty).toFixed(2))
                                                handleInputChange("cost", pieceCost)
                                                const effCost = formData.setPricesForCase ? caseCost : pieceCost
                                                if (formData.lockMarkup) {
                                                    const newPrice = calcPriceFromMarkup(effCost, formData.markup)
                                                    handleInputChange("price", newPrice)
                                                    handleInputChange("profitMargin", calcMargin(newPrice, effCost))
                                                } else {
                                                    handleInputChange("profitMargin", calcMargin(formData.price, effCost))
                                                    handleInputChange("markup", calcMarkup(formData.price, effCost))
                                                }
                                            }
                                        }}
                                        className="inp w-full"
                                        placeholder={canShowCost ? "0.00" : "***"}
                                        readOnly={false}
                                        disabled={costFieldDisabled}
                                    />
                                )}
                            </div>
                        </div>
                    )
                    const qtyField = (
                        // id used by navigateToField + fieldIdToSectionId so
                        // validation messages targeting Case Qty can focus it.
                        <div className={`fg ${invalidFieldIds.has("field-case-qty") ? "field-invalid-group" : ""}`} key="qty" id="field-case-qty">
                            <label>Case Qty</label>
                            <Input
                                type="text"
                                inputMode="numeric"
                                value={formatQtyTypedFromNumber(coerceItemNumber(formData.caseQty))}
                                onFocus={focusSelectIfNumericZero}
                                onChange={(e) => {
                                    const qty = parseQtyTypedInput(e.target.value)
                                    handleInputChange("caseQty", qty)
                                    if (qty <= 0) return
                                    if (caseMode) {
                                        const pieceCost = parseFloat((formData.lastCaseNetCost / qty).toFixed(2))
                                        handleInputChange("cost", pieceCost)
                                        const effCost = formData.lastCaseNetCost
                                        handleInputChange("profitMargin", calcMargin(formData.price, effCost))
                                        handleInputChange("markup", calcMarkup(formData.price, effCost))
                                    } else {
                                        const caseNet = parseFloat((formData.cost * qty).toFixed(2))
                                        handleInputChange("lastCaseNetCost", caseNet)
                                        const effCost = formData.cost
                                        handleInputChange("profitMargin", calcMargin(formData.price, effCost))
                                        handleInputChange("markup", calcMarkup(formData.price, effCost))
                                    }
                                    // Clear the invalid state as soon as the user starts typing.
                                    if (invalidFieldIds.has("field-case-qty")) {
                                        setInvalidFieldIds((prev) => {
                                            const next = new Set(prev)
                                            next.delete("field-case-qty")
                                            return next
                                        })
                                    }
                                }}
                                className={`inp w-full ${invalidFieldIds.has("field-case-qty") ? "field-invalid-input" : ""}`}
                                placeholder="1"
                                error={invalidFieldIds.has("field-case-qty")}
                            />
                        </div>
                    )
                    const pcCostField = (
                        <div className="fg" key="pc-cost">
                            <label>PC Cost</label>
                            <div className="px" data-p="$">
                                {caseMode ? (
                                    <Input
                                        id="field-cost"
                                        type="text"
                                        inputMode="decimal"
                                        value={
                                            canShowCost
                                                ? formatMoneyTypedFromNumber(coerceItemNumber(formData.cost))
                                                : ""
                                        }
                                        onChange={(e) => {
                                            const pc = parseMoneyTypedInput(e.target.value)
                                            handleCostChangeWithLockMarkup(pc)
                                        }}
                                        className={`inp w-full transition-colors duration-150 ${
                                            derivedCostInlineWarn === "pc" ? "!bg-gray-200 dark:!bg-gray-700" : ""
                                        }`}
                                        placeholder={canShowCost ? "0.00" : "***"}
                                        readOnly
                                        disabled={costFieldDisabled}
                                        onBlur={clearDerivedReadOnlyGray}
                                        onFocus={focusSelectIfNumericZero}
                                        onKeyDown={(e) =>
                                            handleDerivedReadOnlyKeyDown(e, {
                                                readonly: true,
                                                disabled: costFieldDisabled,
                                                which: "pc",
                                            })
                                        }
                                    />
                                ) : (
                                    <Input
                                        id="field-cost"
                                        type="text"
                                        inputMode="decimal"
                                        value={
                                            canShowCost
                                                ? formatMoneyTypedFromNumber(coerceItemNumber(formData.cost))
                                                : ""
                                        }
                                        onFocus={focusSelectIfNumericZero}
                                        onChange={(e) => {
                                            const pc = parseMoneyTypedInput(e.target.value)
                                            handleCostChangeWithLockMarkup(pc)
                                        }}
                                        className="inp w-full"
                                        placeholder={canShowCost ? "0.00" : "***"}
                                        readOnly={false}
                                        disabled={costFieldDisabled}
                                    />
                                )}
                            </div>
                        </div>
                    )
                    // Case mode: [Case Cost] / [Qty] = [PC Cost]
                    // Piece mode: [PC Cost] × [Qty] = [Case Cost]
                    return (
                        <div className="pricing-row3">
                            {caseMode ? caseCostField : pcCostField}
                            <div className="pricing-row3-op">{caseMode ? "/" : "×"}</div>
                            {qtyField}
                            <div className="pricing-row3-op">=</div>
                            {caseMode ? pcCostField : caseCostField}
                        </div>
                    )
                })()}

                {/* ── Regular Price / Margin / Markup with Lock ── */}
                <div className="pricing-row4">
                    <div className="fg">
                        <label>Regular Price</label>
                        <div className="px" data-p="$">
                            <Input
                                id="field-price"
                                type="text"
                                inputMode="decimal"
                                value={formatMoneyTypedFromNumber(coerceItemNumber(formData.price))}
                                onFocus={focusSelectIfNumericZero}
                                onChange={(e) => {
                                    const newPrice = parseMoneyTypedInput(e.target.value)
                                    handleInputChange("price", newPrice)
                                    const cost = getEffectiveCost(formData)
                                    handleInputChange("profitMargin", calcMargin(newPrice, cost))
                                    handleInputChange("markup", calcMarkup(newPrice, cost))
                                    if (formData.listPrice > 0) {
                                        handleInputChange("markdownPrice", parseFloat(((1 - newPrice / formData.listPrice) * 100).toFixed(2)))
                                    }
                                }}
                                className="inp w-full"
                                placeholder="0.00"
                                disabled={isEditMode ? !canChangePrice : false}
                            />
                        </div>
                    </div>
                    <div className="fg">
                        <label>Margin %</label>
                        <div className="sx" data-s="%">
                            <Input
                                id="field-margin"
                                type="text"
                                inputMode="decimal"
                                value={formatMoneyTypedFromNumber(coerceItemNumber(formData.profitMargin))}
                                onFocus={focusSelectIfNumericZero}
                                onChange={(e) => {
                                    const margin = parseMoneyTypedInput(e.target.value)
                                    handleInputChange("profitMargin", margin)
                                    const cost = getEffectiveCost(formData)
                                    const newPrice = calcPriceFromMargin(cost, margin)
                                    handleInputChange("price", newPrice)
                                    handleInputChange("markup", calcMarkup(newPrice, cost))
                                }}
                                className="inp w-full"
                                placeholder="0"
                            />
                        </div>
                    </div>
                    <div className="fg">
                        <label>Markup %</label>
                        <div className="sx" data-s="%">
                            <Input
                                id="field-markup"
                                type="text"
                                inputMode="decimal"
                                value={formatMoneyTypedFromNumber(coerceItemNumber(formData.markup))}
                                onFocus={focusSelectIfNumericZero}
                                onChange={(e) => {
                                    const mu = parseMoneyTypedInput(e.target.value)
                                    handleInputChange("markup", mu)
                                    const cost = getEffectiveCost(formData)
                                    const newPrice = calcPriceFromMarkup(cost, mu)
                                    handleInputChange("price", newPrice)
                                    handleInputChange("profitMargin", calcMargin(newPrice, cost))
                                }}
                                className="inp w-full"
                                placeholder="0"
                            />
                        </div>
                    </div>
                    <label className="tog pricing-lock">
                        <input
                            type="checkbox"
                            checked={formData.lockMarkup}
                            onChange={(e) => handleInputChange("lockMarkup", e.target.checked)}
                        />
                        Lock
                    </label>
                </div>

                {/* ── Case & Package Pricing sub-section ── */}
                <div className="pricing-sub">
                    <div className="pricing-sub-hdr">Case &amp; Package Pricing</div>
                    <div className="pricing-sub-body">
                        <div className="pricing-row3b">
                            <div className="fg">
                                <label>Case Price</label>
                                <div className="px" data-p="$">
                                    <Input
                                        type="text"
                                        inputMode="decimal"
                                        value={formatMoneyTypedFromNumber(coerceItemNumber(formData.casePrice))}
                                        onFocus={focusSelectIfNumericZero}
                                        onChange={(e) => {
                                            const cp = parseMoneyTypedInput(e.target.value)
                                            handleInputChange("casePrice", cp)
                                            handleInputChange("caseProfitMargin", calcCaseMargin(cp, formData.lastCaseNetCost))
                                            handleInputChange("caseMarkup", calcCaseMarkup(cp, formData.caseQty, formData.cost))
                                        }}
                                        className="inp w-full"
                                        placeholder="0.00"
                                        disabled={isEditMode ? !canChangePrice : false}
                                    />
                                </div>
                            </div>
                            <div className="fg">
                                <label>Qty <span className="pricing-lock-badge">Locked</span></label>
                                <Input
                                    type="text"
                                    inputMode="numeric"
                                    value={formatQtyTypedFromNumber(coerceItemNumber(formData.caseQty))}
                                    onFocus={focusSelectIfNumericZero}
                                    onChange={(e) => handleInputChange("caseQty", parseQtyTypedInput(e.target.value))}
                                    className="inp w-full"
                                    placeholder="1"
                                />
                            </div>
                            <div className="fg">
                                <label>Case Margin %</label>
                                <div className="sx" data-s="%">
                                    <Input
                                        type="text"
                                        inputMode="decimal"
                                        value={formatMoneyTypedFromNumber(coerceItemNumber(formData.caseProfitMargin))}
                                        onFocus={focusSelectIfNumericZero}
                                        onChange={(e) => {
                                            const cm = parseMoneyTypedInput(e.target.value)
                                            handleInputChange("caseProfitMargin", cm)
                                            if (cm < 100 && formData.lastCaseNetCost > 0) {
                                                const newCp = parseFloat((formData.lastCaseNetCost / (1 - cm / 100)).toFixed(2))
                                                handleInputChange("casePrice", newCp)
                                                handleInputChange("caseMarkup", calcCaseMarkup(newCp, formData.caseQty, formData.cost))
                                            }
                                        }}
                                        className="inp w-full"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pricing-row3b">
                            <div className="fg">
                                <label>Pkg Price</label>
                                <div className="px" data-p="$">
                                    <Input
                                        type="text"
                                        inputMode="decimal"
                                        value={formatMoneyTypedFromNumber(
                                            coerceItemNumber((formData as unknown as Record<string, number>).regPkgPrice),
                                        )}
                                        onFocus={focusSelectIfNumericZero}
                                        onChange={(e) =>
                                            handleInputChange(
                                                "regPkgPrice" as keyof ItemFormData,
                                                parseMoneyTypedInput(e.target.value),
                                            )
                                        }
                                        className="inp w-full"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="fg">
                                <label>Qty</label>
                                <Input
                                    type="text"
                                    inputMode="numeric"
                                    value={formatQtyTypedFromNumber(
                                        coerceItemNumber((formData as unknown as Record<string, number>).regPkgQty),
                                    )}
                                    onFocus={focusSelectIfNumericZero}
                                    onChange={(e) =>
                                        handleInputChange("regPkgQty" as keyof ItemFormData, parseQtyTypedInput(e.target.value))
                                    }
                                    className="inp w-full"
                                    placeholder="—"
                                />
                            </div>
                            <div className="fg">
                                <label>Pkg Margin %</label>
                                <div className="sx" data-s="%">
                                    <Input
                                        type="text"
                                        inputMode="decimal"
                                        value={formatMoneyTypedFromNumber(
                                            coerceItemNumber((formData as unknown as Record<string, number>).regPkgMargin),
                                        )}
                                        onFocus={focusSelectIfNumericZero}
                                        onChange={(e) =>
                                            handleInputChange(
                                                "regPkgMargin" as keyof ItemFormData,
                                                parseMoneyTypedInput(e.target.value),
                                            )
                                        }
                                        className="inp w-full"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pricing-auto-row">
                            <label className="tog">
                                <input
                                    type="checkbox"
                                    checked={!!(formData as unknown as Record<string, boolean>).autoDetectCaseByPurchaseQty}
                                    onChange={(e) => handleInputChange("autoDetectCaseByPurchaseQty" as keyof ItemFormData, e.target.checked)}
                                />
                                Auto Detect Case by Purchase Qty
                            </label>
                            <label className="tog">
                                <input
                                    type="checkbox"
                                    checked={!!(formData as unknown as Record<string, boolean>).autoDetectPkgByPurchaseQty}
                                    onChange={(e) => handleInputChange("autoDetectPkgByPurchaseQty" as keyof ItemFormData, e.target.checked)}
                                />
                                Auto Detect Pkg by Purchase Qty
                            </label>
                        </div>
                    </div>
                </div>

                {/* ── Advanced Pricing & More — v8.5 target (case flag, future price, list/markdown/tare, customer code, tag-alongs) ── */}
                <details className="adv item-detail-v6 pricing-advanced">
                    <summary>
                        <div className="flex flex-col gap-0.5 w-full min-w-0">
                            <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-200 shrink-0">Advanced Pricing &amp; More</h3>
                            {lastPriceChangeDate && (
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-normal leading-snug break-words">
                                    Last modified {lastPriceChangeDate}
                                    {lastModifiedByUser ? ` · ${lastModifiedByUser}` : ""}
                                </span>
                            )}
                        </div>
                    </summary>
                    <div className="adv-body">
                        {/* This item is a case — enables case-label printing */}
                        <label className="tog tog-lg">
                            <input
                                type="checkbox"
                                checked={!!(formData as unknown as Record<string, boolean>).isCaseItem}
                                onChange={(e) => handleInputChange("isCaseItem" as keyof ItemFormData, e.target.checked)}
                            />
                            This item is a case.
                        </label>
                        {!!(formData as unknown as Record<string, boolean>).isCaseItem && (
                            <div className="case-note">Used for printing case labels, etc.</div>
                        )}
                        <div className="sdash" />

                        {/* Future new price + date effective */}
                        <div className="fr">
                            <div className="fg">
                                <label>Future New Price</label>
                                <div className="px" data-p="$">
                                    <Input
                                        type="number"
                                        value={formData.newPrice}
                                        onChange={(e) => handleInputChange("newPrice", parseFloat(e.target.value) || 0)}
                                        step={0.01}
                                        className="inp w-full"
                                        placeholder="—"
                                    />
                                </div>
                            </div>
                            <div className="fg">
                                <label>Date Effective</label>
                                <Flatpickr
                                    value={formData.dateEffective || undefined}
                                    onChange={(dates: Date[]) => {
                                        handleInputChange("dateEffective", dates[0] ? dates[0].toISOString().split("T")[0] : "")
                                    }}
                                    options={{ dateFormat: "Y-m-d", allowInput: true }}
                                    placeholder="mm/dd/yyyy"
                                    className="inp w-full"
                                />
                            </div>
                        </div>

                        {/* List Price | Markdown % | Tare */}
                        <div className="fr3">
                            <div className="fg">
                                <label>List Price</label>
                                <div className="px" data-p="$">
                                    <Input
                                        type="number"
                                        value={formData.listPrice}
                                        onChange={(e) => {
                                            const lp = parseFloat(e.target.value) || 0
                                            handleInputChange("listPrice", lp)
                                            if (formData.markdownPrice !== 0 && lp > 0) {
                                                const newPrice = parseFloat((lp - (lp * formData.markdownPrice / 100)).toFixed(2))
                                                handleInputChange("price", newPrice)
                                                const cost = getEffectiveCost(formData)
                                                handleInputChange("profitMargin", calcMargin(newPrice, cost))
                                                handleInputChange("markup", calcMarkup(newPrice, cost))
                                            }
                                        }}
                                        step={0.01}
                                        className="inp w-full"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="fg">
                                <label>Markdown %</label>
                                <div className="sx" data-s="%">
                                    <Input
                                        type="number"
                                        value={formData.markdownPrice}
                                        onChange={(e) => {
                                            const md = parseFloat(e.target.value) || 0
                                            handleInputChange("markdownPrice", md)
                                            if (formData.listPrice > 0) {
                                                const newPrice = parseFloat((formData.listPrice - (formData.listPrice * md / 100)).toFixed(2))
                                                handleInputChange("price", newPrice)
                                                const cost = getEffectiveCost(formData)
                                                handleInputChange("profitMargin", calcMargin(newPrice, cost))
                                                handleInputChange("markup", calcMarkup(newPrice, cost))
                                            }
                                        }}
                                        step={0.01}
                                        className="inp w-full"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="fg">
                                <label>Tare</label>
                                <Input
                                    type="text"
                                    value={formData.tare}
                                    onChange={(e) => handleInputChange("tare", e.target.value)}
                                    className="inp w-full"
                                    placeholder="—"
                                />
                            </div>
                        </div>

                        {/* Customer code */}
                        <div className="fg">
                            <label>Customer Code</label>
                            <Input
                                type="text"
                                value={formData.customerCode}
                                onChange={(e) => handleInputChange("customerCode", e.target.value)}
                                className="inp w-full"
                                placeholder="—"
                            />
                        </div>

                        {/* Tag Along 1 / 2 / 3 */}
                        <div className="fr3">
                            {[1, 2, 3].map((n) => {
                                const key = `tagAlong${n}` as keyof ItemFormData
                                const value = (formData as unknown as Record<string, string>)[key as unknown as string] || ""
                                return (
                                    <div className="fg" key={key as string}>
                                        <label>Tag Along {n}</label>
                                        <select
                                            className="sel"
                                            value={value}
                                            onChange={(e) => handleInputChange(key, e.target.value)}
                                        >
                                            <option value="">— None —</option>
                                        </select>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </details>

                {/* Legacy Pricing Section — REMOVED: fields now live in the new segmented pricing UI above */}
                {false && <details
                    className="adv item-detail-v6"
                    open={isPricingSectionOpen}
                    onToggle={(e) => {
                        setIsPricingSectionOpen((e.currentTarget as HTMLDetailsElement).open)
                    }}
                >
                    <summary>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-200 uppercase tracking-wider">Pricing</h3>
                            {lastPriceChangeDate && (
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-normal normal-case">
                                    - last modified at {lastPriceChangeDate}{lastModifiedByUser ? ` - by: ${lastModifiedByUser}` : ""}
                                </span>
                            )}
                        </div>
                    </summary>
                    <div className="adv-body">
                        <div className="space-y-3">
                            {/* Top row: Set Prices for Case + Lock Markup toggle */}
                            <div className="flex items-center gap-6">
                                <Checkbox
                                    checked={formData.setPricesForCase}
                                    onChange={(checked) => {
                                        handleInputChange("setPricesForCase", checked)
                                        handleInputChange("usuallySoldIn", checked ? "Cases" : "Pieces")
                                        let cost: number
                                        if (checked) {
                                            cost = formData.lastCaseNetCost
                                        } else {
                                            if (formData.lastCaseNetCostEnabled && formData.caseQty > 0 && formData.lastCaseNetCost > 0) {
                                                cost = parseFloat((formData.lastCaseNetCost / formData.caseQty).toFixed(2))
                                            } else {
                                                cost = formData.cost
                                            }
                                        }
                                        handleInputChange("profitMargin", calcMargin(formData.price, cost))
                                        handleInputChange("markup", calcMarkup(formData.price, cost))
                                    }}
                                    label="Set prices for case"
                                />
                                {/* #48: Lock Markup toggle — when ON, cost changes auto-update price to maintain markup */}
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        checked={formData.lockMarkup}
                                        onChange={(checked) => handleInputChange("lockMarkup", checked)}
                                        label=""
                                    />
                                    <span className={`text-xs font-medium ${formData.lockMarkup ? "text-amber-600 dark:text-amber-400" : "text-gray-500 dark:text-gray-400"}`}>
                                        {formData.lockMarkup ? "🔒 Lock Markup" : "Lock Markup"}
                                    </span>
                                </div>
                            </div>

                            {/* Price row: Price | Profit Margin % | Markup % */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <FormRow label="Price:" prefix="$">
                                    <Input
                                        type="number"
                                        value={formData.price}
                                        onChange={(e) => {
                                            const newPrice = parseFloat(e.target.value) || 0
                                            handleInputChange("price", newPrice)
                                            const cost = getEffectiveCost(formData)
                                            handleInputChange("profitMargin", calcMargin(newPrice, cost))
                                            handleInputChange("markup", calcMarkup(newPrice, cost))
                                            if (formData.listPrice > 0) {
                                                handleInputChange("markdownPrice", parseFloat(((1 - newPrice / formData.listPrice) * 100).toFixed(2)))
                                            }
                                        }}
                                        step={0.01}
                                        placeholder="$0.00"
                                        disabled={isEditMode ? !canChangePrice : false}
                                    />
                                </FormRow>
                                <FormRow label="Profit Margin %:" suffix="%">
                                    <Input
                                        type="number"
                                        value={formData.profitMargin}
                                        onChange={(e) => {
                                            const margin = parseFloat(e.target.value) || 0
                                            handleInputChange("profitMargin", margin)
                                            const cost = getEffectiveCost(formData)
                                            const newPrice = calcPriceFromMargin(cost, margin)
                                            handleInputChange("price", newPrice)
                                            handleInputChange("markup", calcMarkup(newPrice, cost))
                                            if (formData.listPrice > 0) {
                                                handleInputChange("markdownPrice", parseFloat(((1 - newPrice / formData.listPrice) * 100).toFixed(2)))
                                            }
                                        }}
                                        step={0.01}
                                        placeholder="0 %"
                                    />
                                </FormRow>
                                <FormRow label="Markup %:" suffix="%">
                                    <Input
                                        type="number"
                                        value={formData.markup}
                                        onChange={(e) => {
                                            const mu = parseFloat(e.target.value) || 0
                                            handleInputChange("markup", mu)
                                            const cost = getEffectiveCost(formData)
                                            const newPrice = calcPriceFromMarkup(cost, mu)
                                            handleInputChange("price", newPrice)
                                            handleInputChange("profitMargin", calcMargin(newPrice, cost))
                                            if (formData.listPrice > 0) {
                                                handleInputChange("markdownPrice", parseFloat(((1 - newPrice / formData.listPrice) * 100).toFixed(2)))
                                            }
                                        }}
                                        step={0.01}
                                        placeholder="0 %"
                                    />
                                </FormRow>
                            </div>

                            {/* Case Price row: Case Price | Profit Margin % | Markup % */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <FormRow label="Case Price:" prefix="$">
                                    <Input
                                        type="number"
                                        value={formData.casePrice}
                                        onChange={(e) => {
                                            const cp = parseFloat(e.target.value) || 0
                                            handleInputChange("casePrice", cp)
                                            handleInputChange("caseProfitMargin", calcCaseMargin(cp, formData.lastCaseNetCost))
                                            handleInputChange("caseMarkup", calcCaseMarkup(cp, formData.caseQty, formData.cost))
                                        }}
                                        step={0.01}
                                        placeholder="$0.00"
                                        disabled={isEditMode ? !canChangePrice : false}
                                    />
                                </FormRow>
                                <FormRow label="Case Margin %:" suffix="%">
                                    <Input
                                        type="number"
                                        value={formData.caseProfitMargin}
                                        onChange={(e) => {
                                            const cm = parseFloat(e.target.value) || 0
                                            handleInputChange("caseProfitMargin", cm)
                                            if (cm < 100 && formData.lastCaseNetCost > 0) {
                                                const newCp = parseFloat((formData.lastCaseNetCost / (1 - cm / 100)).toFixed(2))
                                                handleInputChange("casePrice", newCp)
                                                handleInputChange("caseMarkup", calcCaseMarkup(newCp, formData.caseQty, formData.cost))
                                            }
                                        }}
                                        step={0.01}
                                        placeholder="0 %"
                                    />
                                </FormRow>
                                <FormRow label="Case Markup %:" suffix="%">
                                    <Input
                                        type="number"
                                        value={formData.caseMarkup}
                                        onChange={(e) => {
                                            const cmu = parseFloat(e.target.value) || 0
                                            handleInputChange("caseMarkup", cmu)
                                            if (formData.cost > 0 && formData.caseQty > 0) {
                                                const pricePerPiece = formData.cost + (formData.cost * cmu / 100)
                                                const newCp = parseFloat((pricePerPiece * formData.caseQty).toFixed(2))
                                                handleInputChange("casePrice", newCp)
                                                handleInputChange("caseProfitMargin", calcCaseMargin(newCp, formData.lastCaseNetCost))
                                            }
                                        }}
                                        step={0.01}
                                        placeholder="0 %"
                                    />
                                </FormRow>
                            </div>
                        </div>
                    </div>
                </details>}

            </div>
        </div>
    )

    // Render Sales Tab
    const renderSalesTab = () => (
        <div className="adv item-detail-v6 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 shadow-sm overflow-hidden">
            {/* Sales Info */}
            <div className="item-detail-v6-adv-summary">
                <span>Sales info</span>
            </div>
            <div className="adv-body">
                <div className="grid grid-cols-2 gap-4">
                    {[
                        { label: "MTD Qty", field: "mtdQty" as const, type: "text" },
                        { label: "MTD Amount", field: "mtdAmount" as const, type: "number" },
                    ].map(({ label, field, type }) => (
                        <FormRow key={field} label={label}>
                            <Input
                                type={type}
                                value={formData[field]}
                                onChange={(e) =>
                                    handleInputChange(field, type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)
                                }
                                placeholder={type === "number" ? "$0.00" : ""}
                            />
                        </FormRow>
                    ))}
                </div>
                <div className="h-px bg-gray-100 dark:bg-gray-700" />
                <div className="grid grid-cols-2 gap-4">
                    {[
                        { label: "PTD Qty", field: "ptdQty" as const, type: "text" },
                        { label: "PTD Amount", field: "ptdAmount" as const, type: "number" },
                    ].map(({ label, field, type }) => (
                        <FormRow key={field} label={label}>
                            <Input
                                type={type}
                                value={formData[field]}
                                onChange={(e) =>
                                    handleInputChange(field, type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)
                                }
                                placeholder={type === "number" ? "$0.00" : ""}
                            />
                        </FormRow>
                    ))}
                </div>
                <div className="h-px bg-gray-100 dark:bg-gray-700" />
                <div className="grid grid-cols-2 gap-4">
                    {[
                        { label: "YTD Qty", field: "ytdQty" as const, type: "text" },
                        { label: "YTD Amount", field: "ytdAmount" as const, type: "number" },
                    ].map(({ label, field, type }) => (
                        <FormRow key={field} label={label}>
                            <Input
                                type={type}
                                value={formData[field]}
                                onChange={(e) =>
                                    handleInputChange(field, type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)
                                }
                                placeholder={type === "number" ? "$0.00" : ""}
                            />
                        </FormRow>
                    ))}
                </div>
                <div className="h-px bg-gray-100 dark:bg-gray-700" />
                <div className="grid grid-cols-2 gap-4">
                    {[
                        { label: "MTD Return Qty", field: "mtdReturnQty" as const },
                        { label: "PTD Return Qty", field: "ptdReturnQty" as const },
                        { label: "YTD Return Qty", field: "ytdReturnQty" as const },
                    ].map(({ label, field }) => (
                        <FormRow key={field} label={label}>
                            <Input type="text" value={formData[field]} onChange={(e) => handleInputChange(field, e.target.value)} />
                        </FormRow>
                    ))}
                </div>
            </div>

            {/* Inventory */}
            <div className="item-detail-v6-adv-summary">
                <span>INVENTORY</span>
            </div>
            <div className="adv-body">
                <div className="grid grid-cols-2 gap-4">
                    {[
                        { label: "Average Cost", field: "averageCost" as const },
                        { label: "On Hand", field: "onHand" as const },
                        { label: "On Order", field: "onOrder" as const },
                        { label: "On Transfer Order", field: "onTransferOrder" as const },
                        { label: "On Sale Order", field: "onSaleOrder" as const },
                    ].map(({ label, field }) => (
                        <FormRow key={field} label={label}>
                            <Input
                                type="number"
                                value={formData[field]}
                                onChange={(e) => handleInputChange(field, parseFloat(e.target.value) || 0)}
                                step={0.01}
                                placeholder={field === "averageCost" ? "$0.00" : "0.00"}
                            />
                        </FormRow>
                    ))}
                </div>
                <div className="h-px bg-gray-100 dark:bg-gray-700" />
                <div className="grid grid-cols-2 gap-4">
                    {[
                        { label: "Reorder Point", field: "reorderPoint" as const },
                        { label: "Restock Level", field: "restockLevel" as const },
                    ].map(({ label, field }) => (
                        <FormRow key={field} label={label}>
                            <Input
                                type="number"
                                value={formData[field]}
                                onChange={(e) => handleInputChange(field, parseInt(e.target.value) || 0)}
                                placeholder="0"
                            />
                        </FormRow>
                    ))}
                </div>
            </div>
        </div>
    )

    // Render Standard Sale Type Form
    const renderStandardForm = () => (
        <div className="space-y-4">
            {/* Row 1: Special Price, Profit Margin %, Markup % */}
            <div className="grid grid-cols-3 gap-3">
                <FormRow label="Special Price" prefix="$">
                    <Input
                        id="field-sale-price"
                        type="number"
                        value={formData.stdPrice}
                        onChange={(e) => handleStdPriceChange(parseFloat(e.target.value) || 0)}
                        step={0.01}
                        placeholder="$0.00"
                        disabled={isEditMode ? !canAssignSpecialPrice : false}
                    />
                </FormRow>
                <FormRow label="Profit Margin %" suffix="%">
                    <Input
                        type="number"
                        value={formData.stdMargin}
                        onChange={(e) => {
                            const margin = parseFloat(e.target.value) || 0
                            handleInputChange("stdMargin", margin)
                            const cost = getSpecialsCost(formData)
                            const newPrice = calcPriceFromMargin(cost, margin)
                            handleInputChange("stdPrice", newPrice)
                            handleInputChange("stdMarkup", calcMarkup(newPrice, cost))
                        }}
                        step={0.01}
                        placeholder="0.00"
                    />
                </FormRow>
                <FormRow label="Markup %" suffix="%">
                    <Input
                        type="number"
                        value={formData.stdMarkup}
                        onChange={(e) => {
                            const markup = parseFloat(e.target.value) || 0
                            handleInputChange("stdMarkup", markup)
                            const cost = getSpecialsCost(formData)
                            const newPrice = calcPriceFromMarkup(cost, markup)
                            handleInputChange("stdPrice", newPrice)
                            handleInputChange("stdMargin", calcMargin(newPrice, cost))
                        }}
                        step={0.01}
                        placeholder="0.00"
                    />
                </FormRow>
            </div>
            {/* Row 2: Minimum Total Sale, Max Qty, Min Qty */}
            <div className="grid grid-cols-3 gap-3">
                <FormRow label="Minimum Total Sale" prefix="$">
                    <Input
                        type="number"
                        value={formData.stdMinTotal}
                        onChange={(e) => handleInputChange("stdMinTotal", parseFloat(e.target.value) || 0)}
                        step={0.01}
                        placeholder="$0.00"
                    />
                </FormRow>
                <FormRow label="Max Qty">
                    <Input
                        type="number"
                        value={formData.stdMaxQty}
                        onChange={(e) => handleInputChange("stdMaxQty", parseInt(e.target.value) || 0)}
                        placeholder="0"
                    />
                </FormRow>
                <FormRow label="Min Qty">
                    <Input
                        type="number"
                        value={formData.stdMinQty}
                        onChange={(e) => handleInputChange("stdMinQty", parseInt(e.target.value) || 0)}
                        placeholder="0"
                    />
                </FormRow>
            </div>
            {/* Row 3: Assign Date checkbox */}
            <div className="flex items-center gap-2">
                <Checkbox
                    id="stdAssignDate"
                    checked={formData.stdAssignDate}
                    onChange={(checked) => handleInputChange("stdAssignDate", checked)}
                />
                <Label htmlFor="stdAssignDate" className="text-sm text-gray-700 dark:text-gray-300">Assign Date</Label>
            </div>
            {/* Row 4: From/To dates */}
            <div className="grid grid-cols-2 gap-3">
                <FormRow label="From">
                    <Flatpickr
                        value={formData.stdFromDate || undefined}
                        onChange={(dates: Date[]) => {
                            handleInputChange("stdFromDate", dates[0] ? dates[0].toISOString().split("T")[0] : "")
                        }}
                        options={{ dateFormat: "Y-m-d", allowInput: true }}
                        disabled={!formData.stdAssignDate}
                        placeholder="Select date"
                        className="h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:focus:border-brand-800 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                    />
                </FormRow>
                <div className="flex items-end gap-3">
                    <div className="flex-1">
                        <FormRow label="To">
                            <Flatpickr
                                value={formData.stdToDate || undefined}
                                onChange={(dates: Date[]) => {
                                    handleInputChange("stdToDate", dates[0] ? dates[0].toISOString().split("T")[0] : "")
                                }}
                                options={{ dateFormat: "Y-m-d", allowInput: true, minDate: formData.stdFromDate || undefined }}
                                disabled={!formData.stdAssignDate}
                                placeholder="Select date"
                                className="h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:focus:border-brand-800 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                            />
                        </FormRow>
                    </div>
                    <div className="flex items-center gap-2 pb-1">
                        <Checkbox
                            id="stdMemberOnly"
                            checked={formData.stdMemberOnly}
                            onChange={(checked) => handleInputChange("stdMemberOnly", checked)}
                        />
                        <Label htmlFor="stdMemberOnly" className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">Member Only</Label>
                    </div>
                </div>
            </div>
        </div>
    )

    // Render Break Down Sale Type Form
    const renderBreakDownForm = () => (
        <div className="space-y-4">
            {/* Row 1: Item Count, Special Price, Profit Margin %, Markup % */}
            <div className="grid grid-cols-4 gap-3">
                <FormRow label="Item Count">
                    <Input
                        type="number"
                        value={formData.bdItemCount}
                        onChange={(e) => {
                            const count = parseInt(e.target.value) || 0
                            handleInputChange("bdItemCount", count)
                            if (count > 0 && formData.bdPrice > 0) {
                                const cost = getSpecialsCost(formData)
                                const pricePerPiece = formData.bdPrice / count
                                handleInputChange("bdMargin", calcMargin(pricePerPiece, cost))
                                handleInputChange("bdMarkup", calcMarkup(pricePerPiece, cost))
                            }
                        }}
                        placeholder="0"
                    />
                </FormRow>
                <FormRow label="Special Price" prefix="$">
                    <Input
                        type="number"
                        value={formData.bdPrice}
                        onChange={(e) => handleBdPriceChange(parseFloat(e.target.value) || 0)}
                        step={0.01}
                        placeholder="$0.00"
                        disabled={isEditMode ? !canAssignSpecialPrice : false}
                    />
                </FormRow>
                <FormRow label="Profit Margin %" suffix="%">
                    <Input
                        type="number"
                        value={formData.bdMargin}
                        onChange={(e) => {
                            const margin = parseFloat(e.target.value) || 0
                            handleInputChange("bdMargin", margin)
                            const cost = getSpecialsCost(formData)
                            const pricePerPiece = calcPriceFromMargin(cost, margin)
                            const itemCnt = formData.bdItemCount || 1
                            handleInputChange("bdPrice", parseFloat((pricePerPiece * itemCnt).toFixed(2)))
                            handleInputChange("bdMarkup", calcMarkup(pricePerPiece, cost))
                        }}
                        step={0.01}
                        placeholder="0.00"
                    />
                </FormRow>
                <FormRow label="Markup %" suffix="%">
                    <Input
                        type="number"
                        value={formData.bdMarkup}
                        onChange={(e) => {
                            const markup = parseFloat(e.target.value) || 0
                            handleInputChange("bdMarkup", markup)
                            const cost = getSpecialsCost(formData)
                            const pricePerPiece = calcPriceFromMarkup(cost, markup)
                            const itemCnt = formData.bdItemCount || 1
                            handleInputChange("bdPrice", parseFloat((pricePerPiece * itemCnt).toFixed(2)))
                            handleInputChange("bdMargin", calcMargin(pricePerPiece, cost))
                        }}
                        step={0.01}
                        placeholder="0.00"
                    />
                </FormRow>
            </div>
            {/* Row 2: Minimum Total Sale, Max Qty */}
            <div className="grid grid-cols-2 gap-3">
                <FormRow label="Minimum Total Sale" prefix="$">
                    <Input
                        type="number"
                        value={formData.bdMinTotal}
                        onChange={(e) => handleInputChange("bdMinTotal", parseFloat(e.target.value) || 0)}
                        step={0.01}
                        placeholder="$0.00"
                    />
                </FormRow>
                <FormRow label="Max Qty">
                    <Input
                        type="number"
                        value={formData.bdMaxQty}
                        onChange={(e) => handleInputChange("bdMaxQty", parseInt(e.target.value) || 0)}
                        placeholder="0"
                    />
                </FormRow>
            </div>
            {/* Row 3: Assign Date checkbox */}
            <div className="flex items-center gap-2">
                <Checkbox
                    id="bdAssignDate"
                    checked={formData.bdAssignDate}
                    onChange={(checked) => handleInputChange("bdAssignDate", checked)}
                />
                <Label htmlFor="bdAssignDate" className="text-sm text-gray-700 dark:text-gray-300">Assign Date</Label>
            </div>
            {/* Row 4: From/To dates */}
            <div className="grid grid-cols-2 gap-3">
                <FormRow label="From">
                    <Flatpickr
                        value={formData.bdFromDate || undefined}
                        onChange={(dates: Date[]) => {
                            handleInputChange("bdFromDate", dates[0] ? dates[0].toISOString().split("T")[0] : "")
                        }}
                        options={{ dateFormat: "Y-m-d", allowInput: true }}
                        disabled={!formData.bdAssignDate}
                        placeholder="Select date"
                        className="h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:focus:border-brand-800 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                    />
                </FormRow>
                <FormRow label="To">
                    <Flatpickr
                        value={formData.bdToDate || undefined}
                        onChange={(dates: Date[]) => {
                            handleInputChange("bdToDate", dates[0] ? dates[0].toISOString().split("T")[0] : "")
                        }}
                        options={{ dateFormat: "Y-m-d", allowInput: true, minDate: formData.bdFromDate || undefined }}
                        disabled={!formData.bdAssignDate}
                        placeholder="Select date"
                        className="h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:focus:border-brand-800 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                    />
                </FormRow>
            </div>
        </div>
    )

    // Render Mix & Match Sale Type Form
    const renderMixMatchForm = () => (
        <div className="space-y-4">
            {/* Row 1: Mix & Match dropdown with "+ Add new" */}
            <div className="fg">
                <div className="fg-lbl-row">
                    <label>Mix &amp; Match</label>
                    <button type="button" className="addnew-link" onClick={() => setShowMixMatchModal(true)}>+ Add new</button>
                </div>
                <SearchableSelect
                    options={mixAndMatchOptions}
                    value={formData.mixMatchSelection}
                    onChange={(value) => {
                        handleInputChange("mixMatchSelection", value)
                        const selected = mixAndMatchData.find(mm => mm.mixAndMatchID === value)
                        if (selected) {
                            handleInputChange("mixMatchQty", selected.qty || 0)
                            handleInputChange("mixMatchAmount", selected.amount || 0)
                            handleInputChange("mmAssignDate", selected.assignDate || false)
                            handleInputChange("mmFromDate", selected.startDate ? new Date(selected.startDate).toISOString().split("T")[0] : "")
                            handleInputChange("mmToDate", selected.endDate ? new Date(selected.endDate).toISOString().split("T")[0] : "")
                            handleInputChange("mmMinTotal", selected.minTotalSale || 0)
                        }
                    }}
                    placeholder="Select"
                />
            </div>
            {/* Row 2: Qty and Amount */}
            <div className="grid grid-cols-2 gap-3 pl-8">
                <FormRow label="Qty">
                    <Input
                        type="number"
                        value={formData.mixMatchQty}
                        onChange={(e) => handleInputChange("mixMatchQty", parseInt(e.target.value) || 0)}
                        placeholder="0"
                    />
                </FormRow>
                <FormRow label="Amount" prefix="$">
                    <Input
                        type="number"
                        value={formData.mixMatchAmount}
                        onChange={(e) => handleInputChange("mixMatchAmount", parseFloat(e.target.value) || 0)}
                        step={0.01}
                        placeholder="$0.00"
                    />
                </FormRow>
            </div>
            {/* Row 3: Assign Date checkbox */}
            <div className="flex items-center gap-2">
                <Checkbox
                    id="mmAssignDate"
                    checked={formData.mmAssignDate}
                    onChange={(checked) => handleInputChange("mmAssignDate", checked)}
                />
                <Label htmlFor="mmAssignDate" className="text-sm text-gray-700 dark:text-gray-300">Assign Date</Label>
            </div>
            {/* Row 4: From/To dates */}
            <div className="grid grid-cols-2 gap-3">
                <FormRow label="From">
                    <Flatpickr
                        value={formData.mmFromDate || undefined}
                        onChange={(dates: Date[]) => {
                            handleInputChange("mmFromDate", dates[0] ? dates[0].toISOString().split("T")[0] : "")
                        }}
                        options={{ dateFormat: "Y-m-d", allowInput: true }}
                        disabled={!formData.mmAssignDate}
                        placeholder="Select date"
                        className="h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:focus:border-brand-800 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                    />
                </FormRow>
                <FormRow label="To">
                    <Flatpickr
                        value={formData.mmToDate || undefined}
                        onChange={(dates: Date[]) => {
                            handleInputChange("mmToDate", dates[0] ? dates[0].toISOString().split("T")[0] : "")
                        }}
                        options={{ dateFormat: "Y-m-d", allowInput: true, minDate: formData.mmFromDate || undefined }}
                        disabled={!formData.mmAssignDate}
                        placeholder="Select date"
                        className="h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:focus:border-brand-800 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                    />
                </FormRow>
            </div>
            {/* Row 5: Minimum Total Sale */}
            <FormRow label="Minimum Total Sale" prefix="$">
                <Input
                    type="number"
                    value={formData.mmMinTotal}
                    onChange={(e) => handleInputChange("mmMinTotal", parseFloat(e.target.value) || 0)}
                    step={0.01}
                    placeholder="$0.00"
                    className="w-48"
                />
            </FormRow>
        </div>
    )

    // Render Combined Sale Type Form
    const renderCombinedForm = () => (
        <div className="space-y-4">
            {/* Row 1: Sale Price, Profit Margin %, Markup % */}
            <div className="grid grid-cols-3 gap-3">
                <FormRow label="Sale Price" prefix="$">
                    <Input
                        type="number"
                        value={formData.cmbSalePrice}
                        onChange={(e) => handleCmbSalePriceChange(parseFloat(e.target.value) || 0)}
                        step={0.01}
                        placeholder="$0.00"
                        disabled={isEditMode ? !canAssignSpecialPrice : false}
                    />
                </FormRow>
                <FormRow label="Profit Margin %" suffix="%">
                    <Input
                        type="number"
                        value={formData.cmbSaleMargin}
                        onChange={(e) => {
                            const margin = parseFloat(e.target.value) || 0
                            handleInputChange("cmbSaleMargin", margin)
                            const cost = getSpecialsCost(formData)
                            const newPrice = calcPriceFromMargin(cost, margin)
                            handleInputChange("cmbSalePrice", newPrice)
                            handleInputChange("cmbSaleMarkup", calcMarkup(newPrice, cost))
                        }}
                        step={0.01}
                        placeholder="0.00"
                    />
                </FormRow>
                <FormRow label="Markup %" suffix="%">
                    <Input
                        type="number"
                        value={formData.cmbSaleMarkup}
                        onChange={(e) => {
                            const markup = parseFloat(e.target.value) || 0
                            handleInputChange("cmbSaleMarkup", markup)
                            const cost = getSpecialsCost(formData)
                            const newPrice = calcPriceFromMarkup(cost, markup)
                            handleInputChange("cmbSalePrice", newPrice)
                            handleInputChange("cmbSaleMargin", calcMargin(newPrice, cost))
                        }}
                        step={0.01}
                        placeholder="0.00"
                    />
                </FormRow>
            </div>
            {/* Row 2: Pkg Price (qty), For (total amount), Profit Margin %, Markup % */}
            <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-3">
                <FormRow label="Pkg Price" prefix="$">
                    <Input
                        type="number"
                        value={formData.cmbPkgPrice}
                        onChange={(e) => handleCmbPkgQtyChange(parseInt(e.target.value) || 0)}
                        placeholder="0"
                    />
                </FormRow>
                <FormRow label="For">
                    <Input
                        type="number"
                        value={formData.cmbPkgFor}
                        onChange={(e) => {
                            handleInputChange("cmbPkgFor", e.target.value)
                            const totalAmount = parseFloat(e.target.value) || 0
                            const qty = formData.cmbPkgPrice || 1
                            if (qty > 0 && totalAmount > 0) {
                                const pricePerUnit = totalAmount / qty
                                const cost = getSpecialsCost(formData)
                                handleInputChange("cmbPkgMargin", calcMargin(pricePerUnit, cost))
                                handleInputChange("cmbPkgMarkup", calcMarkup(pricePerUnit, cost))
                            }
                        }}
                        step={0.01}
                        placeholder="$0.00"
                    />
                </FormRow>
                <FormRow label="Profit Margin %" suffix="%">
                    <Input
                        type="number"
                        value={formData.cmbPkgMargin}
                        onChange={(e) => {
                            const margin = parseFloat(e.target.value) || 0
                            handleInputChange("cmbPkgMargin", margin)
                            const cost = getSpecialsCost(formData)
                            const pricePerUnit = calcPriceFromMargin(cost, margin)
                            const qty = formData.cmbPkgPrice || 1
                            handleInputChange("cmbPkgFor", (pricePerUnit * qty).toFixed(2))
                            handleInputChange("cmbPkgMarkup", calcMarkup(pricePerUnit, cost))
                        }}
                        step={0.01}
                        placeholder="0.00"
                    />
                </FormRow>
                <FormRow label="Markup %" suffix="%">
                    <Input
                        type="number"
                        value={formData.cmbPkgMarkup}
                        onChange={(e) => {
                            const markup = parseFloat(e.target.value) || 0
                            handleInputChange("cmbPkgMarkup", markup)
                            const cost = getSpecialsCost(formData)
                            const pricePerUnit = calcPriceFromMarkup(cost, markup)
                            const qty = formData.cmbPkgPrice || 1
                            handleInputChange("cmbPkgFor", (pricePerUnit * qty).toFixed(2))
                            handleInputChange("cmbPkgMargin", calcMargin(pricePerUnit, cost))
                        }}
                        step={0.01}
                        placeholder="0.00"
                    />
                </FormRow>
            </div>
            {/* Row 4: Minimum Total Sale and Max Qty */}
            <div className="grid grid-cols-2 gap-3">
                <FormRow label="Minimum Total Sale" prefix="$">
                    <Input
                        type="number"
                        value={formData.cmbMinTotal}
                        onChange={(e) => handleInputChange("cmbMinTotal", parseFloat(e.target.value) || 0)}
                        step={0.01}
                        placeholder="$0.00"
                    />
                </FormRow>
                <FormRow label="Max Qty">
                    <Input
                        type="number"
                        value={formData.cmbMaxQty}
                        onChange={(e) => handleInputChange("cmbMaxQty", parseInt(e.target.value) || 0)}
                        placeholder="0"
                    />
                </FormRow>
            </div>
            {/* Row 5: Assign Date checkbox */}
            <div className="flex items-center gap-2">
                <Checkbox
                    id="cmbAssignDate"
                    checked={formData.cmbAssignDate}
                    onChange={(checked) => handleInputChange("cmbAssignDate", checked)}
                />
                <Label htmlFor="cmbAssignDate" className="text-sm text-gray-700 dark:text-gray-300">Assign Date</Label>
            </div>
            {/* Row 6: From/To dates */}
            <div className="grid grid-cols-2 gap-3">
                <FormRow label="From">
                    <Flatpickr
                        value={formData.cmbFromDate || undefined}
                        onChange={(dates: Date[]) => {
                            handleInputChange("cmbFromDate", dates[0] ? dates[0].toISOString().split("T")[0] : "")
                        }}
                        options={{ dateFormat: "Y-m-d", allowInput: true }}
                        disabled={!formData.cmbAssignDate}
                        placeholder="Select date"
                        className="h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:focus:border-brand-800 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                    />
                </FormRow>
                <FormRow label="To">
                    <Flatpickr
                        value={formData.cmbToDate || undefined}
                        onChange={(dates: Date[]) => {
                            handleInputChange("cmbToDate", dates[0] ? dates[0].toISOString().split("T")[0] : "")
                        }}
                        options={{ dateFormat: "Y-m-d", allowInput: true, minDate: formData.cmbFromDate || undefined }}
                        disabled={!formData.cmbAssignDate}
                        placeholder="Select date"
                        className="h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:focus:border-brand-800 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                    />
                </FormRow>
            </div>
        </div>
    )

    // Case Special variant — shares the standard fields but targets case pricing.
    // Toggles `setPricesForCase` so the existing backend math treats prices as case-level.
    const renderCaseSpecialForm = () => (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
                <FormRow label="Case Sale Price" prefix="$">
                    <Input
                        type="number"
                        value={formData.stdPrice}
                        onChange={(e) => {
                            handleInputChange("stdPrice", parseFloat(e.target.value) || 0)
                            handleInputChange("setPricesForCase", true)
                        }}
                        step={0.01}
                        placeholder="$0.00"
                        disabled={isEditMode ? !canAssignSpecialPrice : false}
                    />
                </FormRow>
                <FormRow label="Case Margin %" suffix="%">
                    <Input
                        type="number"
                        value={formData.stdMargin}
                        onChange={(e) => handleInputChange("stdMargin", parseFloat(e.target.value) || 0)}
                        step={0.01}
                        placeholder="0.00"
                    />
                </FormRow>
                <FormRow label="Case Markup %" suffix="%">
                    <Input
                        type="number"
                        value={formData.stdMarkup}
                        onChange={(e) => handleInputChange("stdMarkup", parseFloat(e.target.value) || 0)}
                        step={0.01}
                        placeholder="0.00"
                    />
                </FormRow>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <FormRow label="Min Qty (cases)">
                    <Input
                        type="number"
                        value={formData.stdMinQty}
                        onChange={(e) => handleInputChange("stdMinQty", parseInt(e.target.value) || 0)}
                        placeholder="0"
                    />
                </FormRow>
                <FormRow label="Max Qty (cases)">
                    <Input
                        type="number"
                        value={formData.stdMaxQty}
                        onChange={(e) => handleInputChange("stdMaxQty", parseInt(e.target.value) || 0)}
                        placeholder="0"
                    />
                </FormRow>
            </div>
            <div className="flex items-center gap-2">
                <Checkbox
                    id="caseAssignDate"
                    checked={formData.stdAssignDate}
                    onChange={(checked) => handleInputChange("stdAssignDate", checked)}
                />
                <Label htmlFor="caseAssignDate" className="text-sm text-gray-700 dark:text-gray-300">Assign Date</Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <FormRow label="From">
                    <Flatpickr
                        value={formData.stdFromDate || undefined}
                        onChange={(dates: Date[]) => {
                            handleInputChange("stdFromDate", dates[0] ? dates[0].toISOString().split("T")[0] : "")
                        }}
                        options={{ dateFormat: "Y-m-d", allowInput: true }}
                        disabled={!formData.stdAssignDate}
                        placeholder="Select date"
                        className="h-[30px] w-full rounded-md border px-3 text-sm bg-white border-gray-300 focus:border-brand-400"
                    />
                </FormRow>
                <FormRow label="To">
                    <Flatpickr
                        value={formData.stdToDate || undefined}
                        onChange={(dates: Date[]) => {
                            handleInputChange("stdToDate", dates[0] ? dates[0].toISOString().split("T")[0] : "")
                        }}
                        options={{ dateFormat: "Y-m-d", allowInput: true, minDate: formData.stdFromDate || undefined }}
                        disabled={!formData.stdAssignDate}
                        placeholder="Select date"
                        className="h-[30px] w-full rounded-md border px-3 text-sm bg-white border-gray-300 focus:border-brand-400"
                    />
                </FormRow>
            </div>
        </div>
    )

    // Render sale type specific form based on selection
    const renderSaleTypeForm = () => {
        switch (formData.saleType) {
            case "standard":
                return renderStandardForm()
            case "breakDown":
                return renderBreakDownForm()
            case "mixMatch":
                return renderMixMatchForm()
            case "combined":
                return renderCombinedForm()
            case "caseSpecial":
                return renderCaseSpecialForm()
            case "noSale":
            default:
                return (
                    <div className="min-h-[180px] border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center">
                        <span className="text-sm text-gray-400">No special pricing configured</span>
                    </div>
                )
        }
    }

    // Render Specials Tab — v8.5 layout
    const renderSpecialsTab = () => (
        <>
            <div className="ptabs" role="tablist" aria-label="Sale Type">
                {[
                    { id: "noSale", label: "No Sale" },
                    { id: "standard", label: "Standard" },
                    { id: "caseSpecial", label: "Case Special" },
                    { id: "breakDown", label: "Break Down" },
                    { id: "mixMatch", label: "Mix & Match" },
                    { id: "combined", label: "Combined" },
                ].map(({ id, label }) => {
                    const on = formData.saleType === id
                    return (
                        <button
                            key={id}
                            type="button"
                            className={`ptab ${on ? "on" : ""}`}
                            onClick={() => handleSaleTypeChange(id)}
                            aria-pressed={on}
                        >
                            {label}
                        </button>
                    )
                })}
            </div>
            {renderSaleTypeForm()}
        </>
    )

    const renderFutureSpecial = () => (
        <details className="adv">
            <summary>Future Special</summary>
            <div className="adv-body">
                <div className="fg">
                    <label>Future Sale Type</label>
                    <select
                        className="sel"
                        value="standard"
                        onChange={() => {}}
                    >
                        <option value="standard">Standard</option>
                        <option value="mixMatch">Mix &amp; Match</option>
                        <option value="breakDown">Break Down</option>
                    </select>
                </div>
                <div className="fr">
                    <div className="fg">
                        <label>Special Price / Amount</label>
                        <div className="px" data-p="$">
                            <Input
                                type="number"
                                value={formData.newPrice}
                                onChange={(e) => handleInputChange("newPrice", parseFloat(e.target.value) || 0)}
                                step={0.01}
                                className="inp w-full"
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                    <div className="fg">
                        <label>Effective From Date</label>
                        <Flatpickr
                            value={formData.dateEffective || undefined}
                            onChange={(dates: Date[]) => {
                                handleInputChange("dateEffective", dates[0] ? dates[0].toISOString().split("T")[0] : "")
                            }}
                            options={{
                                dateFormat: "Y-m-d",
                                allowInput: true,
                                minDate: new Date(Date.now() + 86400000),
                            }}
                            placeholder="Select date"
                            className="inp w-full"
                        />
                    </div>
                </div>
            </div>
        </details>
    )

    // === Quick-Add Modal Handlers ===

    // Department Quick-Add
    const resetDeptModal = () => {
        setDepartmentAddLevel("root")
        setDeptModalData({
            name: "", description: "", departmentNo: "", parentDepartmentID: "",
            defaultMarkup: "", roundUp: "0", roundValue: "",
            isDefaultTaxInclude: true, defaultTaxNo: "", isDefaultFoodStampable: true, isDefaultDiscountable: true,
        })
    }

    const openAddDepartmentModal = (level: DepartmentAddLevel) => {
        const sub = formData.subDepartment || ""
        let parentId = ""
        if (level === "sub") {
            if (!formData.department) {
                showToast("Validation", "Select a department first", "error")
                return
            }
            parentId = formData.department
        } else if (level === "subSub") {
            if (!sub) {
                showToast("Validation", "Select a sub-department first", "error")
                return
            }
            parentId = sub
        }
        setDepartmentAddLevel(level)
        setDeptModalData({
            name: "",
            description: "",
            departmentNo: "",
            parentDepartmentID: parentId,
            defaultMarkup: "",
            roundUp: "0",
            roundValue: "",
            isDefaultTaxInclude: true,
            defaultTaxNo: "",
            isDefaultFoodStampable: true,
            isDefaultDiscountable: true,
        })
        setShowAddDepartmentModal(true)
    }

    const handleSaveNewDepartment = async (keepOpen = false) => {
        if (!deptModalData.name.trim()) {
            showToast("Validation Error", "Department name is required", "error")
            return
        }
        setIsSavingDepartment(true)
        try {
            const parentDepartmentID =
                departmentAddLevel === "sub"
                    ? formData.department || null
                    : departmentAddLevel === "subSub"
                      ? formData.subDepartment || null
                      : deptModalData.parentDepartmentID || null

            const result = await departmentService.createDepartment({
                name: deptModalData.name.trim(),
                description: deptModalData.description.trim() || null,
                departmentNo: deptModalData.departmentNo.trim() || null,
                parentDepartmentID,
                defaultMarkup: deptModalData.defaultMarkup ? parseFloat(deptModalData.defaultMarkup) : null,
                roundUp: parseInt(deptModalData.roundUp) || 0,
                roundValue: deptModalData.roundValue ? parseFloat(deptModalData.roundValue) : null,
                isDefaultTaxInclude: deptModalData.isDefaultTaxInclude,
                defaultTaxNo: deptModalData.defaultTaxNo || null,
                isDefaultFoodStampable: deptModalData.isDefaultFoodStampable,
                isDefaultDiscountable: deptModalData.isDefaultDiscountable,
            })
            if (result.success && result.data) {
                const newId = result.data
                const newOption: TreeSelectOption = {
                    value: newId,
                    label: deptModalData.name.trim(),
                    parentId: parentDepartmentID,
                }
                setDepartmentOptions(prev => [...prev, newOption])
                if (departmentAddLevel === "root") {
                    await handleDepartmentChange(newId)
                } else if (departmentAddLevel === "sub") {
                    handleInputChange("subDepartment", newId)
                    handleInputChange("subSubDepartment", "")
                    void applyDepartmentDefaults(newId)
                } else {
                    handleInputChange("subSubDepartment", newId)
                    void applyDepartmentDefaults(newId)
                }
                showToast("Success", "Department created successfully", "success")
                if (keepOpen) {
                    setDeptModalData((prev) => ({
                        ...prev,
                        name: "",
                        description: "",
                        departmentNo: "",
                    }))
                } else {
                    setShowAddDepartmentModal(false)
                    resetDeptModal()
                }
            } else {
                showToast("Error", result.message || "Failed to create department", "error")
            }
        } catch (error) {
            showToast("Error", "Failed to create department", "error")
        } finally {
            setIsSavingDepartment(false)
        }
    }

    // Brand/Manufacturer Quick-Add
    const handleSaveNewBrand = async () => {
        if (!addBrandName.trim()) {
            showToast("Validation Error", "Brand name is required", "error")
            return
        }
        setIsSavingBrand(true)
        try {
            const result = await manufacturerService.createManufacturer({
                manufacturerName: addBrandName.trim(),
                status: 1, // Active
            })
            if (result.success && result.data) {
                const newId = result.data
                const newOption: SelectOption = { value: newId, label: addBrandName.trim() }
                setManufacturerOptions(prev => [...prev, newOption])
                handleInputChange("manufacturer", newId)
                showToast("Success", "Brand created successfully", "success")
                setShowAddBrandModal(false)
                setAddBrandName("")
            } else {
                showToast("Error", result.message || "Failed to create brand", "error")
            }
        } catch (error) {
            showToast("Error", "Failed to create brand", "error")
        } finally {
            setIsSavingBrand(false)
        }
    }

    // Pattern Quick-Add
    const handleSaveNewPattern = async () => {
        if (!addPatternName.trim()) {
            showToast("Validation Error", "Pattern name is required", "error")
            return
        }
        setIsSavingPattern(true)
        try {
            const result = await lookupService.createItemsLookupValue({
                valueName: addPatternName.trim(),
                valueType: LOOKUP_VALUE_TYPES.PATTERN,
            })
            if (result.success && result.data) {
                const newOption: SelectOption = { value: result.data.valueID, label: result.data.valueName }
                setPatternOptions(prev => [...prev, newOption])
                handleInputChange("pattern", result.data.valueID)
                showToast("Success", "Pattern created successfully", "success")
                setShowAddPatternModal(false)
                setAddPatternName("")
            } else {
                showToast("Error", result.message || "Failed to create pattern", "error")
            }
        } catch (error) {
            showToast("Error", "Failed to create pattern", "error")
        } finally {
            setIsSavingPattern(false)
        }
    }

    // Group/ItemGroup Quick-Add
    const handleSaveNewGroup = async () => {
        if (!addGroupName.trim()) {
            showToast("Validation Error", "Group name is required", "error")
            return
        }
        setIsSavingGroup(true)
        try {
            const result = await itemGroupService.createItemGroup({
                name: addGroupName.trim(),
                parentID: addGroupParent || null,
                status: 1, // Active
            })
            if (result.success && result.data) {
                const newId = result.data
                const newOption: TreeSelectOption = {
                    value: newId,
                    label: addGroupName.trim(),
                    parentId: addGroupParent || null,
                }
                setItemGroupOptions(prev => [...prev, newOption])
                const newGroups = [...formData.groups]
                newGroups[0] = newId
                handleInputChange("groups", newGroups)
                showToast("Success", "Group created successfully", "success")
                setShowAddGroupModal(false)
                setAddGroupName("")
                setAddGroupParent("")
            } else {
                showToast("Error", result.message || "Failed to create group", "error")
            }
        } catch (error) {
            showToast("Error", "Failed to create group", "error")
        } finally {
            setIsSavingGroup(false)
        }
    }

    // Render Quick-Add Modals
    const ROUND_UP_OPTIONS: SelectOption[] = [
        { value: "0", label: "None" },
        { value: "1", label: "Round to Dollar" },
        { value: "2", label: "To Ten Cents" },
        { value: "3", label: "To 99" },
        { value: "4", label: "To 09" },
        { value: "5", label: "To 49" },
        { value: "6", label: "To 49 or 99" },
        { value: "7", label: "Manual" },
    ]

    const departmentAddModalTitle =
        departmentAddLevel === "subSub"
            ? "Add Sub-Sub-Department"
            : departmentAddLevel === "sub"
              ? "Add Sub-Department"
              : "Add Department"

    const renderAddDepartmentModal = () => (
        <Modal isOpen={showAddDepartmentModal} onClose={() => { setShowAddDepartmentModal(false); resetDeptModal() }} className="max-w-lg p-6 lg:p-8">
            <div className="space-y-5">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{departmentAddModalTitle}</h3>
                <div className="space-y-3">
                    <FormRow label="Name">
                        <Input
                            type="text"
                            value={deptModalData.name}
                            onChange={(e) => setDeptModalData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Enter department name"
                        />
                    </FormRow>
                    <FormRow label="Description">
                        <Input
                            type="text"
                            value={deptModalData.description}
                            onChange={(e) => setDeptModalData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Enter description"
                        />
                    </FormRow>
                    <div className="grid grid-cols-2 gap-3">
                        <FormRow label="Department No / Sort Order">
                            <Input
                                type="number"
                                value={deptModalData.departmentNo}
                                onChange={(e) => setDeptModalData(prev => ({ ...prev, departmentNo: e.target.value }))}
                                placeholder="0"
                            />
                        </FormRow>
                        <FormRow label="Parent Department">
                            {departmentAddLevel === "root" ? (
                                <SearchableSelect
                                    options={[
                                        { value: "", label: "(No Parent - Root Level)" },
                                        ...departmentOptions.map(d => ({ value: d.value, label: d.label }))
                                    ]}
                                    value={deptModalData.parentDepartmentID}
                                    placeholder="(No Parent - Root Level)"
                                    onChange={(value) => setDeptModalData(prev => ({ ...prev, parentDepartmentID: value }))}
                                />
                            ) : (
                                <p className="text-sm text-gray-700 dark:text-gray-300 py-2">
                                    {departmentOptions.find((d) => d.value === deptModalData.parentDepartmentID)?.label || "—"}
                                </p>
                            )}
                        </FormRow>
                    </div>

                    {/* Pricing Section */}
                    <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Pricing</h4>
                        <div className="grid grid-cols-3 gap-3">
                            <FormRow label="Default Markup %" suffix="%">
                                <Input
                                    type="number"
                                    value={deptModalData.defaultMarkup}
                                    onChange={(e) => setDeptModalData(prev => ({ ...prev, defaultMarkup: e.target.value }))}
                                    placeholder="0.00"
                                />
                            </FormRow>
                            <FormRow label="Default RoundUp">
                                <SearchableSelect
                                    options={ROUND_UP_OPTIONS}
                                    value={deptModalData.roundUp}
                                    onChange={(value) => setDeptModalData(prev => ({ ...prev, roundUp: value }))}
                                    placeholder="None"
                                />
                            </FormRow>
                            <FormRow label="Value">
                                <Input
                                    type="number"
                                    value={deptModalData.roundValue}
                                    onChange={(e) => setDeptModalData(prev => ({ ...prev, roundValue: e.target.value }))}
                                    placeholder="$0.00"
                                />
                            </FormRow>
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-3">
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    checked={deptModalData.isDefaultTaxInclude}
                                    onChange={(checked) => setDeptModalData(prev => ({ ...prev, isDefaultTaxInclude: checked }))}
                                />
                                <Label className="text-sm text-gray-700 dark:text-gray-300">Taxable</Label>
                                <div className="flex-1">
                                    <SearchableSelect
                                        options={taxOptions}
                                        value={deptModalData.defaultTaxNo}
                                        onChange={(value) => setDeptModalData(prev => ({ ...prev, defaultTaxNo: value }))}
                                        placeholder="Tax"
                                        disabled={!deptModalData.isDefaultTaxInclude}
                                    />
                                </div>
                            </div>
                            {isFoodStore && (
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        checked={deptModalData.isDefaultFoodStampable}
                                        onChange={(checked) => setDeptModalData(prev => ({ ...prev, isDefaultFoodStampable: checked }))}
                                    />
                                    <Label className="text-sm text-gray-700 dark:text-gray-300">FoodStampable</Label>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    checked={deptModalData.isDefaultDiscountable}
                                    onChange={(checked) => setDeptModalData(prev => ({ ...prev, isDefaultDiscountable: checked }))}
                                />
                                <Label className="text-sm text-gray-700 dark:text-gray-300">Discountable</Label>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="outline" size="sm" onClick={() => { setShowAddDepartmentModal(false); resetDeptModal() }}>Cancel</Button>
                    <Button variant="outline" size="sm" onClick={() => handleSaveNewDepartment(true)} disabled={isSavingDepartment}>
                        {isSavingDepartment ? "Saving..." : "Save & New"}
                    </Button>
                    <Button size="sm" onClick={() => handleSaveNewDepartment(false)} disabled={isSavingDepartment}>
                        {isSavingDepartment ? "Saving..." : "Save & Close"}
                    </Button>
                </div>
            </div>
        </Modal>
    )

    const renderAddBrandModal = () => (
        <Modal isOpen={showAddBrandModal} onClose={() => setShowAddBrandModal(false)} className="max-w-md p-6 lg:p-8">
            <div className="space-y-5">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add New Brand</h3>
                <div className="space-y-4">
                    <FormRow label="Name">
                        <Input
                            type="text"
                            value={addBrandName}
                            onChange={(e) => setAddBrandName(e.target.value)}
                            placeholder="Enter brand name"

                        />
                    </FormRow>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setShowAddBrandModal(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveNewBrand} disabled={isSavingBrand}>
                        {isSavingBrand ? "Saving..." : "Save"}
                    </Button>
                </div>
            </div>
        </Modal>
    )

    const renderAddPatternModal = () => (
        <Modal isOpen={showAddPatternModal} onClose={() => setShowAddPatternModal(false)} className="max-w-md p-6 lg:p-8">
            <div className="space-y-5">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add New Pattern</h3>
                <div className="space-y-4">
                    <FormRow label="Name">
                        <Input
                            type="text"
                            value={addPatternName}
                            onChange={(e) => setAddPatternName(e.target.value)}
                            placeholder="Enter pattern name"

                        />
                    </FormRow>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setShowAddPatternModal(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveNewPattern} disabled={isSavingPattern}>
                        {isSavingPattern ? "Saving..." : "Save"}
                    </Button>
                </div>
            </div>
        </Modal>
    )

    const renderAddGroupModal = () => (
        <Modal isOpen={showAddGroupModal} onClose={() => setShowAddGroupModal(false)} className="max-w-md p-6 lg:p-8">
            <div className="space-y-5">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add New Group</h3>
                <div className="space-y-4">
                    <FormRow label="Name">
                        <Input
                            type="text"
                            value={addGroupName}
                            onChange={(e) => setAddGroupName(e.target.value)}
                            placeholder="Enter group name"

                        />
                    </FormRow>
                    <FormRow label="Parent Group">
                        <SearchableSelect
                            options={[
                                { value: "", label: "(No Parent - Root Level)" },
                                ...itemGroupOptions.map(g => ({ value: g.value, label: g.label }))
                            ]}
                            value={addGroupParent}
                            placeholder="(No Parent - Root Level)"
                            onChange={(value) => setAddGroupParent(value)}
                        />
                    </FormRow>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setShowAddGroupModal(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveNewGroup} disabled={isSavingGroup}>
                        {isSavingGroup ? "Saving..." : "Save"}
                    </Button>
                </div>
            </div>
        </Modal>
    )

    // Mix & Match Modal
    const [mixMatchModalData, setMixMatchModalData] = useState({
        name: "", qty: 0, amount: 0, assignDate: false, startDate: "", endDate: "", minTotalSale: 0
    })
    const [isSavingMixMatch, setIsSavingMixMatch] = useState(false)

    const handleSaveMixMatch = async () => {
        if (!mixMatchModalData.name.trim()) {
            showToast("Validation Error", "Name is required", "error")
            return
        }
        setIsSavingMixMatch(true)
        try {
            const result = await lookupService.createMixAndMatch({
                name: mixMatchModalData.name.trim(),
                qty: mixMatchModalData.qty || undefined,
                amount: mixMatchModalData.amount || undefined,
                assignDate: mixMatchModalData.assignDate || undefined,
                startDate: mixMatchModalData.startDate || undefined,
                endDate: mixMatchModalData.endDate || undefined,
                minTotalSale: mixMatchModalData.minTotalSale || undefined,
            })
            if (result.success && result.data) {
                // Add to options list
                const newOption: SelectOption = { value: result.data.mixAndMatchID, label: result.data.name }
                setMixAndMatchOptions(prev => [...prev, newOption])
                setMixAndMatchData(prev => [...prev, result.data!])
                // Auto-select and populate form fields
                handleInputChange("mixMatchSelection", result.data.mixAndMatchID)
                handleInputChange("mixMatchQty", result.data.qty || 0)
                handleInputChange("mixMatchAmount", result.data.amount || 0)
                handleInputChange("mmAssignDate", result.data.assignDate || false)
                handleInputChange("mmFromDate", result.data.startDate ? new Date(result.data.startDate).toISOString().split("T")[0] : "")
                handleInputChange("mmToDate", result.data.endDate ? new Date(result.data.endDate).toISOString().split("T")[0] : "")
                handleInputChange("mmMinTotal", result.data.minTotalSale || 0)
                showToast("Success", "Mix & Match created successfully", "success")
                setShowMixMatchModal(false)
                setMixMatchModalData({ name: "", qty: 0, amount: 0, assignDate: false, startDate: "", endDate: "", minTotalSale: 0 })
            } else {
                showToast("Error", result.message || "Failed to create Mix & Match", "error")
            }
        } catch (error) {
            showToast("Error", "Failed to create Mix & Match", "error")
        } finally {
            setIsSavingMixMatch(false)
        }
    }

    const renderMixMatchModal = () => (
        <Modal isOpen={showMixMatchModal} onClose={() => setShowMixMatchModal(false)} className="max-w-lg p-6 lg:p-8">
            <div className="space-y-5">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Mix And Match</h3>
                <div className="space-y-4">
                    <FormRow label="Name">
                        <Input
                            type="text"
                            value={mixMatchModalData.name}
                            onChange={(e) => setMixMatchModalData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Enter name"
                        />
                    </FormRow>
                    <div className="grid grid-cols-2 gap-3">
                        <FormRow label="Qty">
                            <Input
                                type="number"
                                value={mixMatchModalData.qty}
                                onChange={(e) => setMixMatchModalData(prev => ({ ...prev, qty: parseInt(e.target.value) || 0 }))}
                                placeholder="0"
                            />
                        </FormRow>
                        <FormRow label="Amount" prefix="$">
                            <Input
                                type="number"
                                value={mixMatchModalData.amount}
                                onChange={(e) => setMixMatchModalData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                                step={0.01}
                                placeholder="$0.00"
                            />
                        </FormRow>
                    </div>
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="mmAssignDate"
                            checked={mixMatchModalData.assignDate}
                            onChange={(checked) => setMixMatchModalData(prev => ({ ...prev, assignDate: checked }))}
                        />
                        <Label htmlFor="mmAssignDate" className="text-sm text-gray-700 dark:text-gray-300">Assign Date</Label>
                        <div className="flex items-center gap-2 ml-4">
                            <Label className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">From:</Label>
                            <Flatpickr
                                value={mixMatchModalData.startDate || undefined}
                                onChange={(dates: Date[]) => setMixMatchModalData(prev => ({ ...prev, startDate: dates[0] ? dates[0].toISOString().split("T")[0] : "" }))}
                                options={{ dateFormat: "Y-m-d", allowInput: true }}
                                disabled={!mixMatchModalData.assignDate}
                                placeholder="Select date"
                                className="h-9 w-36 rounded-lg border appearance-none px-3 py-1.5 text-sm bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                            />
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                            <Label className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">To:</Label>
                            <Flatpickr
                                value={mixMatchModalData.endDate || undefined}
                                onChange={(dates: Date[]) => setMixMatchModalData(prev => ({ ...prev, endDate: dates[0] ? dates[0].toISOString().split("T")[0] : "" }))}
                                options={{ dateFormat: "Y-m-d", allowInput: true, minDate: mixMatchModalData.startDate || undefined }}
                                disabled={!mixMatchModalData.assignDate}
                                placeholder="Select date"
                                className="h-9 w-36 rounded-lg border appearance-none px-3 py-1.5 text-sm bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                            />
                        </div>
                    </div>
                    <FormRow label="Minimum Total Sale" prefix="$">
                        <Input
                            type="number"
                            value={mixMatchModalData.minTotalSale}
                            onChange={(e) => setMixMatchModalData(prev => ({ ...prev, minTotalSale: parseFloat(e.target.value) || 0 }))}
                            step={0.01}
                            placeholder="$0.00"
                        />
                    </FormRow>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setShowMixMatchModal(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveMixMatch} disabled={isSavingMixMatch}>
                        {isSavingMixMatch ? "Saving..." : "Ok"}
                    </Button>
                </div>
            </div>
        </Modal>
    )

    // Render Vendor Tab
    const renderVendorTab = () => (
        <div className="space-y-6">
            <div className="adv item-detail-v6">
                <div className="item-detail-v6-adv-summary">
                    <span>Suppliers</span>
                    <button
                        type="button"
                        onClick={handleAddSupplier}
                        className="text-xs px-2 py-1 bg-brand-500 text-white rounded hover:bg-brand-600 transition-colors"
                    >
                        + Add Supplier
                    </button>
                </div>
                <table className="w-full table-fixed">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th className="w-10 px-3 py-3"></th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Main Supplier</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Gross Cost</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Case Qty</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Pc Cost</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Name</th>
                            <th className="w-10 px-3 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {formData.vendors.map((vendor, index) => (
                            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <td className="px-3 py-3 text-center">
                                    {vendor.mainSupplier && <span className="text-amber-500" title="Main Supplier">⚡</span>}
                                </td>
                                <td className="px-4 py-3">
                                    <Checkbox
                                        checked={vendor.mainSupplier}
                                        onChange={(checked) => {
                                            const updatedVendors = formData.vendors.map((v, i) => ({
                                                ...v,
                                                mainSupplier: i === index ? checked : (checked ? false : v.mainSupplier),
                                            }))
                                            handleInputChange("vendors", updatedVendors)
                                        }}
                                    />
                                </td>
                                <td className="px-4 py-3">
                                    <Input
                                        type="number"
                                        value={vendor.grossCost}
                                        onChange={(e) => {
                                            const updatedVendors = [...formData.vendors]
                                            const gc = parseFloat(e.target.value) || 0
                                            updatedVendors[index] = {
                                                ...updatedVendors[index],
                                                grossCost: gc,
                                                pcCost: vendor.caseQty > 0 ? parseFloat((gc / vendor.caseQty).toFixed(2)) : gc,
                                            }
                                            handleInputChange("vendors", updatedVendors)
                                        }}
                                        step={0.01}
                                        className="w-24"
                                        placeholder="$0.00"
                                    />
                                </td>
                                <td className="px-4 py-3">
                                    <Input
                                        type="number"
                                        value={vendor.caseQty}
                                        onChange={(e) => {
                                            const updatedVendors = [...formData.vendors]
                                            const qty = parseInt(e.target.value) || 0
                                            updatedVendors[index] = {
                                                ...updatedVendors[index],
                                                caseQty: qty,
                                                pcCost: qty > 0 ? parseFloat((vendor.grossCost / qty).toFixed(2)) : vendor.grossCost,
                                            }
                                            handleInputChange("vendors", updatedVendors)
                                        }}
                                        className="w-20"
                                        placeholder="0"
                                    />
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                                    ${vendor.pcCost.toFixed(2)}
                                </td>
                                <td className="px-4 py-3">
                                    <SearchableSelect
                                        options={supplierOptions}
                                        value={vendor.id}
                                        onChange={(val) => {
                                            const updatedVendors = [...formData.vendors]
                                            const selectedSupplier = supplierOptions.find(s => s.value === val)
                                            updatedVendors[index] = {
                                                ...updatedVendors[index],
                                                id: val,
                                                name: selectedSupplier?.label || "",
                                            }
                                            handleInputChange("vendors", updatedVendors)
                                        }}
                                        placeholder="Select supplier..."
                                        className="min-w-[160px]"
                                    />
                                </td>
                                <td className="px-3 py-3">
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveSupplier(index)}
                                        className="p-1 text-red-400 hover:text-red-600 transition-colors"
                                        title="Remove supplier"
                                    >
                                        <CloseIcon />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {formData.vendors.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                                    No suppliers assigned. Click "+ Add Supplier" to add one.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                {formData.vendors.length < 3 && <div className="min-h-[100px] bg-white dark:bg-gray-900" />}
            </div>

            {/* Vendor Details (plain sub-card: header + body only) */}
            <div className="adv item-detail-v6">
                <div className="item-detail-v6-adv-summary">
                    <span>VENDOR DETAILS</span>
                </div>

                <div className="adv-body">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <FormRow label="Average Delivery Delay" inline>
                            <Input
                                type="text"
                                value={formData.averageDeliveryDelay}
                                onChange={(e) => handleInputChange("averageDeliveryDelay", e.target.value)}
                                placeholder="Enter days"
                            />
                        </FormRow>
                        <FormRow label="Vendor Item Code" inline>
                            <Input
                                type="text"
                                value={formData.vendorItemCode}
                                onChange={(e) => handleInputChange("vendorItemCode", e.target.value)}
                                placeholder="Enter code"
                            />
                        </FormRow>
                    </div>
                </div>
            </div>
        </div>
    )

    // Render Extra Tab
    const renderExtraTab = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
            <div className="space-y-4">
                <Section title="Extra Charges">
                    <div className="space-y-3">
                        {[
                            { num: 1, field: "extraCharge1" as const },
                            { num: 2, field: "extraCharge2" as const },
                            { num: 3, field: "extraCharge3" as const },
                        ].map(({ num, field }) => (
                            <div key={num} className="flex flex-col gap-2">
                                <Label className="text-sm font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                    Extra Charge {num}
                                </Label>
                                <SearchableSelect
                                    options={extraChargeOptions}
                                    value={formData[field]}
                                    placeholder="Select charge"
                                    onChange={(value) => handleInputChange(field, value)}
                                    loading={isLoadingLookups}
                                    className="w-full"
                                />
                            </div>
                        ))}
                    </div>
                </Section>

                <Section title="Extra Info">
                    <div className="space-y-3">
                        <TextArea
                            value={formData.extraInfo1}
                            onChange={(value) => handleInputChange("extraInfo1", value)}
                            rows={3}
                            placeholder="Enter additional information..."
                        />
                        <TextArea
                            value={formData.extraInfo2}
                            onChange={(value) => handleInputChange("extraInfo2", value)}
                            rows={3}
                            placeholder="Enter additional information..."
                        />
                    </div>
                </Section>
            </div>

            <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">UPC Codes</h3>
                        <button
                            type="button"
                            onClick={handleAddAlias}
                            className="text-xs px-2 py-1 bg-brand-500 text-white rounded hover:bg-brand-600 transition-colors"
                        >
                            + Add
                        </button>
                    </div>
                    <table className="w-full table-fixed">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                                <th className="w-10 px-3 py-2"></th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">UPC Code</th>
                                <th className="w-10 px-3 py-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {formData.upcCodes.map((code, index) => (
                                <tr key={index} className="border-t border-gray-200 dark:border-gray-700">
                                    <td className="px-3 py-2 text-gray-400 text-center text-xs">{index + 1}</td>
                                    <td className="px-4 py-2">
                                        <div>
                                            <Input
                                                type="text"
                                                value={code}
                                                placeholder="Enter UPC code"
                                                onChange={(e) => {
                                                    const newCodes = [...formData.upcCodes]
                                                    newCodes[index] = e.target.value
                                                    handleInputChange("upcCodes", newCodes)
                                                    // Clear error on typing
                                                    setAliasErrors(prev => ({ ...prev, [index]: null }))
                                                }}
                                                onBlur={(e) => {
                                                    // #68: Check if alias barcode already exists on blur
                                                    checkAliasBarcodeExists(e.target.value, index)
                                                }}
                                                className={aliasErrors[index] ? 'border-red-500' : ''}
                                            />
                                            {aliasErrors[index] && (
                                                <span className="text-xs text-red-500 mt-0.5 block">{aliasErrors[index]}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveAlias(index)}
                                            className="text-red-400 hover:text-red-600 transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {formData.upcCodes.length === 0 && (
                                <tr className="border-t border-gray-200 dark:border-gray-700">
                                    <td colSpan={3} className="px-4 py-4 text-center text-sm text-gray-400 dark:text-gray-500">
                                        No UPC codes. Click + Add to add one.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    <div className={`${formData.upcCodes.length < 5 ? "min-h-[100px]" : ""} bg-white dark:bg-gray-900`} />
                </div>

                <div className="flex justify-end">
                    <FormRow label="App Button" inline labelClassName="min-w-[90px]">
                        <MultiSelect
                            options={appButtonOptions}
                            value={formData.appButton}
                            placeholder="Select apps"
                            onChange={(selected) => handleInputChange("appButton", selected)}
                        />
                    </FormRow>
                </div>
            </div>

            {/* Sell On Web card (inside Sales Channels & Web card) */}
            <div className="md:col-span-2">
                <div className="adv item-detail-v6 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 shadow-sm overflow-hidden">
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/30">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left column: Sell On Web + prices */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        checked={formData.sellOnWeb}
                                        onChange={(checked) => handleInputChange("sellOnWeb", checked)}
                                    />
                                    <Label className="text-sm">Sell On Web</Label>
                                </div>

                                <div className="grid grid-cols-[140px_1fr] gap-3 items-center">
                                    <Label className="text-sm whitespace-nowrap">Web Price:</Label>
                                    <Input
                                        type="number"
                                        value={formData.webPrice}
                                        onChange={(e) => handleInputChange("webPrice", parseFloat(e.target.value) || 0)}
                                        step={0.01}
                                        className="w-32"
                                        placeholder="$0.00"
                                    />
                                </div>

                                <div className="grid grid-cols-[140px_1fr] gap-3 items-center">
                                    <Label className="text-sm whitespace-nowrap">Web Case Price:</Label>
                                    <Input
                                        type="number"
                                        value={formData.webCasePrice}
                                        onChange={(e) => handleInputChange("webCasePrice", parseFloat(e.target.value) || 0)}
                                        step={0.01}
                                        className="w-32"
                                        placeholder="$0.00"
                                    />
                                </div>
                            </div>

                            {/* Right column: Style/Customer/Number + days */}
                            <div className="space-y-3">
                                {[
                                    { label: "Style No", field: "matrix1" as const, isBlue: true },
                                    { label: "Customer Code", field: "customerCode" as const, isBlue: false },
                                    { label: "Number", field: "matrix2" as const, isBlue: true },
                                ].map(({ label, field, isBlue }) => (
                                    <div key={field} className="grid grid-cols-[140px_1fr] gap-3 items-center">
                                        <Label
                                            className={`text-sm whitespace-nowrap ${isBlue ? "text-brand-600 dark:text-brand-400" : ""} font-medium`}
                                        >
                                            {label}
                                        </Label>
                                        <Input
                                            type="text"
                                            value={formData[field]}
                                            onChange={(e) => handleInputChange(field, e.target.value)}
                                            className="w-32"
                                        />
                                    </div>
                                ))}

                                {/* Days for Return */}
                                <div className="grid grid-cols-[140px_1fr] gap-3 items-center">
                                    <Label className="text-sm whitespace-nowrap font-medium">Days for Return</Label>
                                    <Input
                                        type="number"
                                        value={formData.daysForReturn}
                                        onChange={(e) => handleInputChange("daysForReturn", parseInt(e.target.value) || 0)}
                                        className="w-20"
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )

    // Render Custom Fields Tab
    const renderCustomFieldsTab = () => {
        // Map field number to form data key
        const getCustomFieldKey = (fieldNum: number): keyof ItemFormData => {
            return `customField${fieldNum}` as keyof ItemFormData
        }

        const renderCustomFieldRow = (fieldNum: number) => {
            const fieldKey = getCustomFieldKey(fieldNum)
            const options = customFieldOptions[fieldNum] || []

            return (
                <div
                    key={fieldNum}
                    className="grid grid-cols-[1fr_auto] grid-rows-2 gap-x-3 gap-y-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors items-start"
                >
                    {/* Row 1: label */}
                    <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Custom {fieldNum}:
                    </Label>
                    <div />

                    {/* Row 2: dropdown + actions (aligned to dropdown height) */}
                    <div className="min-w-0">
                        <SearchableSelect
                            options={options}
                            value={formData[fieldKey] as string}
                            placeholder={`Select Custom Field ${fieldNum}`}
                            onChange={(value) => handleInputChange(fieldKey, value)}
                            loading={isLoadingLookups}
                        />
                    </div>
                    <div className="flex items-center justify-center pt-[2px]">
                        <ActionButtonGroup />
                    </div>
                </div>
            )
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((fieldNum) => renderCustomFieldRow(fieldNum))}
                </div>
                <div className="space-y-3">
                    {[6, 7, 8, 9, 10].map((fieldNum) => renderCustomFieldRow(fieldNum))}
                </div>
            </div>
        )
    }

    const renderTabContent = () => {
        switch (activeTab) {
            case "general": return renderGeneralTab()
            case "sales": return renderSalesTab()
            case "specials": return renderSpecialsTab()
            case "vendor": return renderVendorTab()
            case "extra": return renderExtraTab()
            case "customFields": return renderCustomFieldsTab()
            default: return null
        }
    }

    // Show the full-page loader only on the very first load (no data yet)
    // or while permissions are resolving. Prev/next navigations keep the
    // current item on screen and use the pager's inline spinner instead.
    if ((isLoading && !hasLoadedOnceRef.current) || permissionsLoading || !permissionsLoaded) {
        return (
            <Loader size="lg" label="Loading item data..." />
        )
    }

    // #64: View permission gate — only check AFTER permissions are fully loaded
    if (!canView) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center space-y-3">
                    <div className="w-16 h-16 mx-auto rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Access Denied</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">You don't have permission to view items.</p>
                    <Button variant="outline" size="sm" onClick={goBackToList}>Go Back</Button>
                </div>
            </div>
        )
    }

    const generalTabEl = renderGeneralTab()
    const generalTabChildren = React.Children.toArray((generalTabEl as any).props?.children)
    const identityContent = (generalTabChildren[0] ?? null) as React.ReactNode
    const organizationContent = (generalTabChildren[1] ?? null) as React.ReactNode
    const generalRightColumn = (generalTabChildren[2] ?? null) as React.ReactNode

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
            {/* Toast Notification */}
            {toast.show && (
                <div className="fixed top-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-lg ring-1 ring-gray-900/5 dark:ring-white/10 min-w-[340px] max-w-[400px] transition-all duration-300 animate-slide-in">
                    <div className="p-4">
                        <div className="flex items-start gap-3">
                            <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${toast.type === "success" ? "bg-green-50 dark:bg-green-500/10" : toast.type === "error" ? "bg-red-50 dark:bg-red-500/10" : "bg-brand-50 dark:bg-brand-500/10"
                                }`}>
                                {toast.type === "success" ? (
                                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : toast.type === "error" ? (
                                    <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">{toast.title}</p>
                                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{toast.message}</p>
                            </div>
                            <button
                                onClick={closeToast}
                                className="flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="mt-3 w-full bg-gray-100 dark:bg-gray-700 rounded-full h-0.5 overflow-hidden">
                            <div
                                className={`h-0.5 rounded-full ${toast.type === "success" ? "bg-green-500" : toast.type === "error" ? "bg-red-500" : "bg-brand-500"}`}
                                style={{ width: '100%', animation: 'progressBar 5s linear forwards' }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Dialog */}
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onClose={confirmDialog.onResult}
                title={confirmDialog.title}
                message={confirmDialog.message}
                type={confirmDialog.type}
                buttons={confirmDialog.buttons}
            />

            {/* Mix & Match Create Modal */}
            {renderMixMatchModal()}

            {/* Quick-Add Modals for Department, Brand, Pattern, Group */}
            {renderAddDepartmentModal()}
            {renderAddBrandModal()}
            {renderAddPatternModal()}
            {renderAddGroupModal()}

            {/* Header (hidden - replaced by HTML v6 layout) */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] hidden">
                <div className="px-5 py-3">
                    {/* Single Row - Store, checkbox, and action buttons aligned to right */}
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                        {/* Store Dropdown */}
                        <div className="flex items-center gap-2">
                            <SearchableSelect
                                options={storeOptions}
                                value={formData.selectedStore}
                                onChange={(value) => handleStoreChange(value)}
                                placeholder="Select Store"
                                className="w-40 sm:w-48"
                                loading={isLoadingStores}
                            />
                        </div>
                        {/* Save To All Stores Checkbox */}
                        <div className="flex items-center gap-1">
                            <Checkbox
                                checked={formData.saveToAllStores}
                                onChange={(checked) => handleInputChange("saveToAllStores", checked)}
                            />
                            <Label className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">Save To All Stores</Label>
                            <button
                                type="button"
                                className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center"
                                title="When checked, item will be saved to all stores"
                            >
                                ?
                            </button>
                        </div>
                        {/* Unsaved changes indicator */}
                        {isDirty && (
                            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium px-2 py-1 bg-amber-50 dark:bg-amber-900/20 rounded-full">
                                ● Unsaved changes
                            </span>
                        )}
                        {/* Action Buttons - Right aligned */}
                        <div className="flex items-center gap-2 ml-auto">
                            {/* #79: Add Text to Name */}
                            <button
                                type="button"
                                onClick={handleAddTextToName}
                                className="px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                                title="Auto-build name from Brand + Size + Measure"
                            >
                                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Build Name
                            </button>
                            {/* #78: Print Label */}
                            {isEditMode && (
                                <button
                                    type="button"
                                    onClick={handlePrintLabel}
                                    className="px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                                    title="Print label for this item"
                                >
                                    <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                    </svg>
                                    Print
                                </button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSave}
                                disabled={isSaving || (isEditMode ? !canEdit : !canAdd)}
                            >
                                {isSaving ? "Saving..." : "Save & Close"}
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleSaveAndNew} disabled={isSaving || (isEditMode ? !canEdit : !canAdd)}>
                                Save & New
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleCancel}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Item Fields Row (hidden - replaced by HTML v6 vitals bar) */}
                <div className="px-3 sm:px-5 py-2.5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50 hidden">
                    <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                        <h1 className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                            {isEditMode ? "Edit Item" : "New Item"}
                        </h1>
                        {/* Name Field with Autocomplete */}
                        <div className="flex items-center gap-1 relative">
                            <Label className="text-xs text-gray-500 whitespace-nowrap">Name:</Label>
                            <div className="relative">
                                <Input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => {
                                        handleInputChange("name", e.target.value)
                                        setNameWarning(null) // Clear warning on typing
                                        // Trigger search for items by name
                                        if (e.target.value.length >= 2) {
                                            setShowNameSuggestions(true)
                                        } else {
                                            setShowNameSuggestions(false)
                                        }
                                    }}
                                    onFocus={() => formData.name.length >= 2 && setShowNameSuggestions(true)}
                                    onBlur={(e) => {
                                        setTimeout(() => setShowNameSuggestions(false), 200)
                                        // #67: Check if item name already exists on blur
                                        checkItemNameExists(e.target.value)
                                    }}
                                    className={`w-32 sm:w-48 bg-amber-50 dark:bg-amber-900/20 ${nameWarning ? 'border-amber-500' : 'border-amber-200 dark:border-amber-700'}`}
                                    placeholder="Item name"
                                />
                                {/* Name Suggestions Dropdown */}
                                {showNameSuggestions && nameSuggestions.length > 0 && (
                                    <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                                        {nameSuggestions.map((item, index) => (
                                            <div
                                                key={index}
                                                className="px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                                                onMouseDown={() => {
                                                    handleInputChange("name", item.name)
                                                    handleInputChange("upc", item.barcode)
                                                    setShowNameSuggestions(false)
                                                }}
                                            >
                                                <div className="font-medium">{item.name}</div>
                                                <div className="text-xs text-gray-500">{item.barcode}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {isCheckingName && (
                                <span className="text-xs text-gray-400 animate-pulse">Checking...</span>
                            )}
                            {nameWarning && !isCheckingName && (
                                <span className="text-xs text-amber-500" title={nameWarning}>⚠ Duplicate name</span>
                            )}
                        </div>
                        {/* UPC Field with Autocomplete */}
                        <div className="flex items-center gap-1 relative">
                            <Label className="text-xs text-gray-500 whitespace-nowrap">UPC:</Label>
                            <div className="relative flex items-center gap-1">
                                <div className="relative">
                                    <Input
                                        type="text"
                                        value={formData.upc}
                                        onChange={(e) => {
                                            handleInputChange("upc", e.target.value)
                                            // Trigger search for items by barcode
                                            if (e.target.value.length >= 2) {
                                                setShowBarcodeSuggestions(true)
                                            } else {
                                                setShowBarcodeSuggestions(false)
                                            }
                                        }}
                                        onFocus={() => formData.upc.length >= 2 && setShowBarcodeSuggestions(true)}
                                        onBlur={(e) => {
                                            setTimeout(() => setShowBarcodeSuggestions(false), 200)
                                            checkBarcodeExists(e.target.value)
                                        }}
                                        className={`w-28 sm:w-36 bg-amber-50 dark:bg-amber-900/20 ${barcodeError ? 'border-red-500' : 'border-amber-200 dark:border-amber-700'}`}
                                        placeholder="Barcode"
                                    />
                                    {/* Barcode Suggestions Dropdown */}
                                    {showBarcodeSuggestions && barcodeSuggestions.length > 0 && (
                                        <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                                            {barcodeSuggestions.map((item, index) => (
                                                <div
                                                    key={index}
                                                    className="px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                                                    onMouseDown={() => {
                                                        handleInputChange("upc", item.barcode)
                                                        handleInputChange("name", item.name)
                                                        setShowBarcodeSuggestions(false)
                                                    }}
                                                >
                                                    <div className="font-medium">{item.barcode}</div>
                                                    <div className="text-xs text-gray-500">{item.name}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    className="p-2 border border-gray-300 dark:border-gray-600 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    {isCheckingBarcode ? (
                                        <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : (
                                        <SearchIcon />
                                    )}
                                </button>
                            </div>
                            {barcodeError && (
                                <span className="text-xs text-red-500">{barcodeError}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <Label className="text-xs text-gray-500">Alt:</Label>
                            <Input
                                type="text"
                                value={formData.alternateCode}
                                onChange={(e) => handleInputChange("alternateCode", e.target.value)}
                                onBlur={(e) => {
                                    // #66: Check if model number already exists on blur
                                    checkModelNumberExists(e.target.value)
                                }}
                                className={`w-28 ${modelNumberError ? 'border-red-500' : ''}`}
                                placeholder="Alt code"
                            />
                            {isCheckingModelNumber && (
                                <span className="text-xs text-gray-400 animate-pulse">...</span>
                            )}
                            {modelNumberError && !isCheckingModelNumber && (
                                <span className="text-xs text-red-500" title={modelNumberError}>✕</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tabs (hidden - replaced by HTML v6 3-column card layout) */}
                <div className="flex px-3 sm:px-5 gap-1 border-t border-gray-100 dark:border-gray-700 no-scrollbar hidden">
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-4 py-2.5 text-xs font-medium transition-all duration-200 relative whitespace-nowrap ${activeTab === tab.key
                                    ? "text-brand-600 dark:text-brand-400"
                                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                }`}
                        >
                            {tab.label}
                            {tab.shortcut && (
                                <span className={`ml-1.5 text-[10px] ${activeTab === tab.key ? "text-brand-400" : "text-gray-400"}`}>
                                    {tab.shortcut}
                                </span>
                            )}
                            {activeTab === tab.key && (
                                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-brand-500 rounded-t-full" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content (HTML v6 layout) */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden p-0 bg-gray-50 dark:bg-gray-900/50 item-detail-v6">
                {/* Item header — matches v8.5 mockup */}
                <div className="v6-hdr shrink-0">
                    <div className="v6-hdr-left">
                        <span className="pill-active">ACTIVE</span>
                        <div className="v6-hdr-title">
                            <h1 className="v6-hdr-name">{formData.name || "—"}</h1>
                            <div className="v6-hdr-sub">
                                UPC <b>{formData.upc || "-"}</b>
                                <span className="sep">·</span>
                                Model <b>{formData.alternateCode || "-"}</b>
                            </div>
                        </div>
                    </div>

                    <div className="v6-hdr-right">
                        {/* Store selector with Save-to-all-stores checkbox inline */}
                        <div className="v6-hdr-store-col">
                            <div className="v6-hdr-store">
                                <SearchableSelect
                                    options={storeOptions}
                                    value={formData.selectedStore}
                                    onChange={(value) => handleStoreChange(value)}
                                    placeholder="Select Store"
                                    loading={isLoadingStores}
                                />
                            </div>
                            <label className="v6-hdr-chk v6-hdr-chk-inline">
                                <input
                                    type="checkbox"
                                    checked={formData.saveToAllStores}
                                    onChange={(e) => handleInputChange("saveToAllStores", e.target.checked)}
                                />
                                <span>Save to All Stores</span>
                            </label>
                        </div>

                        {/* Auto-save hidden until actually implemented */}

                        {/* Duplicate */}
                        <button
                            type="button"
                            onClick={handleDuplicate}
                            className="v6-hdr-btn"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M8 5V3a1 1 0 011-1h10a1 1 0 011 1v14a1 1 0 01-1 1h-2M5 8h10a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V9a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            Duplicate
                        </button>

                        {/* Cancel */}
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={isSaving}
                            className="v6-hdr-btn"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                            Cancel
                        </button>

                        {/* Save / Save & New / Save & Close — joined segmented group */}
                        <div className="v6-save-group" role="group" aria-label="Save actions">
                            <button
                                type="button"
                                onClick={handleSaveOnly}
                                disabled={isSaving || (isEditMode ? !canEdit : !canAdd)}
                                className="v6-hdr-btn v6-save-seg"
                            >
                                {isSaving ? "Saving..." : "Save"}
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveAndNew}
                                disabled={isSaving || (isEditMode ? !canEdit : !canAdd)}
                                className="v6-hdr-btn v6-save-seg"
                            >
                                Save &amp; New
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving || (isEditMode ? !canEdit : !canAdd)}
                                className="v6-hdr-btn v6-save-seg primary"
                            >
                                Save &amp; Close
                            </button>
                        </div>
                    </div>
                </div>

                {/* Quick-info vitals bar — read-only stats; click any stat to focus matching form field */}
                {(() => {
                    const focusField = (targetId: string) => {
                        const el = document.getElementById(targetId)
                        if (!el) return
                        // Expand the parent collapsible card if it's currently collapsed
                        const cardBody = el.closest(".card-body") as HTMLElement | null
                        if (cardBody && cardBody.style.display === "none") {
                            const hdr = cardBody.previousElementSibling as HTMLElement | null
                            if (hdr && hdr.classList.contains("collapsible")) hdr.click()
                        }
                        requestAnimationFrame(() => {
                            el.scrollIntoView({ behavior: "smooth", block: "center" })
                            const input = (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA")
                                ? (el as HTMLInputElement)
                                : el.querySelector<HTMLInputElement>("input, select, textarea")
                            if (input) {
                                input.focus()
                                if (typeof input.select === "function") try { input.select() } catch { /* noop */ }
                            }
                        })
                    }
                    const Stat: React.FC<{ label: string; target?: string; children: React.ReactNode; className?: string; title?: string }> =
                        ({ label, target, children, className = "", title }) => (
                            <div
                                className={`v6-stat${target ? " v6-stat-click" : ""}`}
                                onClick={target ? () => focusField(target) : undefined}
                                role={target ? "button" : undefined}
                                tabIndex={target ? 0 : undefined}
                                onKeyDown={target ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); focusField(target) } } : undefined}
                            >
                                <label>{label}</label>
                                <div className={`v6-stat-v ${className}`} title={title}>{children}</div>
                            </div>
                        )
                    return (
                <div className="v6-vitals shrink-0">
                    <div className="v6-vitals-stats">
                        <Stat label="Price" target="field-price">${Number(formData.price || 0).toFixed(2)}</Stat>
                        <Stat label="Cost" target={formData.setPricesForCase ? "field-case-cost" : "field-cost"}>${Number(getEffectiveCost(formData) || 0).toFixed(2)}</Stat>
                        <Stat label="Margin" target="field-margin" className="g">{Number(formData.profitMargin || 0).toFixed(1)}%</Stat>
                        <Stat label="Markup" target="field-markup" className="g">{Number(formData.markup || 0).toFixed(0)}%</Stat>
                        <Stat label="Sale Price" target="field-sale-price" className={formData.stdPrice > 0 ? "" : "dim"}>
                            {formData.stdPrice > 0 ? `$${Number(formData.stdPrice).toFixed(2)}` : "No sale"}
                        </Stat>
                        <Stat label="On Hand" target="field-onhand" className={Number(formData.onHand || 0) > 0 ? "g" : "dim"}>
                            {Number(formData.onHand || 0).toLocaleString()}
                        </Stat>
                        <Stat label="On Order">{Number(formData.onOrder || 0).toLocaleString()}</Stat>
                        <Stat label="MTD Sales">{Number(formData.mtdQty || 0).toLocaleString()}</Stat>
                        <Stat label="YTD Qty">{Number(formData.ytdQty || 0).toLocaleString()}</Stat>
                        <Stat label="Last Sale" className="dim">—</Stat>
                        <Stat label="Location" target="field-location">{formData.location || "—"}</Stat>
                        <Stat
                            label="Dept"
                            target="field-department"
                            className="trunc"
                            title={departmentOptions.find(d => d.value === formData.department)?.label || ""}
                        >
                            {departmentOptions.find(d => d.value === formData.department)?.label || "—"}
                        </Stat>
                    </div>

                    <div className="v6-vitals-right">
                        {isEditMode && itemListNavigation && itemListNavigation.itemStoreIds.length > 0 && (() => {
                            const nav = itemListNavigation
                            const denom = Math.max(nav.totalCount, nav.itemStoreIds.length)
                            const posLabel = `${(nav.index + 1).toLocaleString()} / ${denom.toLocaleString()}`
                            const canPrev = nav.index > 0 && !isSaving && !isNavigatingItem
                            const canNext = nav.index < nav.itemStoreIds.length - 1 && !isSaving && !isNavigatingItem
                            const moreBuffered = nav.totalCount > nav.itemStoreIds.length
                            const nextTitle =
                                !canNext && moreBuffered
                                    ? "More items exist — scroll the list to load additional rows"
                                    : "Next item"
                            return (
                            <div className="v6-pager" aria-label="Record navigation">
                                <button
                                    type="button"
                                    className="v6-pager-btn"
                                    title="Previous item"
                                    aria-label="Previous item"
                                    disabled={!canPrev}
                                    onClick={() => void navigateAdjacentItem(-1)}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </button>
                                <span className="v6-pager-rec">
                                    {isNavigatingItem && (
                                        <span className="v6-pager-spinner" aria-label="Loading" />
                                    )}
                                    {posLabel}
                                </span>
                                <button
                                    type="button"
                                    className="v6-pager-btn"
                                    title={nextTitle}
                                    aria-label="Next item"
                                    disabled={!canNext}
                                    onClick={() => void navigateAdjacentItem(1)}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </button>
                            </div>
                            )
                        })()}

                        {isEditMode && (
                            <button
                                type="button"
                                onClick={handlePrintLabel}
                                className="v6-hdr-btn"
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 9V4h12v5M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2m-12 0v4h12v-4m-12 0h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                Print Label
                            </button>
                        )}
                    </div>
                </div>
                    )
                })()}

                {/* Content - 3 columns of cards (v6 layout); sole scroll area so header + vitals stay fixed */}
                <div className="v6-content min-h-0">
                    <div className="v6-grid">
                        {(() => {
                            // Common drag props shared by every card.
                            const dragProps = {
                                onDragStart: handleSectionDragStart,
                                onDragOver: handleSectionDragOver,
                                onDrop: handleSectionDrop,
                                onDragEnd: handleSectionDragEnd,
                                draggingId: draggingSection,
                                dragOverId: dragOverSection,
                            }
                            // Each card's JSX, keyed by sectionId. The columns
                            // render below pulls the right card for each
                            // position in `sectionLayout.columns`.
                            const sectionCards: Record<string, React.ReactNode> = {
                                identity: (
                            <CollapsibleCard
                                sectionId="identity"
                                title="Item Details"
                                collapsed={!!sectionLayout.collapsed.identity}
                                onToggle={() => sectionLayout.toggle("identity")}
                                {...dragProps}
                            >
                                {identityContent}
                            </CollapsibleCard>
                                ),
                                organization: (
                            <CollapsibleCard
                                sectionId="organization"
                                title="Organization & Attributes"
                                collapsed={!!sectionLayout.collapsed.organization}
                                onToggle={() => sectionLayout.toggle("organization")}
                                {...dragProps}
                            >
                                {organizationContent}
                            </CollapsibleCard>
                                ),
                                pricing: (
                            <CollapsibleCard
                                sectionId="pricing"
                                title="Pricing & Costing"
                                subText={lastPriceChangeDate
                                    ? `Last modified ${lastPriceChangeDate}${lastModifiedByUser ? ` · ${lastModifiedByUser}` : ""}`
                                    : undefined}
                                collapsed={!!sectionLayout.collapsed.pricing}
                                onToggle={() => sectionLayout.toggle("pricing")}
                                {...dragProps}
                            >
                                    {generalRightColumn}
                            </CollapsibleCard>
                                ),
                                specials: (
                            <CollapsibleCard
                                sectionId="specials"
                                title="Specials & Promotions"
                                subText={formData.stdPrice > 0 ? `$${Number(formData.stdPrice).toFixed(2)} active` : "No active sale"}
                                collapsed={!!sectionLayout.collapsed.specials}
                                onToggle={() => sectionLayout.toggle("specials")}
                                footer={renderFutureSpecial()}
                                {...dragProps}
                            >
                                {renderSpecialsTab()}
                            </CollapsibleCard>
                                ),
                                vendor: (
                            <CollapsibleCard
                                sectionId="vendor"
                                title="Purchasing & Vendor"
                                subText={formData.vendors.find(v => v.mainSupplier)?.name || ""}
                                collapsed={!!sectionLayout.collapsed.vendor}
                                onToggle={() => sectionLayout.toggle("vendor")}
                                {...dragProps}
                            >
                                    <table className="vtbl">
                                        <thead>
                                            <tr>
                                                <th style={{width: "28px"}}><Tooltip text="Main" className="block truncate">Main</Tooltip></th>
                                                <th><Tooltip text="Vendor" className="block truncate">Vendor</Tooltip></th>
                                                <th><Tooltip text="Gross Cost" className="block truncate">Gross Cost</Tooltip></th>
                                                <th><Tooltip text="Case Qty" className="block truncate">Case Qty</Tooltip></th>
                                                <th><Tooltip text="PC Cost" className="block truncate">PC Cost</Tooltip></th>
                                                <th style={{width: "24px"}}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {formData.vendors.map((vendor, index) => (
                                                <tr key={index}>
                                                    <td>
                                                        <input
                                                            type="radio"
                                                            name="mv"
                                                            checked={vendor.mainSupplier}
                                                            onChange={() => {
                                                                const updatedVendors = formData.vendors.map((v, i) => ({
                                                                    ...v,
                                                                    mainSupplier: i === index,
                                                                }))
                                                                handleInputChange("vendors", updatedVendors)
                                                            }}
                                                            style={{width: "13px", height: "13px", accentColor: "var(--ac)"}}
                                                        />
                                                    </td>
                                                    <td>
                                                        <SearchableSelect
                                                            options={supplierOptions}
                                                            value={vendor.id}
                                                            onChange={(val) => {
                                                                const updatedVendors = [...formData.vendors]
                                                                const selectedSupplier = supplierOptions.find(s => s.value === val)
                                                                updatedVendors[index] = {
                                                                    ...updatedVendors[index],
                                                                    id: val,
                                                                    name: selectedSupplier?.label || "",
                                                                }
                                                                handleInputChange("vendors", updatedVendors)
                                                            }}
                                                            placeholder="Select..."
                                                        />
                                                    </td>
                                                    <td>
                                                        <div className="px" data-p="$">
                                                            <Input
                                                                type="number"
                                                                value={vendor.grossCost}
                                                                onChange={(e) => {
                                                                    const updatedVendors = [...formData.vendors]
                                                                    const gc = parseFloat(e.target.value) || 0
                                                                    updatedVendors[index] = {
                                                                        ...updatedVendors[index],
                                                                        grossCost: gc,
                                                                        pcCost: vendor.caseQty > 0 ? parseFloat((gc / vendor.caseQty).toFixed(2)) : gc,
                                                                    }
                                                                    handleInputChange("vendors", updatedVendors)
                                                                }}
                                                                step={0.01}
                                                                className="inp"
                                                                placeholder="--"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <Input
                                                            type="number"
                                                            value={vendor.caseQty}
                                                            onChange={(e) => {
                                                                const updatedVendors = [...formData.vendors]
                                                                const qty = parseInt(e.target.value) || 0
                                                                updatedVendors[index] = {
                                                                    ...updatedVendors[index],
                                                                    caseQty: qty,
                                                                    pcCost: qty > 0 ? parseFloat((vendor.grossCost / qty).toFixed(2)) : vendor.grossCost,
                                                                }
                                                                handleInputChange("vendors", updatedVendors)
                                                            }}
                                                            className="inp"
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                    <td>
                                                        <div className="px" data-p="$">
                                                            <input className="inp ro" value={vendor.pcCost.toFixed(2)} readOnly />
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div
                                                            className="xbtn"
                                                            onClick={() => handleRemoveSupplier(index)}
                                                        >
                                                            x
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {formData.vendors.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} style={{textAlign: "center", padding: "12px", color: "var(--t3)", fontSize: "12px"}}>
                                                        No vendors assigned.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                    <button type="button" className="addbtn" onClick={handleAddSupplier}>
                                        <svg width="11" height="11" fill="none" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                                        Add vendor
                                    </button>
                                    <div className="fr">
                                        <div className="fg">
                                            <label>Vendor Item Code</label>
                                            <Input
                                                type="text"
                                                value={formData.vendorItemCode}
                                                onChange={(e) => handleInputChange("vendorItemCode", e.target.value)}
                                                className="inp w-full"
                                                placeholder="--"
                                            />
                                        </div>
                                        <div className="fg">
                                            <label>Avg Delivery Delay</label>
                                            <Input
                                                type="text"
                                                value={formData.averageDeliveryDelay}
                                                onChange={(e) => handleInputChange("averageDeliveryDelay", e.target.value)}
                                                className="inp w-full"
                                                placeholder="Days"
                                            />
                                        </div>
                                    </div>
                                    <div className="fr">
                                        <div className="fg">
                                            <label>Reorder Point</label>
                                            <Input
                                                type="number"
                                                value={formData.reorderPoint}
                                                onChange={(e) => handleInputChange("reorderPoint", parseInt(e.target.value) || 0)}
                                                className="inp w-full"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="fg">
                                            <label>Restock Level</label>
                                            <Input
                                                type="number"
                                                value={formData.restockLevel}
                                                onChange={(e) => handleInputChange("restockLevel", parseInt(e.target.value) || 0)}
                                                className="inp w-full"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                            </CollapsibleCard>
                                ),
                                variants: (
                            <CollapsibleCard
                                sectionId="variants"
                                title="Variants / Matrix"
                                collapsed={!!sectionLayout.collapsed.variants}
                                onToggle={() => sectionLayout.toggle("variants")}
                                {...dragProps}
                            >
                                {/* Matrix editor — port of legacy desktop FrmMatrix.vb.
                                    Phase 1: Matrix Parent ("2") shows the full
                                    editable grid + bulk Update Cost / Update Price
                                    toolbar (mirrors screenshot 2). Matrix Child
                                    ("3") shows an info message — to edit the matrix
                                    grid the user opens the parent. Requires a saved
                                    parent (currentItemId) and an active store. */}
                                {!isMatrixParent && !isMatrixChild ? (
                                    <div className="matrix-editor matrix-editor--empty">
                                        Change Item Type to <strong>Matrix</strong> to manage variants.
                                    </div>
                                ) : isMatrixChild ? (
                                    <div className="matrix-editor matrix-editor--empty">
                                        This is a <strong>Matrix Child</strong> — open its parent matrix item to edit the variant grid and bulk-update cost/price.
                                    </div>
                                ) : !currentItemId ? (
                                    <div className="matrix-editor matrix-editor--empty">
                                        Save the item first to manage its matrix variants.
                                    </div>
                                ) : !currentStore?.storeId ? (
                                    <div className="matrix-editor matrix-editor--empty">
                                        Select an active store to edit matrix variants.
                                    </div>
                                ) : (
                                    <MatrixEditor
                                        parentItemId={currentItemId}
                                        storeId={currentStore.storeId}
                                        mode="parent"
                                        styleNumberLabel={storeCodeLabels.style}
                                        modelNumberLabel={storeCodeLabels.model}
                                    />
                                )}
                            </CollapsibleCard>
                                ),
                                channels: (
                            <CollapsibleCard
                                sectionId="channels"
                                title="Sales Channels & Web"
                                collapsed={!!sectionLayout.collapsed.channels}
                                onToggle={() => sectionLayout.toggle("channels")}
                                {...dragProps}
                            >
                                    <div className="chg">
                                        <label className="tog">
                                            <input
                                                type="checkbox"
                                                checked={formData.appButton.includes("pos")}
                                                onChange={(e) => {
                                                    const val = e.target.checked
                                                        ? [...formData.appButton, "pos"]
                                                        : formData.appButton.filter((v: string) => v !== "pos")
                                                    handleInputChange("appButton", val)
                                                }}
                                            />
                                            POS Button
                                        </label>
                                        <label className="tog">
                                            <input
                                                type="checkbox"
                                                checked={formData.appButton.includes("self-checkout")}
                                                onChange={(e) => {
                                                    const val = e.target.checked
                                                        ? [...formData.appButton, "self-checkout"]
                                                        : formData.appButton.filter((v: string) => v !== "self-checkout")
                                                    handleInputChange("appButton", val)
                                                }}
                                            />
                                            Self-Checkout
                                        </label>
                                        <label className="tog">
                                            <input
                                                type="checkbox"
                                                checked={formData.appButton.includes("deli")}
                                                onChange={(e) => {
                                                    const val = e.target.checked
                                                        ? [...formData.appButton, "deli"]
                                                        : formData.appButton.filter((v: string) => v !== "deli")
                                                    handleInputChange("appButton", val)
                                                }}
                                            />
                                            Deli
                                        </label>
                                        <label className="tog">
                                            <input
                                                type="checkbox"
                                                checked={formData.sellOnWeb}
                                                onChange={(e) => handleInputChange("sellOnWeb", e.target.checked)}
                                            />
                                            Sell on Web
                                        </label>
                                        <label className="tog">
                                            <input
                                                type="checkbox"
                                                checked={formData.appButton.includes("phone-order")}
                                                onChange={(e) => {
                                                    const val = e.target.checked
                                                        ? [...formData.appButton, "phone-order"]
                                                        : formData.appButton.filter((v: string) => v !== "phone-order")
                                                    handleInputChange("appButton", val)
                                                }}
                                            />
                                            Phone Order
                                        </label>
                                    </div>
                                    <div className="sdash" />
                                    <div className="fr">
                                        <div className="fg">
                                            <label>Web Price</label>
                                            <div className="px" data-p="$">
                                                <Input
                                                    type="number"
                                                    value={formData.webPrice}
                                                    onChange={(e) => handleInputChange("webPrice", parseFloat(e.target.value) || 0)}
                                                    step={0.01}
                                                    className="inp w-full"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                        <div className="fg">
                                            <label>Web Case Price</label>
                                            <div className="px" data-p="$">
                                                <Input
                                                    type="number"
                                                    value={formData.webCasePrice}
                                                    onChange={(e) => handleInputChange("webCasePrice", parseFloat(e.target.value) || 0)}
                                                    step={0.01}
                                                    className="inp w-full"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                {/* Custom Fields (collapsible) */}
                                <div className={`${isCustomFieldsOpen ? "border-t border-gray-200 dark:border-gray-700" : ""}`}>
                                    <button
                                        type="button"
                                        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer border-t border-gray-200 dark:border-gray-700"
                                        onClick={() => setIsCustomFieldsOpen(v => !v)}
                                    >
                                        <span style={{fontSize: "9px", transition: "transform .2s", transform: isCustomFieldsOpen ? "rotate(90deg)" : "none"}}>&#9654;</span>
                                        Custom Fields (10)
                                    </button>
                                    {isCustomFieldsOpen && (
                                        <div className="adv-body" style={{background: "var(--s2)"}}>
                                            <div className="cfg">
                                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((fieldNum) => {
                                                    const fieldKey = `customField${fieldNum}` as keyof typeof formData
                                                    const options = customFieldOptions[fieldNum] || []
                                                    return (
                                                        <div key={fieldNum} className="fg">
                                                            <label>Field {fieldNum}</label>
                                                            <SearchableSelect
                                                                options={options}
                                                                value={formData[fieldKey] as string}
                                                                placeholder="--"
                                                                onChange={(value) => handleInputChange(fieldKey, value)}
                                                                loading={isLoadingLookups}
                                                            />
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Extra Fields & Additional UPCs (collapsible).
                                    Hidden when the current item IS a Tag-Along
                                    — the desktop FrmItems disables these
                                    inputs because a Tag-Along item can't have
                                    its own extra-charges (it IS the extra
                                    charge attached to other items). */}
                                {!isTagAlongItem && (
                                <div>
                                    <button
                                        type="button"
                                        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer border-t border-gray-200 dark:border-gray-700"
                                        onClick={() => setIsExtraFieldsOpen(v => !v)}
                                    >
                                        <span style={{fontSize: "9px", transition: "transform .2s", transform: isExtraFieldsOpen ? "rotate(90deg)" : "none"}}>&#9654;</span>
                                        Extra Fields &amp; Additional UPCs
                                    </button>
                                    {isExtraFieldsOpen && (
                                        <div className="adv-body" style={{background: "var(--s2)"}}>
                                            <div className="fr">
                                                <div className="fg">
                                                    <label>Tag Along 1</label>
                                                    <SearchableSelect
                                                        options={extraChargeOptions}
                                                        value={formData.extraCharge1}
                                                        onChange={(value) => handleInputChange("extraCharge1", value)}
                                                        loading={isLoadingLookups}
                                                        className="w-full"
                                                        placeholder="Select charge"
                                                    />
                                                </div>
                                                <div className="fg">
                                                    <label>Tag Along 2</label>
                                                    <SearchableSelect
                                                        options={extraChargeOptions}
                                                        value={formData.extraCharge2}
                                                        onChange={(value) => handleInputChange("extraCharge2", value)}
                                                        loading={isLoadingLookups}
                                                        className="w-full"
                                                        placeholder="Select charge"
                                                    />
                                                </div>
                                                <div className="fg">
                                                    <label>Tag Along 3</label>
                                                    <SearchableSelect
                                                        options={extraChargeOptions}
                                                        value={formData.extraCharge3}
                                                        onChange={(value) => handleInputChange("extraCharge3", value)}
                                                        loading={isLoadingLookups}
                                                        className="w-full"
                                                        placeholder="Select charge"
                                                    />
                                                </div>
                                            </div>
                                            <div className="fr">
                                                <div className="fg">
                                                    <label>Tag Along (Note 1)</label>
                                                    <TextArea
                                                        value={formData.extraInfo1}
                                                        onChange={(value) => handleInputChange("extraInfo1", value)}
                                                        rows={2}
                                                    />
                                                </div>
                                                <div className="fg">
                                                    <label>Tag Along (Note 2)</label>
                                                    <TextArea
                                                        value={formData.extraInfo2}
                                                        onChange={(value) => handleInputChange("extraInfo2", value)}
                                                        rows={2}
                                                    />
                                                </div>
                                            </div>
                                            <div className="fg"><label>Additional UPCs</label></div>
                                            <div className="ul">
                                                {formData.upcCodes.map((code, index) => (
                                                    <div key={index} className="ur">
                                                        <Input
                                                            type="text"
                                                            value={code}
                                                            placeholder="Enter UPC..."
                                                            onChange={(e) => {
                                                                const newCodes = [...formData.upcCodes]
                                                                newCodes[index] = e.target.value
                                                                handleInputChange("upcCodes", newCodes)
                                                            }}
                                                            className="inp flex-1"
                                                        />
                                                        <div className="xbtn" onClick={() => handleRemoveAlias(index)}>x</div>
                                                    </div>
                                                ))}
                                            </div>
                                            <button type="button" className="addbtn" onClick={handleAddAlias}>
                                                <svg width="11" height="11" fill="none" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                                                Add UPC
                                            </button>
                                        </div>
                                    )}
                                </div>
                                )}
                            </CollapsibleCard>
                                ),
                                stats: (
                            <CollapsibleCard
                                sectionId="stats"
                                title="Sales Statistics"
                                collapsed={!!sectionLayout.collapsed.stats}
                                onToggle={() => sectionLayout.toggle("stats")}
                                {...dragProps}
                            >
                                    <div className="sg">
                                        <div className="sc2"><div className="sn2 m">{formData.mtdQty || 0}</div><div className="sl2">MTD Qty</div></div>
                                        <div className="sc2"><div className="sn2 m">${Number(formData.mtdAmount || 0).toFixed(0)}</div><div className="sl2">MTD $</div></div>
                                        <div className="sc2"><div className="sn2 m">{formData.mtdReturnQty || 0}</div><div className="sl2">MTD Ret.</div></div>
                                        <div className="sc2"><div className="sn2 m">{formData.ptdQty || 0}</div><div className="sl2">PTD Qty</div></div>
                                        <div className="sc2"><div className="sn2 m">${Number(formData.ptdAmount || 0).toFixed(0)}</div><div className="sl2">PTD $</div></div>
                                        <div className="sc2"><div className="sn2 m">{formData.ptdReturnQty || 0}</div><div className="sl2">PTD Ret.</div></div>
                                        <div className="sc2"><div className="sn2 m">{formData.ytdQty || 0}</div><div className="sl2">YTD Qty</div></div>
                                        <div className="sc2"><div className="sn2 m">${Number(formData.ytdAmount || 0).toFixed(0)}</div><div className="sl2">YTD $</div></div>
                                        <div className="sc2"><div className="sn2 m">{formData.ytdReturnQty || 0}</div><div className="sl2">YTD Ret.</div></div>
                                    </div>
                                    <div className="fr" style={{marginTop: "2px"}}>
                                        <button type="button" onClick={handlePrintLabel} className="v6-btn" style={{flex: 1, justifyContent: "center", fontSize: "12px"}}>Print Label</button>
                                        <button type="button" className="v6-btn" style={{flex: 1, justifyContent: "center", fontSize: "12px"}}>Add to Print List</button>
                                    </div>
                            </CollapsibleCard>
                                ),
                            }
                            return sectionLayout.columns.map((colIds, colIdx) => (
                                <div
                                    key={colIdx}
                                    className="v6-col"
                                    data-col-index={colIdx}
                                    // Allow drops on empty space inside a
                                    // column (drop "at the end" of that col).
                                    onDragOver={(e) => { if (draggingSection) e.preventDefault() }}
                                    onDrop={(e) => {
                                        // A drop on a card inside the column
                                        // has already been handled and will
                                        // have cleared `draggingSection`; this
                                        // branch only fires for empty-space drops.
                                        e.preventDefault()
                                        if (draggingSection) {
                                            sectionLayout.moveToColumnEnd(draggingSection, colIdx)
                                            setDraggingSection(null)
                                            setDragOverSection(null)
                                        }
                                    }}
                                >
                                    {colIds
                                        // Skip sections that don't apply to
                                        // the current item-type. Mirrors the
                                        // desktop FrmItems "tabVendor.Visible
                                        // = false" for Service / Tag-Along
                                        // — those items don't have a
                                        // purchasable supply chain.
                                        .filter(id => {
                                            if (id === "vendor" && (isServiceItem || isTagAlongItem)) return false
                                            return true
                                        })
                                        .map(id => (
                                            <React.Fragment key={id}>{sectionCards[id]}</React.Fragment>
                                        ))}
                                </div>
                            ))
                        })()}
                    </div>
                </div>
            </div>

            <PrintLabelsDialog
                isOpen={printLabelDialogOpen}
                onClose={() => setPrintLabelDialogOpen(false)}
                itemStoreIds={id ? [id] : []}
                labelType={1}
            />
        </div>
    )
}

export default ItemFormPage
