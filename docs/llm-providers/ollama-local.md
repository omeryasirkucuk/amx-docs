# Ollama and OpenAI-compatible local endpoints

For air-gapped use, on-prem deployments, or just keeping all data local, AMX supports two
local-LLM paths:

- **Ollama native** (`provider: ollama`) — uses the Ollama-specific API at
  `http://localhost:11434`.
- **OpenAI-compatible local** (`provider: local`) — uses the OpenAI Chat Completions wire
  format against any local server (vLLM, LM Studio, Text Generation Inference, llama.cpp's
  server, Ollama's OpenAI-mode).

## Ollama native

```text
/add-llm-profile ollama_local
```

Fields:

- **Provider:** `ollama`
- **Model id:** the Ollama model name, e.g. `llama3.1:70b`, `qwen2.5:32b`, `gemma2:27b`
- **Base URL:** `http://localhost:11434` (no `/v1`)
- **API key:** any non-empty string (Ollama ignores it)

Make sure the model is pulled first:

```bash
ollama pull llama3.1:70b
```

## OpenAI-compatible local

For vLLM / LM Studio / TGI / llama.cpp:

```text
/add-llm-profile local_vllm
```

Fields:

- **Provider:** `local`
- **Model id:** the model name as the server exposes it
- **Base URL:** `http://localhost:8000/v1` (vLLM) / `http://localhost:11434/v1` (Ollama
  OpenAI-mode) / etc.
- **API key:** any non-empty string

This is the right choice when:

- You need OpenAI-compatible logprobs (vLLM exposes them, Ollama native does not).
- You want to use prompts and tools designed for the OpenAI Chat Completions schema
  unchanged.
- You're running a fine-tuned model behind a vLLM serving stack.

## Recommended local models

For metadata generation, the model needs to be:

- Good at structured (JSON) output.
- Able to follow long-form prompts (the Profile Agent batch can be 4-8K tokens).
- Big enough to do reasonable inference (≥ 30B parameters in practice).

Tested combinations:

| Model | Quality | Notes |
|---|---|---|
| `qwen2.5:32b` | Good | Solid JSON adherence, fast |
| `llama3.1:70b` | Very good | Slow on consumer hardware; use for high-stakes |
| `gemma2:27b` | OK | Decent baseline, occasional JSON drift |
| `deepseek-coder-v2:16b` | Mixed | Strong on code-heavy schemas, weaker on business semantics |

Smaller models (≤ 13B) tend to invent foreign-key relationships and produce verbose,
low-confidence output. They work for evaluation but aren't suitable for production
metadata.

## Cost

Local LLMs cost nothing per token, but they cost wall-clock and electricity. AMX's
`/usage` shows token totals but no dollar cost (`—`) for local profiles since pricing is
unknown.

## Logprobs

- **Ollama native** does not return logprobs. AMX falls back to whole-response confidence
  for ollama-native profiles.
- **vLLM / LM Studio / OpenAI-compatible** returns logprobs when the server is started
  with the right flags. Confidence calibration works as for OpenAI direct.

## Embeddings

For fully-offline AMX, also configure local embeddings:

```text
/embeddings Local
```

This uses sentence-transformers from the `local-embeddings` extra. Run `/search rebuild`
after switching to re-embed the catalog.

```bash
pip install "amx[local-embeddings]"
```

## Known gotchas

- Local servers often have small default context windows. For wide-table profiling, set
  the server's context window high (vLLM `--max-model-len`, llama.cpp `-c`) and reduce
  `/llm-batch-size` until prompts fit.
- Ollama's native API doesn't support Anthropic-style tool calls. Use OpenAI-compatible
  mode if you want the Search Agent's tool-loop behaviour against an Ollama-served model.
- Self-signed TLS on the local server: set `REQUESTS_CA_BUNDLE` to your CA bundle.
