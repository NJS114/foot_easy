# Foot Easy

Logiciel de gestion de club de football amateur, organisé en modules :

| Module | État |
|---|---|
| Tableau de bord | Prochains événements du club, équipes |
| Calendrier & Planning | Agenda du club par jour, filtres équipe / type |
| Gestion sportive | Équipes (catégorie, saison, couleur), effectif, événements (match, entraînement, tournoi), convocations et relances, compositions (8 schémas, foot à 11 / 8 / 5), score et faits de match, statistiques et assiduité |
| Gestion des membres · Communication & Messagerie · Inscriptions & Paiements · Visibilité sponsors | Bientôt — périmètre décrit dans [`specs/`](./specs) |

La feuille de route complète (15 épopées, 49 user stories) est dans [`specs/`](./specs) ;
l'organisation en espace club est décrite dans
[ADR-0004](./docs/adr/0004-club-space-and-module-navigation.md).

## Stack

| Partie | Technologies |
|---|---|
| `back/` | FastAPI · SQLAlchemy 2 async · Alembic · Postgres · Pydantic v2 · pytest |
| `front/` | Vite · React 19 · TypeScript strict · Tailwind CSS 4 + shadcn/ui · TanStack Query · i18next · Vitest + RTL + MSW |
| Infra locale | docker-compose · Traefik · Postgres · Adminer |

Décisions d'architecture : [`docs/adr/`](./docs/adr).

## Démarrer avec Docker

```bash
cp .env.example .env
docker compose up -d --build
```

| Service | URL |
|---|---|
| Application | http://foot-easy.localhost |
| API + Swagger | http://api.foot-easy.localhost/docs |
| Adminer | http://adminer.foot-easy.localhost |
| Dashboard Traefik | http://traefik.foot-easy.localhost |

Les migrations Alembic sont appliquées au démarrage du conteneur `api`.

## Développer sans Docker

**Backend** (Python ≥ 3.12) :

```bash
cd back
python -m venv .venv && .venv/Scripts/activate   # Windows ; source .venv/bin/activate sinon
pip install -e ".[dev]"
pytest                                            # tests (SQLite en mémoire, voir ADR-0003)
ruff check . && ruff format --check .
DATABASE_URL=postgresql+asyncpg://… alembic upgrade head
uvicorn app.main:app --reload
```

**Frontend** (Node ≥ 20.16, npm uniquement) :

```bash
cd front
npm ci --include=dev
npm run dev            # http://localhost:5173 (VITE_API_URL pour pointer l'API)
npm test
npm run lint && npm run typecheck && npm run build
```

## Contrat d'API

L'OpenAPI du backend est la source de vérité. Après toute modification d'un endpoint :

```bash
cd back && python -c "import json, app.main as m; print(json.dumps(m.app.openapi(), indent=2))" > openapi.json
cd ../front && npm run api:types
```

Les erreurs suivent toujours l'enveloppe `{code, message, errors[], request_id}`.

## Qualité

```bash
pip install pre-commit
pre-commit install --hook-type pre-commit --hook-type commit-msg
pre-commit run --all-files
```

Commits au format Conventional Commits ; chaque PR suit
[`.github/pull_request_template.md`](./.github/pull_request_template.md).

## Sécurité

L'authentification n'est pas encore en place (voir
[ADR-0002](./docs/adr/0002-authentication-deferred.md)) : **ne pas exposer l'API** hors d'un
poste de développement avant la livraison de l'épopée 04.
