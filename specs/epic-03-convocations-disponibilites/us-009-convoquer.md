# US 009 — Convoquer l'effectif ou une sélection

status: Done
estimate: M
parent: epic-03

## Story

En tant que coach, je veux convoquer tout l'effectif ou une sélection de joueurs à un événement afin de recueillir leurs disponibilités.

## Acceptance criteria

- Étant donné un événement, quand je convoque sans préciser de membres, alors tout l'effectif est convoqué avec le statut « Sans réponse ».
- Étant donné des membres déjà convoqués, quand je reconvoque, alors ils ne sont pas dupliqués (idempotent).
- Étant donné un membre d'une autre équipe, quand je le convoque, alors j'obtiens 422 `member_not_in_team`.
- Étant donné un événement annulé, quand je convoque, alors j'obtiens 422 `event_cancelled`.

## Dependencies

- us-002
- us-005

## Layers

- model
- migration
- repository
- service
- router
- front
