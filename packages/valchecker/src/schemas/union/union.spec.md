# union.spec.md

Source File: `./union.ts`
Test File: [`./union.test.ts`](./union.test.ts)

## Functionality Summary
- Creates a union schema that validates a value against multiple branch schemas, succeeding if at least one branch validates successfully.

## Exported Items
- `UnionSchema`
    - **Description**: A schema class that extends AbstractSchema for union validation.
    - **Input**: Value to validate, meta with branches array.
    - **Output**: ExecutionResult with success if any branch succeeds, or failure with all issues.
- `union`
    - **Description**: Function to create a UnionSchema instance.
    - **Input**: At least two ValSchema branches as rest parameters.
    - **Output**: New UnionSchema instance with the provided branches.

## Test Cases
- `UnionSchema`
    - **Happy Path Cases**
        - [ ] **[UnionSchema.happy.1]** Case 1: Value passes the first branch.
            - **Input**: Value that passes first branch, fails others.
            - **Expected**: Success result with the value.
        - [ ] **[UnionSchema.happy.2]** Case 1: Value passes a middle branch.
            - **Input**: Value that fails first, passes middle, fails last.
            - **Expected**: Success result with the value.
        - [ ] **[UnionSchema.happy.3]** Case 1: Value passes the last branch.
            - **Input**: Value that fails all but last branch.
            - **Expected**: Success result with the value.
    - **Edge Cases**
        - [ ] **[UnionSchema.edge.1]** Case 1: Empty branches array.
            - **Input**: Meta with empty branches.
            - **Expected**: Failure with 'NO_BRANCHES_PROVIDED'.
    - **Error Cases**
        - [ ] **[UnionSchema.error.1]** Case 1: Value fails all branches.
            - **Input**: Value that fails all branches.
            - **Expected**: Failure with issues from all branches.
- `union`
    - **Happy Path Cases**
        - [ ] **[union.happy.1]** Case 1: Create union with two branches.
            - **Input**: Two ValSchema instances.
            - **Expected**: UnionSchema instance with those branches in meta.
