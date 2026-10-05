# US 005 — Planifier un match, un entraînement ou un événement

status: Done
estimate: M
parent: epic-02

## Story

En tant que coach, je veux planifier un match (adversaire, domicile/extérieur, heure de rendez-vous, lieu) ou un entraînement afin que l'équipe sache où et quand venir.

## Acceptance criteria

- Étant donné un match sans adversaire ou sans domicile/extérieur, quand je le crée, alors j'obtiens 422 `match_details_required`.
- Étant donné un rendez-vous après le coup d'envoi ou une fin avant le début, quand je valide, alors j'obtiens 422 `invalid_event_schedule`.
- Étant donné des événements, quand j'ouvre l'équipe, alors ils sont listés par ordre chronologique avec filtre par type et période.

## Dependencies

- us-001

## Layers

- model
- migration
- repository
- service
- router
- front
