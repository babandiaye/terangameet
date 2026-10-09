import { Trans, useTranslation } from 'react-i18next'
import { A, Badge, Dialog, type DialogProps, H, P } from '@/primitives'
import { useUser } from '@/features/auth/api/useUser'
import { LoginButton } from '@/components/LoginButton'
import { logout } from '@/features/auth/utils/logout'

export type SettingsDialogProps = Pick<DialogProps, 'isOpen' | 'onOpenChange'>

export const SettingsDialog = (props: SettingsDialogProps) => {
  const { t } = useTranslation('settings')
  const { user, isLoggedIn } = useUser()
  const userDisplay =
    user?.full_name && user?.email
      ? `${user.full_name} (${user.email})`
      : user?.email
  return (
    <Dialog title={t('dialog.heading')} {...props}>
      <H lvl={2}>{t('account.heading')}</H>
      {isLoggedIn ? (
        <>
          <P>
            <Trans
              i18nKey="settings:account.currentlyLoggedAs"
              values={{ user: userDisplay }}
              components={[<Badge key="user-badge" />]}
            />
          </P>
          <P>
            <A onPress={logout}>{t('logout', { ns: 'global' })}</A>
          </P>
        </>
      ) : (
        <>
          <P>{t('account.youAreNotLoggedIn')}</P>
          <LoginButton />
        </>
      )}
    </Dialog>
  )
}
