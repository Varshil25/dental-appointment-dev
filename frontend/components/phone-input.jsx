'use client';

import { useMemo, useState } from 'react';
import { COUNTRY_CODES } from '@/lib/country-codes';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Regional-indicator flag emoji from an ISO 3166-1 alpha-2 code — no flag
// image assets needed.
const flag = (iso2) =>
  String.fromCodePoint(...[...iso2.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));

const SORTED = [...COUNTRY_CODES].sort((a, b) => a[1].localeCompare(b[1]));

// Splits a stored "+<dial><number>" value into its dial code (matched
// against the known list, longest prefix first so e.g. +1876 (Jamaica)
// isn't mistaken for +1 (US/Canada)) and the remaining local digits.
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
// the same shape the backend's phone validation expects.
export default function PhoneInput({ value, onChange, placeholder }) {
  const initial = useMemo(() => splitValue(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [dial, setDial] = useState(initial.dial);
  const [local, setLocal] = useState(initial.local);

  const emit = (nextDial, nextLocal) => {
    const digits = nextLocal.replace(/\D/g, '');
    onChange(digits ? `+${nextDial}${digits}` : '');
  };

  return (
    <div className="flex gap-2">
      <Select
        value={dial}
        onValueChange={(v) => {
          setDial(v);
          emit(v, local);
        }}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {SORTED.map(([iso2, name, code]) => (
            <SelectItem key={`${iso2}-${code}`} value={code}>
              {flag(iso2)} +{code} {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        className="flex-1"
        type="tel"
        inputMode="numeric"
        placeholder={placeholder || 'Number, no country code'}
        value={local}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '');
          setLocal(digits);
          emit(dial, digits);
        }}
      />
    </div>
  );
}
