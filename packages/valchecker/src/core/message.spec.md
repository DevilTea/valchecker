# `message.spec.md`

Source File: `./message.ts`

## Functionality Summary
- Provides utilities for resolving validation messages based on issue codes, input values, and user-provided message configurations.

## Exported Items (Functions, Classes, Constants, TS Types, etc.)
- `SchemaMessage`
	- Description: A TypeScript type alias for schema validation messages. It can be a string, a function, or a map of issue codes to strings or functions.
	- Input: `IssueCode` (string), `Input` (any)
	- Output: A type representing the possible message formats.
- `UnknownErrorIssueCode`
	- Description: A TypeScript type alias for the 'UNKNOWN_ERROR' issue code.
	- Input: N/A
	- Output: The literal string type `'UNKNOWN_ERROR'`.
- `defaultInvalidValueMessage`
	- Description: A constant string that serves as the default message when no other message can be resolved.
	- Input: N/A
	- Output: The string `'Invalid value.'`.
- `resolveMessage`
	- Description: Resolves a validation message based on a payload containing the issue code, value, and optional path/error, along with default and user-provided message configurations.
	- Input: An object with `payload`, `defaultMessage`, and `message`.
	- Output: The resolved message string.

## Test Cases (as strictly required for 100% coverage)
- `resolveMessage`
	- Happy Path Cases
		- [ ] case 1: should return the specific message from the user-provided message map.
			- Input: `payload: { code: 'TEST_CODE', value: 'test' }, message: { TEST_CODE: 'User message' }`
			- Expected: `'User message'`
		- [ ] case 2: should return the message from the user-provided message function.
			- Input: `payload: { code: 'TEST_CODE', value: 'test' }, message: (p) => \`Value is \${p.value}\`\``
			- Expected: `'Value is test'`
		- [ ] case 3: should return the user-provided global message string.
			- Input: `payload: { code: 'TEST_CODE', value: 'test' }, message: 'Global user message'`
			- Expected: `'Global user message'`
		- [ ] case 4: should return the specific message from the default message map.
			- Input: `payload: { code: 'TEST_CODE', value: 'test' }, defaultMessage: { TEST_CODE: 'Default message' }`
			- Expected: `'Default message'`
		- [ ] case 5: should return the message from the default message function.
			- Input: `payload: { code: 'TEST_CODE', value: 'test' }, defaultMessage: (p) => \`Default value is \${p.value}\`\``
			- Expected: `'Default value is test'`
		- [ ] case 6: should return the default global message string.
			- Input: `payload: { code: 'TEST_CODE', value: 'test' }, defaultMessage: 'Global default message'`
			- Expected: `'Global default message'`
		- [ ] case 7: should prioritize user message over default message.
			- Input: `payload: { code: 'TEST_CODE', value: 'test' }, defaultMessage: 'Default', message: 'User'`
			- Expected: `'User'`
		- [ ] case 8: should return `defaultInvalidValueMessage` when no message is resolved.
			- Input: `payload: { code: 'TEST_CODE', value: 'test' }`
			- Expected: `defaultInvalidValueMessage`
		- [ ] case 9: should handle nested message resolution in maps.
			- Input: `payload: { code: 'ANOTHER_CODE', value: 'test' }, message: { TEST_CODE: 'Won't be used' }`
			- Expected: `defaultInvalidValueMessage`
	- Edge Cases
		- [ ] case 1: should handle `null` and `undefined` for message and defaultMessage.
			- Input: `payload: { code: 'TEST_CODE', value: 'test' }, message: null, defaultMessage: undefined`
			- Expected: `defaultInvalidValueMessage`
		- [ ] case 2: should pass path and error to the message function.
			- Input: `payload: { code: 'TEST_CODE', value: 'test', path: ['a', 'b'], error: new Error('test error') }, message: (p) => \`Path: \${p.path?.join('.')}, Error: \${p.error?.message}\`\``
			- Expected: `'Path: a.b, Error: test error'`
