# object.spec.md

Source File: `./object.ts`
Test File: [`./object.test.ts`](./object.test.ts)

## Functionality Summary
- Object schema that validates objects with specific property schemas.

## Exported Items
- `ObjectSchemaTypes`
    - **Description**: Type for object schema types.
    - **Input**: Struct of property schemas.
    - **Output**: DefineSchemaTypes with output inferred from struct.
- `ObjectSchemaMessage`
    - **Description**: Type for object schema message.
    - **Input**: N/A.
    - **Output**: SchemaMessage for ObjectSchemaTypes.
- `ObjectSchema`
    - **Description**: Class for object validation.
    - **Input**: Meta with struct, message optional.
    - **Output**: Schema instance.
- `object`
    - **Description**: Function to create an object schema.
    - **Input**: Struct, optional message.
    - **Output**: ObjectSchema instance.

## Test Cases
- `ObjectSchemaTypes`
    - **Note**: Type-only, not runtime testable.
- `ObjectSchemaMessage`
    - **Note**: Type-only, not runtime testable.
- `ObjectSchema`
    - **Happy Path Cases**
        - [ ] **[ObjectSchema.happy.1]** Case 1: Execute with valid object.
            - **Input**: { a: 1, b: 'hello' }, struct { a: number, b: string }.
            - **Expected**: Success with { a: 1, b: 'hello' }.
    - **Error Cases**
        - [ ] **[ObjectSchema.error.1]** Case 1: Execute with non-object.
            - **Input**: 42, struct { a: number }.
            - **Expected**: Failure with EXPECTED_OBJECT.
        - [ ] **[ObjectSchema.error.2]** Case 1: Execute with invalid property.
            - **Input**: { a: '1' }, struct { a: number }.
            - **Expected**: Failure with issues for a.
- `object`
    - **Happy Path Cases**
        - [ ] **[object.happy.1]** Case 1: Create object schema.
            - **Input**: { a: number }.
            - **Expected**: ObjectSchema instance.
