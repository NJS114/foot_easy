# ADR-0003 — SQLite en mémoire pour les tests backend

- **Status**: Accepted
- **Date**: 2026-10-05
- **Deciders**: équipe Foot Easy
- **Refs**: ADR-0001

## Context

Les tests doivent être rapides, déterministes et exécutables sans Docker (postes de dev,
CI simple). La base cible est Postgres.

## Decision

Les tests backend utilisent **SQLite en mémoire** (`aiosqlite`), un moteur neuf par test,
avec `PRAGMA foreign_keys=ON` pour appliquer les `ON DELETE CASCADE`. Le code reste portable :
types génériques (`Uuid`, enums `VARCHAR` + `CHECK`) et un type `UtcDateTime` qui garantit
des dates UTC avec fuseau sur les deux moteurs. La migration Alembic est vérifiée
(upgrade → downgrade → upgrade, `alembic check`) sur SQLite et doit l'être sur Postgres
avant chaque déploiement.

## Consequences

- Suite de tests en quelques secondes, sans dépendance externe.
- Les comportements propres à Postgres (verrous, `ILIKE`, JSONB…) ne sont pas couverts :
  une suite d'intégration Postgres (testcontainers) sera ajoutée quand ils apparaîtront.

## Alternatives considered

- **Postgres via testcontainers** dès maintenant : exige Docker partout, plus lent.
- **Base Postgres partagée** : non déterministe, état partagé entre tests.
