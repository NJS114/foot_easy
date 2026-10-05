# ADR-0004 — Espace club et navigation par modules

- **Status**: Accepted
- **Date**: 2026-10-05
- **Deciders**: équipe Foot Easy
- **Refs**: epic-05, epic-06, epic-11 (us-037), ADR-0001

## Context

Le produit vise les mêmes usages qu'un logiciel de gestion de club tout-en-un (calendrier,
gestion sportive, membres, messagerie, inscriptions et paiements, sponsors), limité au football.
La première version était centrée sur une équipe isolée ; un club gère pourtant plusieurs
équipes et a besoin d'une vue d'ensemble.

## Decision

Nous organisons l'application autour d'un **club** : les équipes appartiennent à un club
(`teams.club_id`, unicité nom + saison par club, couleur par équipe) et l'interface expose une
**navigation latérale à sept modules** — Tableau de bord, Calendrier & Planning, Gestion
sportive, Gestion des membres, Communication & Messagerie, Inscriptions & Paiements, Visibilité
sponsors. Les modules non livrés affichent une page « Bientôt » décrivant leur périmètre.

Nous reprenons la **structure fonctionnelle et les parcours** de ce type de produit
(événement → convocation → relance → composition → match → statistiques), mais avec une
**identité visuelle propre** : aucun logo, icône, illustration, texte ou charte d'un produit
existant n'est réutilisé.

## Consequences

- La migration 0002 rattache les équipes existantes à un club « Mon club » créé à la volée.
- Un espace = un club tant que les comptes et rôles (epic-04) ne sont pas livrés.
- Le calendrier club agrège les événements équipe par équipe côté front ; un endpoint dédié
  sera nécessaire quand le nombre d'équipes grandira.

## Alternatives considered

- **Rester centré équipe** : ne couvre pas les besoins des dirigeants (vue club, planning).
- **Copier une interface existante** : risque juridique (droit d'auteur, parasitisme) et
  dépendance à un design non maîtrisé.
