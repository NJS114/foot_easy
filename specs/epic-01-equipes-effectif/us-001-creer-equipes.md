# US 001 — Créer et lister les équipes d'une saison

status: Done
estimate: S
parent: epic-01

## Story

En tant que coach, je veux créer mon équipe (nom, catégorie U7…Vétérans, saison) afin d'organiser ma saison.

## Acceptance criteria

- Étant donné un nom, une catégorie et une saison au format AAAA-AAAA, quand je crée l'équipe, alors elle apparaît dans la liste.
- Étant donné une équipe existante avec le même nom sur la même saison, quand je la recrée, alors j'obtiens une erreur 409 `team_already_exists`.
- Étant donné une saison mal formée, quand je valide, alors l'erreur s'affiche sur le champ saison (422).

## Dependencies

- aucune

## Layers

- model
- migration
- repository
- service
- router
- front
