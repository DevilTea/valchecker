# lazy.spec.md

Source File: `./lazy.ts`
Test File: [`./lazy.test.ts`](./lazy.test.ts)

## Functionality Summary
- Lazy schema that evaluates a schema getter function lazily.

## Exported Items
- `LazySchemaTypes`
    - **Description**: Type for lazy schema types.
    - **Input**: Schema getter.
    - **Output**: DefineSchemaTypes with input/output from schema.
- `LazySchema`
    - **Description**: Class for lazy validation.
    - **Input**: Meta with getSchema.
    - **Output**: Schema instance.
- `lazy`
    - **Description**: Function to create a lazy schema.
    - **Input**: Schema getter function.
    - **Output**: LazySchema instance.

## Test Cases
- `LazySchemaTypes`
    - **Note**: Type-only, not runtime testable.
- `LazySchema`
    - **Happy Path Cases**
        - [ ] **[LazySchema.happy.1]** Case 1: Execute with valid input for lazy schema.
            - **Input**: 42, getSchema returns number.
            - **Expected**: Success with 42.
    - **Error Cases**
        - [ ] **[LazySchema.error.1]** Case 1: Execute with invalid input for lazy schema.
            - **Input**: '42', getSchema returns number.
            - **Expected**: Failure with issues from number schema.
- `lazy`
    - **Happy Path Cases**
        - [ ] **[lazy.happy.1]** Case 1: Create lazy schema.
            - **Input**: () => number().
            - **Expected**: LazySchema instance.
