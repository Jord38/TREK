import type { ForkChangelogItem } from '@trek/shared';
import { AlertCircle, Loader2, Sparkles } from 'lucide-react';
import PageShell from '../components/Layout/PageShell';
import EmptyState from '../components/shared/EmptyState';
import { useTranslation } from '../i18n';
import { useWhatsNew } from './whatsNew/useWhatsNew';

const KIND_CLASS: Record<ForkChangelogItem['kind'], string> = {
  added: 'bg-success-soft text-success',
  changed: 'bg-info-soft text-info',
  fixed: 'bg-warning-soft text-warning',
};

/** Entry dates are calendar days, so they are formatted in UTC to never slip a day. */
function formatEntryDate(date: string, locale: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(locale, { dateStyle: 'long', timeZone: 'UTC' });
}

export default function WhatsNewPage() {
  const { t, locale } = useTranslation();
  const { entries, loading, error } = useWhatsNew();

  return (
    <PageShell background="var(--bg-secondary)">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 flex items-center gap-4">
          <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-2xl bg-accent-subtle text-accent">
            <Sparkles className="h-5 w-5" />
          </span>
          <h1 className="text-title font-semibold text-content">{t('whatsNew.title')}</h1>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-content-faint">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
            <AlertCircle size={28} className="text-content-faint" />
            <p className="text-body font-semibold text-content">{t('whatsNew.errorTitle')}</p>
            <p className="max-w-sm text-body text-content-faint">{t('whatsNew.errorBody')}</p>
          </div>
        ) : entries.length === 0 ? (
          <EmptyState title={t('whatsNew.empty')} surface="var(--bg-secondary)" />
        ) : (
          <div className="flex flex-col gap-4">
            {entries.map((entry) => (
              <article key={entry.id} className="rounded-2xl border border-edge bg-surface-card p-5 shadow-sm">
                <time className="text-caption text-content-faint" dateTime={entry.date}>
                  {formatEntryDate(entry.date, locale)}
                </time>
                <h2 className="mt-1 text-body font-semibold text-content">{entry.title}</h2>
                <ul className="mt-3 flex list-none flex-col gap-2 p-0">
                  {entry.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span
                        className={`mt-0.5 inline-flex flex-none items-center rounded-full px-2 py-0.5 text-caption font-semibold ${KIND_CLASS[item.kind]}`}
                      >
                        {t(`whatsNew.kind.${item.kind}`)}
                      </span>
                      <span className="min-w-0 text-body text-content-secondary">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
