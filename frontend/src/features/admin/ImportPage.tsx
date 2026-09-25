import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, LoaderCircle, RotateCcw, Upload } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router'
import { useImport, type ImportResult, type ImportSummary } from '../../api/admin'
import { ApiError, NetworkError } from '../../api/client'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useI18n } from '../../i18n/context'
import type { MessageKey } from '../../i18n/en'

const rows: [MessageKey, keyof ImportSummary, keyof ImportSummary | null][] = [
  ['import.row.classes', 'classesCreated', 'classesSkipped'],
  ['import.row.users', 'usersCreated', 'usersSkipped'],
  ['import.row.quizzes', 'quizzesCreated', 'quizzesSkipped'],
  ['import.row.questions', 'questionsCreated', null],
]

function SummaryTable({ summary, done }: { summary: ImportSummary; done: boolean }) {
  const { t } = useI18n()
  return (
    <table className="w-full text-sm">
      <thead className="text-muted">
        <tr>
          <th className="py-2 text-start font-semibold" />
          <th className="py-2 text-end font-semibold">{t(done ? 'import.col.added' : 'import.col.new')}</th>
          <th className="py-2 text-end font-semibold">{t('import.col.existing')}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map(([label, created, skipped]) => (
          <tr key={label}>
            <td className="py-2.5 font-medium text-ink">{t(label)}</td>
            <td className="py-2.5 text-end font-serif text-lg font-bold text-ink">{summary[created]}</td>
            <td className="py-2.5 text-end text-muted">{skipped ? summary[skipped] : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * Load the centre's spreadsheets: choose a workbook (or the four CSV files), see exactly
 * what would change, then import. Same validation and import as the command-line tool.
 */
export function ImportPage() {
  const { t } = useI18n()
  const input = useRef<HTMLInputElement>(null)
  const importer = useImport()
  const [files, setFiles] = useState<File[]>([])
  const [checked, setChecked] = useState<ImportResult | null>(null)
  const [imported, setImported] = useState<ImportResult | null>(null)
  const [dragging, setDragging] = useState(false)

  function choose(list: FileList | null) {
    const chosen = Array.from(list ?? [])
    if (!chosen.length) return
    setFiles(chosen)
    setChecked(null)
    setImported(null)
    importer.reset()
    // Check straight away: the admin sees problems before anything can be saved.
    importer.mutate({ files: chosen, preview: true }, { onSuccess: setChecked })
  }

  function runImport() {
    importer.mutate({ files, preview: false }, { onSuccess: setImported })
  }

  function startOver() {
    setFiles([])
    setChecked(null)
    setImported(null)
    importer.reset()
    if (input.current) input.current.value = ''
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    choose(event.dataTransfer.files)
  }

  const error = importer.error
  const errorMessage = !error
    ? null
    : error instanceof NetworkError
      ? t('common.offline')
      : error instanceof ApiError && error.status === 413
        ? t('import.tooBig')
        : error instanceof ApiError && error.status < 500
          ? error.message
          : t('common.error')
  const nothingNew =
    checked !== null &&
    checked.summary.classesCreated + checked.summary.usersCreated + checked.summary.quizzesCreated === 0

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <header>
        <h1 className="font-serif text-3xl font-bold text-ink sm:text-4xl">{t('import.title')}</h1>
        <p className="mt-1 text-muted">{t('import.subtitle')}</p>
      </header>

      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-success-soft text-success">
          <FileSpreadsheet className="size-7" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 text-sm text-muted">
          <p className="font-semibold text-ink">{t('import.formatTitle')}</p>
          <p>{t('import.formatBody')}</p>
          <p className="mt-2 flex flex-wrap gap-1.5" dir="ltr">
            {['classes', 'users', 'quizzes', 'questions'].map((sheet) => (
              <code key={sheet} className="rounded-md bg-ivory px-2 py-0.5 text-xs text-ink ring-1 ring-line">
                {sheet}
              </code>
            ))}
          </p>
        </div>
        <a
          href="/atc-import-example.xlsx"
          download
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-surface px-5 text-sm font-semibold text-primary ring-1 ring-line hover:bg-sky-soft"
        >
          <Download className="size-4" aria-hidden="true" />
          {t('import.example')}
        </a>
      </Card>

      {!imported && (
        <label
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center gap-3 rounded-3xl border-2 border-dashed p-8 text-center transition-colors ${
            dragging ? 'border-primary bg-sky-soft' : 'border-line bg-surface hover:border-secondary'
          }`}
        >
          <Upload className="size-8 text-secondary" aria-hidden="true" />
          <span className="font-semibold text-ink">
            {files.length ? files.map((f) => f.name).join(', ') : t('import.choose')}
          </span>
          <span className="text-sm text-muted">{t('import.chooseHint')}</span>
          <input
            ref={input}
            type="file"
            accept=".xlsx,.csv"
            multiple
            className="sr-only"
            onChange={(e) => choose(e.target.files)}
          />
        </label>
      )}

      {importer.isPending && (
        <Card className="flex items-center gap-3 p-5 text-muted" role="status">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          {checked ? t('import.importing') : t('import.checking')}
        </Card>
      )}

      {errorMessage && (
        <Card className="flex gap-3 p-5" role="alert">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-danger">{t('import.problem')}</p>
            <p className="mt-1 break-words whitespace-pre-line text-ink" dir="auto">
              {errorMessage}
            </p>
            <p className="mt-2 text-muted">{t('import.nothingSaved')}</p>
          </div>
        </Card>
      )}

      {checked && !imported && !importer.isPending && (
        <Card className="p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-serif text-xl font-semibold">
            <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
            {t('import.checked')}
          </h2>
          <p className="mb-3 text-sm text-muted">{t('import.checkedBody')}</p>
          <SummaryTable summary={checked.summary} done={false} />
          <p className="mt-4 text-sm text-muted">{t('import.rules')}</p>
          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={startOver}>
              <RotateCcw className="size-4" aria-hidden="true" />
              {t('import.other')}
            </Button>
            {nothingNew ? (
              <p className="self-center text-sm font-semibold text-muted">{t('import.nothingNew')}</p>
            ) : (
              <Button onClick={runImport}>{t('import.confirm')}</Button>
            )}
          </div>
        </Card>
      )}

      {imported && (
        <Card className="p-5 sm:p-6" role="status">
          <h2 className="flex items-center gap-2 font-serif text-xl font-semibold text-success">
            <CheckCircle2 className="size-5" aria-hidden="true" />
            {t('import.done')}
          </h2>
          <div className="mt-3">
            <SummaryTable summary={imported.summary} done />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/admin/users" className="font-semibold text-secondary hover:text-primary">
              {t('nav.users')}
            </Link>
            <Link to="/manage/quizzes" className="font-semibold text-secondary hover:text-primary">
              {t('nav.allQuizzes')}
            </Link>
            <button type="button" onClick={startOver} className="font-semibold text-secondary hover:text-primary">
              {t('import.other')}
            </button>
          </div>
        </Card>
      )}
    </div>
  )
}
