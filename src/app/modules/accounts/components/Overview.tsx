import {Link} from 'react-router-dom'
import {KTIcon} from '../../../../_metronic/helpers'

// Account Overview (demo46 account/overview.html): SOLO la card "Profile Details".
// Se removieron los widgets posteriores (charts, tablas, listas) a peticion.
// Sin <Content> propio: AccountPage ya envuelve header + child en un solo Content.
export function Overview() {
  return (
    <div className='card mb-5 mb-xl-10' id='kt_profile_details_view'>
      {/* begin::Card header */}
      <div className='card-header cursor-pointer'>
          <div className='card-title m-0'>
            <h3 className='fw-bold m-0'>Profile Details</h3>
          </div>

          <Link to='/account/settings' className='btn btn-sm btn-primary align-self-center'>
            Edit Profile
          </Link>
        </div>
        {/* end::Card header */}

        {/* begin::Card body */}
        <div className='card-body p-9'>
          <div className='row mb-7'>
            <label className='col-lg-4 fw-semibold text-muted'>Full Name</label>
            <div className='col-lg-8'>
              <span className='fw-bold fs-6 text-gray-800'>Max Smith</span>
            </div>
          </div>

          <div className='row mb-7'>
            <label className='col-lg-4 fw-semibold text-muted'>Company</label>
            <div className='col-lg-8 fv-row'>
              <span className='fw-semibold text-gray-800 fs-6'>Colegio SaaS</span>
            </div>
          </div>

          <div className='row mb-7'>
            <label className='col-lg-4 fw-semibold text-muted'>
              Contact Phone
              <span className='ms-1' data-bs-toggle='tooltip' title='Phone number must be active'>
                <KTIcon iconName='information' className='fs-7' />
              </span>
            </label>
            <div className='col-lg-8 d-flex align-items-center'>
              <span className='fw-bold fs-6 text-gray-800 me-2'>044 3276 454 935</span>
              <span className='badge badge-success'>Verified</span>
            </div>
          </div>

          <div className='row mb-7'>
            <label className='col-lg-4 fw-semibold text-muted'>Company Site</label>
            <div className='col-lg-8'>
              <a href='#' className='fw-semibold fs-6 text-gray-800 text-hover-primary'>
                colegiosaas.com
              </a>
            </div>
          </div>

          <div className='row mb-7'>
            <label className='col-lg-4 fw-semibold text-muted'>
              Country
              <span className='ms-1' data-bs-toggle='tooltip' title='Country of origination'>
                <KTIcon iconName='information' className='fs-7' />
              </span>
            </label>
            <div className='col-lg-8'>
              <span className='fw-bold fs-6 text-gray-800'>Germany</span>
            </div>
          </div>

          <div className='row mb-7'>
            <label className='col-lg-4 fw-semibold text-muted'>Communication</label>
            <div className='col-lg-8'>
              <span className='fw-bold fs-6 text-gray-800'>Email, Phone</span>
            </div>
          </div>

          <div className='row mb-10'>
            <label className='col-lg-4 fw-semibold text-muted'>Allow Changes</label>
            <div className='col-lg-8'>
              <span className='fw-semibold fs-6 text-gray-800'>Yes</span>
            </div>
          </div>

          {/* begin::Notice */}
          <div className='notice d-flex bg-light-warning rounded border-warning border border-dashed p-6'>
            <KTIcon iconName='information' className='fs-2tx text-warning me-4' />
            <div className='d-flex flex-stack flex-grow-1'>
              <div className='fw-semibold'>
                <h4 className='text-gray-900 fw-bold'>We need your attention!</h4>
                <div className='fs-6 text-gray-700'>
                  Your payment was declined. To start using tools, please
                  <Link className='fw-bold' to='/account/settings'>
                    {' '}
                    Add Payment Method
                  </Link>
                  .
                </div>
              </div>
            </div>
          </div>
          {/* end::Notice */}
        </div>
        {/* end::Card body */}
    </div>
  )
}
