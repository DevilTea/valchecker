export const NullProtoObj = (() => {
	const e = function () {}
	e.prototype = Object.create(null)
	Object.freeze(e.prototype)
	return e
})() as any as ({
	new (): Record<any, any>
})

export function createObject<T extends Record<any, any> = Record<any, any>>(obj?: T): T {
	const _obj = new NullProtoObj()
	if (obj)
		Object.assign(_obj, obj)
	return _obj
}
