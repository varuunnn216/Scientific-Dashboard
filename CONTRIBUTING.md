# Contributing

Thank you for contributing to `Scientific-Dashboard`.

## Local Development

- **Backend:** Follow the PostgreSQL + FastAPI instructions in `README.md` (`uvicorn main:app --reload`).
- **Frontend:** `cd frontend && npm install && npm run dev`

## Checks Before Opening a PR

```bash
cd frontend
npm run lint
npm test
npm run build
```

- Work on a feature/chore branch; do not commit directly to `main`.
- Never commit `.env` files or database credentials.
