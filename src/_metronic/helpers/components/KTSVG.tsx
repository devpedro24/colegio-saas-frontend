import { ReactSVG } from 'react-svg'
import {toAbsoluteUrl} from '../AssetHelpers'

type Props = {
  className?: string
  path: string
  svgClassName?: string
}

export const KTSVG = ({className = '', path, svgClassName = 'mh-50px'}: Props) => {
  return (
    <span className={`svg-icon ${className}`}>
      <ReactSVG src={toAbsoluteUrl(path)} className={svgClassName} />
    </span>
  )
}