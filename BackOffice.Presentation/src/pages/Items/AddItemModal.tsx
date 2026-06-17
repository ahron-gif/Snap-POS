import React, { useState, useCallback } from "react"
import { Modal } from "../../components/ui/modal"
import Button from "../../components/ui/button/Button"
import Input from "../../components/form/input/InputField"
import Label from "../../components/form/Label"
import Select from "../../components/form/Select"
import Checkbox from "../../components/form/input/Checkbox"
import Radio from "../../components/form/input/Radio"
import TextArea from "../../components/form/input/TextArea"

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
  upcCodes: string[]
  sellOnWeb: boolean
  webPrice: number
  webCasePrice: number
  appButton: string
  customerCode: string
  matrix1: string
  matrix2: string
  imageData: string | null
}

interface VendorItem {
  id: string
  mainSupplier: boolean
  grossCost: number
  caseQty: number
  pcCost: number
  name: string
}

interface AddItemModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: ItemFormData) => void
}

const initialFormData: ItemFormData = {
  name: "",
  upc: "",
  alternateCode: "",
  description: "",
  itemType: "Standard",
  department: "",
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
  upcCodes: [],
  sellOnWeb: true,
  webPrice: 0,
  webCasePrice: 0,
  appButton: "",
  customerCode: "",
  matrix1: "",
  matrix2: "",
  imageData: null,
}

// Icon components for cleaner code
const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
  </svg>
)

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

// Reusable action button group component
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

// Section wrapper component
const Section: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({
  title,
  children,
  className = "",
}) => (
  <div className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 ${className}`}>
    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-t-xl">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
    </div>
    <div className="p-4">{children}</div>
  </div>
)

// Form row component for consistent styling
const FormRow: React.FC<{
  label: string
  children: React.ReactNode
  labelClassName?: string
  inline?: boolean
}> = ({ label, children, labelClassName = "", inline = false }) => (
  <div className={`${inline ? "flex items-center gap-3" : "space-y-1.5"}`}>
    <Label className={`text-sm text-gray-600 dark:text-gray-400 ${inline ? "whitespace-nowrap min-w-[120px]" : ""} ${labelClassName}`}>
      {label}
    </Label>
    <div className="flex-1">{children}</div>
  </div>
)

const AddItemModal: React.FC<AddItemModalProps> = ({ isOpen, onClose, onSave }) => {
  const [activeTab, setActiveTab] = useState<TabKey>("general")
  const [formData, setFormData] = useState<ItemFormData>(initialFormData)

  const handleInputChange = useCallback((field: keyof ItemFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleClose = useCallback(() => {
    setFormData(initialFormData)
    setActiveTab("general")
    onClose()
  }, [onClose])

  const handleSave = useCallback(() => {
    onSave(formData)
    handleClose()
  }, [formData, onSave, handleClose])

  // Render General Tab
  const renderGeneralTab = () => (
    <div className="flex gap-6">
      {/* Left Column */}
      <div className="w-[380px] space-y-4">
        <FormRow label="Description">
          <TextArea
            value={formData.description}
            onChange={(value) => handleInputChange("description", value)}
            rows={3}
            placeholder="Enter item description..."
          />
        </FormRow>

        <FormRow label="Item Type">
          <Select
            options={[
              { value: "Standard", label: "Standard" },
              { value: "Kit", label: "Kit" },
              { value: "Assembly", label: "Assembly" },
              { value: "Matrix", label: "Matrix" },
            ]}
            defaultValue={formData.itemType}
            onChange={(value) => handleInputChange("itemType", value)}
          />
        </FormRow>

        <FormRow label="Department">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Select
                options={[]}
                placeholder="Select Department"
                onChange={(value) => handleInputChange("department", value)}
              />
            </div>
            <ActionButtonGroup />
          </div>
        </FormRow>

        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Units">
            <Input
              type="text"
              value={formData.units}
              onChange={(e) => handleInputChange("units", e.target.value)}
              placeholder="0"
            />
          </FormRow>
          <FormRow label="Measure">
            <Select
              options={[
                { value: "Each", label: "Each" },
                { value: "Pound", label: "Pound" },
                { value: "Ounce", label: "Ounce" },
                { value: "Gallon", label: "Gallon" },
              ]}
              placeholder="Select"
              onChange={(value) => handleInputChange("measure", value)}
            />
          </FormRow>
        </div>

        <FormRow label="Size">
          <Input
            type="text"
            value={formData.size}
            onChange={(e) => handleInputChange("size", e.target.value)}
            placeholder="Enter size"
          />
        </FormRow>

        <FormRow label="UPC Type">
          <Select
            options={[
              { value: "Standard", label: "Standard" },
              { value: "Random Weight", label: "Random Weight" },
              { value: "Coupon", label: "Coupon" },
            ]}
            defaultValue={formData.upcType}
            onChange={(value) => handleInputChange("upcType", value)}
          />
        </FormRow>

        <FormRow label="Location">
          <Input
            type="text"
            value={formData.location}
            onChange={(e) => handleInputChange("location", e.target.value)}
            placeholder="Enter location"
          />
        </FormRow>

        {/* Groups Section */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-brand-600 dark:text-brand-400">Groups</Label>
          {[1, 2, 3, 4].map((index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-sm text-brand-600 dark:text-brand-400 w-6">{index === 1 ? "" : "0"}</span>
              <div className="flex-1">
                <Select options={[]} placeholder="" onChange={() => {}} />
              </div>
              <ActionButtonGroup />
            </div>
          ))}
          <button
            type="button"
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors shadow-sm"
          >
            <PlusIcon />
          </button>
        </div>

        {/* Image Section */}
        <div className="mt-4 p-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/30 text-center">
          <div className="flex flex-col items-center justify-center min-h-[120px]">
            <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm text-gray-400 dark:text-gray-500">No image data</span>
            <button type="button" className="mt-2 text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400">
              Upload Image
            </button>
          </div>
        </div>

        <Button variant="outline" size="sm" className="w-full">
          Print Label
        </Button>
      </div>

      {/* Right Column */}
      <div className="flex-1 space-y-4">
        {/* Cost Section */}
        <Section title="Cost">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormRow label="List Price">
                <Input
                  type="number"
                  value={formData.listPrice}
                  onChange={(e) => handleInputChange("listPrice", parseFloat(e.target.value) || 0)}
                  step={0.01}
                  placeholder="$0.00"
                />
              </FormRow>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={formData.taxable}
                    onChange={(checked) => handleInputChange("taxable", checked)}
                    label="Taxable"
                  />
                  <Select
                    options={[{ value: "default", label: "Default" }]}
                    placeholder=""
                    onChange={(value) => handleInputChange("taxableRate", value)}
                    className="w-24"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormRow label="Markdown Price">
                <Input
                  type="number"
                  value={formData.markdownPrice}
                  onChange={(e) => handleInputChange("markdownPrice", parseFloat(e.target.value) || 0)}
                  step={0.01}
                  placeholder="$0.00"
                />
              </FormRow>
              <div className="space-y-2 pt-2">
                <Checkbox
                  checked={formData.discountable}
                  onChange={(checked) => handleInputChange("discountable", checked)}
                  label="Discountable"
                />
                <Checkbox
                  checked={formData.foodStamp}
                  onChange={(checked) => handleInputChange("foodStamp", checked)}
                  label="Food Stamp"
                />
                <Checkbox
                  checked={formData.wic}
                  onChange={(checked) => handleInputChange("wic", checked)}
                  label="WIC"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormRow label="Usually Ordered in">
                <Select
                  options={[
                    { value: "Cases", label: "Cases" },
                    { value: "Units", label: "Units" },
                  ]}
                  defaultValue={formData.usuallyOrderedIn}
                  onChange={(value) => handleInputChange("usuallyOrderedIn", value)}
                />
              </FormRow>
              <FormRow label="Tare">
                <Input
                  type="text"
                  value={formData.tare}
                  onChange={(e) => handleInputChange("tare", e.target.value)}
                  placeholder="0"
                />
              </FormRow>
            </div>

            <FormRow label="Usually Sold in">
              <Select
                options={[
                  { value: "Cases", label: "Cases" },
                  { value: "Units", label: "Units" },
                ]}
                defaultValue={formData.usuallySoldIn}
                onChange={(value) => handleInputChange("usuallySoldIn", value)}
                className="w-1/2"
              />
            </FormRow>

            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.lastCaseNetCostEnabled}
                    onChange={(checked) => handleInputChange("lastCaseNetCostEnabled", checked)}
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Last Case Net Cost:</span>
                  <Input
                    type="number"
                    value={formData.lastCaseNetCost}
                    onChange={(e) => handleInputChange("lastCaseNetCost", parseFloat(e.target.value) || 0)}
                    step={0.01}
                    className="w-24"
                    placeholder="$0.00"
                  />
                </div>
                <span className="text-gray-400">/</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Case Qty:</span>
                  <Input
                    type="number"
                    value={formData.caseQty}
                    onChange={(e) => handleInputChange("caseQty", parseInt(e.target.value) || 0)}
                    className="w-16"
                    placeholder="0"
                  />
                </div>
                <span className="text-gray-400">=</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Cost:</span>
                  <Input
                    type="number"
                    value={formData.cost}
                    onChange={(e) => handleInputChange("cost", parseFloat(e.target.value) || 0)}
                    step={0.01}
                    className="w-24"
                    placeholder="$0.00"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Case Code:</span>
                  <Input
                    type="text"
                    value={formData.caseCode}
                    onChange={(e) => handleInputChange("caseCode", e.target.value)}
                    className="w-24"
                  />
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Pricing Section */}
        <Section title="Pricing">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={formData.setPricesForCase}
                onChange={(checked) => handleInputChange("setPricesForCase", checked)}
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Set prices for case</span>
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-1/3"></th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Price</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Profit Margin %</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Markup %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Unit Price</td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        value={formData.price}
                        onChange={(e) => handleInputChange("price", parseFloat(e.target.value) || 0)}
                        step={0.01}
                        placeholder="$0.00"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        value={formData.profitMargin}
                        onChange={(e) => handleInputChange("profitMargin", parseFloat(e.target.value) || 0)}
                        step={0.01}
                        placeholder="0.00%"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        value={formData.markup}
                        onChange={(e) => handleInputChange("markup", parseFloat(e.target.value) || 0)}
                        step={0.01}
                        placeholder="0.00%"
                      />
                    </td>
                  </tr>
                  <tr className="bg-gray-50/50 dark:bg-gray-800/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Case Price</td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        value={formData.casePrice}
                        onChange={(e) => handleInputChange("casePrice", parseFloat(e.target.value) || 0)}
                        step={0.01}
                        placeholder="$0.00"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        value={formData.caseProfitMargin}
                        onChange={(e) => handleInputChange("caseProfitMargin", parseFloat(e.target.value) || 0)}
                        step={0.01}
                        placeholder="0.00%"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        value={formData.caseMarkup}
                        onChange={(e) => handleInputChange("caseMarkup", parseFloat(e.target.value) || 0)}
                        step={0.01}
                        placeholder="0.00%"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )

  // Render Sales Tab
  const renderSalesTab = () => (
    <div className="grid grid-cols-2 gap-6">
      {/* Sales Info Section */}
      <Section title="Sales Info">
        <div className="space-y-4">
          {[
            { label: "MTD Qty", field: "mtdQty" as const, type: "text" },
            { label: "MTD Amount", field: "mtdAmount" as const, type: "number", prefix: "$" },
          ].map(({ label, field, type }) => (
            <FormRow key={field} label={label} inline>
              <Input
                type={type}
                value={formData[field]}
                onChange={(e) => handleInputChange(field, type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
                placeholder={type === "number" ? "$0.00" : ""}
              />
            </FormRow>
          ))}

          <div className="border-t border-gray-100 dark:border-gray-700 my-4" />

          {[
            { label: "PTD Qty", field: "ptdQty" as const, type: "text" },
            { label: "PTD Amount", field: "ptdAmount" as const, type: "number" },
          ].map(({ label, field, type }) => (
            <FormRow key={field} label={label} inline>
              <Input
                type={type}
                value={formData[field]}
                onChange={(e) => handleInputChange(field, type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
                placeholder={type === "number" ? "$0.00" : ""}
              />
            </FormRow>
          ))}

          <div className="border-t border-gray-100 dark:border-gray-700 my-4" />

          {[
            { label: "YTD Qty", field: "ytdQty" as const, type: "text" },
            { label: "YTD Amount", field: "ytdAmount" as const, type: "number" },
          ].map(({ label, field, type }) => (
            <FormRow key={field} label={label} inline>
              <Input
                type={type}
                value={formData[field]}
                onChange={(e) => handleInputChange(field, type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
                placeholder={type === "number" ? "$0.00" : ""}
              />
            </FormRow>
          ))}

          <div className="border-t border-gray-100 dark:border-gray-700 my-4" />

          {[
            { label: "MTD Return Qty", field: "mtdReturnQty" as const },
            { label: "PTD Return Qty", field: "ptdReturnQty" as const },
            { label: "YTD Return Qty", field: "ytdReturnQty" as const },
          ].map(({ label, field }) => (
            <FormRow key={field} label={label} inline>
              <Input
                type="text"
                value={formData[field]}
                onChange={(e) => handleInputChange(field, e.target.value)}
              />
            </FormRow>
          ))}
        </div>
      </Section>

      {/* Inventory Section */}
      <Section title="Inventory">
        <div className="space-y-4">
          {[
            { label: "Average Cost", field: "averageCost" as const },
            { label: "On Hand", field: "onHand" as const },
            { label: "On Order", field: "onOrder" as const },
            { label: "On Transfer Order", field: "onTransferOrder" as const },
            { label: "On Sale Order", field: "onSaleOrder" as const },
          ].map(({ label, field }) => (
            <FormRow key={field} label={label} inline>
              <Input
                type="number"
                value={formData[field]}
                onChange={(e) => handleInputChange(field, parseFloat(e.target.value) || 0)}
                step={0.01}
                placeholder={field === "averageCost" ? "$0.00" : "0.00"}
              />
            </FormRow>
          ))}

          <div className="border-t border-gray-100 dark:border-gray-700 my-4" />

          {[
            { label: "Reorder Point", field: "reorderPoint" as const },
            { label: "Restock Level", field: "restockLevel" as const },
          ].map(({ label, field }) => (
            <FormRow key={field} label={label} inline>
              <Input
                type="number"
                value={formData[field]}
                onChange={(e) => handleInputChange(field, parseInt(e.target.value) || 0)}
                placeholder="0"
              />
            </FormRow>
          ))}
        </div>
      </Section>
    </div>
  )

  // Render Specials Tab
  const renderSpecialsTab = () => (
    <div className="space-y-6">
      <div className="flex items-start gap-6">
        {/* Specials Icon */}
        <div className="w-20 h-20 flex items-center justify-center border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-gradient-to-br from-brand-50 to-green-50 dark:from-brand-900/20 dark:to-green-900/20">
          <svg className="w-10 h-10 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        {/* Specials Section */}
        <Section title="Specials" className="flex-1">
          <div className="flex gap-6">
            <div className="space-y-3 min-w-[140px]">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Sale Type</Label>
              {[
                { id: "noSale", label: "No Sale", disabled: false },
                { id: "standard", label: "Standard", disabled: true },
                { id: "breakDown", label: "Break Down", disabled: true },
                { id: "mixMatch", label: "Mix & Match", disabled: true },
                { id: "combined", label: "Combined", disabled: true },
              ].map(({ id, label, disabled }) => (
                <Radio
                  key={id}
                  id={id}
                  name="saleType"
                  value={id}
                  checked={formData.saleType === id}
                  onChange={(value) => handleInputChange("saleType", value)}
                  label={label}
                  disabled={disabled}
                />
              ))}
            </div>

            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormRow label="Cost">
                  <Input
                    type="text"
                    value={formData.specialsCost}
                    onChange={(e) => handleInputChange("specialsCost", e.target.value)}
                    placeholder="$0.00 / $0.00"
                  />
                </FormRow>
                <FormRow label="Regular Price">
                  <Input
                    type="number"
                    value={formData.regularPrice}
                    onChange={(e) => handleInputChange("regularPrice", parseFloat(e.target.value) || 0)}
                    step={0.01}
                    placeholder="$0.00"
                  />
                </FormRow>
              </div>

              <div className="min-h-[180px] border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center">
                <span className="text-sm text-gray-400">Special pricing details will appear here</span>
              </div>
            </div>
          </div>
        </Section>
      </div>

      {/* Future Pricing Section */}
      <Section title="Future Pricing">
        <div className="flex items-center gap-6">
          <FormRow label="New Price" inline>
            <Input
              type="number"
              value={formData.newPrice}
              onChange={(e) => handleInputChange("newPrice", parseFloat(e.target.value) || 0)}
              step={0.01}
              className="w-32"
              placeholder="$0.00"
            />
          </FormRow>
          <FormRow label="Date Effective" inline>
            <Input
              type="date"
              value={formData.dateEffective}
              onChange={(e) => handleInputChange("dateEffective", e.target.value)}
              className="w-48"
            />
          </FormRow>
        </div>
      </Section>
    </div>
  )

  // Render Vendor Tab
  const renderVendorTab = () => (
    <div className="space-y-6">
      {/* Vendor Grid */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
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
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className="px-3 py-3 text-center">
                <span className="text-amber-500">⚡</span>
              </td>
              <td className="px-4 py-3">
                <Checkbox checked={false} onChange={() => {}} />
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">=</td>
              <td className="px-4 py-3 text-sm text-gray-500">=</td>
              <td className="px-4 py-3 text-sm text-gray-500">=</td>
              <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">ABC</td>
              <td className="px-3 py-3">
                <button type="button" className="p-1 text-gray-400 hover:text-gray-600">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="6" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="12" cy="18" r="2" />
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div className="min-h-[280px] bg-white dark:bg-gray-900" />
      </div>

      {/* Vendor Details */}
      <Section title="Vendor Details">
        <div className="grid grid-cols-2 gap-6">
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
      </Section>
    </div>
  )

  // Render Extra Tab
  const renderExtraTab = () => (
    <div className="grid grid-cols-2 gap-6">
      {/* Left Column */}
      <div className="space-y-4">
        {/* Extra Charges */}
        <Section title="Extra Charges">
          <div className="space-y-3">
            {[1, 2, 3].map((num) => (
              <div key={num} className="flex items-center gap-2">
                <Label className="w-28 text-sm">Extra Charge {num}</Label>
                <div className="flex-1">
                  <Select options={[]} placeholder="Select charge" onChange={() => {}} />
                </div>
                <ActionButtonGroup />
              </div>
            ))}
          </div>
        </Section>

        {/* Extra Info */}
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

        {/* Web Settings */}
        <div className="flex items-center gap-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={formData.sellOnWeb}
              onChange={(checked) => handleInputChange("sellOnWeb", checked)}
            />
            <Label className="text-sm">Sell On Web</Label>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm">Web Price:</Label>
            <Input
              type="number"
              value={formData.webPrice}
              onChange={(e) => handleInputChange("webPrice", parseFloat(e.target.value) || 0)}
              step={0.01}
              className="w-24"
              placeholder="$0.00"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm">Web Case Price:</Label>
            <Input
              type="number"
              value={formData.webCasePrice}
              onChange={(e) => handleInputChange("webCasePrice", parseFloat(e.target.value) || 0)}
              step={0.01}
              className="w-24"
              placeholder="$0.00"
            />
          </div>
        </div>

        {/* Matrix Fields */}
        <div className="space-y-3">
          {[
            { label: "0", field: "matrix1" as const, isBlue: true },
            { label: "Customer Code", field: "customerCode" as const, isBlue: false },
            { label: "0", field: "matrix2" as const, isBlue: true },
          ].map(({ label, field, isBlue }) => (
            <div key={field} className="flex items-center gap-3">
              <Label className={`w-28 text-sm ${isBlue ? "text-brand-600 dark:text-brand-400" : ""}`}>{label}</Label>
              <Input
                type="text"
                value={formData[field]}
                onChange={(e) => handleInputChange(field, e.target.value)}
                className="flex-1"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Right Column - UPC Code Grid */}
      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">UPC Codes</h3>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="w-10 px-3 py-2"></th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">UPC Code</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-gray-200 dark:border-gray-700">
                <td className="px-3 py-2 text-amber-500 text-center">*</td>
                <td className="px-4 py-2">
                  <Input type="text" placeholder="Enter UPC code" onChange={() => {}} />
                </td>
              </tr>
            </tbody>
          </table>
          <div className="min-h-[260px] bg-white dark:bg-gray-900" />
        </div>

        <div className="flex justify-end">
          <FormRow label="App Button" inline>
            <Select
              options={[]}
              placeholder="Select button"
              onChange={(value) => handleInputChange("appButton", value)}
              className="w-48"
            />
          </FormRow>
        </div>
      </div>
    </div>
  )

  // Render Custom Fields Tab
  const renderCustomFieldsTab = () => {
    const renderCustomFieldRow = (index: number) => (
      <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
        <Label className="w-8 text-sm font-medium text-gray-500 dark:text-gray-400">0:</Label>
        <div className="flex-1">
          <Select options={[]} placeholder="Select custom field" onChange={() => {}} />
        </div>
        <ActionButtonGroup />
      </div>
    )

    return (
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-3">
          {[0, 1, 2, 3, 4, 5].map((index) => renderCustomFieldRow(index))}
        </div>
        <div className="space-y-3">
          {[6, 7, 8, 9, 10, 11].map((index) => renderCustomFieldRow(index))}
        </div>
      </div>
    )
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "general":
        return renderGeneralTab()
      case "sales":
        return renderSalesTab()
      case "specials":
        return renderSpecialsTab()
      case "vendor":
        return renderVendorTab()
      case "extra":
        return renderExtraTab()
      case "customFields":
        return renderCustomFieldsTab()
      default:
        return null
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="max-w-[1150px] m-4">
      <div className="relative w-full max-w-[1150px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                Item Name: <span className="text-gray-400">{formData.name || "-"}</span>
                <span className="mx-2 text-gray-300">|</span>
                Barcode: <span className="text-gray-400">{formData.upc || "-"}</span>
              </h2>
            </div>

            {/* Header Fields */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Name:</Label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  className="w-72 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 focus:border-amber-400 focus:ring-amber-400/20"
                  placeholder="Enter item name"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">UPC:</Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="text"
                    value={formData.upc}
                    onChange={(e) => handleInputChange("upc", e.target.value)}
                    className="w-52 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 focus:border-amber-400 focus:ring-amber-400/20"
                    placeholder="Enter UPC"
                  />
                  <button
                    type="button"
                    className="px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <SearchIcon />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">0</Label>
                <Input
                  type="text"
                  value={formData.alternateCode}
                  onChange={(e) => handleInputChange("alternateCode", e.target.value)}
                  className="w-44"
                  placeholder="Alternate code"
                />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex px-6 gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-3 text-sm font-medium rounded-t-lg transition-all ${
                  activeTab === tab.key
                    ? "bg-white dark:bg-gray-900 text-brand-600 dark:text-brand-400 border-t-2 border-x border-brand-500 border-b-0 -mb-px shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                }`}
              >
                {tab.label}
                {tab.shortcut && (
                  <span className={`ml-1.5 text-xs ${activeTab === tab.key ? "text-brand-400" : "text-gray-400"}`}>
                    {tab.shortcut}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6 h-[520px] overflow-y-auto bg-gray-50/50 dark:bg-gray-900">
          {renderTabContent()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" size="sm" onClick={handleSave} className="min-w-[120px]">
            Save & Close
          </Button>
          <Button variant="outline" size="sm" disabled className="min-w-[120px] opacity-50">
            Save & New
          </Button>
          <Button variant="outline" size="sm" onClick={handleClose} className="min-w-[100px] bg-gray-600 text-white border-gray-600 hover:bg-gray-700">
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default AddItemModal
