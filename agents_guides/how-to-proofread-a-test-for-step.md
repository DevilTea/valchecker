# How to Proofread a Test for a Step

This document provides a checklist for reviewing a test file (`.test.ts`) for a `step`. The goal is to ensure tests are comprehensive, correct, and adhere to the project's standards.

This guide should be used as the standard for code reviews of any new or modified test file for a step. It assumes the reviewer is familiar with the principles in [How to Write a Test](./how-to-write-a-test.md) and [How to Test a Step](./how-to-test-a-step.md).

## Checklist

### 1. Coverage

- [ ] **100% Coverage**: Does the test achieve **100% statement, branch, and function coverage** for the corresponding `step` source file? This is the most critical requirement.

### 2. Test Plan

- [ ] **JSDoc Test Plan**: Is there a complete and descriptive JSDoc test plan at the top of the file?
- [ ] **Comprehensiveness**: Does the plan accurately cover all aspects of the step being tested, including its functions, all possible input/output scenarios, and edge cases?

### 3. Test cases

- [ ] **Valid Inputs**: Are there sufficient test cases to prove the step works correctly with all expected valid inputs?
- [ ] **Invalid Inputs**: Are all relevant invalid input types thoroughly tested?
    - [ ] For initial type validators (e.g., `string`, `number`), are **all** JavaScript primitive types tested where it makes sense?
        - [ ] `string`
        - [ ] `number`
        - [ ] `boolean`
        - [ ] `null`
        - [ ] `undefined`
        - [ ] `bigint`
        - [ ] `symbol`
        - [ ] `object` (plain objects)
        - [ ] `array`
    - [ ] For constraint steps, are values that violate the constraint tested? Include boundary and off-by-one cases.
    - [ ] **Edge cases**: Are boundary and edge cases properly tested?
    - [ ] Empty strings (`''`)
    - [ ] Empty arrays (`[]`)
    - [ ] Empty objects (`{}`)
    - [ ] Zero (`0`)
    - [ ] Negative numbers
    - [ ] `NaN`, `Infinity`, and `-Infinity` (if applicable)
    - [ ] Very large/small numbers
    - [ ] Unicode characters and surrogate pairs (if string handling is relevant)
- [ ] **Specific Scenarios**: If the step has special behaviors, are they all tested?
    - [ ] **Chaining**: Is chaining with other steps tested?
        - [ ] Success path through multiple steps
        - [ ] Failure at first step
        - [ ] Failure at subsequent steps
    - [ ] **Async**: If the step is asynchronous, are both success and failure paths tested, and are tests properly `async` with `await`?
        - [ ] Successful async resolution
        - [ ] Promise rejection and thrown exceptions inside async handlers
        - [ ] Error thrown in async callback
    - [ ] **Custom messages**: If the step supports custom messages, is that functionality verified?
        - [ ] String message
        - [ ] Function-based message handler
    - [ ] **Overloads**: If the step has multiple overloads, is each overload tested?
    - [ ] **Nested structures**: For structural steps (`object`, `array`), are nested validations tested?
        - [ ] Valid nested structure
        - [ ] Invalid nested values
        - [ ] Issue path correctness
    - [ ] **Optional Properties**: For steps supporting optional properties, are both presence and absence tested?

### 4. Standards and Correctness

- [ ] **Standards Compliance**: Does the test file adhere to all standards defined in [How to Write a Test](./how-to-write-a-test.md)?
    - [ ] Is indentation done with **tabs**?
    - [ ] Are line endings LF (`\n`)?
    - [ ] Is all code and comments in **English**?
- [ ] **Imports**: Are imports correct and from the root export (`'../..'`)?
- [ ] **Test Organization**: Is the test file well-organized with `describe` and `it` blocks?
    - [ ] Are test groups logically named (e.g., `'valid inputs'`, `'invalid inputs'`, `'edge cases'`)?
    - [ ] Are test case descriptions clear and descriptive?
- [ ] **Strict Assertions**: Are all assertions made using `expect(...).toEqual(...)` for strict, complete object validation?
    - [ ] Is the use of partial checks like `toMatchObject` or `toHaveProperty` avoided?
    - [ ] For success results: `expect(result).toEqual({ value: expectedValue })`
    - [ ] For failure results: `expect(result).toEqual({ issues: [...] })`
- [ ] **Issue Structure Verification**: Do the assertions check for the correct structure upon failure?
    - [ ] Issue `code` follows the `stepName:error_code` format
    - [ ] Issue `payload` contains all necessary fields
    - [ ] Issue `message` is correct (or uses `expect.any(String)` if dynamic)
    - [ ] Issue `path` is correct for nested validations (if applicable)
    - [ ] **Async/Await**: Are async tests properly marked with `async` and using `await` when required?
