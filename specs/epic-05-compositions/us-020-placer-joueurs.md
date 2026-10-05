# US 020 — Placer les joueurs disponibles sur le terrain

status: To Do
estimate: L
parent: epic-05

## Story

En tant que coach, je veux glisser-déposer les joueurs disponibles sur le terrain et sur le banc afin de construire ma composition.

## Acceptance criteria

- Étant donné les joueurs « Présent », quand j'ouvre la composition, alors ils sont proposés en priorité.
- Étant donné un joueur absent, quand je le place, alors un avertissement s'affiche.
- Étant donné un même joueur, quand je le place deux fois, alors c'est refusé.

## Dependencies

- us-019
- us-010

## Layers

- model
- migration
- service
- router
- front
