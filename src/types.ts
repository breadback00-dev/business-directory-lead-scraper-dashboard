export const statuses = ['New', 'Contacted', 'Qualified', 'Rejected'] as const
export const scraperCategories = ['dentists', 'accountants', 'cafes', 'pharmacies', 'restaurants', 'solicitors'] as const

export type LeadStatus = (typeof statuses)[number]
export type ScraperCategory = (typeof scraperCategories)[number]
export type AppPage = 'leads' | 'scraper'

export type Lead = {
  id: string
  businessName: string
  category: string
  city: string
  directory: string
  website: string
  email: string
  phone: string
  address: string
  sourceUrl: string
  score: number
  signals: string[]
  status: LeadStatus
}

export type LeadInput = Omit<Lead, 'id'>
