from pathlib import Path

map_path = Path('packages/internal/src/steps/map/map.ts')
map_source = map_path.read_text()

old_snapshot = """\t\tconst snapshotEntries = (\n\t\t\tvalue: Map<unknown, unknown>,\n\t\t\tforEach: typeof Map.prototype.forEach,\n\t\t): unknown[] => {\n\t\t\t// eslint-disable-next-line unicorn/no-new-array\n\t\t\tconst entries = new Array<unknown>(value.size * 2)\n\t\t\tlet offset = 0\n\t\t\tforEach.call(value, (sourceValue, sourceKey) => {\n\t\t\t\tentries[offset++] = sourceKey\n\t\t\t\tentries[offset++] = sourceValue\n\t\t\t})\n\t\t\treturn entries\n\t\t}\n"""
new_snapshot = """\t\tconst snapshotEntries = (\n\t\t\tvalue: Map<unknown, unknown>,\n\t\t\tsize: number,\n\t\t\tforEach: typeof Map.prototype.forEach,\n\t\t): unknown[] => {\n\t\t\t// eslint-disable-next-line unicorn/no-new-array\n\t\t\tconst entries = new Array<unknown>(size * 2)\n\t\t\tlet offset = 0\n\t\t\tReflect.apply(forEach, value, [\n\t\t\t\t(sourceValue: unknown, sourceKey: unknown) => {\n\t\t\t\t\tentries[offset++] = sourceKey\n\t\t\t\t\tentries[offset++] = sourceValue\n\t\t\t\t},\n\t\t\t])\n\t\t\treturn entries\n\t\t}\n"""
old_call = """\t\t\tconst forEach = value.forEach\n\t\t\tconst entries = snapshotEntries(value, forEach)\n"""
new_call = """\t\t\tconst size = value.size\n\t\t\tconst forEach = value.forEach\n\t\t\tconst entries = snapshotEntries(value, size, forEach)\n"""

assert map_source.count(old_snapshot) == 1
assert map_source.count(old_call) == 1
map_source = map_source.replace(old_snapshot, new_snapshot).replace(old_call, new_call)
map_path.write_text(map_source)

test_path = Path('packages/internal/src/steps/map/lazy-output.test.ts')
test_source = test_path.read_text()
marker = "\tit('retains the original executor for an overridden forEach method', () => {\n"
insert = """\tit('preserves size lookup and overridden forEach call semantics', () => {\n\t\tconst input = new Map([['source', 1]])\n\t\tconst order: string[] = []\n\t\tObject.defineProperty(input, 'size', {\n\t\t\tget() {\n\t\t\t\torder.push('size')\n\t\t\t\treturn 1\n\t\t\t},\n\t\t})\n\t\tconst overriddenForEach = (callback: (value: unknown, key: unknown) => void) => {\n\t\t\torder.push('call')\n\t\t\tcallback(1, 'a')\n\t\t}\n\t\tObject.defineProperty(overriddenForEach, 'call', {\n\t\t\tvalue: () => {\n\t\t\t\tthrow new Error('Function.call must not be observed.')\n\t\t\t},\n\t\t})\n\t\tObject.defineProperty(input, 'forEach', {\n\t\t\tget() {\n\t\t\t\torder.push('forEach')\n\t\t\t\treturn overriddenForEach\n\t\t\t},\n\t\t})\n\n\t\texpect(v.map({ key: v.string(), value: v.number() }).execute(input)).toEqual({\n\t\t\tvalue: new Map([['a', 1]]),\n\t\t})\n\t\texpect(order).toEqual(['size', 'forEach', 'call'])\n\t})\n\n"""
assert test_source.count(marker) == 1
test_path.write_text(test_source.replace(marker, insert + marker))
