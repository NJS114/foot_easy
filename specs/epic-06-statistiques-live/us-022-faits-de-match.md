# US 022 — Saisir le score et les faits de match

status: Done
estimate: M
parent: epic-06

## Story

En tant que coach, je veux saisir le score, les buteurs, passeurs, cartons et remplacements afin de garder l'historique du match.

## Acceptance criteria

- Étant donné un match terminé, quand je saisis les buts, alors le score est calculé et cohérent avec les buteurs.
- Étant donné un joueur non convoqué, quand je l'indique buteur, alors c'est refusé.

## Dependencies

- us-005
- us-009

## Layers

- model
- migration
- service
- router
- front
