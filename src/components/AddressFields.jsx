// SCRUM-239: Street / unit / city / state / ZIP inputs for the quote form.
// The address checker needs the address split into these fields.
export default function AddressFields({ value, onChange, idPrefix = 'address', disabled = false }) {
  const update = (field) => (e) => onChange({ ...value, [field]: e.target.value })

  return (
    <>
      <input
        type="text"
        id={`${idPrefix}-street`}
        aria-label="Street address"
        placeholder="Street address"
        autoComplete="address-line1"
        value={value.street}
        onChange={update('street')}
        disabled={disabled}
      />
      <input
        type="text"
        id={`${idPrefix}-unit`}
        aria-label="Apartment, suite or unit (optional)"
        placeholder="Apt, suite, unit (optional)"
        autoComplete="address-line2"
        value={value.unit}
        onChange={update('unit')}
        disabled={disabled}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--space-sm, 0.5rem)' }}>
        <input
          type="text"
          id={`${idPrefix}-city`}
          aria-label="City"
          placeholder="City"
          autoComplete="address-level2"
          value={value.city}
          onChange={update('city')}
          disabled={disabled}
        />
        <input
          type="text"
          id={`${idPrefix}-state`}
          aria-label="State"
          placeholder="State"
          autoComplete="address-level1"
          maxLength={2}
          value={value.state}
          onChange={update('state')}
          disabled={disabled}
        />
        <input
          type="text"
          id={`${idPrefix}-zip`}
          aria-label="ZIP code"
          placeholder="ZIP"
          autoComplete="postal-code"
          inputMode="numeric"
          maxLength={5}
          value={value.zip}
          onChange={update('zip')}
          disabled={disabled}
        />
      </div>
    </>
  )
}
