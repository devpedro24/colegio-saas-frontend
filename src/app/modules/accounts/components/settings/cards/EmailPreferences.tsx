import {useState, FC} from 'react'
import {FormattedMessage} from 'react-intl'
import {IEmailPreferences, emailPreferences} from '../SettingsModel'

const EmailPreferences: FC = () => {
  const [data, setData] = useState<IEmailPreferences>(emailPreferences)

  const updateData = (fieldsToUpdate: Partial<IEmailPreferences>) => {
    const updatedData = {...data, ...fieldsToUpdate}
    setData(updatedData)
  }

  const [loading, setLoading] = useState(false)

  const click = () => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
    }, 1000)
  }

  return (
    <div className='card mb-5 mb-xl-10'>
      <div
        className='card-header border-0 cursor-pointer'
        role='button'
        data-bs-toggle='collapse'
        data-bs-target='#kt_account_email_preferences'
        aria-expanded='true'
        aria-controls='kt_account_email_preferences'
      >
        <div className='card-title m-0'>
          <h3 className='fw-bold m-0'>
            <FormattedMessage id='account.email.title' />
          </h3>
        </div>
      </div>

      <div id='kt_account_email_preferences' className='collapse show'>
        <form className='form'>
          <div className='card-body border-top px-9 py-9'>
            <label className='form-check form-check-custom form-check-solid align-items-start'>
              <input
                className='form-check-input me-3'
                type='checkbox'
                name='email-preferences[]'
                defaultChecked={data.successfulPayments}
                onChange={() =>
                  updateData({
                    successfulPayments: !data.successfulPayments,
                  })
                }
              />

              <span className='form-check-label d-flex flex-column align-items-start'>
                <span className='fw-bolder fs-5 mb-0'>
                  <FormattedMessage
                    id='account.email.successfulPayments'
                  />
                </span>
                <span className='text-muted fs-6'>
                  <FormattedMessage
                    id='account.email.successfulPaymentsDesc'
                  />
                </span>
              </span>
            </label>

            <div className='separator separator-dashed my-6'></div>

            <label className='form-check form-check-custom form-check-solid align-items-start'>
              <input
                className='form-check-input me-3'
                type='checkbox'
                name='email-preferences[]'
                defaultChecked={data.payouts}
                onChange={() =>
                  updateData({
                    payouts: !data.payouts,
                  })
                }
              />

              <span className='form-check-label d-flex flex-column align-items-start'>
                <span className='fw-bolder fs-5 mb-0'>
                  <FormattedMessage id='account.email.payouts' />
                </span>
                <span className='text-muted fs-6'>
                  <FormattedMessage
                    id='account.email.payoutsDesc'
                  />
                </span>
              </span>
            </label>

            <div className='separator separator-dashed my-6'></div>

            <label className='form-check form-check-custom form-check-solid align-items-start'>
              <input
                className='form-check-input me-3'
                type='checkbox'
                name='email-preferences[]'
                defaultChecked={data.freeCollections}
                onChange={() =>
                  updateData({
                    freeCollections: !data.freeCollections,
                  })
                }
              />

              <span className='form-check-label d-flex flex-column align-items-start'>
                <span className='fw-bolder fs-5 mb-0'>
                  <FormattedMessage
                    id='account.email.feeCollection'
                  />
                </span>
                <span className='text-muted fs-6'>
                  <FormattedMessage
                    id='account.email.feeCollectionDesc'
                  />
                </span>
              </span>
            </label>

            <div className='separator separator-dashed my-6'></div>

            <label className='form-check form-check-custom form-check-solid align-items-start'>
              <input
                className='form-check-input me-3'
                type='checkbox'
                name='email-preferences[]'
                defaultChecked={data.customerPaymentDispute}
                onChange={() =>
                  updateData({
                    customerPaymentDispute: !data.customerPaymentDispute,
                  })
                }
              />

              <span className='form-check-label d-flex flex-column align-items-start'>
                <span className='fw-bolder fs-5 mb-0'>
                  <FormattedMessage
                    id='account.email.paymentDispute'
                  />
                </span>
                <span className='text-muted fs-6'>
                  <FormattedMessage
                    id='account.email.paymentDisputeDesc'
                  />
                </span>
              </span>
            </label>

            <div className='separator separator-dashed my-6'></div>

            <label className='form-check form-check-custom form-check-solid align-items-start'>
              <input
                className='form-check-input me-3'
                type='checkbox'
                name='email-preferences[]'
                defaultChecked={data.refundAlert}
                onChange={() =>
                  updateData({
                    refundAlert: !data.refundAlert,
                  })
                }
              />

              <span className='form-check-label d-flex flex-column align-items-start'>
                <span className='fw-bolder fs-5 mb-0'>
                  <FormattedMessage
                    id='account.email.refundAlerts'
                  />
                </span>
                <span className='text-muted fs-6'>
                  <FormattedMessage
                    id='account.email.refundAlertsDesc'
                  />
                </span>
              </span>
            </label>

            <div className='separator separator-dashed my-6'></div>

            <label className='form-check form-check-custom form-check-solid align-items-start'>
              <input
                className='form-check-input me-3'
                type='checkbox'
                name='email-preferences[]'
                defaultChecked={data.invoicePayments}
                onChange={() =>
                  updateData({
                    invoicePayments: !data.invoicePayments,
                  })
                }
              />

              <span className='form-check-label d-flex flex-column align-items-start'>
                <span className='fw-bolder fs-5 mb-0'>
                  <FormattedMessage
                    id='account.email.invoicePayments'
                  />
                </span>
                <span className='text-muted fs-6'>
                  <FormattedMessage
                    id='account.email.invoicePaymentsDesc'
                  />
                </span>
              </span>
            </label>

            <div className='separator separator-dashed my-6'></div>

            <label className='form-check form-check-custom form-check-solid align-items-start'>
              <input
                className='form-check-input me-3'
                type='checkbox'
                name='email-preferences[]'
                defaultChecked={data.webhookAPIEndpoints}
                onChange={() =>
                  updateData({
                    webhookAPIEndpoints: !data.webhookAPIEndpoints,
                  })
                }
              />

              <span className='form-check-label d-flex flex-column align-items-start'>
                <span className='fw-bolder fs-5 mb-0'>
                  <FormattedMessage
                    id='account.email.webhooks'
                  />
                </span>
                <span className='text-muted fs-6'>
                  <FormattedMessage
                    id='account.email.webhooksDesc'
                  />
                </span>
              </span>
            </label>
          </div>

          <div className='card-footer d-flex justify-content-end py-6 px-9'>
            <button className='btn btn-lightbtn-active-light-primary me-2'>
              <FormattedMessage id='account.discard' />
            </button>
            <button type='button' onClick={click} className='btn btn-primary'>
              {!loading && <FormattedMessage id='common.save' />}
              {loading && (
                <span className='indicator-progress' style={{display: 'block'}}>
                  <FormattedMessage id='common.pleaseWait' />{' '}
                  <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export {EmailPreferences}
