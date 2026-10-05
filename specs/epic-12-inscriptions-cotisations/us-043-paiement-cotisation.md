# US 043 — Cotisations et paiement en ligne

status: To Do
estimate: L
parent: epic-12

## Story

En tant que famille, je veux payer la cotisation en ligne, éventuellement en plusieurs fois.

## Acceptance criteria

- Étant donné une cotisation, quand je paie via le prestataire de paiement, alors le statut passe à « payé » après confirmation du prestataire.
- Étant donné un paiement fractionné, quand une échéance échoue, alors le club et la famille sont avertis.

## Dependencies

- us-042

## Layers

- model
- migration
- service
- router
- front
