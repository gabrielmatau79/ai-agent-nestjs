# 🧠 Ollama Installation Guide – Ubuntu & macOS

Ollama is a powerful tool to run Large Language Models (LLMs) locally on your machine. This guide provides step-by-step instructions for installing and setting up Ollama on **Ubuntu** and **macOS**.

---

## 🐧 Installation on Ubuntu

### 1. Install System Dependencies

```bash
sudo apt update
sudo apt install -y curl unzip
```

### 2. Download and Install Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

> 📦 This script will automatically download the latest Ollama binary and install it in `/usr/local/bin/ollama`.

### 3. Start the Ollama Service

```bash
ollama serve
```

> 🧠 This launches the Ollama server and makes it accessible on `http://localhost:11434`.

### 4. Pull a Model (Example: LLaMA 3)

```bash
ollama pull llama3
```

---

## 🍏 Installation on macOS

### 1. Install via Homebrew (Recommended)

```bash
brew install ollama
```

> 💡 If you don’t have Homebrew, install it first: <https://brew.sh>

### 2. Start the Ollama Service

```bash
ollama serve
```

### Expose Ollama on all interfaces (0.0.0.0)

> **Why?**  
> To allow access from Docker or other machines, you may want Ollama to listen on all network interfaces.

```bash
OLLAMA_HOST=0.0.0.0 ollama serve
```

- **Tip:** By default, Ollama listens only on `localhost`. Setting `OLLAMA_HOST=0.0.0.0` makes it accessible from other devices and Docker containers.

> 🔄 This will run the Ollama server in the background on port 11434.

### 3. Pull a Model

```bash
ollama pull llama3
```

---

## 🔍 Test Your Installation

Run a simple prompt:

```bash
curl http://localhost:11434/api/generate \
  -d '{"model": "llama3", "prompt": "What is the capital of France?"}' \
  -H "Content-Type: application/json"
```

Expected response:

```json
{ "response": "The capital of France is Paris." }
```

---

## 📌 Notes

- Ollama models are downloaded and stored locally.
- To run models without internet access after pulling, ensure the service is running with the model already loaded.
