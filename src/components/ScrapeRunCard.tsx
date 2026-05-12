import type { Doc } from '../../convex/_generated/dataModel'

type ScrapeRunCardProps = {
  run: Doc<'scrapeRuns'>
}

export function ScrapeRunCard({ run }: ScrapeRunCardProps) {
  return (
    <article className="scrape-run">
      <div className="scrape-run-title">
        <div>
          <strong>
            {run.targetCategory} / {run.targetLocation}
          </strong>
          <span>{new Date(run.createdAt).toLocaleString()}</span>
        </div>
        <span className={`run-pill ${run.status}`}>{run.status}</span>
      </div>
      <dl>
        <div>
          <dt>Max</dt>
          <dd>{run.maxPages ?? 1}</dd>
        </div>
        <div>
          <dt>Pages</dt>
          <dd>{run.pagesChecked}</dd>
        </div>
        <div>
          <dt>Found</dt>
          <dd>{run.leadsFound}</dd>
        </div>
        <div>
          <dt>Saved</dt>
          <dd>{run.leadsSaved}</dd>
        </div>
        <div>
          <dt>Duplicates</dt>
          <dd>{run.duplicatesSkipped}</dd>
        </div>
        <div>
          <dt>Failures</dt>
          <dd>{run.failures}</dd>
        </div>
      </dl>
      <p>{run.summary || run.logLines.at(-1) || 'No summary yet.'}</p>
      <ul className="scrape-run-log">
        {run.logLines.slice(-3).map((line, index) => (
          <li key={`${run._id}-${index}-${line}`}>{line}</li>
        ))}
      </ul>
    </article>
  )
}
