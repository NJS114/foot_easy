# Epic 04 — Comptes, authentification & rôles

status: To Do

## Problem

L'API est aujourd'hui ouverte : n'importe qui peut modifier n'importe quelle équipe. Chaque membre doit avoir son compte et des droits adaptés à son rôle.

## Scope

- In: Connexion OIDC, rôles par équipe (admin, coach, joueur, parent), invitation par lien, comptes parents, autorisation par ressource.
- Out: Fournisseur d'identité spécifique (choisi au démarrage de l'épopée).

## Success criteria

- Toutes les routes de l'API exigent un jeton valide et les tests 401/403 couvrent chaque endpoint.

## Stories

- us-014 — Connexion OIDC et protection de l'API
- us-015 — Rôles par équipe et autorisations
- us-016 — Inviter un membre à créer son compte
- us-017 — Comptes parents pour les joueurs mineurs
- us-018 — Un joueur ne répond que pour lui
