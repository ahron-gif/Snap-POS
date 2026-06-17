import React, { useState } from 'react'
import { DATA_FIELD_CATEGORIES, DataField } from '../types'
import './DataSourcePanel.css'

interface DataSourcePanelProps {
  onFieldSelect: (field: DataField) => void
  onFieldDragStart: (e: React.DragEvent, field: DataField) => void
}

const DataSourcePanel: React.FC<DataSourcePanelProps> = ({
  onFieldSelect,
  onFieldDragStart,
}) => {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(
    DATA_FIELD_CATEGORIES.map(c => c.name)
  )
  const [searchTerm, setSearchTerm] = useState('')

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryName)
        ? prev.filter(c => c !== categoryName)
        : [...prev, categoryName]
    )
  }

  const getCategoryIcon = (icon: string) => {
    switch (icon) {
      case 'box':
        return (
          <svg className="category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        )
      case 'dollar':
        return (
          <svg className="category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        )
      case 'folder':
        return (
          <svg className="category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        )
      case 'inventory':
        return (
          <svg className="category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        )
      default:
        return null
    }
  }

  const getFieldTypeIcon = (type: string) => {
    switch (type) {
      case 'text':
        return 'Aa'
      case 'number':
        return '#'
      case 'currency':
        return '$'
      case 'barcode':
        return '|||'
      case 'image':
        return '[]'
      default:
        return '?'
    }
  }

  const filteredCategories = DATA_FIELD_CATEGORIES.map(category => ({
    ...category,
    fields: category.fields.filter(
      field =>
        field.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        field.value.toLowerCase().includes(searchTerm.toLowerCase())
    ),
  })).filter(category => category.fields.length > 0)

  return (
    <div className="datasource-panel">
      <div className="datasource-header">
        <h4>Data Fields</h4>
        <p className="datasource-hint">Drag fields to canvas or click to add</p>
      </div>

      <div className="datasource-search">
        <input
          type="text"
          placeholder="Search fields..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button
            className="search-clear"
            onClick={() => setSearchTerm('')}
          >
            ×
          </button>
        )}
      </div>

      <div className="datasource-categories">
        {filteredCategories.map(category => (
          <div key={category.name} className="datasource-category">
            <button
              className="category-header"
              onClick={() => toggleCategory(category.name)}
            >
              {getCategoryIcon(category.icon)}
              <span className="category-name">{category.name}</span>
              <span className={`category-toggle ${expandedCategories.includes(category.name) ? 'expanded' : ''}`}>
                ▶
              </span>
            </button>

            {expandedCategories.includes(category.name) && (
              <div className="category-fields">
                {category.fields.map(field => (
                  <div
                    key={field.value}
                    className="field-item"
                    draggable
                    onClick={() => onFieldSelect(field)}
                    onDragStart={(e) => onFieldDragStart(e, field)}
                  >
                    <span className={`field-type-badge ${field.type}`}>
                      {getFieldTypeIcon(field.type)}
                    </span>
                    <div className="field-info">
                      <span className="field-label">{field.label}</span>
                      <span className="field-value">{field.value}</span>
                    </div>
                    <span className="field-drag-handle">⋮⋮</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="datasource-footer">
        <div className="field-type-legend">
          <span className="legend-item"><span className="field-type-badge text">Aa</span> Text</span>
          <span className="legend-item"><span className="field-type-badge currency">$</span> Currency</span>
          <span className="legend-item"><span className="field-type-badge barcode">|||</span> Barcode</span>
        </div>
      </div>
    </div>
  )
}

export default DataSourcePanel
