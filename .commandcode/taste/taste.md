# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# architecture
- Capabilities are custom-built domain modules (Appointments, Billing, Property Listings, Onboarding, etc.) — not generic feature flags or third-party plugins. They are distinct from plugins (installable packages) and integrations (external provider connections). Confidence: 0.85
- Verify architectural claims against the actual codebase before asserting them; trace module imports, guard usage, and data flow before making conclusions about how the system works. Confidence: 0.70
- When a new system replaces an old one, prefer removing the old system entirely over dual-writing or maintaining both in parallel. Avoid split-brain data issues by having a single source of truth. Confidence: 0.60

# ui-ux
- Prefer rich, information-dense CRM interfaces with drill-down summaries — clicking on entities (users, agents, leads) should surface contextual stats and activity. Confidence: 0.65

# shell
- Do not use && to chain commands; run shell commands separately. The shell (Windows cmd) does not support && chaining. Confidence: 0.85
