# US 015 — Rôles par équipe et autorisations

status: To Do
estimate: L
parent: epic-04

## Story

En tant qu'admin d'équipe, je veux attribuer des rôles (admin, coach, joueur, parent) afin que chacun n'agisse que dans son périmètre.

## Acceptance criteria

- Étant donné un joueur, quand il tente de créer un événement, alors il reçoit 403.
- Étant donné un coach d'une autre équipe, quand il lit cette équipe, alors il reçoit 403 (autorisation par ressource).

## Dependencies

- us-014

## Layers

- model
- migration
- service
- router
- front
