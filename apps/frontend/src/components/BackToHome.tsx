import { Link } from '@/primitives'
import { AProps } from '@/primitives/A'
import { useTranslation } from 'react-i18next'
import { useHomePath } from '@/features/auth/utils/useHomePath'

export const BackToHome = ({ size }: { size?: AProps['size'] }) => {
  const { t } = useTranslation()
  const homePath = useHomePath()
  return (
    <p>
      <Link to={homePath} size={size}>
        {t('backToHome')}
      </Link>
    </p>
  )
}
