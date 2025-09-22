# check.spec.md

Source File: `./check.ts`
Test File: [`./check.test.ts`](./check.test.ts)

## Functionality Summary
- Check step schema for pipe operations, performing validations on successful execution results with issue reporting.

## Exported Items
- `PipeStepCheckSchemaMessage`
    - **Description**: Type for messages in check schema.
    - **Input**: N/A (type definition).
    - **Output**: SchemaMessage type.
- `RunCheck`
    - **Description**: Type for check function.
    - **Input**: N/A (type definition).
    - **Output**: Function type.
- `RunCheckResult`
    - **Description**: Type for check result.
    - **Input**: N/A (type definition).
    - **Output**: MaybePromise of void, boolean, string, or True.
- `RunCheckUtils`
    - **Description**: Type for utils passed to check function.
    - **Input**: N/A (type definition).
    - **Output**: Object with narrow and addIssue.
- `True`
    - **Description**: Type for true with output type.
    - **Input**: N/A (type definition).
    - **Output**: true with output.
- `defineRunCheck`
    - **Description**: Helper function to define check functions.
    - **Input**: N/A.
    - **Output**: Object with implement method.
- `PipeStepCheckSchema`
    - **Description**: Class for check step in pipes.
    - **Input**: Meta with run function.
    - **Output**: Schema instance.

## Test Cases
- `PipeStepCheckSchemaMessage`
    - **Note**: Type-only, not runtime testable.
- `RunCheck`
    - **Note**: Type-only, not runtime testable.
- `RunCheckResult`
    - **Note**: Type-only, not runtime testable.
- `RunCheckUtils`
    - **Note**: Type-only, not runtime testable.
- `True`
    - **Note**: Type-only, not runtime testable.
- `defineRunCheck`
    - **Happy Path Cases**
        - [ ] **[defineRunCheck.happy.1]** Case 1: Define a check function.
            - **Input**: Call implement with function.
            - **Expected**: Returns the function.
- `PipeStepCheckSchema`
    - **Happy Path Cases**
        - [ ] **[PipeStepCheckSchema.happy.1]** Case 1: Execute with success, check returns void.
            - **Input**: Success result, check returns void.
            - **Expected**: { value: 'test' }
        - [ ] **[PipeStepCheckSchema.happy.2]** Case 1: Execute with success, check returns true.
            - **Input**: Success, check returns true.
            - **Expected**: { value: 'test' }
        - [ ] **[PipeStepCheckSchema.happy.3]** Case 1: Execute with success, check returns True.
            - **Input**: Success, check returns True.
            - **Expected**: { value: 'test' }
    - **Edge Cases**
        - [ ] **[PipeStepCheckSchema.edge.1]** Case 1: Execute with failure result.
            - **Input**: Failure result.
            - **Expected**: Pass through failure.
        - [ ] **[PipeStepCheckSchema.edge.2]** Case 1: Execute with success, check adds issues.
            - **Input**: Success, check calls addIssue.
            - **Expected**: { issues: [{ code: 'TEST', message: 'test issue' }] }
    - **Error Cases**
        - [ ] **[PipeStepCheckSchema.error.1]** Case 1: Execute with success, check returns false.
            - **Input**: Success, check returns false.
            - **Expected**: { issues: [{ code: 'CHECK_FAILED', message: 'Invalid value.' }] }
        - [ ] **[PipeStepCheckSchema.error.2]** Case 1: Execute with success, check returns string.
            - **Input**: Success, check returns string.
            - **Expected**: { issues: [{ code: 'CHECK_FAILED', message: 'error message' }] }
        - [ ] **[PipeStepCheckSchema.error.3]** Case 1: Execute with success, check throws.
            - **Input**: Success, check throws.
            - **Expected**: { issues: [{ code: 'CHECK_FAILED', message: 'Invalid value.', error: Error }] }
