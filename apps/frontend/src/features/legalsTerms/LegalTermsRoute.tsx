import { Screen } from '@/layout/Screen'
import { Bold, H, P, A, Link } from '@/primitives'
import { css } from '@/styled-system/css'
import { HStack } from '@/styled-system/jsx'
import { useTranslation } from 'react-i18next'

const SUPPORT_EMAIL = 'support@unchk.edu.sn'
const CDP_URL = 'https://www.cdp.sn/'
const SOURCE_URL = 'https://github.com/suitenumerique/meet'

const LegalTermsRoute = () => {
  const { t } = useTranslation('legals')

  const indentedStyle = css({
    paddingLeft: '1.5rem',
    marginLeft: '1rem',
    borderLeft: '1px solid black',
    marginTop: '1.5rem',
  })

  return (
    <Screen layout="centered" headerTitle={t('title')}>
      <HStack display={'block'} padding={'2rem'}>
        {/* Éditeur section */}
        <H lvl={2}>{t('creator.title')}</H>
        <P>{t('creator.body')}</P>
        <P className={indentedStyle}>
          {t('creator.contact.address')}
          <br />
          {t('creator.contact.email')}{' '}
          <A href={`mailto:${SUPPORT_EMAIL}`} color="primary">
            {SUPPORT_EMAIL}
          </A>
        </P>

        {/* Directeur de la publication section */}
        <H lvl={2}>{t('director.title')}</H>
        <P>{t('director.body')}</P>

        {/* Hébergement section */}
        <H lvl={2}>{t('hosting.title')}</H>
        <P>{t('hosting.body')}</P>

        {/* Données personnelles section */}
        <H lvl={2}>{t('data.title')}</H>
        <P>
          {t('data.body')}{' '}
          <A href={`mailto:${SUPPORT_EMAIL}`} color="primary">
            {SUPPORT_EMAIL}
          </A>
          .
        </P>
        <P>
          {t('data.authority')}{' '}
          <A href={CDP_URL} target="_blank" color="primary">
            www.cdp.sn
          </A>
          .
        </P>

        {/* Accessibilité section */}
        <H lvl={2}>{t('accessibility.title')}</H>
        <P>{t('accessibility.body')}</P>
        <P>
          {t('accessibility.more')}
          <Link to="/accessibilite" color="primary">
            {t('accessibility.link')}
          </Link>
        </P>

        <P>
          <Bold>{t('accessibility.status')}</Bold>
        </P>

        {/* Propriété intellectuelle section */}
        <H lvl={2}>{t('reuse.title')}</H>
        <P>{t('reuse.body1')}</P>
        <P>
          {t('reuse.body2')}{' '}
          <A href={SOURCE_URL} target="_blank" color="primary">
            {SOURCE_URL.replace('https://', '')}
          </A>
          .
        </P>
      </HStack>
    </Screen>
  )
}

export default LegalTermsRoute
