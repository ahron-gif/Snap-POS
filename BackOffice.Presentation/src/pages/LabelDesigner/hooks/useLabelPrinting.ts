import { useState, useCallback } from 'react'
import { useAuthHeaders } from '../../../hooks/useAuthHeaders'
import { API_ENDPOINTS } from '../../../constants/api'
import { LabelTemplate, LabelTemplateListItem, LabelData } from '../types'

interface UseLabelPrintingReturn {
  templates: LabelTemplateListItem[]
  selectedTemplate: LabelTemplate | null
  isLoading: boolean
  error: string | null
  loadTemplates: (labelType?: number) => Promise<void>
  loadTemplate: (id: number) => Promise<LabelTemplate | null>
  getItemsData: (itemStoreIds: string[]) => Promise<LabelData[]>
  printLabels: (templateId: number, itemStoreIds: string[], copies?: number) => Promise<void>
}

export const useLabelPrinting = (): UseLabelPrintingReturn => {
  const { getAuthHeaders } = useAuthHeaders()
  const [templates, setTemplates] = useState<LabelTemplateListItem[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<LabelTemplate | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load all templates (optionally filtered by type)
  const loadTemplates = useCallback(async (labelType?: number) => {
    setIsLoading(true)
    setError(null)
    try {
      const headers = getAuthHeaders()
      let url = API_ENDPOINTS.LABEL_TEMPLATES.GET_ALL
      if (labelType !== undefined) {
        url += `?labelType=${labelType}`
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
      })

      if (response.ok) {
        const data = await response.json()
        if (data.isSuccess && data.response) {
          setTemplates(data.response)
        } else {
          setError(data.message || 'Failed to load templates')
        }
      } else {
        setError('Failed to load templates')
      }
    } catch (err) {
      setError('Error loading templates')
      console.error('Error loading templates:', err)
    } finally {
      setIsLoading(false)
    }
  }, [getAuthHeaders])

  // Load a specific template by ID
  const loadTemplate = useCallback(async (id: number): Promise<LabelTemplate | null> => {
    setIsLoading(true)
    setError(null)
    try {
      const headers = getAuthHeaders()
      const response = await fetch(API_ENDPOINTS.LABEL_TEMPLATES.GET_BY_ID(id), {
        method: 'GET',
        headers,
      })

      if (response.ok) {
        const data = await response.json()
        if (data.isSuccess && data.response) {
          setSelectedTemplate(data.response)
          return data.response
        } else {
          setError(data.message || 'Template not found')
        }
      } else {
        setError('Failed to load template')
      }
    } catch (err) {
      setError('Error loading template')
      console.error('Error loading template:', err)
    } finally {
      setIsLoading(false)
    }
    return null
  }, [getAuthHeaders])

  // Get item data for labels
  const getItemsData = useCallback(async (itemStoreIds: string[]): Promise<LabelData[]> => {
    if (itemStoreIds.length === 0) return []

    try {
      const headers = getAuthHeaders()
      const response = await fetch(API_ENDPOINTS.LABEL_TEMPLATES.GET_ITEMS, {
        method: 'POST',
        headers,
        body: JSON.stringify({ itemStoreIds }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.isSuccess && data.response) {
          return data.response
        }
      }
    } catch (err) {
      console.error('Error getting item data:', err)
    }
    return []
  }, [getAuthHeaders])

  // Print labels for selected items
  const printLabels = useCallback(async (
    templateId: number,
    itemStoreIds: string[],
    copies: number = 1
  ) => {
    setIsLoading(true)
    setError(null)

    try {
      // Load template
      const template = await loadTemplate(templateId)
      if (!template) {
        setError('Template not found')
        return
      }

      // Get item data
      const items = await getItemsData(itemStoreIds)
      if (items.length === 0) {
        setError('No items found')
        return
      }

      // Open print preview in new window
      // This would typically trigger the LabelPrintPreview component
      // For now, we'll store the data and let the calling component handle display

    } catch (err) {
      setError('Error preparing labels')
      console.error('Error printing labels:', err)
    } finally {
      setIsLoading(false)
    }
  }, [loadTemplate, getItemsData])

  return {
    templates,
    selectedTemplate,
    isLoading,
    error,
    loadTemplates,
    loadTemplate,
    getItemsData,
    printLabels,
  }
}

export default useLabelPrinting
