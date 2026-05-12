import { History } from 'lucide-react'
import type { Doc } from '../../convex/_generated/dataModel'

type ImportHistoryProps = {
  imports: Doc<'imports'>[] | undefined
}

export function ImportHistory({ imports }: ImportHistoryProps) {
  return (
    <section className="import-history" aria-labelledby="import-history-title">
      <div className="import-history-heading">
        <History size={18} />
        <div>
          <h2 id="import-history-title">Import history</h2>
          <p>Latest backend import batches and validation counts.</p>
        </div>
      </div>

      <div className="import-history-list">
        {(imports ?? []).length > 0 ? (
          imports?.map((importRecord) => (
            <article className="import-record" key={importRecord._id}>
              <div>
                <strong>{importRecord.fileName}</strong>
                <span>{new Date(importRecord.createdAt).toLocaleString()}</span>
              </div>
              <dl>
                <div>
                  <dt>Rows</dt>
                  <dd>{importRecord.rowsReceived}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{importRecord.leadsCreated}</dd>
                </div>
                <div>
                  <dt>Duplicates</dt>
                  <dd>{importRecord.duplicatesSkipped}</dd>
                </div>
                <div>
                  <dt>Invalid</dt>
                  <dd>{importRecord.invalidRowsSkipped}</dd>
                </div>
              </dl>
            </article>
          ))
        ) : (
          <p className="empty-import-history">
            {imports === undefined ? 'Loading import history...' : 'No CSV imports recorded yet.'}
          </p>
        )}
      </div>
    </section>
  )
}
