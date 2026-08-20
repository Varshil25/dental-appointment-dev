'use client';

import { useMemo, useState } from 'react';
import { COUNTRY_CODES } from '@/lib/country-codes';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const flag = (iso2) =>
  String.fromCodePoint(...[...iso2.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));

const SORTED = [...COUNTRY_CODES].sort((a, b) => a[1].localeCompare(b[1]));

// Dial codes aren't unique (e.g. +1 is shared by US/CA, +7 by RU/KZ), so the
// Select tracks the unique iso2 as its value and looks up the dial code from
// here rather than using the dial code itself as the item value.
const DIAL_BY_ISO2 = new Map(COUNTRY_CODES.map(([iso2, , dial]) => [iso2, dial]));

function splitValue(value) {
  const digits = String(value || '').replace(/^\+/, '');
  const candidates = [...COUNTRY_CODES].sort((a, b) => b[2].length - a[2].length);
  for (const [iso2, , dial] of candidates) {
    if (digits.startsWith(dial)) return { iso2, dial, local: digits.slice(dial.length) };
  }
  return { iso2: 'US', dial: '1', local: digits };
}

// Combined country-code + local-number input. `value`/`onChange` carry a
// single normalized "+<countrycode><digits>" string (or '' when empty) —
// the shape appointment-service's own phone validation expects, so a
// booking never fails validation only after submit.
export default function PhoneInput({ value, onChange, onBlur, placeholder, id }) {
  const initial = useMemo(() => splitValue(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [iso2, setIso2] = useState(initial.iso2);
  const [local, setLocal] = useState(initial.local);
  const [prevValue, setPrevValue] = useState(value);

  // Keep in sync if a parent resets `value` wholesale (e.g. prefilling from
  // a matched returning-patient record after this field mounted). Adjusted
  // during render — React's supported pattern for state derived from a
  // changed prop — rather than in an effect, to avoid an extra commit.
  if (value !== prevValue) {
    setPrevValue(value);
    const next = splitValue(value);
    setIso2(next.iso2);
    setLocal(next.local);
  }

  const emit = (nextIso2, nextLocal) => {
    const digits = nextLocal.replace(/\D/g, '');
    const dial = DIAL_BY_ISO2.get(nextIso2) || '1';
    onChange(digits ? `+${dial}${digits}` : '');
  };

  return (
    <div className="flex gap-2">
      <Select
        value={iso2}
        onValueChange={(v) => {
          setIso2(v);
          emit(v, local);
        }}
      >
        <SelectTrigger className="w-[110px]" id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {SORTED.map(([optIso2, name, code]) => (
            <SelectItem key={optIso2} value={optIso2}>
              {flag(optIso2)} +{code} {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        className="flex-1"
        type="tel"
        inputMode="numeric"
        placeholder={placeholder || 'Phone number'}
        value={local}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '');
          setLocal(digits);
          emit(iso2, digits);
        }}
        onBlur={onBlur}
      />
    </div>
  );
}
