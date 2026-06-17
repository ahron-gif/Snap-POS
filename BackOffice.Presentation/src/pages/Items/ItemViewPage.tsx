import React, { useState, useEffect, useCallback } from "react"
import Button from "../../components/ui/button/Button"
import Loader from "../../components/ui/loader/Loader"
import Label from "../../components/form/Label"
import { useDashboardTabs } from "../../context/DashboardTabContext"
import { useStore } from "../../context/StoreContext"
import { itemService } from "../../services/itemService"
import { lookupService, LookupDto, DepartmentLookupDto, ItemGroupLookupDto, ManufacturerLookupDto, ExtraChargeItemLookupDto } from "../../services/lookupService"

// Props interface for tab-based navigation
interface ItemViewPageProps {
  id: string
  _refreshKey?: number // Set by tab system when re-opening an existing tab to trigger data reload
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

// Item data interface - matches API response
interface ItemData {
  // Basic Info
  itemId: string
  itemStoreId: string
  name: string
  barcodeNumber: string
  modalNumber: string
  description: string
  size: string
  itemType: number
  barcodeType: number
  departmentId: string
  departmentName: string
  binLocation: string
  manufacturerId: string
  manufacturerName: string
  units: string
  measure: string
  patternName: string

  // Cost & Pricing
  cost: number
  price: number
  listPrice: number
  casePrice: number
  caseQty: number
  caseBarcodeNumber: string
  profitMargin: number
  markup: number

  // Flags
  isTaxable: boolean
  isDiscount: boolean
  isFoodStampable: boolean
  isWIC: boolean
  priceByCase: boolean
  costByCase: boolean
  tare: number

  // Inventory
  onHand: number
  onOrder: number
  onTransferOrder: number
  onSaleOrder: number
  reorderPoint: number
  restockLevel: number
  averageCost: number

  // Sales Stats
  mtdQty: number
  mtdAmount: number
  ptdQty: number
  ptdAmount: number
  ytdQty: number
  ytdAmount: number
  mtdReturnQty: number
  ptdReturnQty: number
  ytdReturnQty: number

  // Web Sales
  onWeb: boolean
  webPrice: number
  webCasePrice: number

  // Specials
  saleType: number
  salePrice: number
  specialPrice: number
  saleStartDate: string
  saleEndDate: string
  saleMin: number
  saleMax: number

  // Vendors
  vendors: VendorItem[]

  // Extra
  extraCharge1: string
  extraCharge2: string
  extraCharge3: string
  extraCharge1Name: string
  extraCharge2Name: string
  extraCharge3Name: string
  extraInfo: string
  extraInfo2: string
  customerCode: string
  styleNo: string
  customInteger1: string
  upcCodes: string[]
  appButton: string[]

  // Custom Fields
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

  // Groups
  groups: string[]

  // Image
  imageUrl: string | null
}

interface VendorItem {
  id: string
  mainSupplier: boolean
  grossCost: number
  caseQty: number
  pcCost: number
  name: string
}

// Reusable components for read-only display
const Section: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({
  title,
  children,
  className = "",
}) => (
  <div className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 shadow-card ${className}`}>
    <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
      <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-200 uppercase tracking-wider">{title}</h3>
    </div>
    <div className="p-4">{children}</div>
  </div>
)

const DisplayField: React.FC<{
  label: string
  value: string | number | boolean | null | undefined
  type?: "text" | "currency" | "number" | "boolean" | "date" | "percent"
  className?: string
}> = ({ label, value, type = "text", className = "" }) => {
  const formatValue = () => {
    if (value === null || value === undefined || value === "") return "-"

    switch (type) {
      case "currency":
        return `$${Number(value).toFixed(2)}`
      case "number":
        return Number(value).toLocaleString()
      case "boolean":
        return value ? "Yes" : "No"
      case "date":
        return value ? new Date(String(value)).toLocaleDateString() : "-"
      case "percent":
        return `${Number(value).toFixed(2)}%`
      default:
        return String(value)
    }
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-xs text-gray-500 dark:text-gray-400">{label}</Label>
      <div className="text-sm font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700/30 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-600">
        {formatValue()}
      </div>
    </div>
  )
}

const DisplayRow: React.FC<{
  label: string
  value: string | number | boolean | null | undefined
  type?: "text" | "currency" | "number" | "boolean" | "date" | "percent"
}> = ({ label, value, type = "text" }) => {
  const formatValue = () => {
    if (value === null || value === undefined || value === "") return "-"

    switch (type) {
      case "currency":
        return `$${Number(value).toFixed(2)}`
      case "number":
        return Number(value).toLocaleString()
      case "boolean":
        return value ? "Yes" : "No"
      case "date":
        return value ? new Date(String(value)).toLocaleDateString() : "-"
      case "percent":
        return `${Number(value).toFixed(2)}%`
      default:
        return String(value)
    }
  }

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-900 dark:text-white">{formatValue()}</span>
    </div>
  )
}

const Badge: React.FC<{ active: boolean; label: string }> = ({ active, label }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
      active
        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
        : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
    }`}
  >
    {label}: {active ? "Yes" : "No"}
  </span>
)

const ItemViewPage: React.FC<ItemViewPageProps> = ({ id, _refreshKey }) => {
  const { openTab, closeTab, activeTabId } = useDashboardTabs()
  const { currentStore } = useStore()

  const [activeTab, setActiveTab] = useState<TabKey>("general")
  const [itemData, setItemData] = useState<ItemData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  // Lookup data for displaying labels
  const [itemTypeLabel, setItemTypeLabel] = useState<string>("")
  const [barcodeTypeLabel, setBarcodeTypeLabel] = useState<string>("")
  const [appItemLabels, setAppItemLabels] = useState<Record<string, string>>({})

  // Item type labels
  const ITEM_TYPE_LABELS: Record<number, string> = {
    0: "Standard",
    1: "Weight",
    2: "Matrix",
    3: "Matrix Child",
    4: "Service",
    5: "Tag Along",
  }

  // Barcode type labels
  const BARCODE_TYPE_LABELS: Record<number, string> = {
    0: "Standard",
    1: "Random Weight",
    2: "Coupon",
  }

  // Measure labels (matching MEASURE_OPTIONS in ItemFormPage)
  const MEASURE_LABELS: Record<number, string> = {
    1: "Oz.", 2: "Lb.", 3: "Pc.", 4: "Bag", 5: "Kg.", 6: "Gr.",
    7: "Lt", 8: "Gll", 9: "Cnt.", 10: "Bx.", 11: "Ml.", 12: "Pack",
    13: "Pair", 14: "Sq. Ft.", 15: "Tray", 16: "Bunch", 17: "Fl oz",
    18: "Pt", 19: "Qt", 20: "Ml",
  }

  // Sale type labels
  const SALE_TYPE_LABELS: Record<number, string> = {
    0: "No Sale",
    1: "Standard",
    2: "Break Down",
    3: "Mix & Match",
    4: "Combined",
  }

  // Load item data
  // _refreshKey changes when the tab is re-opened, triggering a data reload
  useEffect(() => {
    if (id) {
      // Reset all item-specific state before loading to prevent stale data
      setItemData(null)
      setIsLoading(true)
      setError(null)
      setImageUrl(null)
      setItemTypeLabel("")
      setBarcodeTypeLabel("")
      setAppItemLabels({})
      setActiveTab("general")
      loadItemData(id)
    }
  }, [id, _refreshKey])

  // Resolve Extra Charge names and App Button labels after item data loads
  useEffect(() => {
    if (!itemData) return

    // Resolve extra charge names
    const resolveExtraChargeNames = async () => {
      const storeId = currentStore?.storeId
      if (!storeId) return
      const hasAnyCharge = itemData.extraCharge1 || itemData.extraCharge2 || itemData.extraCharge3
      if (!hasAnyCharge) return

      try {
        const response = await lookupService.getExtraChargeItems(storeId)
        if (response.success && response.data) {
          const ecMap: Record<string, string> = {}
          response.data.forEach((ec: ExtraChargeItemLookupDto) => {
            ecMap[String(ec.itemStoreID).toLowerCase()] = ec.name
          })
          setItemData(prev => prev ? {
            ...prev,
            extraCharge1Name: prev.extraCharge1 ? (ecMap[prev.extraCharge1] || prev.extraCharge1) : "",
            extraCharge2Name: prev.extraCharge2 ? (ecMap[prev.extraCharge2] || prev.extraCharge2) : "",
            extraCharge3Name: prev.extraCharge3 ? (ecMap[prev.extraCharge3] || prev.extraCharge3) : "",
          } : prev)
        }
      } catch (e) {
        console.error("Error resolving extra charge names:", e)
      }
    }

    // Resolve app button labels
    const resolveAppButtonLabels = async () => {
      if (!itemData.appButton || itemData.appButton.length === 0) return
      try {
        const response = await lookupService.getAppItems()
        if (response.success && response.data) {
          const labels: Record<string, string> = {}
          response.data.forEach((app: any) => {
            labels[app.id.toString()] = app.appName
          })
          setAppItemLabels(labels)
        }
      } catch (e) {
        console.error("Error resolving app button labels:", e)
      }
    }

    resolveExtraChargeNames()
    resolveAppButtonLabels()
  }, [itemData?.extraCharge1, itemData?.extraCharge2, itemData?.extraCharge3, itemData?.appButton, currentStore?.storeId])

  const loadItemData = async (itemId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await itemService.getItem(itemId)

      if (response.success && response.data) {
        const item = response.data
        setItemData({
          itemId: item.itemID || item.itemId || itemId,
          itemStoreId: item.itemStoreID || item.itemStoreId || itemId,
          name: item.name || "",
          barcodeNumber: item.barcodeNumber || "",
          modalNumber: item.modalNumber || "",
          description: item.description || "",
          size: item.size || "",
          itemType: item.itemType || 0,
          barcodeType: item.barcodeType || 0,
          departmentId: item.departmentID || "",
          departmentName: item.department || "",
          binLocation: item.binLocation || "",
          manufacturerId: item.manufacturerID || "",
          manufacturerName: item.brand || item.manufacturerName || "",
          units: item.units != null ? item.units.toString() : "",
          measure: item.meaasure != null ? (MEASURE_LABELS[item.meaasure] || "") : "",
          patternName: item.extName || "",

          cost: item.cost || 0,
          price: item.price || 0,
          listPrice: item.listPrice || 0,
          casePrice: item.casePrice || 0,
          caseQty: item.caseQty || 0,
          caseBarcodeNumber: item.caseBarcodeNumber || item.caseCode || "",
          profitMargin: item.margin || 0,
          markup: item.markup || 0,

          isTaxable: item.isTaxable || false,
          isDiscount: item.isDiscount || false,
          isFoodStampable: item.isFoodStampable || false,
          isWIC: item.isWIC || false,
          priceByCase: item.priceByCase || false,
          costByCase: item.costByCase || false,
          tare: item.tare || 0,

          onHand: item.onHand || 0,
          onOrder: item.onOrder || 0,
          onTransferOrder: item.onTransferOrder || 0,
          onSaleOrder: item.onSaleOrder || 0,
          reorderPoint: item.reorderPoint || 0,
          restockLevel: item.restockLevel || 0,
          averageCost: item.avgCost || item.aVGCost || 0,

          mtdQty: item.mtD_Pc_Qty || 0,
          mtdAmount: item.mtd || 0,
          ptdQty: item.ptD_Pc_Qty || 0,
          ptdAmount: item.ptd || 0,
          ytdQty: item.ytD_Pc_Qty || 0,
          ytdAmount: item.ytd || 0,
          mtdReturnQty: item.mtdReturnQty || 0,
          ptdReturnQty: item.ptdReturnQty || 0,
          ytdReturnQty: item.ytdReturnQty || 0,

          onWeb: item.sellOnWeb === true,
          webPrice: item.webPrice || 0,
          webCasePrice: item.webCasePrice || 0,

          saleType: item.saleType || 0,
          salePrice: item.salePrice || 0,
          specialPrice: item.specialPrice || 0,
          saleStartDate: item.saleStartDate || "",
          saleEndDate: item.saleEndDate || "",
          saleMin: item.saleMin || 0,
          saleMax: item.saleMax || 0,

          vendors: item.itemSupplies?.map((v: any) => ({
            id: v.supplierNo,
            mainSupplier: v.isMainSupplier,
            grossCost: v.grossCost || 0,
            caseQty: v.qtyPerCase || 0,
            pcCost: v.totalCost || 0,
            name: v.supplierName || "",
          })) || [],

          extraCharge1: item.extraCharge1 ? String(item.extraCharge1).toLowerCase() : "",
          extraCharge2: item.extraCharge2 ? String(item.extraCharge2).toLowerCase() : "",
          extraCharge3: item.extraCharge3 ? String(item.extraCharge3).toLowerCase() : "",
          extraCharge1Name: "",
          extraCharge2Name: "",
          extraCharge3Name: "",
          extraInfo: item.extraInfo || "",
          extraInfo2: item.extraInfo2 || "",
          customerCode: item.customerCode || "",
          styleNo: item.styleNo || "",
          customInteger1: item.customInteger1 != null ? item.customInteger1.toString() : "",
          upcCodes: item.itemAlias ? item.itemAlias.split(",").map((s: string) => s.trim()).filter((s: string) => s) : [],
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

          groups: item.itemToGroups?.map((g: any) => g.itemGroupID) || [],

          imageUrl: item.imageUrl || null,
        })

        setItemTypeLabel(ITEM_TYPE_LABELS[item.itemType] || "Standard")
        setBarcodeTypeLabel(BARCODE_TYPE_LABELS[item.barcodeType] || "Standard")

        // Load image if available - use itemNo or itemID (ItemMain.ItemID for image lookup)
        const itemMainId = item.itemNo || item.itemID || item.itemId
        if (itemMainId) {
          loadItemImage(itemMainId)
        }
      } else {
        setError(response.message || "Failed to load item data")
      }
    } catch (err) {
      console.error("Error loading item:", err)
      setError("An error occurred while loading the item")
    } finally {
      setIsLoading(false)
    }
  }

  const loadItemImage = async (itemId: string) => {
    try {
      const response = await itemService.getImageUrl(itemId, 1)
      if (response.success && response.data?.imageUrl) {
        setImageUrl(response.data.imageUrl)
      }
    } catch (err) {
      console.error("Error loading image:", err)
    }
  }

  // Navigate back to list
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

  // Navigate to edit mode
  const handleEdit = useCallback(() => {
    if (activeTabId) {
      closeTab(activeTabId)
    }
    openTab({
      component: "ItemFormPage",
      title: `Edit: ${itemData?.name || "Item"}`,
      closable: true,
      editMode: true,
      props: { id },
    })
  }, [activeTabId, closeTab, openTab, id, itemData?.name])

  // Render General Tab
  const renderGeneralTab = () => {
    if (!itemData) return null

    return (
      <div className="grid grid-cols-12 gap-5">
        {/* Left Column - Basic Info */}
        <div className="col-span-3 space-y-4">
          {/* Image */}
          <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-800/30">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={itemData.name}
                className="w-full h-32 object-contain rounded"
              />
            ) : (
              <div className="w-full h-32 flex items-center justify-center">
                <svg className="w-16 h-16 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>

          <DisplayField label="Description" value={itemData.description} />

          <div className="grid grid-cols-2 gap-2">
            <DisplayField label="Item Type" value={itemTypeLabel} />
            <DisplayField label="UPC Type" value={barcodeTypeLabel} />
          </div>

          <DisplayField label="Department" value={itemData.departmentName} />

          <div className="grid grid-cols-2 gap-2">
            <DisplayField label="Size" value={itemData.size} />
            <DisplayField label="Location" value={itemData.binLocation} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <DisplayField label="Units" value={itemData.units} />
            <DisplayField label="Measure" value={itemData.measure} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <DisplayField label="Brand" value={itemData.manufacturerName} />
            <DisplayField label="Pattern" value={itemData.patternName} />
          </div>
        </div>

        {/* Middle Column - Cost & Pricing */}
        <div className="col-span-5 space-y-4">
          <Section title="Cost & Pricing">
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                <DisplayField label="List Price" value={itemData.listPrice} type="currency" />
                <DisplayField label="Cost" value={itemData.cost} type="currency" />
                <DisplayField label="Price" value={itemData.price} type="currency" />
                <DisplayField label="Profit %" value={itemData.profitMargin} type="percent" />
              </div>

              <div className="grid grid-cols-4 gap-2">
                <DisplayField label="Case Cost" value={itemData.cost * itemData.caseQty} type="currency" />
                <DisplayField label="Case Qty" value={itemData.caseQty} type="number" />
                <DisplayField label="Case Price" value={itemData.casePrice} type="currency" />
                <DisplayField label="Markup %" value={itemData.markup} type="percent" />
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Badge active={itemData.isTaxable} label="Taxable" />
                <Badge active={itemData.isDiscount} label="Discountable" />
                <Badge active={itemData.isFoodStampable} label="Food Stamp" />
                <Badge active={itemData.isWIC} label="WIC" />
                <Badge active={itemData.priceByCase} label="Price by Case" />
              </div>

              {itemData.tare > 0 && (
                <DisplayField label="Tare" value={itemData.tare} type="number" />
              )}
            </div>
          </Section>

          <Section title="Inventory">
            <div className="grid grid-cols-4 gap-2">
              <DisplayField label="On Hand" value={itemData.onHand} type="number" />
              <DisplayField label="On Order" value={itemData.onOrder} type="number" />
              <DisplayField label="Reorder Pt" value={itemData.reorderPoint} type="number" />
              <DisplayField label="Restock Lvl" value={itemData.restockLevel} type="number" />
            </div>
          </Section>

          <Section title="Web Sales">
            <div className="flex items-center gap-4">
              <Badge active={itemData.onWeb} label="Sell on Web" />
              <DisplayField label="Web Price" value={itemData.webPrice} type="currency" className="flex-1" />
              <DisplayField label="Web Case" value={itemData.webCasePrice} type="currency" className="flex-1" />
            </div>
          </Section>
        </div>

        {/* Right Column - Activity */}
        <div className="col-span-4 space-y-4">
          <Section title="Activity">
            <div className="space-y-1">
              <div className="grid grid-cols-3 gap-2 text-xs font-medium text-gray-500 pb-1 border-b border-gray-200 dark:border-gray-700">
                <span></span>
                <span className="text-center">Qty</span>
                <span className="text-center">Amount</span>
              </div>
              {[
                { label: "MTD", qty: itemData.mtdQty, amt: itemData.mtdAmount },
                { label: "PTD", qty: itemData.ptdQty, amt: itemData.ptdAmount },
                { label: "YTD", qty: itemData.ytdQty, amt: itemData.ytdAmount },
              ].map(({ label, qty, amt }) => (
                <div key={label} className="grid grid-cols-3 gap-2 py-1">
                  <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
                  <span className="text-sm text-center font-medium text-gray-900 dark:text-white">{qty}</span>
                  <span className="text-sm text-center font-medium text-gray-900 dark:text-white">${amt.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Returns">
            <div className="grid grid-cols-3 gap-2">
              <DisplayField label="MTD" value={itemData.mtdReturnQty} type="number" />
              <DisplayField label="PTD" value={itemData.ptdReturnQty} type="number" />
              <DisplayField label="YTD" value={itemData.ytdReturnQty} type="number" />
            </div>
          </Section>

          <Section title="Avg Cost">
            <DisplayField label="Average Cost" value={itemData.averageCost} type="currency" />
          </Section>
        </div>
      </div>
    )
  }

  // Render Sales Tab
  const renderSalesTab = () => {
    if (!itemData) return null

    return (
      <div className="grid grid-cols-2 gap-6">
        <Section title="Sales Info">
          <div className="space-y-2">
            <DisplayRow label="MTD Qty" value={itemData.mtdQty} type="number" />
            <DisplayRow label="MTD Amount" value={itemData.mtdAmount} type="currency" />
            <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
            <DisplayRow label="PTD Qty" value={itemData.ptdQty} type="number" />
            <DisplayRow label="PTD Amount" value={itemData.ptdAmount} type="currency" />
            <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
            <DisplayRow label="YTD Qty" value={itemData.ytdQty} type="number" />
            <DisplayRow label="YTD Amount" value={itemData.ytdAmount} type="currency" />
            <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
            <DisplayRow label="MTD Return Qty" value={itemData.mtdReturnQty} type="number" />
            <DisplayRow label="PTD Return Qty" value={itemData.ptdReturnQty} type="number" />
            <DisplayRow label="YTD Return Qty" value={itemData.ytdReturnQty} type="number" />
          </div>
        </Section>

        <Section title="Inventory">
          <div className="space-y-2">
            <DisplayRow label="Average Cost" value={itemData.averageCost} type="currency" />
            <DisplayRow label="On Hand" value={itemData.onHand} type="number" />
            <DisplayRow label="On Order" value={itemData.onOrder} type="number" />
            <DisplayRow label="On Transfer Order" value={itemData.onTransferOrder} type="number" />
            <DisplayRow label="On Sale Order" value={itemData.onSaleOrder} type="number" />
            <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
            <DisplayRow label="Reorder Point" value={itemData.reorderPoint} type="number" />
            <DisplayRow label="Restock Level" value={itemData.restockLevel} type="number" />
          </div>
        </Section>
      </div>
    )
  }

  // Render Specials Tab
  const renderSpecialsTab = () => {
    if (!itemData) return null

    return (
      <div className="space-y-6">
        <Section title="Specials">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <DisplayField label="Sale Type" value={SALE_TYPE_LABELS[itemData.saleType] || "No Sale"} />
              <DisplayField label="Cost" value={itemData.cost} type="currency" />
              <DisplayField label="Regular Price" value={itemData.price} type="currency" />
            </div>

            {itemData.saleType > 0 && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <DisplayField label="Special Price" value={itemData.specialPrice} type="currency" />
                  <DisplayField label="Sale Price" value={itemData.salePrice} type="currency" />
                  <DisplayField label="Min Qty" value={itemData.saleMin} type="number" />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <DisplayField label="Max Qty" value={itemData.saleMax} type="number" />
                  <DisplayField label="From Date" value={itemData.saleStartDate} type="date" />
                  <DisplayField label="To Date" value={itemData.saleEndDate} type="date" />
                </div>
              </>
            )}
          </div>
        </Section>
      </div>
    )
  }

  // Render Vendor Tab
  const renderVendorTab = () => {
    if (!itemData) return null

    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Main</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Supplier Name</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Gross Cost</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Case Qty</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Pc Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
              {itemData.vendors.length > 0 ? (
                itemData.vendors.map((vendor, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      {vendor.mainSupplier && (
                        <span className="text-amber-500">&#9733;</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{vendor.name}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">${vendor.grossCost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">{vendor.caseQty}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">${vendor.pcCost.toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                    No vendors assigned
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Render Extra Tab
  const renderExtraTab = () => {
    if (!itemData) return null

    return (
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <Section title="Extra Charges">
            <div className="space-y-2">
              <DisplayRow label="Extra Charge 1" value={itemData.extraCharge1Name || "-"} />
              <DisplayRow label="Extra Charge 2" value={itemData.extraCharge2Name || "-"} />
              <DisplayRow label="Extra Charge 3" value={itemData.extraCharge3Name || "-"} />
            </div>
          </Section>

          <Section title="Extra Info">
            <div className="space-y-3">
              <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded border border-gray-200 dark:border-gray-600 min-h-[60px]">
                <p className="text-sm text-gray-700 dark:text-gray-300">{itemData.extraInfo || "-"}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded border border-gray-200 dark:border-gray-600 min-h-[60px]">
                <p className="text-sm text-gray-700 dark:text-gray-300">{itemData.extraInfo2 || "-"}</p>
              </div>
            </div>
          </Section>

          <Section title="Web Settings">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge active={itemData.onWeb} label="Sell On Web" />
              </div>
              <DisplayRow label="Web Price" value={itemData.webPrice} type="currency" />
              <DisplayRow label="Web Case Price" value={itemData.webCasePrice} type="currency" />
            </div>
          </Section>

          <div className="space-y-2">
            <DisplayRow label="Style No" value={itemData.styleNo || "-"} />
            <DisplayRow label="Customer Code" value={itemData.customerCode || "-"} />
            <DisplayRow label="Number" value={itemData.customInteger1 || "-"} />
          </div>
        </div>

        <div className="space-y-4">
          <Section title="UPC Codes">
            {itemData.upcCodes.length > 0 ? (
              <div className="space-y-1">
                {itemData.upcCodes.map((code, index) => (
                  <div key={index} className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{index + 1}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{code}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-2">No UPC codes</p>
            )}
          </Section>

          {itemData.appButton.length > 0 && (
            <Section title="App Button">
              <div className="flex flex-wrap gap-2">
                {itemData.appButton.map((appId) => (
                  <span key={appId} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">
                    {appItemLabels[appId] || `App ${appId}`}
                  </span>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    )
  }

  // Render Custom Fields Tab
  const renderCustomFieldsTab = () => {
    if (!itemData) return null

    const customFields = [
      { num: 1, value: itemData.customField1 },
      { num: 2, value: itemData.customField2 },
      { num: 3, value: itemData.customField3 },
      { num: 4, value: itemData.customField4 },
      { num: 5, value: itemData.customField5 },
      { num: 6, value: itemData.customField6 },
      { num: 7, value: itemData.customField7 },
      { num: 8, value: itemData.customField8 },
      { num: 9, value: itemData.customField9 },
      { num: 10, value: itemData.customField10 },
    ]

    return (
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-3">
          {customFields.slice(0, 5).map(({ num, value }) => (
            <div key={num} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Label className="w-24 text-sm font-medium text-gray-500 dark:text-gray-400">Custom {num}:</Label>
              <div className="flex-1 text-sm font-medium text-gray-900 dark:text-white bg-white dark:bg-gray-700/50 px-3 py-2 rounded border border-gray-200 dark:border-gray-600">
                {value || "-"}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {customFields.slice(5, 10).map(({ num, value }) => (
            <div key={num} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Label className="w-24 text-sm font-medium text-gray-500 dark:text-gray-400">Custom {num}:</Label>
              <div className="flex-1 text-sm font-medium text-gray-900 dark:text-white bg-white dark:bg-gray-700/50 px-3 py-2 rounded border border-gray-200 dark:border-gray-600">
                {value || "-"}
              </div>
            </div>
          ))}
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

  // Show loading spinner
  if (isLoading) {
    return (
      <Loader size="lg" label="Loading item data..." />
    )
  }

  // Show error
  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Failed to Load Item</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{error}</p>
          <Button variant="outline" onClick={goBackToList}>
            Back to List
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
        <div className="px-5 py-3.5">
          <div className="flex items-center justify-between">
            {/* Item Info */}
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-base font-semibold text-gray-900 dark:text-white">
                  {itemData?.name || "Item Details"}
                </h1>
                <div className="flex items-center gap-3 mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  <span>UPC: <span className="font-medium text-gray-700 dark:text-gray-300">{itemData?.barcodeNumber || "-"}</span></span>
                  {itemData?.modalNumber && (
                    <span>Alt: <span className="font-medium text-gray-700 dark:text-gray-300">{itemData.modalNumber}</span></span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button variant="primary" size="sm" onClick={handleEdit}>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </Button>
              <Button variant="outline" size="sm" onClick={goBackToList}>
                Back to List
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-5 gap-1 border-t border-gray-100 dark:border-gray-700">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-xs font-medium transition-all duration-200 relative ${
                activeTab === tab.key
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

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-5 bg-gray-50 dark:bg-gray-900/50">
        {renderTabContent()}
      </div>
    </div>
  )
}

export default ItemViewPage
