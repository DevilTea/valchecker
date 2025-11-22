# Valchecker Proposals

This directory contains design proposals and technical discussions for future enhancements to valchecker.

## Active Proposals

### JIT Mode Support

**Status**: Proposal / Discussion Phase

A comprehensive proposal for adding Just-In-Time (JIT) compilation mode to valchecker to optimize validation performance for frequently-executed schemas.

**Documents:**
- [JIT Mode Support Proposal](./jit-mode-support.md) - Full proposal in English with detailed implementation strategies
- [JIT Mode Discussion (中文)](./jit-mode-discussion-zh-tw.md) - Simplified Chinese version for maintainers
- [JIT Performance Analysis](./jit-performance-analysis.md) - Detailed performance analysis and projections

**Summary:**
- **Problem**: Current interpreter-based execution has overhead from function calls, array iteration, and intermediate object allocations
- **Solution**: Pre-compile validation pipelines into optimized functions using code generation
- **Expected Gains**: 3-6x performance improvement for typical schemas
- **Approach**: Phased implementation starting with low-risk optimizations, then explicit compilation API, finally auto-compilation

**Key Discussion Points:**
1. Should JIT be opt-in or automatic?
2. How to handle async steps?
3. What compilation threshold makes sense?
4. Should compiled schemas support chaining?
5. CSP compatibility considerations

**Next Steps:**
1. Gather feedback from maintainers and community
2. Build minimal POC to validate approach
3. Benchmark actual performance gains
4. Decide on implementation strategy
5. Begin Phase 1 (low-risk optimizations)

---

## Contributing Proposals

To propose a new feature or architectural change:

1. Create a new markdown file in this directory
2. Use a clear, descriptive filename (e.g., `feature-name-proposal.md`)
3. Include:
   - **Overview**: What problem does this solve?
   - **Current State**: How does the system work now?
   - **Proposed Solution**: What changes are you suggesting?
   - **Trade-offs**: What are the pros and cons?
   - **Implementation Plan**: How would this be built?
   - **Discussion Questions**: What needs to be decided?
4. Update this README with a summary
5. Open an issue or PR to start discussion

## Proposal Template

```markdown
# [Feature Name] Proposal

## Overview
Brief description of what you're proposing and why.

## Problem Statement
What problem does this solve? Who is affected?

## Current State
How does the system work now? What are the limitations?

## Proposed Solution
Detailed description of your proposal. Include:
- Architecture changes
- API changes
- Implementation approach
- Examples

## Trade-offs
### Pros
- What benefits does this provide?

### Cons
- What are the downsides?
- What complexity does this add?

## Implementation Plan
1. Phase 1: ...
2. Phase 2: ...
3. Phase 3: ...

## Open Questions
1. Question 1?
2. Question 2?

## Alternatives Considered
What other approaches did you consider and why did you reject them?

## References
- Links to related issues
- Similar implementations in other libraries
- Relevant documentation
```
