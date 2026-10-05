# US 021 — Partager la composition

status: In Progress
estimate: S
parent: epic-05

## Story

En tant que coach, je veux publier la composition à l'équipe ou publiquement afin que chacun connaisse son rôle.

## Acceptance criteria

- Étant donné une composition publiée en privé, quand un joueur de l'équipe l'ouvre, alors il la voit ; un visiteur non.
- Étant donné une composition publique, quand on ouvre son lien, alors elle est visible sans compte.

## Dependencies

- us-020
- us-015

## Layers

- service
- router
- front

## Notes

- Livré : indicateur « publiée à l'équipe » enregistré avec la composition.
- Reste : visibilité réelle par rôle (dépend de us-015) et lien public.
