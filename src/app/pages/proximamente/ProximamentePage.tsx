import {FC} from 'react'
import {useIntl} from 'react-intl'
import {PageLink, PageTitle} from '../../../_metronic/layout/core'
import {Content} from '../../../_metronic/layout/components/content'

interface ProximamentePageProps {
  titleId: string
  defaultTitle: string
}

// Placeholder genérico para módulos del roadmap que aún no tienen pantallas
// reales (ver ANALISIS-DOCUMENTACION.md §11). Un componente, muchas rutas.
const ProximamentePage: FC<ProximamentePageProps> = ({titleId, defaultTitle}) => {
  const intl = useIntl()
  const title = intl.formatMessage({id: titleId, defaultMessage: defaultTitle})

  const breadcrumbs: Array<PageLink> = [
    {title, path: '#', isSeparator: false, isActive: false},
  ]

  return (
    <>
      <PageTitle breadcrumbs={breadcrumbs}>{title}</PageTitle>
      <Content>
        <div className='card'>
          <div className='card-body d-flex flex-column align-items-center text-center py-20'>
            <i className='ki-duotone ki-time fs-3x text-primary mb-5'>
              <span className='path1'></span>
              <span className='path2'></span>
            </i>
            <h3 className='fw-bold mb-2'>{title}</h3>
            <span className='text-muted fs-6'>
              {intl.formatMessage({id: 'common.proximamente.subtitle'})}
            </span>
          </div>
        </div>
      </Content>
    </>
  )
}

export default ProximamentePage
