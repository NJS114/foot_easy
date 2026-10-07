# ADR 0005 — Parcours administratifs persistants avec le Worker

## Contexte

Le Site Foot Easy contenait une implémentation complète des parcours administratifs absente
du dépôt GitHub. Le frontend historique utilisait FastAPI pour les fonctions sportives et
des écrans « À développer » pour messagerie, paiements et sponsors.

## Décision

Conserver l’API FastAPI/Postgres historique et intégrer dans `front/` la source du Site :
React, Worker compatible Cloudflare, migrations D1, stockage de fichiers R2 et adaptateur
local SQLite. Le Worker fournit le contrat sportif `/api/v1` et les parcours `/api/v2`.
`npm run dev` utilise ce moteur complet ; Docker conserve ses données dans `club_data`.

Les envois et paiements externes utilisent des simulations explicites. Les notifications
d’événement, de composition, de règlement, de tâche et de message sont persistantes et
suivies dans le même journal que les campagnes. L’identité provient de la passerelle Sites
en publication et d’un compte de développement dans l’adaptateur local.

## Conséquences

- Les nouvelles fonctionnalités sont disponibles dans le dépôt et dans le Site avec le
  même code. Node 24 est requis pour le moteur SQLite local et ses tests.
- D1/SQLite et Postgres restent deux stockages distincts ; aucune synchronisation n’est
  implicite. Les installations FastAPI existantes restent utilisables en mode historique.
- Les envois programmés simulés progressent à la consultation ; il reste à connecter les
  prestataires et un ordonnanceur pour envoyer sans visite de l’application.
- Le Site est privé. Une conversation enregistrée et son ciblage ne créent pas de comptes
  membres ou parents et ne constituent pas une messagerie partagée entre comptes.
- Les migrations conservées sont immuables. La migration additive `0003` conserve les fichiers
  existants et ajoute leur dossier, gestionnaire déposant, membre déposant déclaré et destinataires.
  Les dossiers et sous-dossiers sont conservés dans l’instantané du club et restent indépendants
  du rattachement à un membre, événement ou tâche.

## Vérification

Tests React, parcours Worker sur SQLite/R2 simulé, contrôles d’idempotence, autorisation,
documents et scénarios d’échec ; compilation frontend et Worker. L’API FastAPI conserve
ses tests et son contrat OpenAPI séparés.
