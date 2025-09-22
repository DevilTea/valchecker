# pipe.spec.md

Source File: `./pipe.ts`
Test File: [`./pipe.test.ts`](./pipe.test.ts)

## Functionality Summary
- Pipe schema implementation for chaining validation, transformation, and fallback steps on schema execution results.

## Exported Items
- `PipeStepValSchema`
    - **Description**: Type for pipe step schemas that operate on execution results.
    - **Input**: N/A (type definition).
    - **Output**: Schema with input as ExecutionResult.
- `PipeSteps`
    - **Description**: Type for array of pipe steps, starting with a ValSchema.
    - **Input**: N/A (type definition).
    - **Output**: Tuple of schemas.
- `NextAsync`
    - **Description**: Type to determine if pipe becomes async based on new step.
    - **Input**: N/A (type definition).
    - **Output**: Boolean.
- `PipeSchemaTypes`
    - **Description**: Schema types for PipeSchema.
    - **Input**: N/A (type definition).
    - **Output**: Defined schema types.
- `PipeSchema`
    - **Description**: Class for pipe schemas with methods to add steps.
    - **Input**: Meta with steps.
    - **Output**: PipeSchema instance.
- `pipe`
    - **Description**: Function to create a pipe schema from a source schema.
    - **Input**: Source ValSchema.
    - **Output**: PipeSchema instance.

## Test Cases
- `PipeStepValSchema`
    - **Note**: Type-only, not runtime testable.
- `PipeSteps`
    - **Note**: Type-only, not runtime testable.
- `NextAsync`
    - **Note**: Type-only, not runtime testable.
- `PipeSchemaTypes`
    - **Note**: Type-only, not runtime testable.
- `PipeSchema`
    - **Happy Path Cases**
        - [ ] **[PipeSchema.happy.1]** Case 1: Instantiate PipeSchema.
            - **Input**: Meta with steps.
            - **Expected**: Instance created.
        - [ ] **[PipeSchema.happy.2]** Case 1: Add check step.
            - **Input**: Call check on schema.
            - **Expected**: New schema with added step.
        - [ ] **[PipeSchema.happy.3]** Case 1: Add transform step.
            - **Input**: Call transform on schema.
            - **Expected**: New schema with added step, transformed true.
        - [ ] **[PipeSchema.happy.4]** Case 1: Add fallback step.
            - **Input**: Call fallback on schema.
            - **Expected**: New schema with added step.
        - [ ] **[PipeSchema.happy.5]** Case 1: Execute pipe with success.
            - **Input**: Pipe with success steps.
            - **Expected**: Chained execution result.
        - [ ] **[PipeSchema.happy.6]** Case 1: Execute pipe with failure and fallback.
            - **Input**: Pipe with failing step and fallback.
            - **Expected**: Fallback result.
    - **Edge Cases**
        - [ ] **[PipeSchema.edge.1]** Case 1: Pipe with single step.
            - **Input**: Pipe with one schema.
            - **Expected**: Executes the single step.
    - **Error Cases**
        - [ ] **[PipeSchema.error.1]** Case 1: Execute with invalid step.
            - **Input**: Pipe with step that throws.
            - **Expected**: Propagates error.
- `pipe`
    - **Happy Path Cases**
        - [ ] **[pipe.happy.1]** Case 1: Create pipe from schema.
            - **Input**: ValSchema.
            - **Expected**: PipeSchema with the schema as first step.
