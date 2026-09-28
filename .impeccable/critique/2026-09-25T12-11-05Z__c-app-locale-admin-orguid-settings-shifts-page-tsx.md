---
target: Shifts and check-in settings page
total_score: 24
p0_count: 0
p1_count: 3
timestamp: 2026-09-25T12-11-05Z
slug: c-app-locale-admin-orguid-settings-shifts-page-tsx
---
# Critique: Shifts and check-in settings (`settings/shifts`)

Assessment independence: two isolated sub-agents. Deterministic scan: **unavailable** (impeccable install lacks `scripts/detector/detect-antipatterns*.mjs`; CLI exit 1 "bundled detector not found", browser `/detect.js` 404). Design review only.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No save feedback; clearing the last day silently switches the automation off |
| 2 | Match System / Real World | 3 | "gets this help" wording on Pause approval; "Discovery email" is internal |
| 3 | User Control and Freedom | 2 | Deselect Sat, Sun → card turns off, Mon disabled, re-enable restores Sat+Sun |
| 4 | Consistency and Standards | 3 | "Enable ID verification" verb title; "Active days" vs "Send on"; shared isSaving |
| 5 | Error Prevention | 2 | Pause approval has no scope line or consequence cue |
| 6 | Recognition Rather Than Recall | 2 | Off state shows nothing; what switching on applies must be remembered |
| 7 | Flexibility and Efficiency | 2 | Urgent call and approval configured separately with identical controls |
| 8 | Aesthetic and Minimalist Design | 3 | Clean; greyed blocks add weight; flat in-card hierarchy |
| 9 | Error Recovery | 2 | Generic toast, silent rollback |
| 10 | Help and Documentation | 3 | Good boundary copy; no preview of what volunteers get |
| **Total** | | **24/40** | **Acceptable** |

## Anti-Patterns Verdict
Pass, close to the line: four near-identical icon + title + description + switch cards; the most consequential setting (Pause approval) looks like the harmless digest. No absolute bans hit.

## Priority Issues
- **[P1] Clearing days locks the controls mid-edit** (`automations-settings.tsx` update(): days=[] → enabled=false → pills disabled; re-enable restores defaults). Fix: keep controls live; auto-off only after the edit, or keep on with an inline "no days, won't run" hint. `harden`
- **[P1] No status or save feedback** — add an "On · Sat, Sun · 48 h before" summary line, transient "Saved", name the card in errors. `clarify` → `polish`
- **[P1] Pause approval under-weighted** — own step-in description, "only shifts that require approval" scope line, consider cross-link to urgent call settings. `clarify`
- **[P2] Flat card hierarchy + off-scale padding** — title = legend weight/size; Card py-6 + CardContent py-4 = 40 px vertical; resting shadow vs Flat-At-Rest. `typeset` → `layout`
- **[P2] Mobile cramped** — radio labels wrap at 375 px, description squeezed beside switch, H1 breaks "check-/in", switch 32×18 target. `adapt`

## Persona Red Flags
- Manager: can't see what runs at a glance; subtitle restates title; no saved confirmation.
- Keyboard/screen reader: focus lost when the last day is cleared; small switch target; disabled state unexplained.
- Shift supervisor on phone: ~2.5 screens, wrapped radio labels, empty "--:--" looks required.

## Minor Observations
Shared isSaving disables all switches; no timezone on time; multi-day "Send on" for a weekly overview; "Staffing" section only holds emails; sidebar shows no active item; coral carries a lot; Check-in description oversells one switch.

## Questions to Consider
1. Would one rule with two outcome switches be more honest than two identical forms in two sections?
2. Would a one-line default summary replace greyed-out controls at a tenth of the weight?
3. Where does a coordinator see on Monday which sign-ups skipped approval?
