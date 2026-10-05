# ADR-0002 — Authentification reportée à l'épopée 04

- **Status**: Accepted
- **Date**: 2026-10-05
- **Deciders**: équipe Foot Easy
- **Refs**: epic-04 (us-014, us-015)

## Context

La première tranche (équipes, effectif, calendrier, convocations) doit valider le produit
rapidement. Le standard sécurité exige une authentification OIDC et une autorisation par
ressource sur chaque route protégée.

## Decision

Nous livrons la première tranche **sans authentification**. L'API n'est destinée qu'au
développement local et **ne doit pas être exposée** dans un environnement partagé tant que
l'épopée 04 n'est pas livrée. us-014 (OIDC + vérification JWT) et us-015 (rôles par équipe,
403) sont les prochaines priorités.

## Consequences

- Aucun déploiement partagé (recette, production) avant us-014 et us-015.
- Les services reçoivent déjà les dépendances par injection : l'ajout d'un `Depends` de
  vérification du jeton et de contrôles d'appartenance à l'équipe ne change pas les couches.
- Chaque endpoint devra gagner ses tests 401/403 lors de l'épopée 04.

## Alternatives considered

- **Brancher un IdP dès maintenant** : écarté à ce stade, le fournisseur n'est pas choisi.
- **Authentification maison** : contraire au standard (OIDC uniquement).
