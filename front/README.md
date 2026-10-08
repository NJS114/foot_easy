# Foot Easy · Espace club

Application privée de gestion de football amateur : interface React, API compatible Workers,
données persistantes et fichiers. La présentation reprend les repères des références : bleu
marine, vert, cartes blanches, tableaux, calendrier, terrain et tâches en colonnes.

## Parcours disponibles

| Module | Parcours |
| --- | --- |
| Calendrier | Mois/agenda, filtres, événements uniques ou récurrents, heure locale préservée au changement d’heure, modification, annulation/rétablissement, export iCalendar |
| Membres | Annuaire, import CSV/XLSX, contrôle des doublons, export filtré, coordonnées, licence, maillot, photo, contact d’urgence, responsable légal et préférences de communication |
| Utilisateurs | Liste filtrable, ajout rapide, dossier individuel, documents transmis/reçus/rattachés, état de licence et relance suivie, tâches à accomplir et terminées, convocations |
| Convocations | Ciblage des membres, disponibilités, pointage des présences, relance directe des sans-réponse, documents liés aux événements et joints aux prochains envois, suivi des campagnes associées |
| Compositions et statistiques | Formations foot à 11/8/5, titulaires/remplaçants, publication, scores, faits de match, présences et bilans d’équipe |
| Documents | Dépôt multiple, glisser-déposer, images/PDF/DOCX/XLSX/CSV/TXT, reprise après erreur, dossiers et sous-dossiers, déplacement individuel ou groupé, recherche et filtres, téléchargement ZIP avec arborescence, export CSV, origine et destinataires déclarés, versions, échéance, validation/refus motivé/archivage |
| Messagerie | Groupe, conversation directe ou annonce, destinataires, rattachement équipe/événement, fichiers/images, réactions, épinglage, archivage/réouverture |
| Campagnes | Assistant en quatre étapes, email/SMS/push/espace membre, ciblage, consentements publicitaires, modèles, personnalisation, fichiers et CTA, brouillon, test, programmation, pause/reprise/annulation, duplication |
| Distribution | Rapport par destinataire, file/envoi/distribution/lecture/clic/échec/rejet/exclusion/désinscription, journal des étapes, export CSV et relance des échecs uniquement |
| Collectes | Cotisation/équipement/tournoi/don, montant par membre, échéancier mensuel, ouverture/clôture, paiements partiels, transaction en attente/échec/succès, reçus imprimables, remboursement, exonération, annulation et relance des impayés |
| Sponsors et publicités | Prospect → contact → proposition → négociation → signature, montant/période, logo/contrat, emplacements avec visuel et lien, activation/pause/fin, métriques simulées, campagne liée au partenaire |
| Tâches | Attribution équipe/membre/événement, priorité, échéance, checklist, justificatif obligatoire, commentaires, à faire/en cours/bloqué/à valider/terminé, correction motivée et réouverture |
| Championnats | 2–32 équipes internes/externes, logos, barème, pénalités initiales, aller/retour avec exemptions, matchs du club ajoutés au calendrier, report/annulation, résultat, classement calculé, export, pièces jointes et clôture |
| Réglages | Scénarios de simulation succès/réaliste/échec, journal d’activité et export des données |

Les modifications pratiques d’un événement, son annulation/rétablissement et son résultat
créent une notification simulée pour les membres convoqués. Publier ou actualiser une
composition notifie ses titulaires et remplaçants ; réenregistrer une composition identique
ne crée pas un nouvel envoi. Les règlements confirmés/refusés et remboursements ont leur
confirmation, les tâches leur suivi d’attribution/statut et les conversations leurs notifications
dans l’espace club. Tous utilisent le journal de distribution des campagnes. La fiche d’événement
affiche les étapes et permet de rejoindre directement chaque action et le dernier envoi.

## Nature des données et des simulations

Le premier accès initialise un **club fictif**. Les modifications suivantes sont enregistrées
côté serveur. Les destinataires, statuts d’envoi, réactions de livraison, paiements par carte,
remboursements et mesures publicitaires peuvent être testés sans fournisseur externe.
**Les campagnes n’effectuent aucun email, SMS, push ou débit bancaire réel.**
Le test SMS local décrit ci-dessous est une exception explicitement activée et confirmée. Un règlement espèces/virement/
chèque est une déclaration manuelle, sans rapprochement bancaire.

La progression des statuts et le démarrage d’une campagne programmée sont calculés lors
d’une consultation après l’heure prévue. Aucun ordonnanceur autonome n’est configuré.
L’application distingue ces simulations dans ses écrans. Les conversations sont enregistrées
dans l’espace du gestionnaire ; elles ne constituent pas encore une messagerie multi-comptes.
L’ajout d’un membre/destinataire n’invite personne et n’accorde pas d’accès.

## Développement local

Node **24 ou supérieur**, npm :

```sh
npm ci --include=dev
npm run dev
```

Vite sert l’interface sur `http://localhost:5173`. L’API locale écoute uniquement sur
`127.0.0.1:8788` ; Vite lui relaie `/api`. Le simulateur de stockage utilise SQLite et les fichiers
réels dans `.local-data/` (ignoré par Git). Un compte de développement est injecté par cet
adaptateur local uniquement. Ce serveur de développement n’est pas un serveur public authentifié.

```sh
npm test                 # React + contrats + parcours Worker sur SQLite
npm run lint
npm run build             # dist/client + dist/server
```

`npm run validate:api` régénère les validateurs d’entrées du contrat sportif ; ils sont compilés
à l’avance pour ne pas utiliser d’évaluation dynamique dans Workers. `npm run db:generate`
génère une migration après modification du schéma de stockage.

## Tester Twilio en local

Le test SMS réel est disponible dans **Réglages → Twilio · test SMS local**. Il n’active pas
les campagnes de démonstration : seul ce bouton contacte Twilio, après confirmation.

1. Récupérez la dernière version de `main`.
2. Copiez `front/.dev.vars.example` vers `front/.dev.vars`.
3. Complétez `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` et
   `TWILIO_TEST_TO` (votre téléphone au format international, par exemple `+33…`).
4. Passez `TWILIO_TEST_ENABLED=true`, puis lancez ou redémarrez `npm run dev` dans `front/`.
5. Ouvrez `http://localhost:5173/settings`, saisissez le message et confirmez le SMS réel.

Vous pouvez remplacer l’Auth Token par `TWILIO_API_KEY_SID` + `TWILIO_API_KEY_SECRET`
et le numéro expéditeur par `TWILIO_MESSAGING_SERVICE_SID`. Le panneau indique les valeurs
manquantes ou invalides, sans afficher les secrets.

Avec un compte Twilio d’essai, le numéro destinataire doit être vérifié dans la console.
Pour recevoir réellement un SMS, utilisez les identifiants du compte, pas les anciens
« Test Credentials » de Twilio : ces derniers ne contactent pas de téléphone réel.
Le test peut consommer votre crédit Twilio et son texte peut représenter plusieurs segments SMS.

Le suivi lit le statut réel de Twilio (accepté, en file, envoyé, distribué ou en échec),
automatiquement pendant deux minutes puis via « Actualiser le suivi ». Aucun webhook public
ni tunnel n’est nécessaire pour ce test. « Envoyé » signifie remis à l’opérateur, et n’est pas
une confirmation de réception. Le dernier essai est conservé dans SQLite.

Le numéro de test est limité à `TWILIO_TEST_TO`, avec 30 secondes entre deux essais.
Un identifiant de test répété ne renvoie pas de SMS. En cas de délai réseau dépassé, consultez
la console Twilio avant un nouvel essai : l’envoi peut avoir été accepté sans réponse reçue.

Pour Docker, créez également le `.env` principal comme décrit plus bas, puis utilisez :

```sh
docker compose -f docker-compose.yml -f docker-compose.twilio.yml up -d --build front
```

Ouvrez `http://foot-easy.localhost/settings`. Le fichier de secrets est monté en lecture seule ;
il est ignoré par Git et exclu de l’image Docker. Après une modification, redémarrez le service.
Le mode local utilise une identité de développement et n’est pas destiné à être exposé en public.
Les routes de test sont indisponibles dans le Worker hébergé, qui n’active pas ce mode.

Références : [Messages API](https://www.twilio.com/docs/messaging/api/message-resource),
[Authentification](https://www.twilio.com/docs/messaging/api),
[Test Credentials](https://www.twilio.com/docs/iam/test-credentials).

## Publication et stockage

Le manifeste `.openai/hosting.json` déclare le projet Sites et les liaisons `DB` (D1) et
`BUCKET` (R2). La compilation produit le Worker et les ressources statiques. Les migrations
versionnées de `drizzle/` sont incluses au déploiement Sites.

Le Worker lit l’identité vérifiée injectée par Sites (`oai-authenticated-user-id`) et refuse
les requêtes API anonymes. Données et téléchargements sont isolés par propriétaire. Déployer
uniquement derrière cette passerelle d’identité ; exposer directement le Worker avec des
en-têtes d’identité non vérifiés n’est pas une configuration d’authentification prise en charge.
La version actuelle du Site conserve son audience privée.

Les modifications du club utilisent révision, transaction atomique et identifiant de requête
pour éviter les écritures perdues et les doubles opérations. Les instantanés sont découpés
en lignes sous la limite D1 ; le plafond applicatif est de 12 Mo par espace, hors fichiers R2.
Les fichiers sont limités à 10 Mo chacun ; les imports d’annuaire à 2 Mo et 1 000 lignes.
L’export JSON inclut les données et métadonnées ; les fichiers se récupèrent individuellement
ou dans une archive ZIP conservant leurs dossiers (100 Mo maximum par sélection).
Les dernières versions sont affichées par défaut ; les anciennes restent accessibles.
Le dossier de classement est indépendant du rattachement membre/événement/tâche.
Le nom du gestionnaire ayant ajouté un fichier est conservé ; le membre déposant et les
destinataires sont des informations déclarées, sans preuve de connexion de ces membres.
Les convocations joignent au maximum 12 dernières pièces actives de l’événement.
L’historique d’activité conserve les 2 000 dernières entrées et chaque envoi ses 60 dernières étapes.

## Architecture

- `src/pages`, `src/components` : gestion sportive, calendrier, annuaire et terrain.
- `src/workflows` : écrans, règles métier et transitions des modules administratifs.
- `src/server` : compatibilité API sportive `/api/v1`, validation et données initiales.
- `worker` : API persistante `/api/v1`, `/api/v2/workspace`, `/api/v2/actions`, `/api/v2/files`.
- `db`, `drizzle` : schéma et migrations D1 ; fichiers dans R2.
- `scripts/dev-worker.mjs` : adaptateur local SQLite/fichiers, sans dépendance à un compte cloud.

L’API FastAPI/Postgres du dépôt parent reste disponible pour le périmètre sportif historique.
Elle n’implémente pas les nouvelles routes `/api/v2`. Les deux moteurs ont des bases séparées ;
il n’y a ni réplication ni import automatique de Postgres vers D1. Pour consulter tous les
modules comme sur le Site, utiliser le Worker ou `npm run dev` sans `VITE_API_URL` externe.

Avant un usage multi-utilisateurs réel : connecter les fournisseurs et leurs retours signés,
ajouter l’ordonnancement des envois, les comptes membres/parents, les rôles partagés et les
règles d’accès du club. Les coordonnées de responsable légal constituent un champ de dossier,
non un compte parent connecté.
