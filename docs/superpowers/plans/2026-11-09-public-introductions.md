# Public introduction refresh

Goal: Refresh Home, Vision, About, Services, Design and TwinverseDesk introductions against the current product and primary technical references, then verify and deploy.

Architecture: Preserve existing routes, visual identity and persistent OpenClaw host. Share public capability descriptions and reference links. Keep public functionality, administrator tools and roadmap ambitions distinct.

Stack: React, React Router, CSS Modules, Vite; existing Vitest and Playwright checks.

Constraints: No AI resource/configuration changes. Read the shared registry; do not publish internal infrastructure details. Preserve launch behavior, gallery selection and console sessions. Technology references describe possibilities, not installed upgrades. Creator/solo-business examples follow the project vision; audience can be broadened later.

Review focus: Accurate availability labels, useful Korean content, valid navigation, source attribution, mobile overflow, no browser errors, existing console regression suite.

- [x] Refresh shared product content, Home, About and Services.
- [x] Update Vision claims and clearly label long-term targets.
- [x] Expand Design with sourced practical guidance; retain gallery behavior.
- [x] Refresh the four TwinverseDesk pages against implementation.
- [x] Update page metadata and footer navigation.
- [x] Verify build, targeted lint, unit and browser tests; review changes.

Release gate: Commit/push main, deploy current remote head on Orbitron, and verify production before reporting completion.

Validation: 53 frontend unit tests, 11 static-serving tests and 39 browser scenarios verified. Browser coverage includes nine public routes at desktop and 390px, gallery interactions, account-aware links, footer SPA navigation, console persistence and failed-chunk recovery. The two FAQ scenarios passed after correcting test waits/login-page assertions. Targeted changed-page lint and production build passed; DeskLaunch retains its previously existing hooks lint findings without altering session logic.

Operational finding: Deployment 2699 explicitly checked out old commit 6832a87. Restored current main ce179c2 via deployment 2700; production menu/sidebar and health verified. Future release checks must compare current remote main, checkout and served assets before declaring completion.

Follow-up incident: Missing hashed JavaScript requests incorrectly received cacheable SPA HTML, causing lazy imports to blank the React tree. Hotfix b3647da (deployment 2701) added 30-day persistent build-asset retention, proper 404/no-store responses, a fresh asset namespace, and manual recovery boundaries. Production checks verified old chunks as JavaScript, missing chunks as uncacheable 404, and an intact OpenClaw view. Automatic page reload was deliberately avoided to preserve user work.
