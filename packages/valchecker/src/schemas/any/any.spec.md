# any.spec.md

Source File: `./any.ts`
Test File: [`./any.test.ts`](./any.test.ts)

## Functionality Summary
- Any schema that accepts any value and always succeeds.

## Exported Items
- `AnySchema`
    - **Description**: Class for any validation.
    - **Input**: N/A.
    - **Output**: Schema instance.
- `any`
    - **Description**: Function to create an any schema.
    - **Input**: N/A.
    - **Output**: AnySchema instance.

## Test Cases
- `AnySchema`
    - **Happy Path Cases**
        - [ ] **[AnySchema.happy.1]** Case 1: Execute with any input.
            - **Input**: 42.
            - **Expected**: Success with 42.
        - [ ] **[AnySchema.happy.2]** Case 1: Execute with another input.
            - **Input**: 'hello'.
            - **Expected**: Success with 'hello'.
- `any`
    - **Happy Path Cases**
        - [ ] **[any.happy.1]** Case 1: Create any schema.
            - **Input**: N/A.
            - **Expected**: AnySchema instance.
