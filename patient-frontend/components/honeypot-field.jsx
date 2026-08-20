// Classic bot deterrent: a field named to look worth filling in ("website")
// that's invisible to real visitors (off-screen, not display:none — some
// bots skip display:none/visibility:hidden fields, so this hides it
// visually while staying in the tab/DOM flow) but that basic form-filling
// bots tend to fill in anyway. Both appointment-service's POST /appointments
// and dentist-service's POST /inquiries reject the request if this arrives
// non-empty. Real users never see or interact with it.
export function HoneypotField({ value, onChange }) {
  return (
    <div className="absolute left-[-9999px] top-auto w-px h-px overflow-hidden" aria-hidden="true">
      <label htmlFor="website">Website</label>
      <input
        id="website"
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
