# Scientific Compound Data Explorer

A full stack dashboard for exploring scientific compound data. The app lets users filter a compound library, inspect molecular properties, and view D3 visualizations for toxicity, molecular weight, and binding affinity trends.

![React](https://img.shields.io/badge/React-19-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-local-4169e1)
![D3](https://img.shields.io/badge/D3.js-charts-f9a03c)

## Overview

This project demonstrates a practical scientific data workflow:

1. Seed realistic fake compound records into PostgreSQL.
2. Serve the data through a typed FastAPI REST API.
3. Consume the API from a React + TypeScript frontend.
4. Visualize compound trends with D3.js.
5. Test and document the component and application behavior.

The dataset is local fake data generated with `Faker` and Python's `random` module. It is not a real pharmaceutical or chemistry dataset, but it is shaped to look like compound data for dashboard development and interview/demo purposes.

## Features

- Modern React dashboard with responsive panels and metric cards.
- Category and molecular weight filters.
- Clickable compound table with selected-compound details.
- D3 scatter plot: molecular weight vs toxicity score.
- D3 bar chart: average binding affinity by category.
- D3 histogram: molecular weight distribution.
- FastAPI backend with paginated, filtered, sortable endpoints.
- PostgreSQL persistence through SQLAlchemy.
- Storybook stories for reusable UI/chart components.
- Vitest + React Testing Library tests.
- GitHub Actions CI workflow.

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, TypeScript, Vite, Axios |
| Visualization | D3.js |
| Styling | CSS Modules, inline chart styling |
| Backend | FastAPI, SQLAlchemy, Pydantic |
| Database | PostgreSQL |
| Data seeding | Faker, Python random |
| Testing | Vitest, React Testing Library, jsdom |
| Component docs | Storybook |
| CI | GitHub Actions |

## Architecture

```text
Browser
  |
  | React + TypeScript + Vite
  | - Dashboard UI
  | - Filters and table
  | - D3 charts
  |
  v
Axios API client
  |
  v
FastAPI backend
  |
  | SQLAlchemy ORM
  v
PostgreSQL database
  |
  ^
  | seed_data.py generates 250 fake compounds
```

## Data Model

Each compound record contains:

- `id`
- `name`
- `molecular_formula`
- `molecular_weight`
- `solubility`
- `toxicity_score`
- `binding_affinity`
- `category`
- `created_at`

The seed script creates 250 fake compounds across these categories:

- Antiviral
- Kinase Inhibitor
- Antibiotic
- Antifungal
- Anticancer
- Anti-inflammatory
- CNS Agent

## Project Structure

```text
scientific-dashboard-starter/
  backend/
    database.py          SQLAlchemy engine/session setup
    main.py              FastAPI application and endpoints
    models.py            SQLAlchemy Compound model
    schemas.py           Pydantic request/response schemas
    seed_data.py         Fake data generator
    requirements.txt     Python dependencies
    .env.example         Example backend environment variables

  frontend/
    src/
      api/compounds.ts           Typed Axios API client
      components/Dashboard.tsx   Main dashboard
      components/*.tsx           Charts and UI components
      components/*.test.tsx      Frontend tests
      stories/*.stories.ts       Storybook stories
      types.ts                   Shared frontend types
    package.json
    vite.config.ts
    .env.example

  .github/workflows/ci.yml
  PROJECT_EXPLANATION.md
  README.md
```

## Prerequisites

Install these before running the project:

- Node.js
- Python 3.12
- PostgreSQL
- npm

Python 3.12 is recommended because some pinned backend packages may not provide stable prebuilt wheels for newer Python versions on Windows.

## Backend Setup

Open PowerShell:

```powershell
cd C:\Users\theva\Downloads\scientific-dashboard-starter\backend
py -3.12 -m venv venv
.\venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
copy .env.example .env
```

Edit `backend\.env`:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/scientific_dashboard
```

If your PostgreSQL password contains special URL characters, encode them. For example:

```text
@ -> %40
# -> %23
% -> %25
/ -> %2F
: -> %3A
```

Example:

```env
DATABASE_URL=postgresql://postgres:abc%40123@localhost:5432/scientific_dashboard
```

## PostgreSQL Setup

1. Install PostgreSQL for Windows.
2. Keep the default port as `5432`.
3. Remember the password for the `postgres` user.
4. Open pgAdmin.
5. Create a database named:

```text
scientific_dashboard
```

## Seed the Database

With the backend virtual environment activated:

```powershell
python seed_data.py
```

This command creates the table if needed and inserts 250 fake compound records.

## Run the Backend

```powershell
uvicorn main:app --reload
```

The API runs at:

```text
http://127.0.0.1:8000
```

Swagger docs are available at:

```text
http://127.0.0.1:8000/docs
```

## Frontend Setup

Open a second PowerShell terminal:

```powershell
cd C:\Users\theva\Downloads\scientific-dashboard-starter\frontend
npm install
copy .env.example .env
npm run dev
```

The frontend runs at:

```text
http://localhost:5173
```

`frontend\.env.example` contains:

```env
VITE_API_URL=http://localhost:8000
```

This tells the React app where the FastAPI backend is running.

## Common Commands

| Command | Where to run it | What it does |
| --- | --- | --- |
| `py -3.12 -m venv venv` | `backend/` | Creates a Python 3.12 virtual environment |
| `.\venv\Scripts\activate` | `backend/` | Activates the backend virtual environment |
| `pip install -r requirements.txt` | `backend/` | Installs backend dependencies |
| `python seed_data.py` | `backend/` | Seeds PostgreSQL with 250 fake compounds |
| `uvicorn main:app --reload` | `backend/` | Starts the FastAPI development server |
| `npm install` | `frontend/` | Installs frontend dependencies |
| `npm run dev` | `frontend/` | Starts the Vite frontend dev server |
| `npm run test` | `frontend/` | Runs Vitest tests |
| `npm run build` | `frontend/` | Builds the production frontend |
| `npm run lint` | `frontend/` | Runs ESLint |
| `npm run storybook` | `frontend/` | Starts Storybook |

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/` | API health message |
| GET | `/compounds` | Paginated, filtered, sortable compound list |
| GET | `/compounds/stats` | Aggregate stats for charts |
| GET | `/compounds/{compound_id}` | Single compound by ID |
| POST | `/compounds` | Create a compound |
| GET | `/compounds/categories/list` | List distinct categories |

### `/compounds` Query Parameters

| Parameter | Description |
| --- | --- |
| `page` | Page number, default `1` |
| `page_size` | Results per page, default `20`, max `100` |
| `category` | Filter by exact category |
| `min_weight` | Minimum molecular weight |
| `max_weight` | Maximum molecular weight |
| `min_toxicity` | Minimum toxicity score |
| `max_toxicity` | Maximum toxicity score |
| `sort_by` | `id`, `name`, `molecular_weight`, `toxicity_score`, or `binding_affinity` |
| `sort_order` | `asc` or `desc` |

## Storybook

```powershell
cd frontend
npm run storybook
```

Storybook includes isolated stories for:

- `Button`
- `ScatterPlot`
- `BarChart`
- `Histogram`

The chart stories use mock data, so Storybook works without the backend running.

## Testing

```powershell
cd frontend
npm run test
```

Current test coverage includes:

- Button variants, disabled state, and loading state.
- Dashboard category dropdown rendering from mocked API data.

## CI

GitHub Actions runs on pushes to `main` and pull requests. The workflow:

1. Installs frontend dependencies.
2. Runs frontend tests.
3. Runs frontend linting.
4. Installs backend dependencies.
5. Runs Python syntax checks on backend files.

## Notes

- Do not commit `backend/.env`; it contains local database credentials.
- Do not commit `backend/venv` or `frontend/node_modules`.
- Run `seed_data.py` only when you need to populate or add fake data.
- Keep backend and frontend running in separate terminals during local development.
