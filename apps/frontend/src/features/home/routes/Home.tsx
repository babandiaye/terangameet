import { useTranslation } from 'react-i18next'
import { useLocation } from 'wouter'
import { ReactNode, useEffect, useState } from 'react'
import {
  RiArrowRightLine,
  RiDatabase2Line,
  RiHdLine,
  RiLockLine,
  RiVideoAddLine,
} from '@remixicon/react'
import { Screen } from '@/layout/Screen'
import { UserAware } from '@/features/auth/components/UserAware'
import { useUser } from '@/features/auth/api/useUser'
import { useHomePath } from '@/features/auth/utils/useHomePath'
import { authUrl } from '@/features/auth/utils/authUrl'
import { JoinMeetingInline } from '../components/JoinMeetingInline'
import { LandingSections } from '../components/LandingSections'
import { MoreLink } from '../components/MoreLink'
import { css } from '@/styled-system/css'
import { useConfig } from '@/api/useConfig'
import { LoadingScreen } from '@/components/LoadingScreen'

const TRUST = [
  { key: 'secure', Icon: RiLockLine },
  { key: 'quality', Icon: RiHdLine },
  { key: 'hosted', Icon: RiDatabase2Line },
] as const

/**
 * Campus photograph as an atmospheric ground. Kept at very low opacity and
 * faded out downward: the source image carries its own headline and logo, which
 * must not compete with the page's own type. Decorative, so aria-hidden.
 */
const CampusBackdrop = () => (
  <div
    aria-hidden="true"
    className={css({
      position: 'absolute',
      inset: 0,
      zIndex: 0,
      pointerEvents: 'none',
      backgroundImage: 'url(/assets/unchk-campus-bg.webp)',
      backgroundSize: 'cover',
      backgroundPosition: 'center 40%',
      opacity: 0.22,
      maskImage:
        'linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,0) 100%)',
      WebkitMaskImage:
        'linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,0) 100%)',
    })}
  />
)

const Hero = ({ children }: { children?: ReactNode }) => (
  <div
    className={css({
      position: 'relative',
      width: '100%',
      paddingX: { base: '1rem', sm: '1.5rem' },
      paddingTop: { base: '2rem', md: '3.5rem' },
      paddingBottom: { base: '2.5rem', md: '4rem' },
      _motionReduce: { opacity: 1 },
      _motionSafe: { opacity: 0, animation: '.5s ease-in fade 0s forwards' },
    })}
  >
    <CampusBackdrop />
    <div
      className={css({
        position: 'relative',
        zIndex: 1,
        maxWidth: '76rem',
        margin: '0 auto',
      })}
    >
      <div className={css({ maxWidth: '44rem' })}>{children}</div>
    </div>
  </div>
)

const Home = () => {
  const { t } = useTranslation('home')
  const { isLoggedIn } = useUser()
  const [, setLocation] = useLocation()
  const homePath = useHomePath()

  const [redirectFailed, setRedirectFailed] = useState(false)
  const { data } = useConfig()

  // The landing page is for anonymous visitors. A signed-in user belongs in
  // their own space (the console for administrators), so send them there rather
  // than showing the marketing page. `replace` keeps it out of the history.
  useEffect(() => {
    if (isLoggedIn) setLocation(homePath, { replace: true })
  }, [isLoggedIn, homePath, setLocation])

  useEffect(() => {
    const checkSiteAndRedirect = async () => {
      if (!data?.external_home_url) return
      if (isLoggedIn === false) {
        try {
          await fetch(data.external_home_url, {
            method: 'HEAD', // Use HEAD to avoid downloading the full page
            mode: 'no-cors', // Needed for cross-origin requests
          })
          window.location.replace(data.external_home_url)
        } catch (error) {
          setRedirectFailed(true)
          console.error('Site is not reachable:', error)
        }
      }
    }

    checkSiteAndRedirect()
  }, [isLoggedIn, data])

  if (data?.external_home_url && isLoggedIn == false && !redirectFailed) {
    return <LoadingScreen header={false} footer={false} delay={0} />
  }

  // Redirect in flight: don't flash the marketing page on the way out.
  if (isLoggedIn) {
    return <LoadingScreen header={false} footer={false} delay={0} />
  }

  return (
    <UserAware>
      <Screen>
        <Hero>
          <div>
            <h1
              className={css({
                fontWeight: 800,
                fontSize: {
                  base: '2.1rem',
                  xs: '2.5rem',
                  xsm: '3rem',
                  lg: '3.4rem',
                },
                lineHeight: 1.08,
                letterSpacing: '-0.03em',
                color: 'landing.ink',
                textWrap: 'balance',
                overflowWrap: 'anywhere',
              })}
            >
              {t('landing.headingLine1')}
              <br />
              {t('landing.headingLine2')}
              <br />
              <span className={css({ color: 'landing.blue-bright' })}>
                {t('landing.headingAccent')}
              </span>
            </h1>

            <p
              className={css({
                marginTop: '1.3rem',
                maxWidth: '32rem',
                fontSize: { base: '1rem', sm: '1.05rem' },
                lineHeight: 1.65,
                color: 'landing.ink-soft',
              })}
            >
              {t('landing.lead')}
            </p>

            <ul
              className={css({
                listStyle: 'none',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '0.6rem 1.3rem',
                marginTop: '1.6rem',
              })}
            >
              {TRUST.map(({ key, Icon }) => (
                <li
                  key={key}
                  className={css({
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    fontSize: '0.86rem',
                    color: 'landing.ink-soft',
                  })}
                >
                  <span
                    className={css({
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '26px',
                      height: '26px',
                      borderRadius: '7px',
                      backgroundColor: 'landing.blue-subtle',
                      color: 'landing.blue-bright',
                      flexShrink: 0,
                    })}
                  >
                    <Icon size={15} aria-hidden="true" />
                  </span>
                  {t(`landing.trust.${key}`)}
                </li>
              ))}
            </ul>

            {/* The one action a visitor without an account can complete. */}
            <JoinMeetingInline />

            <p
              className={css({
                marginTop: '0.4rem',
                fontSize: '0.9rem',
                color: 'landing.muted',
              })}
            >
              {t('landing.signInPrompt')}{' '}
              <a
                href={authUrl()}
                data-attr="login"
                className={css({
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  color: 'landing.blue',
                  fontWeight: 600,
                  textDecoration: 'underline',
                  textUnderlineOffset: '3px',
                  _hover: { color: 'landing.blue-bright' },
                })}
              >
                <RiVideoAddLine size={16} aria-hidden="true" />
                {t('landing.signInAction')}
                <RiArrowRightLine size={15} aria-hidden="true" />
              </a>
            </p>

            <MoreLink />
          </div>
        </Hero>

        <LandingSections />
      </Screen>
    </UserAware>
  )
}

export default Home
