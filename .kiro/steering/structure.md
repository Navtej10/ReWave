# Repo structure

apps/web     React client (src/wave = sync + agent client logic, src/components = UI components, src/App.tsx = composition + orchestration)
             Multi-wave (PRIVATE, membership-based; no shared index doc, no global list of waves/users):
               src/wave/useMyWaves.ts (drives the inbox from a private localStorage membership list + one lightweight background connection per joined wave, all over one shared socket; presence from each wave's own awareness),
               src/wave/myWaves.ts (pure membership logic: parse/serialize/join/leave/markRead),
               src/wave/waveIndex.ts (pure row-summary/unread/sort/filter logic, fed from each wave's live doc),
               src/wave/waveId.ts (pure: generateWaveId/isValidWaveId/buildInviteLink/parseWaveIdFromHash — the wave id is the share capability).
               Per-wave meta (title, createdAt) lives in the wave's own Y.Doc ("meta" Y.Map). src/components/WaveList.tsx + WaveListItem.tsx (left inbox), src/components/WaveTitle.tsx (editable wave title), src/components/JoinScreen.tsx + InvalidLink.tsx (share-link join / invalid-link). The open wave still uses src/wave/useWave.ts.
apps/collab  Hocuspocus/Yjs sync server
apps/api     FastAPI agent endpoints (agents.py holds personas)
.kiro/specs    One folder per feature: requirements.md, design.md, tasks.md
.kiro/steering product.md, tech.md, agent-behavior.md, structure.md, design.md (UI design system)
