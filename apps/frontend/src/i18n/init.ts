import i18n from 'i18next'
import resourcesToBackend from 'i18next-resources-to-backend'
import { initReactI18next } from 'react-i18next'

/**
 * TerangaMeet is in French only. The English, German and Dutch catalogues of
 * Meet were dropped rather than kept half-translated: the consoles, the agenda
 * and the emails were French-only anyway. A language a user had picked before
 * (stored by the browser) is ignored.
 */
const i18nDefaultNamespace = 'global'
const language = 'fr'

i18n.setDefaultNamespace(i18nDefaultNamespace)
i18n
  .use(
    resourcesToBackend((lng: string, namespace: string) => {
      return import(`../locales/${lng}/${namespace}.json`)
    })
  )
  .use(initReactI18next)
  .init({
    lng: language,
    supportedLngs: [language],
    fallbackLng: language,
    ns: i18nDefaultNamespace,
    interpolation: {
      escapeValue: false,
    },
  })
  .then(() => {
    document.documentElement.setAttribute('lang', language)
  })
