# US 012 — Relances automatiques des non-répondants

status: In Progress
estimate: M
parent: epic-03

## Story

En tant que coach, je veux que les joueurs sans réponse soient relancés automatiquement afin de ne plus relancer à la main.

## Acceptance criteria

- Étant donné un événement à J-2 avec des réponses manquantes, quand la tâche planifiée tourne, alors chaque non-répondant reçoit une relance.
- Étant donné un joueur ayant répondu, quand la relance part, alors il ne la reçoit pas.

## Dependencies

- us-009
- us-034

## Layers

- tasks
- service
- front

## Notes

- Livré : relance manuelle des non-répondants (`POST /invitations/reminders`), compteur et date de dernière relance affichés.
- Reste : envoi réel (e-mail / push) et déclenchement planifié à J-2, dépendant de us-034.
