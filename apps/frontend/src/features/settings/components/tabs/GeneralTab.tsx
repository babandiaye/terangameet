import { Field, H } from '@/primitives'
import { useTranslation } from 'react-i18next'
import { TabPanel, type TabPanelProps } from '@/primitives/Tabs'
import { userPreferencesStore } from '@/stores/userPreferences'
import { useSnapshot } from 'valtio'

export type GeneralTabProps = Pick<TabPanelProps, 'id'>

export const GeneralTab = ({ id }: GeneralTabProps) => {
  const { t } = useTranslation('settings')

  const userPreferencesSnap = useSnapshot(userPreferencesStore)

  return (
    <TabPanel padding={'md'} flex id={id}>
      <H lvl={2}>{t('preferences.title')}</H>
      <Field
        type="switch"
        label={t('preferences.idleDisconnectModal.label')}
        description={t('preferences.idleDisconnectModal.description')}
        isSelected={userPreferencesSnap.is_idle_disconnect_modal_enabled}
        onChange={(value) =>
          (userPreferencesStore.is_idle_disconnect_modal_enabled = value)
        }
        wrapperProps={{
          noMargin: true,
          fullWidth: true,
        }}
      />
    </TabPanel>
  )
}
