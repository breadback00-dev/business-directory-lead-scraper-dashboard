import { Globe2, Mail, Phone } from 'lucide-react'
import { scoreLabel } from '../lib/leadHelpers'
import { statuses, type Lead, type LeadStatus } from '../types'

type LeadTableProps = {
  leads: Lead[]
  onStatusChange: (leadId: string, status: LeadStatus) => void
}

export function LeadTable({ leads, onStatusChange }: LeadTableProps) {
  return (
    <section className="table-panel" aria-labelledby="lead-table-title">
      <div className="table-heading">
        <div>
          <h2 id="lead-table-title">Sales-ready leads</h2>
          <p>Sorted by lead score with directory and homepage enrichment signals.</p>
        </div>
        <span>{leads.length} matches</span>
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
            {leads.map((lead) => (
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
                      <Mail size={14} /> {lead.email || 'No email'}
                    </span>
                    <span>
                      <Phone size={14} /> {lead.phone || 'No phone'}
                    </span>
                    <span>
                      <Globe2 size={14} /> {lead.website || 'No website'}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="signal-list">
                    {(lead.signals.length > 0 ? lead.signals : ['No signals yet']).map((signal) => (
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
                    onChange={(event) => onStatusChange(lead.id, event.target.value as LeadStatus)}
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
  )
}
