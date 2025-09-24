# literal.spec.md

Source File: `./literal.ts`
Test File: [`./literal.test.ts`](./literal.test.ts)

## Functionality Summary
- Literal schema for validating that input exactly matches a specified value, with special handling for NaN.

## Exported Items
- `LiteralSchema`
    - **Description**: Class for literal validation.
    - **Input**: Meta with value L.
    - **Output**: Schema instance.
- `literal`
    - **Description**: Function to create a literal schema.
    - **Input**: Value L, optional message.
    - **Output**: LiteralSchema<L>.

## Test Cases
- `LiteralSchema`
    - **Happy Path Cases**
        - [ ] **[LiteralSchema.happy.1]** Case 1: Execute with matching string value.
            - **Input**: Value 'test', input 'test'.
            - **Expected**: { value: 'test' }
        - [ ] **[LiteralSchema.happy.2]** Case 1: Execute with matching number value.
            - **Input**: Value 42, input 42.
            - **Expected**: { value: 42 }
        - [ ] **[LiteralSchema.happy.3]** Case 1: Execute with matching boolean value.
            - **Input**: Value true, input true.
            - **Expected**: { value: true }
        - [ ] **[LiteralSchema.happy.4]** Case 1: Execute with NaN value, input NaN.
            - **Input**: Value NaN, input NaN.
            - **Expected**: { value: NaN }
    - **Edge Cases**
        - [ ] **[LiteralSchema.edge.1]** Case 1: Execute with NaN value, input not NaN.
            - **Input**: Value NaN, input 42.
            - **Expected**: { issues: [{ code: 'INVALID_LITERAL', message: 'Invalid value.' }] }
    - **Error Cases**
        - [ ] **[LiteralSchema.error.1]** Case 1: Execute with non-matching value.
            - **Input**: Value 'test', input 'other'.
            - **Expected**: { issues: [{ code: 'INVALID_LITERAL', message: 'Invalid value.' }] }
- `literal`
    - **Happy Path Cases**
        - [ ] **[literal.happy.1]** Case 1: Create literal schema.
            - **Input**: Value 'test'.
            - **Expected**: LiteralSchema instance with meta value 'test'.
