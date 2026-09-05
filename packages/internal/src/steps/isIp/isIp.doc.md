<!-- step-doc
category: formats
section: parsed
summary: IPv4 or IPv6, with range-checked octets and `::` compression
-->

### `isIp(options?)`

Checks an IPv4 or IPv6 address. IPv4 octets are range-checked (0–255, no leading zeros); IPv6
supports `::` zero-compression and an embedded IPv4 suffix as the final portion. When compression
is used, the IPv4 suffix must follow the `::` marker. Zone identifiers are not accepted.
Restrict to one family with `version` (`4` or `6`); by default both are accepted.

```ts
v.string()
	.isIp()
	.execute('192.168.0.1')
// { value: '192.168.0.1' }

v.string()
	.isIp({ version: 6 })
	.execute('192.168.0.1')
// failure
```

**Issue code:** `isIp:expected_ip` — the string is not an IP address of the requested family.
Payload `{ value, version }`, where `version` is the configured restriction and `undefined` when
both families are accepted.
