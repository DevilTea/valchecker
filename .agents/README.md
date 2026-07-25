# .agents

This repository is Claude Code first. The canonical agent configuration lives in
[`.claude/`](../.claude):

| Path | Contents |
| --- | --- |
| [`.claude/skills/valchecker-dev/`](../.claude/skills/valchecker-dev/SKILL.md) | Repository maintenance skill |
| [`.claude/skills/valchecker-expert/`](../.claude/skills/valchecker-expert/SKILL.md) | Application-code skill for consumers of Valchecker |
| [`.claude/settings.json`](../.claude/settings.json) | Shared permissions and hooks |
| [`.claude/commands/`](../.claude/commands) | Slash commands |

`.agents/skills/*/SKILL.md` are pointers only, kept so that agent harnesses which
discover skills under `.agents/` still resolve to the canonical files. Do not add
content to them.

Repository-wide rules that every agent needs are in [`AGENTS.md`](../AGENTS.md).
Outside contributors should read [`CONTRIBUTING.md`](../CONTRIBUTING.md) instead;
it is self-contained and does not depend on anything in this directory.
