# US 004 — Fiche joueur détaillée

status: To Do
estimate: M
parent: epic-01

## Story

En tant que coach, je veux une fiche joueur (date de naissance, pied fort, contacts d'urgence, n° de licence) afin d'avoir les infos utiles au bord du terrain.

## Acceptance criteria

- Étant donné un joueur, quand j'ouvre sa fiche, alors je vois ses informations et son historique de présence.
- Étant donné des données personnelles, quand un autre joueur consulte la fiche, alors les contacts d'urgence sont masqués (RGPD).

## Dependencies

- us-002
- us-015

## Layers

- model
- migration
- service
- router
- front
