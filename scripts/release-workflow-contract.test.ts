import { describe, expect, it } from 'vitest'
import { assertReleaseWorkflowContract } from './release-workflow-contract'

const validWorkflow = `on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-24.04
    timeout-minutes: 45
    environment: npm
    permissions:
      contents: read
      id-token: write
    steps:
      - name: Checkout exact release tag
        uses: actions/checkout@1111111111111111111111111111111111111111
        with:
          fetch-depth: 0
          persist-credentials: false
      - name: Verify annotated tag and main ancestry
        shell: bash
        run: |
          test "$GITHUB_REF_TYPE" = "tag"
          test "$(git cat-file -t "$GITHUB_REF_NAME")" = "tag"
          tagged_commit="$(git rev-list -n 1 "$GITHUB_REF_NAME")"
          test "$tagged_commit" = "$GITHUB_SHA"
          git fetch origin main
          git merge-base --is-ancestor "$GITHUB_SHA" origin/main
      - name: Setup PNPM
        uses: pnpm/action-setup@2222222222222222222222222222222222222222
      - name: Setup Node
        uses: actions/setup-node@3333333333333333333333333333333333333333
        with:
          node-version: 24
          package-manager-cache: false
      - name: Setup npm for Trusted Publishing
        run: npm install --global npm@11.5.1
      - name: Install Dependencies
        run: pnpm install --frozen-lockfile
      - name: Security Audit Policy
        run: pnpm security:audit
      - name: Validate Tagged Release
        run: pnpm release:validate
      - name: Prepare Immutable Tarballs
        run: pnpm release:prepare
      - name: Upload Prepared Tarballs
        uses: actions/upload-artifact@4444444444444444444444444444444444444444
        with:
          name: npm-release-\${{ github.ref_name }}-\${{ github.run_id }}-\${{ github.run_attempt }}
          path: artifacts/release
          if-no-files-found: error
          retention-days: 90
      - name: Publish Prepared Tarballs
        run: pnpm release:publish
`

describe('release workflow contract', () => {
	it('accepts the executable release contract', () => {
		expect(() => assertReleaseWorkflowContract(validWorkflow)).not.toThrow()
	})

	it('does not accept a security gate mentioned only in a comment', () => {
		const mutated = validWorkflow.replace(
			'      - name: Security Audit Policy\n        run: pnpm security:audit',
			'      # pnpm security:audit\n      - name: Security Audit Policy\n        run: echo skipped-security-audit',
		)
		expect(() => assertReleaseWorkflowContract(mutated))
			.toThrow('release step Security Audit Policy')
	})

	it('requires OIDC permission on the publish job itself', () => {
		const mutated = validWorkflow.replace('      id-token: write', '      id-token: read\n      # id-token: write')
		expect(() => assertReleaseWorkflowContract(mutated))
			.toThrow('release publish permissions')
	})

	it('requires checkout credentials to stay disabled in the executable checkout step', () => {
		const mutated = validWorkflow.replace('          persist-credentials: false', '          persist-credentials: true\n          # persist-credentials: false')
		expect(() => assertReleaseWorkflowContract(mutated))
			.toThrow('release step Checkout exact release tag with options')
	})

	it('rejects a security gate that is allowed to fail', () => {
		const mutated = validWorkflow.replace(
			'      - name: Security Audit Policy\n        run: pnpm security:audit',
			'      - name: Security Audit Policy\n        continue-on-error: true\n        run: pnpm security:audit',
		)
		expect(() => assertReleaseWorkflowContract(mutated))
			.toThrow('release step Security Audit Policy')
	})

	it('rejects extra executable steps in the publish authority path', () => {
		const mutated = validWorkflow.replace(
			'      - name: Publish Prepared Tarballs\n        run: pnpm release:publish',
			'      - name: Mutate prepared artifacts\n        run: echo unexpected\n      - name: Publish Prepared Tarballs\n        run: pnpm release:publish',
		)
		expect(() => assertReleaseWorkflowContract(mutated))
			.toThrow('release publish steps or their order changed')
	})

	it('rejects duplicate nested checkout option blocks', () => {
		const mutated = validWorkflow.replace(
			'        with:\n          fetch-depth: 0\n          persist-credentials: false',
			'        with:\n          fetch-depth: 0\n          persist-credentials: false\n        with:\n          fetch-depth: 0\n          persist-credentials: false',
		)
		expect(() => assertReleaseWorkflowContract(mutated))
			.toThrow('must contain exactly one with block')
	})
})
