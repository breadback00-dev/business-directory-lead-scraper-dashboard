import { describe, expect, it } from 'vitest'
import { buildLeadFromRecord, calculateScore, getRecordValue, normalizeKey, normalizeStatus } from './leadHelpers'

describe('lead helpers', () => {
  it('builds a lead from friendly CSV header aliases', () => {
    const lead = buildLeadFromRecord(
      {
        Company: 'Atlas Dental',
        Industry: 'Dentists',
        Market: 'Bristol',
        Source: 'Local directory',
        Domain: 'atlas.example',
        'Email Address': 'hello@atlas.example',
        Telephone: '+44 117 555 0190',
        'Street Address': '12 Queen Square',
        'Listing URL': 'https://directory.example/atlas',
        Tags: 'Email found | Booking link',
        'Lead Status': 'qualified',
        'Lead Score': '88',
      },
      () => 'lead-1',
    )

    expect(lead).toMatchObject({
      id: 'lead-1',
      businessName: 'Atlas Dental',
      category: 'Dentists',
      city: 'Bristol',
      directory: 'Local directory',
      website: 'atlas.example',
      email: 'hello@atlas.example',
      phone: '+44 117 555 0190',
      address: '12 Queen Square',
      sourceUrl: 'https://directory.example/atlas',
      signals: ['Email found', 'Booking link'],
      score: 88,
      status: 'Qualified',
    })
  })

  it('derives a missing score from contact fields and signals', () => {
    const lead = buildLeadFromRecord(
      {
        Name: 'Civic Accountants',
        Email: 'team@civic.example',
        Phone: '+44 20 5555 0191',
        Website: 'civic.example',
        'Source URL': 'https://directory.example/civic',
        Signals: 'Contact form; Multi-office',
      },
      () => 'lead-2',
    )

    expect(lead?.score).toBe(96)
  })

  it('normalizes unknown statuses back to New', () => {
    expect(normalizeStatus('archived')).toBe('New')
    expect(normalizeStatus(' Contacted ')).toBe('Contacted')
  })

  it('keeps duplicate-sensitive header normalization stable across punctuation and case', () => {
    const record = {
      'Business Name': 'Northline Dental',
      business_name: 'Should not win',
      'Lead-Source': 'Directory A',
    }

    expect(normalizeKey('Business Name')).toBe(normalizeKey('business_name'))
    expect(getRecordValue(record, ['Business Name'])).toBe('Should not win')
    expect(getRecordValue(record, ['Lead Source'])).toBe('Directory A')
  })

  it('caps calculated scores at 100', () => {
    expect(
      calculateScore({
        businessName: 'Complete lead',
        category: 'Dentists',
        city: 'Manchester',
        directory: 'Directory',
        website: 'complete.example',
        email: 'hello@complete.example',
        phone: '+44 161 555 0123',
        address: '',
        sourceUrl: 'https://directory.example/complete',
        signals: ['A', 'B', 'C', 'D'],
      }),
    ).toBe(100)
  })
})
