# US 048 — Albums photos par match

status: To Do
estimate: L
parent: epic-14

## Story

En tant que membre, je veux partager des photos du match dans un album afin de garder des souvenirs.

## Acceptance criteria

- Étant donné un match, quand j'ajoute des photos, alors elles sont stockées en stockage objet et visibles par l'équipe.
- Étant donné un fichier non image ou trop lourd, quand je l'envoie, alors il est refusé (422).

## Dependencies

- us-015

## Layers

- model
- migration
- service
- router
- front
- infra
