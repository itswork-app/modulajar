# PR Governance Specification

We follow a strict "Contract-First" development lifecycle.

## Rules
1. **No Drift**: Code must match the spec. If code needs to change, update the spec FIRST in a separate PR.
2. **PR-Only**: All changes must go through a Pull Request. No direct pushes to main.
3. **CI Checks**: ALL PRs must pass:
    - Linting
    - Building
    - Unit Tests
    - Spec Compliance (Manual Check)
4. **Scope Control**: Each PR must address ONE specific objective. No scope creep.
