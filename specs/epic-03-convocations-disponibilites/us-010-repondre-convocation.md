# US 010 — Répondre à une convocation

status: Done
estimate: S
parent: epic-03

## Story

En tant que joueur, je veux indiquer si je suis présent, incertain ou absent (avec un commentaire) afin que le coach puisse s'organiser.

## Acceptance criteria

- Étant donné une convocation, quand je réponds « Présent », alors mon statut et l'heure de réponse sont enregistrés.
- Étant donné une réponse « Sans réponse », quand je l'envoie, alors elle est refusée (422).

## Dependencies

- us-009

## Layers

- service
- router
- front
