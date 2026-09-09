import { v } from 'valchecker'

export interface UserDirectory {
	usernameExists: (username: string) => Promise<boolean>
}

export function createUsernameSchema(users: UserDirectory) {
	return v.string()
		.toLowercase()
		.toTrimmed()
		.isLengthAtLeast(3, { message: 'Username must be at least 3 characters' })
		.check(async (value) => {
			const exists = await users.usernameExists(value)
			return exists ? 'Username is already taken' : true
		})
}
