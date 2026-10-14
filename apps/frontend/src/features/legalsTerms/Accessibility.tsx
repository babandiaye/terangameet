import { Screen } from '@/layout/Screen'
import { H, P, A, Italic, Ul } from '@/primitives'
import { HStack } from '@/styled-system/jsx'
import { useTranslation } from 'react-i18next'

const SITE_URL = 'https://terangameet.unchk.sn'
const SITE_NAME = 'terangameet.unchk.sn'
const SUPPORT_EMAIL = 'support@unchk.edu.sn'

const AccessibilityRoute = () => {
  const { t } = useTranslation('accessibility', { keyPrefix: 'accessibility' })

  return (
    <Screen layout="centered" headerTitle={t('title')}>
      <HStack display={'block'} padding={'2rem'}>
        <P dangerouslySetInnerHTML={{ __html: t('introduction') }}></P>
        <H lvl={2} bold>
          {t('declaration.title')}
        </H>
        <Italic>{t('declaration.date')}</Italic>
        <P>
          {t('scope')}{' '}
          <A href={SITE_URL} color="primary">
            {SITE_NAME}
          </A>
          .
        </P>

        <H lvl={2} bold>
          {t('complianceStatus.title')}
        </H>
        <P>
          <A href={SITE_URL} color="primary">
            {SITE_NAME}
          </A>{' '}
          {t('complianceStatus.body')}
        </P>

        <H lvl={2} bold>
          {t('improvement.title')}
        </H>
        <P>{t('improvement.body')}</P>

        <Ul
          style={{
            marginBottom: '1rem',
          }}
        >
          <li>
            {t('improvement.contact.email')}{' '}
            <A href={`mailto:${SUPPORT_EMAIL}`} color="primary">
              {SUPPORT_EMAIL}
            </A>
          </li>
          <li>{t('improvement.contact.address')}</li>
        </Ul>

        <P>{t('improvement.response')}</P>
      </HStack>
    </Screen>
  )
}

export default AccessibilityRoute
