# US 016 — Inviter un membre à créer son compte

status: To Do
estimate: M
parent: epic-04

## Story

En tant que coach, je veux envoyer un lien d'invitation à un membre afin qu'il rattache son compte à sa fiche.

## Acceptance criteria

- Étant donné un membre avec e-mail, quand je l'invite, alors il reçoit un lien à usage unique et expirant.
- Étant donné un lien expiré ou déjà utilisé, quand il est ouvert, alors il est refusé.

## Dependencies

- us-014
- us-002

## Layers

- model
- migration
- service
- router
- front
