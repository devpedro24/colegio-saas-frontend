export async function chooseMobileCountry({evaluate, until}, id, country) {
  await evaluate(`document.getElementById(${JSON.stringify(id)}).click()`)
  const option = `${id}-option-${country}`
  await until(`!!document.getElementById(${JSON.stringify(option)})?.getClientRects().length`)
  await evaluate(`document.getElementById(${JSON.stringify(option)}).click()`)
  await until(`document.getElementById(${JSON.stringify(id)})?.dataset.country === ${JSON.stringify(country)} && document.getElementById(${JSON.stringify(id)}).getAttribute('aria-expanded') === 'false'`)
}
