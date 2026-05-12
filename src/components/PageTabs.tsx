import { Activity, Mail } from 'lucide-react'
import type { AppPage } from '../types'

type PageTabsProps = {
  activePage: AppPage
  onPageChange: (page: AppPage) => void
}

export function PageTabs({ activePage, onPageChange }: PageTabsProps) {
  return (
    <div className="page-tabs" role="tablist" aria-label="Dashboard pages">
      <button
        className={activePage === 'leads' ? 'active' : ''}
        type="button"
        role="tab"
        aria-selected={activePage === 'leads'}
        onClick={() => onPageChange('leads')}
      >
        <Mail size={17} />
        Leads
      </button>
      <button
        className={activePage === 'scraper' ? 'active' : ''}
        type="button"
        role="tab"
        aria-selected={activePage === 'scraper'}
        onClick={() => onPageChange('scraper')}
      >
        <Activity size={17} />
        Scraper runs
      </button>
    </div>
  )
}
