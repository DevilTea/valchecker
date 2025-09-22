# intersection.spec.md

Source File: `./intersection.ts`
Test File: [`./intersection.test.ts`](./intersection.test.ts)

## Functionality Summary
- Intersection schema for validating that input satisfies all provided branch schemas.

## Exported Items
- `IntersectionSchemaTypes`
    - **Description**: Type for intersection schema types.
    - **Input**: Branches array.
    - **Output**: DefineSchemaTypes with meta branches, output intersection of branch outputs.
- `IntersectionSchema`
    - **Description**: Class for intersection validation.
    - **Input**: Meta with branches.
    - **Output**: Schema instance.
- `intersection`
    - **Description**: Function to create an intersection schema.
    - **Input**: At least two branch schemas.
    - **Output**: IntersectionSchema instance.

## Test Cases
- `IntersectionSchemaTypes`
    - **Note**: Type-only, not runtime testable.
- `IntersectionSchema`
    - **Happy Path Cases**
        - [ ] **[IntersectionSchema.happy.1]** Case 1: Execute with value satisfying all branches.
            - **Input**: 42, branches [number, literal(42)].
            - **Expected**: Success with 42.
    - **Error Cases**
        - [ ] **[IntersectionSchema.error.1]** Case 1: Execute with value failing one branch.
            - **Input**: '42', branches [string, number].
            - **Expected**: Failure with issues from number branch.
        - [ ] **[IntersectionSchema.error.2]** Case 1: Execute with value failing all branches.
            - **Input**: {}, branches [string, number].
            - **Expected**: Failure with issues from both branches.
- `intersection`
    - **Happy Path Cases**
        - [ ] **[intersection.happy.1]** Case 1: Create intersection schema with branches.
            - **Input**: number, string.
            - **Expected**: IntersectionSchema instance.
