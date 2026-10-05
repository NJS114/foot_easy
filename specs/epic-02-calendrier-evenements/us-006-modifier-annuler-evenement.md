# US 006 — Modifier ou annuler un événement

status: Done
estimate: S
parent: epic-02

## Story

En tant que coach, je veux modifier ou annuler un événement afin de gérer les imprévus (météo, report).

## Acceptance criteria

- Étant donné un événement, quand je l'annule, alors il est marqué « Annulé » et on ne peut plus y convoquer.
- Étant donné une modification d'horaire incohérente, quand je valide, alors elle est refusée (422).

## Dependencies

- us-005

## Layers

- service
- router
- front
