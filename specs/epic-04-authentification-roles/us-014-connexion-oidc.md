# US 014 — Connexion OIDC et protection de l'API

status: To Do
estimate: L
parent: epic-04

## Story

En tant qu'utilisateur, je veux me connecter de façon sécurisée afin que seules les personnes autorisées accèdent aux données de l'équipe.

## Acceptance criteria

- Étant donné un appel sans jeton ou avec un jeton invalide/expiré, quand il atteint l'API, alors il est rejeté en 401.
- Étant donné un jeton valide, quand il est vérifié, alors signature (JWKS), iss, aud, exp et nbf sont contrôlés.
- Étant donné le frontend, quand je ne suis pas connecté, alors je suis redirigé vers la connexion ; le jeton n'est pas stocké dans localStorage.

## Dependencies

- aucune

## Layers

- core
- router
- front
