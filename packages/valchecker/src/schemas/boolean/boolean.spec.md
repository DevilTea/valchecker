# boolean.spec.md

Source File: `./boolean.ts`
Test File: [`./boolean.test.ts`](./boolean.test.ts)

## Functionality Summary
- Boolean schema for validating that input is a boolean value.

## Exported Items
- `BooleanSchema`
    - **Description**: Class for boolean validation.
    - **Input**: Optional message.
    - **Output**: Schema instance.
- `boolean`
    - **Description**: Function to create a boolean schema.
    - **Input**: Optional message.
    - **Output**: BooleanSchema instance.

## Test Cases
- `BooleanSchema`
    - **Happy Path Cases**
        - [ ] **[BooleanSchema.happy.1]** Case 1: Execute with true value.
            - **Input**: Input true.
            - **Expected**: Success with true.
        - [ ] **[BooleanSchema.happy.2]** Case 1: Execute with false value.
            - **Input**: Input false.
            - **Expected**: Success with false.
    - **Error Cases**
        - [ ] **[BooleanSchema.error.1]** Case 1: Execute with number value.
            - **Input**: Input 1.
            - **Expected**: Failure with EXPECTED_BOOLEAN.
        - [ ] **[BooleanSchema.error.2]** Case 1: Execute with string value.
            - **Input**: Input 'true'.
            - **Expected**: Failure with EXPECTED_BOOLEAN.
        - [ ] **[BooleanSchema.error.3]** Case 1: Execute with null value.
            - **Input**: Input null.
            - **Expected**: Failure with EXPECTED_BOOLEAN.
        - [ ] **[BooleanSchema.error.4]** Case 1: Execute with undefined value.
            - **Input**: Input undefined.
            - **Expected**: Failure with EXPECTED_BOOLEAN.
        - [ ] **[BooleanSchema.error.5]** Case 1: Execute with object value.
            - **Input**: Input {}.
            - **Expected**: Failure with EXPECTED_BOOLEAN.
- `boolean`
    - **Happy Path Cases**
        - [ ] **[boolean.happy.1]** Case 1: Create boolean schema.
            - **Input**: No arguments.
            - **Expected**: BooleanSchema instance.
