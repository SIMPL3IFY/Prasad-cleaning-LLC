// SCRUM-239: "Did you mean ...?" box shown when the address was found but spelled differently.
// "Use this address" fills the form with the suggestion and submits; "Edit my address" keeps
// what the customer typed so they can fix it.
export default function AddressSuggestion({ suggestion, loading, onAccept, onEdit }) {
  if (!suggestion) return null

  return (
    <div role="alert">
      <p style={{ margin: 0 }}>Did you mean: <strong>{suggestion.standardized}</strong>?</p>
      <button type="button" className="button button-main" onClick={onAccept} disabled={loading}>
        Use this address
      </button>{' '}
      <button type="button" className="button" onClick={onEdit} disabled={loading}>
        Edit my address
      </button>
    </div>
  )
}
