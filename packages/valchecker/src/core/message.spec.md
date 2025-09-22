# message.spec.md

Source File: `./message.ts`
Test File: [`./message.test.ts`](./message.test.ts)

## Functionality Summary
- Message resolution utilities for valchecker schemas, handling default and custom error messages.

## Exported Items
- `SchemaMessage`
    - **Description**: Type for schema message definitions, can be string, function, or map.
    - **Input**: N/A (type definition).
    - **Output**: String, function, or partial map.
- `UnknownErrorIssueCode`
    - **Description**: Type for unknown error issue code.
    - **Input**: N/A (type definition).
    - **Output**: 'UNKNOWN_ERROR'.
- `defaultInvalidValueMessage`
    - **Description**: Default error message for invalid values.
    - **Input**: N/A (constant).
    - **Output**: 'Invalid value.'.
- `resolveMessage`
    - **Description**: Resolves a message from provided message and default message.
    - **Input**: Payload with code, value, path, error; defaultMessage; message.
    - **Output**: Resolved string message.

## Test Cases
- `SchemaMessage`
    - **Note**: Type-only, not runtime testable.
- `UnknownErrorIssueCode`
    - **Note**: Type-only, not runtime testable.
- `defaultInvalidValueMessage`
    - **Happy Path Cases**
        - [ ] **[defaultInvalidValueMessage.happy.1]** Case 1: Check the default message value.
            - **Input**: N/A.
            - **Expected**: 'Invalid value.'.
- `resolveMessage`
    - **Happy Path Cases**
        - [ ] **[resolveMessage.happy.1]** Case 1: Resolve string message.
            - **Input**: Payload, message: 'custom'.
            - **Expected**: 'custom'.
        - [ ] **[resolveMessage.happy.2]** Case 1: Resolve function message.
            - **Input**: Payload, message: () => 'func'.
            - **Expected**: 'func'.
        - [ ] **[resolveMessage.happy.3]** Case 1: Resolve map message.
            - **Input**: Payload with code 'TEST', message: { TEST: 'map' }.
            - **Expected**: 'map'.
        - [ ] **[resolveMessage.happy.4]** Case 1: Fall back to default message.
            - **Input**: Payload, message: null, defaultMessage: 'default'.
            - **Expected**: 'default'.
        - [ ] **[resolveMessage.happy.5]** Case 1: Fall back to default invalid message.
            - **Input**: Payload, message: null, defaultMessage: null.
            - **Expected**: 'Invalid value.'.
    - **Edge Cases**
        - [ ] **[resolveMessage.edge.1]** Case 1: Message map with unknown code.
            - **Input**: Payload with code 'UNKNOWN', message: { TEST: 'test' }.
            - **Expected**: undefined (then fallback).
        - [ ] **[resolveMessage.edge.2]** Case 1: Function message with path and error.
            - **Input**: Payload with path and error, message: (p) => `error: ${p.error}`.
            - **Expected**: 'error: test'.
    - **Error Cases**
        - [ ] **[resolveMessage.error.1]** Case 1: Invalid message type.
            - **Input**: Payload, message: 123.
            - **Expected**: Fallback to default.
