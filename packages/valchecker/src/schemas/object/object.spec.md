# object.spec.md

Source File: `./object.ts`
Test File: [`./object.test.ts`](./object.test.ts)

## Functionality Summary
- Provides object schema validation with default, loose, and strict modes for validating object properties.

## Exported Items
- `object`
    - **Description**: Creates a default object schema that validates the specified struct properties and allows extra keys.
    - **Input**: `struct: Record<PropertyKey, ValSchema>`, optional `message?: ObjectSchemaMessage<O, 'default'>`.
    - **Output**: `ObjectSchema<O, 'default'>` instance.
- `looseObject`
    - **Description**: Creates a loose object schema that validates the specified struct properties, allows extra keys, and preserves the original object structure if not transformed.
    - **Input**: `struct: Record<PropertyKey, ValSchema>`, optional `message?: ObjectSchemaMessage<O, 'loose'>`.
    - **Output**: `ObjectSchema<O, 'loose'>` instance.
- `ObjectSchema`
    - **Description**: The class representing an object schema with execution logic for validation.
    - **Input**: Constructor with meta containing struct and mode.
    - **Output**: Schema instance for validation.
- `strictObject`
    - **Description**: Creates a strict object schema that validates the specified struct properties and rejects any extra keys.
    - **Input**: `struct: Record<PropertyKey, ValSchema>`, optional `message?: ObjectSchemaMessage<O, 'strict'>`.
    - **Output**: `ObjectSchema<O, 'strict'>` instance.

## Test Cases
- `object`
    - **Happy Path Cases**
        - [ ] **[object.happy.1]** Case 1: Create and execute with valid object matching struct.
            - **Input**: struct { a: numberSchema, b: stringSchema }, value { a: 1, b: 'test' }.
            - **Expected**: Success with { a: 1, b: 'test' }.
        - [ ] **[object.happy.2]** Case 1: Create and execute with extra keys allowed.
            - **Input**: struct { a: numberSchema }, value { a: 1, b: 'extra' }.
            - **Expected**: Success with { a: 1 }.
        - [ ] **[object.happy.3]** Case 1: Create with optional properties.
            - **Input**: struct { a: optional(numberSchema) }, value {}.
            - **Expected**: Success with {}.
    - **Edge Cases**
        - [ ] **[object.edge.1]** Case 1: Execute with null value.
            - **Input**: struct { a: numberSchema }, value null.
            - **Expected**: Failure with EXPECTED_OBJECT.
        - [ ] **[object.edge.2]** Case 1: Execute with array value.
            - **Input**: struct { a: numberSchema }, value [].
            - **Expected**: Failure with EXPECTED_OBJECT.
    - **Error Cases**
        - [ ] **[object.error.1]** Case 1: Execute with invalid property type.
            - **Input**: struct { a: numberSchema }, value { a: 'invalid' }.
            - **Expected**: Failure with issues for property a.
- `looseObject`
    - **Happy Path Cases**
        - [ ] **[looseObject.happy.1]** Case 1: Create and execute with valid object, preserving extra keys.
            - **Input**: struct { a: numberSchema }, value { a: 1, b: 'extra' }.
            - **Expected**: Success with { a: 1, b: 'extra' }.
        - [ ] **[looseObject.happy.2]** Case 1: Create and execute with transformed schema.
            - **Input**: struct { a: transformSchema }, value { a: input, b: 'extra' }.
            - **Expected**: Success with transformed output including extra keys.
    - **Edge Cases**
        - [ ] **[looseObject.edge.1]** Case 1: Execute with no extra keys.
            - **Input**: struct { a: numberSchema }, value { a: 1 }.
            - **Expected**: Success with { a: 1 }.
    - **Error Cases**
        - [ ] **[looseObject.error.1]** Case 1: Execute with invalid property.
            - **Input**: struct { a: numberSchema }, value { a: 'invalid', b: 'extra' }.
            - **Expected**: Failure with issues for property a.
- `ObjectSchema`
    - **Happy Path Cases**
        - [ ] **[ObjectSchema.happy.1]** Case 1: Instantiate and execute default mode.
            - **Input**: new ObjectSchema with default mode, valid object.
            - **Expected**: Success.
        - [ ] **[ObjectSchema.happy.2]** Case 1: Instantiate and execute loose mode.
            - **Input**: new ObjectSchema with loose mode, valid object with extras.
            - **Expected**: Success with extras preserved.
        - [ ] **[ObjectSchema.happy.3]** Case 1: Instantiate and execute strict mode.
            - **Input**: new ObjectSchema with strict mode, exact match.
            - **Expected**: Success.
    - **Error Cases**
        - [ ] **[ObjectSchema.error.1]** Case 1: Execute strict mode with extra key.
            - **Input**: strict mode, object with extra key.
            - **Expected**: Failure with UNEXPECTED_KEY.
- `strictObject`
    - **Happy Path Cases**
        - [ ] **[strictObject.happy.1]** Case 1: Create and execute with exact struct match.
            - **Input**: struct { a: numberSchema, b: stringSchema }, value { a: 1, b: 'test' }.
            - **Expected**: Success with { a: 1, b: 'test' }.
    - **Edge Cases**
        - [ ] **[strictObject.edge.1]** Case 1: Execute with missing required property.
            - **Input**: struct { a: numberSchema }, value {}.
            - **Expected**: Failure with issues for missing a.
    - **Error Cases**
        - [ ] **[strictObject.error.1]** Case 1: Execute with extra key.
            - **Input**: struct { a: numberSchema }, value { a: 1, b: 'extra' }.
            - **Expected**: Failure with UNEXPECTED_KEY.
        - [ ] **[strictObject.error.2]** Case 1: Execute with invalid type.
            - **Input**: struct { a: numberSchema }, value { a: 'invalid' }.
            - **Expected**: Failure with issues for a.
