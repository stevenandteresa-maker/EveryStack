import { getTranslations } from 'next-intl/server';

export default async function DashboardPage() {
  const t = await getTranslations('dashboard');

  return (
    <div className="p-6">
      <h1 className="text-h1 text-[var(--text-primary)]">{t('title')}</h1>
      <p className="mt-2 text-body text-[var(--text-secondary)]">
        {t('welcome')}
      </p>
    </div>
  );
}
