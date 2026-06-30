# Scientific Compound Data Explorer

An interactive dashboard for exploring multi-dimensional scientific compound data, built with React, TypeScript, D3.js, FastAPI, and PostgreSQL.

## Tech Stack
- **Frontend:** React, TypeScript, D3.js, Axios, Vite
- **Backend:** FastAPI, SQLAlchemy, Pydantic
- **Database:** PostgreSQL

## Features
- Interactive scatter plot (molecular weight vs. toxicity) with hover tooltips and click-to-select
- Bar chart of average binding affinity by compound category
- Filterable, sortable, paginated compound table
- RESTful API with full CRUD support and aggregate stats endpoint

## Setup

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# create a .env file with DATABASE_URL=postgresql://user:pass@host:port/dbname
python seed_data.py
uvicorn main:app --reload
```
API docs available at `http://localhost:8000/docs`

### Frontend
```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install
npm install d3 axios
npm install -D @types/d3
# copy files from frontend-src/ into src/
npm run dev
```

## API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /compounds | Paginated, filterable, sortable list |
| GET | /compounds/{id} | Single compound detail |
| GET | /compounds/stats | Aggregate stats for charts |
| POST | /compounds | Create a new compound |
| GET | /compounds/categories/list | Distinct categories |

## Live Demo
[link here once deployed]
