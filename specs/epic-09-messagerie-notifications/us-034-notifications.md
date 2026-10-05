# US 034 — Notifications et préférences

status: To Do
estimate: M
parent: epic-09

## Story

En tant que membre, je veux être notifié (e-mail, push) des convocations, changements et messages, selon mes préférences.

## Acceptance criteria

- Étant donné une nouvelle convocation, quand elle est créée, alors les convoqués sont notifiés via leurs canaux activés.
- Étant donné un canal désactivé, quand une notification part, alors rien n'est envoyé sur ce canal.

## Dependencies

- us-014

## Layers

- tasks
- service
- router
- front
