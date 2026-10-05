# US 003 — Importer un effectif depuis un fichier CSV

status: To Do
estimate: M
parent: epic-01

## Story

En tant que coach, je veux importer mon effectif depuis un CSV afin de ne pas tout ressaisir.

## Acceptance criteria

- Étant donné un CSV valide (prénom, nom, e-mail, poste, numéro), quand je l'importe, alors tous les membres sont créés.
- Étant donné des lignes invalides, quand j'importe, alors je vois un rapport ligne par ligne et rien n'est créé (tout ou rien).
- Étant donné un membre déjà présent (même e-mail), quand j'importe, alors il n'est pas dupliqué.

## Dependencies

- us-002

## Layers

- service
- router
- front
