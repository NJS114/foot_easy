# US 002 — Gérer l'effectif (joueurs, coachs, staff)

status: Done
estimate: M
parent: epic-01

## Story

En tant que coach, je veux ajouter et retirer des membres avec leur rôle, poste et numéro afin d'avoir un effectif à jour.

## Acceptance criteria

- Étant donné un joueur avec un numéro libre, quand je l'ajoute, alors il apparaît dans l'effectif trié par rôle puis numéro.
- Étant donné un numéro de maillot déjà pris dans l'équipe, quand j'ajoute un joueur avec ce numéro, alors j'obtiens 409 `shirt_number_taken`.
- Étant donné un coach ou un staff, quand je lui donne un poste ou un numéro, alors j'obtiens 422 `position_not_allowed`.
- Étant donné un membre, quand je le retire, alors il disparaît de l'effectif et de ses convocations.

## Dependencies

- us-001

## Layers

- model
- migration
- repository
- service
- router
- front
