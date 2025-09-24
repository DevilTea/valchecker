# instance.spec.md

Source File: `./instance.ts`
Test File: [`./instance.test.ts`](./instance.test.ts)

## Functionality Summary
- Instance schema that validates if the value is an instance of a given constructor.

## Exported Items
- `InstanceSchema`
    - **Description**: Class for instance validation.
    - **Input**: Meta with constructor, message optional.
    - **Output**: Schema instance.
- `instance`
    - **Description**: Function to create an instance schema.
    - **Input**: Constructor, optional message.
    - **Output**: InstanceSchema instance.

## Test Cases
- `InstanceSchema`
    - **Happy Path Cases**
        - [ ] **[InstanceSchema.happy.1]** Case 1: Execute with instance of constructor.
            - **Input**: new Date(), Date.
            - **Expected**: Success with the Date instance.
    - **Error Cases**
        - [ ] **[InstanceSchema.error.1]** Case 1: Execute with non-instance.
            - **Input**: 'not a date', Date.
            - **Expected**: Failure with INVALID_INSTANCE.
- `instance`
    - **Happy Path Cases**
        - [ ] **[instance.happy.1]** Case 1: Create instance schema.
            - **Input**: Date.
            - **Expected**: InstanceSchema instance.
