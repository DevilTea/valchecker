<!-- step-doc
category: formats
section: pattern
summary: EUI-48 MAC address with `:` or `-` separators
-->

### `isMac(options?)`

EUI-48 MAC address as six hexadecimal octets, each followed by either `:` or `-` except the last.
Matching is case-insensitive; the current pattern does not require the same separator at every
position.

```ts
v.string()
	.isMac()
	.execute('00:1A:2B:3C:4D:5E')
// { value: '00:1A:2B:3C:4D:5E' }

v.string()
	.isMac()
	.execute('001A2B3C4D5E')
// failure
```

**Issue code:** `isMac:expected_mac` — the string is not a valid MAC address. Payload `{ value }`.
