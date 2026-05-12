import { useMemo, useState } from 'react'
import {
  ArrowDownToLine,
  Building2,
  CheckCircle2,
  Filter,
  Globe2,
  Mail,
  MapPin,
  Phone,
  Search,
  UploadCloud,
} from 'lucide-react'
import './App.css'

type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Rejected'

type Lead = {
  id: number
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

const leads: Lead[] = [
  {
    id: 1,
    businessName: 'Northline Dental Studio',
    category: 'Dentists',
    city: 'Manchester',
    directory: 'Local Health Index',
    website: 'northlinedental.example',
    email: 'hello@northlinedental.example',
    phone: '+44 161 555 0134',
    address: '18 Deansgate, Manchester',
    sourceUrl: 'https://directory.example/northline-dental',
    score: 92,
    signals: ['Email found', 'Booking link', 'Outdated website'],
    status: 'New',
  },
  {
    id: 2,
    businessName: 'Summit Roof Care',
    category: 'Roofing',
    city: 'Austin',
    directory: 'Trade Directory',
    website: 'summitroofcare.example',
    email: 'jobs@summitroofcare.example',
    phone: '+1 512 555 0148',
    address: '2408 E 7th St, Austin',
    sourceUrl: 'https://directory.example/summit-roof-care',
    score: 86,
    signals: ['High-value category', 'Phone verified', 'No CRM widget'],
    status: 'Qualified',
  },
  {
    id: 3,
    businessName: 'Cedar & Co Accountants',
    category: 'Accounting',
    city: 'London',
    directory: 'Chamber Listings',
    website: 'cedaraccountants.example',
    email: 'team@cedaraccountants.example',
    phone: '+44 20 5555 0173',
    address: '42 Fleet Street, London',
    sourceUrl: 'https://directory.example/cedar-co-accountants',
    score: 78,
    signals: ['LinkedIn found', 'Contact form', 'Multi-office'],
    status: 'Contacted',
  },
  {
    id: 4,
    businessName: 'Bluebird Family Clinic',
    category: 'Healthcare',
    city: 'Birmingham',
    directory: 'Care Finder',
    website: 'bluebirdclinic.example',
    email: 'reception@bluebirdclinic.example',
    phone: '+44 121 555 0182',
    address: '9 Cornwall Street, Birmingham',
    sourceUrl: 'https://directory.example/bluebird-family-clinic',
    score: 73,
    signals: ['Email found', 'Reviews rising', 'Needs social links'],
    status: 'New',
  },
  {
    id: 5,
    businessName: 'Harbor View Legal',
    category: 'Legal',
    city: 'Liverpool',
    directory: 'Professional Register',
    website: 'harborviewlegal.example',
    email: 'intake@harborviewlegal.example',
    phone: '+44 151 555 0116',
    address: '31 Water Street, Liverpool',
    sourceUrl: 'https://directory.example/harbor-view-legal',
    score: 69,
    signals: ['Contact form', 'Local intent', 'No live chat'],
    status: 'Rejected',
  },
  {
    id: 6,
    businessName: 'Oak & Pixel Web Studio',
    category: 'Marketing',
    city: 'Leeds',
    directory: 'Agency Map',
    website: 'oakpixel.example',
    email: 'studio@oakpixel.example',
    phone: '+44 113 555 0194',
    address: '7 Park Row, Leeds',
    sourceUrl: 'https://directory.example/oak-pixel-web-studio',
    score: 81,
    signals: ['Social links', 'Technology detected', 'Fast site'],
    status: 'Qualified',
  },
  {
    id: 7,
    businessName: 'BrightPath Tutoring',
    category: 'Education',
    city: 'Chicago',
    directory: 'City Business Hub',
    website: 'brightpathtutoring.example',
    email: 'learn@brightpathtutoring.example',
    phone: '+1 312 555 0169',
    address: '105 W Madison St, Chicago',
    sourceUrl: 'https://directory.example/brightpath-tutoring',
    score: 64,
    signals: ['Email found', 'Seasonal demand', 'Missing analytics'],
    status: 'New',
  },
  {
    id: 8,
    businessName: 'Pinecrest Fitness',
    category: 'Fitness',
    city: 'Denver',
    directory: 'Wellness Directory',
    website: 'pinecrestfitness.example',
    email: 'members@pinecrestfitness.example',
    phone: '+1 720 555 0177',
    address: '1401 Blake St, Denver',
    sourceUrl: 'https://directory.example/pinecrest-fitness',
    score: 71,
    signals: ['Booking link', 'Instagram found', 'No email automation'],
    status: 'Contacted',
  },
]

const statuses: LeadStatus[] = ['New', 'Contacted', 'Qualified', 'Rejected']
const categories = ['All categories', ...Array.from(new Set(leads.map((lead) => lead.category)))]
const cities = ['All cities', ...Array.from(new Set(leads.map((lead) => lead.city)))]

const scoreLabel = (score: number) => {
  if (score >= 85) return 'Hot'
  if (score >= 72) return 'Warm'
  return 'Nurture'
}

const csvEscape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`

function App() {
  const [searchTerm, setSearchTerm] = useState('')
  const [category, setCategory] = useState('All categories')
  const [city, setCity] = useState('All cities')
  const [minScore, setMinScore] = useState(60)
  const [leadStatuses, setLeadStatuses] = useState<Record<number, LeadStatus>>(
    () => Object.fromEntries(leads.map((lead) => [lead.id, lead.status])),
  )

  const filteredLeads = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return leads
      .map((lead) => ({
        ...lead,
        status: leadStatuses[lead.id] ?? lead.status,
      }))
      .filter((lead) => {
        const matchesSearch =
          normalizedSearch.length === 0 ||
          [
            lead.businessName,
            lead.category,
            lead.city,
            lead.directory,
            lead.email,
            lead.signals.join(' '),
          ]
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearch)
        const matchesCategory = category === 'All categories' || lead.category === category
        const matchesCity = city === 'All cities' || lead.city === city
        const matchesScore = lead.score >= minScore

        return matchesSearch && matchesCategory && matchesCity && matchesScore
      })
      .sort((a, b) => b.score - a.score)
  }, [category, city, leadStatuses, minScore, searchTerm])

  const metrics = useMemo(() => {
    const visible = filteredLeads.length
    const qualified = filteredLeads.filter((lead) => lead.status === 'Qualified').length
    const averageScore =
      visible === 0
        ? 0
        : Math.round(filteredLeads.reduce((total, lead) => total + lead.score, 0) / visible)
    const emails = filteredLeads.filter((lead) => lead.email).length

    return { visible, qualified, averageScore, emails }
  }, [filteredLeads])

  const exportCsv = () => {
    const headers = [
      'Business Name',
      'Category',
      'City',
      'Directory',
      'Website',
      'Email',
      'Phone',
      'Address',
      'Score',
      'Status',
      'Signals',
      'Source URL',
    ]
    const rows = filteredLeads.map((lead) => [
      lead.businessName,
      lead.category,
      lead.city,
      lead.directory,
      lead.website,
      lead.email,
      lead.phone,
      lead.address,
      lead.score,
      lead.status,
      lead.signals.join('; '),
      lead.sourceUrl,
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => csvEscape(value)).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'business-directory-leads.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="app-shell">
      <nav className="topbar" aria-label="Dashboard navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Building2 size={20} />
          </span>
          <span>LeadVault</span>
        </div>
        <div className="topbar-actions">
          <button className="ghost-button" type="button">
            <UploadCloud size={17} />
            Import targets
          </button>
          <button className="primary-button" type="button" onClick={exportCsv}>
            <ArrowDownToLine size={17} />
            Export CSV
          </button>
        </div>
      </nav>

      <section className="workspace-heading" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Business Directory Lead Scraper</p>
          <h1 id="page-title">Lead discovery dashboard</h1>
        </div>
        <div className="run-status" aria-label="Latest scraper run status">
          <CheckCircle2 size={18} />
          <span>Last run: 842 records checked</span>
        </div>
      </section>

      <section className="metrics-grid" aria-label="Lead metrics">
        <article className="metric">
          <span>Visible leads</span>
          <strong>{metrics.visible}</strong>
        </article>
        <article className="metric">
          <span>Qualified</span>
          <strong>{metrics.qualified}</strong>
        </article>
        <article className="metric">
          <span>Average score</span>
          <strong>{metrics.averageScore}</strong>
        </article>
        <article className="metric">
          <span>Emails found</span>
          <strong>{metrics.emails}</strong>
        </article>
      </section>

      <section className="control-strip" aria-label="Lead filters">
        <label className="search-field">
          <Search size={18} />
          <span className="sr-only">Search leads</span>
          <input
            type="search"
            placeholder="Search company, signal, city, or email"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>

        <label className="select-field">
          <Filter size={17} />
          <span className="sr-only">Filter by category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="select-field">
          <MapPin size={17} />
          <span className="sr-only">Filter by city</span>
          <select value={city} onChange={(event) => setCity(event.target.value)}>
            {cities.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="score-field">
          <span>Min score</span>
          <input
            type="range"
            min="50"
            max="95"
            value={minScore}
            onChange={(event) => setMinScore(Number(event.target.value))}
          />
          <strong>{minScore}</strong>
        </label>
      </section>

      <section className="table-panel" aria-labelledby="lead-table-title">
        <div className="table-heading">
          <div>
            <h2 id="lead-table-title">Sales-ready leads</h2>
            <p>Sorted by lead score with enrichment signals from directory and website checks.</p>
          </div>
          <span>{filteredLeads.length} matches</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Lead</th>
                <th>Contact</th>
                <th>Signals</th>
                <th>Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <div className="lead-cell">
                      <strong>{lead.businessName}</strong>
                      <span>
                        {lead.category} / {lead.city}
                      </span>
                      <small>{lead.directory}</small>
                    </div>
                  </td>
                  <td>
                    <div className="contact-cell">
                      <span>
                        <Mail size={14} /> {lead.email}
                      </span>
                      <span>
                        <Phone size={14} /> {lead.phone}
                      </span>
                      <span>
                        <Globe2 size={14} /> {lead.website}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="signal-list">
                      {lead.signals.map((signal) => (
                        <span key={signal}>{signal}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="score-cell">
                      <strong>{lead.score}</strong>
                      <span className={`score-badge ${scoreLabel(lead.score).toLowerCase()}`}>
                        {scoreLabel(lead.score)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <select
                      className="status-select"
                      value={lead.status}
                      onChange={(event) =>
                        setLeadStatuses((current) => ({
                          ...current,
                          [lead.id]: event.target.value as LeadStatus,
                        }))
                      }
                    >
                      {statuses.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

export default App
