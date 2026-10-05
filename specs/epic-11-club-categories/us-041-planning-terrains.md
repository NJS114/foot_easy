# US 041 — Planning des terrains

status: To Do
estimate: M
parent: epic-11

## Story

En tant que dirigeant, je veux réserver les terrains et vestiaires par créneau afin d'éviter les conflits entre équipes.

## Acceptance criteria

- Étant donné un créneau déjà réservé sur un terrain, quand une autre équipe le réserve, alors c'est refusé (409).

## Dependencies

- us-037
- us-005

## Layers

- model
- migration
- service
- router
- front
