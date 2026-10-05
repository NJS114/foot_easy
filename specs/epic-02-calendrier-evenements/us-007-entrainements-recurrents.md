# US 007 — Entraînements récurrents

status: To Do
estimate: M
parent: epic-02

## Story

En tant que coach, je veux créer une série d'entraînements (ex. chaque mardi et jeudi 19h) afin de ne pas les saisir un par un.

## Acceptance criteria

- Étant donné une règle de récurrence et une date de fin, quand je crée la série, alors toutes les séances sont générées.
- Étant donné une série, quand j'annule une seule séance, alors les autres restent inchangées.

## Dependencies

- us-005

## Layers

- model
- migration
- service
- router
- front
