# US 026 — Vote homme du match

status: To Do
estimate: M
parent: epic-07

## Story

En tant que joueur, je veux voter pour l'homme du match afin de valoriser un coéquipier.

## Acceptance criteria

- Étant donné un match terminé, quand je vote, alors un seul vote par joueur est accepté et je ne peux pas voter pour moi.
- Étant donné la clôture du vote, quand elle intervient, alors le résultat est publié à l'équipe.

## Dependencies

- us-022
- us-015

## Layers

- model
- migration
- service
- router
- front
