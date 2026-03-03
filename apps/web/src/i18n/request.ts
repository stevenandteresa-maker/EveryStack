import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async () => {
  const locale = 'en'; // Will read from user preferences in Core UX

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
