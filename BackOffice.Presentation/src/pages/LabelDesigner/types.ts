// Label Designer Types

export enum LabelType {
  ItemLabel = 1,
  ShelfTag = 2,
  PriceLabel = 3,
  BarcodeLabel = 4,
  Custom = 5,
}

export enum PaperSize {
  Letter = 1,
  A4 = 2,
  Custom = 3,
}

export interface LabelTemplate {
  id: number
  storeId?: string
  name: string
  description?: string
  labelType: LabelType
  paperSize: PaperSize
  labelWidth: number // in inches
  labelHeight: number // in inches
  columnsPerPage: number
  rowsPerPage: number
  marginLeft: number
  marginTop: number
  horizontalGap: number
  verticalGap: number
  designJson: string
  isDefault: boolean
  dateCreated?: string
  dateModified?: string
}

export interface LabelTemplateListItem {
  id: number
  name: string
  description?: string
  labelType: LabelType
  labelTypeName: string
  labelWidth: number
  labelHeight: number
  columnsPerPage: number
  rowsPerPage: number
  isDefault: boolean
  dateModified: string
}

export type ElementType = 'text' | 'barcode' | 'image' | 'rectangle' | 'line'

export interface LabelElement {
  id: string
  type: ElementType
  x: number
  y: number
  width: number
  height: number
  rotation: number
  properties: LabelElementProperties
}

export interface LabelElementProperties {
  // Text properties
  text?: string
  fontFamily?: string
  fontSize?: number
  bold?: boolean
  italic?: boolean
  textAlign?: 'left' | 'center' | 'right'
  color?: string

  // Barcode properties
  barcodeType?: 'CODE128' | 'EAN13' | 'UPC' | 'CODE39' | 'QR'
  barcodeValue?: string
  showText?: boolean
  barcodeHeight?: number

  // Data binding
  dataField?: string // e.g., "[Description]", "[BarcodeNumber]", "[Price]"

  // Shape properties
  fillColor?: string
  strokeColor?: string
  strokeWidth?: number

  // Image properties
  imageUrl?: string
  useItemImage?: boolean
}

export interface LabelDesign {
  elements: LabelElement[]
  backgroundColor?: string
  showBorder?: boolean
  borderColor?: string
}

export interface LabelData {
  itemStoreId: string
  barcodeNumber: string
  description: string
  measure?: string
  price: number
  priceA?: number
  priceB?: number
  cost?: number
  size?: string
  modelNo?: string
  styleNo?: string
  extraInfo?: string
  departmentName?: string
  manufacturerName?: string
  imageUrl?: string
}

export interface LabelPrintRequest {
  templateId: number
  itemStoreIds: string[]
  copiesPerItem: number
  startPosition: number
}

export interface LabelPrintPreview {
  template: LabelTemplate
  items: LabelData[]
}

// Data field categories for organized display
export interface DataFieldCategory {
  name: string
  icon: string
  fields: DataField[]
}

export interface DataField {
  value: string
  label: string
  type: 'text' | 'number' | 'barcode' | 'currency' | 'image'
  sampleValue: string
}

// Available data fields for binding - organized by category
export const DATA_FIELD_CATEGORIES: DataFieldCategory[] = [
  {
    name: 'Product Info',
    icon: 'box',
    fields: [
      { value: '[Description]', label: 'Description', type: 'text', sampleValue: 'Sample Product Name' },
      { value: '[BarcodeNumber]', label: 'Barcode Number', type: 'barcode', sampleValue: '1234567890123' },
      { value: '[Size]', label: 'Size', type: 'text', sampleValue: 'Medium' },
      { value: '[ModelNo]', label: 'Model No', type: 'text', sampleValue: 'MDL-001' },
      { value: '[StyleNo]', label: 'Style No', type: 'text', sampleValue: 'STY-A1' },
      { value: '[ExtraInfo]', label: 'Extra Info', type: 'text', sampleValue: 'Additional Details' },
    ]
  },
  {
    name: 'Pricing',
    icon: 'dollar',
    fields: [
      { value: '[Price]', label: 'Price', type: 'currency', sampleValue: '$9.99' },
      { value: '[PriceA]', label: 'Price A', type: 'currency', sampleValue: '$8.99' },
      { value: '[PriceB]', label: 'Price B', type: 'currency', sampleValue: '$7.99' },
      { value: '[Cost]', label: 'Cost', type: 'currency', sampleValue: '$5.00' },
    ]
  },
  {
    name: 'Classification',
    icon: 'folder',
    fields: [
      { value: '[DepartmentName]', label: 'Department', type: 'text', sampleValue: 'Electronics' },
      { value: '[ManufacturerName]', label: 'Manufacturer', type: 'text', sampleValue: 'Brand Inc.' },
      { value: '[ItemGroup]', label: 'Item Group', type: 'text', sampleValue: 'Group A' },
    ]
  },
  {
    name: 'Inventory',
    icon: 'inventory',
    fields: [
      { value: '[Quantity]', label: 'Quantity', type: 'number', sampleValue: '100' },
      { value: '[Location]', label: 'Location', type: 'text', sampleValue: 'Aisle 5' },
      { value: '[SKU]', label: 'SKU', type: 'text', sampleValue: 'SKU-12345' },
    ]
  },
]

// Flat list for backward compatibility
export const DATA_FIELDS = DATA_FIELD_CATEGORIES.flatMap(cat =>
  cat.fields.map(f => ({ value: f.value, label: f.label }))
)

// Sample data for preview
export const SAMPLE_ITEM_DATA: LabelData = {
  itemStoreId: '00000000-0000-0000-0000-000000000001',
  barcodeNumber: '1234567890123',
  description: 'Sample Product Name',
  measure: 'Each',
  price: 9.99,
  priceA: 8.99,
  priceB: 7.99,
  cost: 5.00,
  size: 'Medium',
  modelNo: 'MDL-001',
  styleNo: 'STY-A1',
  extraInfo: 'Additional Info',
  departmentName: 'Electronics',
  manufacturerName: 'Brand Inc.',
  imageUrl: '',
}

// Pre-defined label sizes (Avery templates)
export const LABEL_PRESETS = [
  {
    name: 'Avery 5160 (1" x 2.625")',
    width: 2.625,
    height: 1,
    columns: 3,
    rows: 10,
    marginLeft: 0.1875,
    marginTop: 0.5,
    horizontalGap: 0.125,
    verticalGap: 0,
  },
  {
    name: 'Avery 5163 (2" x 4")',
    width: 4,
    height: 2,
    columns: 2,
    rows: 5,
    marginLeft: 0.15625,
    marginTop: 0.5,
    horizontalGap: 0.1875,
    verticalGap: 0,
  },
  {
    name: 'Avery 5164 (3.33" x 4")',
    width: 4,
    height: 3.333,
    columns: 2,
    rows: 3,
    marginLeft: 0.15625,
    marginTop: 0.5,
    horizontalGap: 0.1875,
    verticalGap: 0,
  },
  {
    name: 'Avery 5167 (0.5" x 1.75")',
    width: 1.75,
    height: 0.5,
    columns: 4,
    rows: 20,
    marginLeft: 0.28125,
    marginTop: 0.5,
    horizontalGap: 0.3125,
    verticalGap: 0,
  },
  {
    name: 'Avery 5161 (1" x 4")',
    width: 4,
    height: 1,
    columns: 2,
    rows: 10,
    marginLeft: 0.15625,
    marginTop: 0.5,
    horizontalGap: 0.1875,
    verticalGap: 0,
  },
]

// Barcode types
export const BARCODE_TYPES = [
  { value: 'CODE128', label: 'Code 128' },
  { value: 'EAN13', label: 'EAN-13' },
  { value: 'UPC', label: 'UPC-A' },
  { value: 'CODE39', label: 'Code 39' },
  { value: 'QR', label: 'QR Code' },
]
