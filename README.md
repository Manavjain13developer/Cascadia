# React + Vite

## Run Cascadia locally

Make sure Ollama has both `qwen2.5:3b` and `qwen2.5:7b` available. Cascadia
starts each query on the 3B model, escalating to 7B only when confidence is
below the configured threshold. Models are kept loaded for 10 minutes after
use, and the response details show total time plus Ollama's load, prompt, and
generation timings. Generation limits scale with query complexity (256, 768,
or 1,536 tokens), context grows only when needed, and Ollama's model-default
temperature is retained.

Backend:

```powershell
python -m pip install -r backend/requirements.txt
python backend/app.py
```

Frontend:

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite. Requests to `/api/query` are proxied to
Flask on `http://localhost:5000`.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
