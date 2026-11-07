# Repo structure

apps/web     React client (src/wave = sync + agent client logic, src/components = UI components, src/App.tsx = composition + orchestration)
apps/collab  Hocuspocus/Yjs sync server
apps/api     FastAPI agent endpoints (agents.py holds personas)
.kiro/specs    One folder per feature: requirements.md, design.md, tasks.md
.kiro/steering product.md, tech.md, agent-behavior.md, structure.md, design.md (UI design system)
