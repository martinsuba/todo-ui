# Brief from Martin (todo-ui)

Build a private Artifact (claude.ai) as a todo checklist UI.

Goal: I see my open todos at a glance and can tick them done from phone or desktop.

Requirements:
- Single-page checklist: add, edit, delete, tick done/undone. Open items on top, done items collapsed below.
- Fields: title, optional due date, optional project tag. Overdue items highlighted.
- State lives in the artifact's shared database (db capability), not in browser storage.
- Mobile-first, light and dark theme.
- Import my existing todos from ~/HAL/ai-assistant (show me what you found before importing).
- HAL can add, complete and list items on request via ArtifactData. Every add or complete needs my explicit "yes", per HAL's usual rules.
- Optional, as a separate task: include open todos in morning.sh.

Process: follow the framework (plan, harness, next-task). Start with the plan skill and interview me first. Keep tasks small, one PR each, don't merge.
