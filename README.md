# Grok Girls Studio

Grok Girls is the consolidated avatar studio built from the strongest pieces found across:

- `Aura-Studio-Avatar` - avatar/game core, rooms, memory, relationships, story, animation and local-first architecture.
- `AuraAvatarStudio` - avatar-studio UI direction and design tooling.
- `Truth-time` - local persistence, creator flows, ViewModel patterns, diagnostics and swarm-oriented tooling.
- Existing `Grok-Girls` - media export and service integrations.

## Current architecture

```text
Studio UI
  -> Avatar State / Room / Story / Relationship engines
  -> Memory + Conversation
  -> Generation service boundary
  -> Gallery / Video export
  -> Diagnostics + self-repair
```

## Product areas

- Avatar Library
- Avatar Designer
- Rooms and scene setup
- Character state, emotion and relationship simulation
- Memory and conversation context
- Image/video generation adapters
- Gallery and export
- Local-first storage
- Diagnostics and self-repair hooks
- Provider/API settings

The consolidation deliberately keeps provider keys out of source control and treats remote generation as an adapter rather than a hard dependency.

## Development

```bash
npm install
npm run dev
npm run build
```

This branch is the consolidation workspace. Source repositories remain untouched until the resulting build is reviewed and accepted.