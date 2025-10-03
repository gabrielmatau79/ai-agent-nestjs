# 🤖 AI Agent – RAG & Memory-Based Chatbot (NestJS)

This project is a modular, extendable AI chatbot service built with **NestJS**, supporting both **in-memory** and **Redis-based memory**, as well as **Retrieval Augmented Generation (RAG)** using **LangChain** or a simplified in-memory embedding store.

## 🚀 Features

- Multiple memory backends (`memory`, `redis`)
- Modular RAG provider (LangChain or in-memory)
- Dynamic embedding source (OpenAI)
- Simple REST API with Swagger documentation
- Environment-based configuration

---

## 📦 Installation

```bash
git clone https://github.com/gabrielmatau79/ai-agent-nestjs
cd ai-agent-nestjs
pnpm install
```

---

## ⚙️ Environment Configuration

You can configure the app using a `.env` file or system environment variables. Below are the available settings:

### 🔧 General Application Settings

| Variable    | Description                    | Default |
| ----------- | ------------------------------ | ------- |
| `APP_PORT`  | Port where the server will run | `3000`  |
| `LOG_LEVEL` | Logging verbosity level        | `1`     |

### 🤖 LLM & Agent Settings

| Variable          | Description                                    | Default                  |
| ----------------- | ---------------------------------------------- | ------------------------ |
| `AGENT_PROMPT`    | Default system prompt for the chatbot          | `""`                     |
| `LLM_PROVIDER`    | Language model provider (`openai` or `ollama`) | `openai`                 |
| `OLLAMA_ENDPOINT` | Ollama base URL                                | `http://localhost:11434` |
| `OLLAMA_MODEL`    | Ollama model name                              | `llama3`                 |
| `OPENAI_API_KEY`  | OpenAI API key                                 | `""`                     |
| `OPENAI_MODEL`    | OpenAI chat model name                         | `gpt-3.5-turbo`          |

### 🧠 Memory Settings

| Variable              | Description                     | Default                  |
| --------------------- | ------------------------------- | ------------------------ |
| `AGENT_MEMORY_TYPE`   | `memory` (in-memory) or `redis` | `memory`                 |
| `AGENT_MEMORY_WINDOW` | Messages to keep per session    | `8`                      |
| `REDIS_URL`           | Redis connection URL            | `redis://localhost:6379` |

### 📚 RAG (Retrieval Augmented Generation)

| Variable            | Description                                 | Default    |
| ------------------- | ------------------------------------------- | ---------- |
| `RAG_PROVIDER`      | `inMemory` or `langchain`                   | `inMemory` |
| `RAG_DOCS_PATH`     | Path to load `.txt`, `.csv`, etc.           | `./docs`   |
| `VECTOR_STORE`      | Vector DB used when `langchain` is selected | `redis`    |
| `VECTOR_INDEX_NAME` | Index name used by Redis vector store       | `agent-ia` |

---

## 🛠 Configuration Examples

### 🧠 Memory Setup

#### In-Memory (Default)

```env
AGENT_MEMORY_TYPE=memory
AGENT_MEMORY_WINDOW=8
```

#### Redis Memory Backend

```env
AGENT_MEMORY_TYPE=redis
REDIS_URL=redis://localhost:6379
AGENT_MEMORY_WINDOW=10
```

### 📚 RAG Provider Setup

#### In-Memory RAG Provider

```env
RAG_PROVIDER=inMemory
RAG_DOCS_PATH=./docs
```

#### LangChain RAG Provider with Redis Vector Store (OpenAI)

```env
RAG_PROVIDER=langchain
VECTOR_STORE=redis
VECTOR_INDEX_NAME=agent-ia
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=sk-xxxxx
```

---

## 🐳 Run with Docker Compose

Create a `.env` file with your settings, then Multiple configuration presets are available in the `docs/env-examples` directory:

| File                   | Description                              |
| ---------------------- | ---------------------------------------- |
| `.env.inmemory-ollama` | In-memory memory & RAG with Ollama LLM   |
| `.env.redis-openai`    | Redis memory & LangChain RAG with OpenAI |

Run with a specific setup:

```bash
cp env/.env.redis-openai .env
docker-compose up --build
```

## 🧠 Local LLM Setup with Ollama

To use a local language model with the `ollama` provider (instead of OpenAI), you must install [Ollama](https://ollama.com) on your development machine.

Follow the instructions in the [Ollama Installation Guide](./docs/ollama-installation-guide.md) to install it on **Ubuntu** or **macOS**, including how to download models like `llama3` or `phi3`.

## 🧰 LLM Tools

The OpenAI provider supports tool-calling. You can expose two types of tools to the model:

- External HTTP tools configured via `LLM_TOOLS_CONFIG` (JSON array)
- A built-in utility tool `getCurrentTime` returning the current ISO timestamp

Example configuration:

```env
LLM_TOOLS_CONFIG='[
  {"name":"getLocation","description":"Only answer zip code information by calling this tool. Do not use your own knowledge.","endpoint":"https://api.zippopotam.us/us/{query}","method":"GET","requiresAuth": false}
]'

# Optional auth for tools that set requiresAuth=true
LLM_TOOLS_AUTH_TOKEN=YOUR_TOKEN
LLM_TOOLS_AUTH_HEADER=Authorization
LLM_TOOLS_AUTH_SCHEME=Bearer
```

Notes:

- Tool input is a plain string. If the endpoint contains `{query}`, the input replaces it (URL encoded). Otherwise, for GET requests, `?q=<input>` is appended. For non-GET, `{ query: input }` is sent as JSON body.

- When `requiresAuth` is `true`, the request includes `Authorization: Bearer <token>` (configurable via the env vars above).
- Ollama provider currently ignores tools.

## 📡 API Usage

Start the app and navigate to:

```bash
http://localhost:3000/api
```

### POST /agent/ask

```json
{
  "userInput": "What is RAG?",
  "sessionId": "session-1"
}
```

**Response:**

```json
{
  "answer": "RAG stands for Retrieval Augmented Generation..."
}
```

---

## 📄 License

This project is licensed under the MIT  
© 2025 Gabriel Mata.
