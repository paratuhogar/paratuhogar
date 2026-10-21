# Pages Checkout Gate Implementation Plan

> **For agentic workers:** Execute inline with the existing verified checkout regression suite and independent review.

**Goal:** Publish only an exact main commit whose checkout regressions passed; keep the current deployed site on failure.

**Architecture:** Extend the current CI workflow with a Jekyll build depending on checkout recovery and a serialized Pages deployment depending on both. Check the current main SHA before deployment. Switch the repository Pages source from branch publication to Actions only after the workflow is ready.

**Tech Stack:** GitHub Actions, existing Jekyll Pages builder, Node tests, GitHub Pages artifact/OIDC deployment.

**Spec:** Owner authorization forwarded in this task, 2026-10-19 21:53 UTC: activate the minimum publication protection; no runtime, customer-data, credentials or unrelated policy changes.

## Global Constraints

- Keep the existing served site during setup and any failed gate.
- No new persistent credentials or access grants to people.
- No application, authentication, price or customer-data changes.
- Keep the current Jekyll build semantics.
- Test PRs without production deployment; only exact current main may deploy.
- Remove branch-based automatic publication by selecting Actions as Pages source.

## Task 1: Prepare and verify publication policy

- [ ] Add behavior tests rejecting failed/skipped/cancelled checks, wrong refs/events and stale SHA.
- [ ] Implement a small deployment-only policy script and call it from the deploy job.
- [ ] Add build/deploy jobs with explicit needs, checkout of github.sha and production serialization.
- [ ] Run existing release regressions and independent review.

## Task 2: Activate without a bypass

- [ ] Verify current Pages settings in the existing authorized GitHub account.
- [ ] Open reviewed PR and verify its actual Actions run; PR deployment must be skipped.
- [ ] Select GitHub Actions as Pages source, preserving custom domain and HTTPS settings.
- [ ] Integrate only passing PR, verify main gate/build/deploy and public deployment-version.json.
- [ ] Confirm no other workflow publishes Pages and branch publication is disabled.

## Rollback

Keep the last deployed site if a job fails. Revert the workflow/policy commit for a broken pipeline; restoring branch publication requires an explicit settings change and removes the gate. Never clear queues or alter customer data. Do not reset or force-push main.
