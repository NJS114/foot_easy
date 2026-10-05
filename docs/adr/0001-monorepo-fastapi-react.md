# ADR-0001 — Monorepo FastAPI + React, backend organisé par fonctionnalité

- **Status**: Accepted
- **Date**: 2026-10-05
- **Deciders**: équipe Foot Easy
- **Refs**: epic-01, epic-02, epic-03

## Context

Foot Easy démarre avec une petite équipe qui livre des tranches verticales (API + écran) dans
une même PR. Le contrat HTTP doit rester synchronisé entre backend et frontend.

## Decision

Nous utilisons un **monorepo** `back/` (FastAPI, SQLAlchemy 2 async, Alembic, Postgres) +
`front/` (Vite, React, TypeScript, Tailwind + shadcn/ui, TanStack Query). Le backend suit
l'organisation **par fonctionnalité** (`app/{feature}/router.py · service.py · repository.py ·
models.py · schemas.py · exceptions.py`). Les types du front sont **générés** depuis
`back/openapi.json` (`npm run api:types`), jamais écrits à la main. Les erreurs suivent une
enveloppe unique `{code, message, errors[], request_id}`.

## Consequences

- Une fonctionnalité = un dossier backend + ses hooks/composants front, livrés ensemble.
- Toute modification du contrat impose de régénérer `back/openapi.json` puis
  `front/src/api/types.ts` dans la même PR.
- Les enums sont stockés en `VARCHAR` + contrainte `CHECK` (portables, migrations simples).

## Alternatives considered

- **Dépôts séparés** : synchronisation du contrat plus lourde pour une petite équipe.
- **Organisation par couche** : moins lisible au-delà de ~10 fonctionnalités, or la feuille de
  route en compte une quinzaine.
