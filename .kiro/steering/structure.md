# Repo structure

apps/web     React client (src/wave = sync + agent client logic, src/components = UI components, src/App.tsx = composition + orchestration)
             Multi-wave: src/wave/useWaveIndex.ts (shared "index" doc + inbox presence over one socket), src/wave/waveIndex.ts (pure index/unread/sort/filter logic), src/components/WaveList.tsx + WaveListItem.tsx (left inbox), src/components/WaveTitle.tsx (editable wave title). The open wave still uses src/wave/useWave.ts.
apps/collab  Hocuspocus/Yjs sync server
apps/api     FastAPI agent endpoints (agents.py holds personas)
.kiro/specs    One folder per feature: requirements.md, design.md, tasks.md
.kiro/steering product.md, tech.md, agent-behavior.md, structure.md, design.md (UI design system)
