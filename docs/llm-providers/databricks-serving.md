# Databricks Serving

Use a Databricks **Model Serving** endpoint — Foundation Models (e.g.
`databricks-meta-llama-3-1-70b-instruct`, `databricks-dbrx-instruct`) or a custom
endpoint you've published in your workspace — as the LLM AMX talks to. The big draw is
**no extra vendor**: the inference runs in the same workspace the warehouse data lives
in, billed against your existing Databricks contract, on the same authentication
(workspace PAT) you already issue to AMX for SQL warehouse access.

## Prerequisites

- AMX installed (`pip install amx-cli`) and a working `~/.amx/config.yml` (run [`/setup`](../cli/setup.md) first if not).
- A Databricks workspace with **Model Serving** enabled — Foundation Model APIs are available in most Premium / Enterprise tiers; verify in the **Serving** tab in the workspace UI.
- A **Personal Access Token (PAT)** for the workspace, with permission to query the serving endpoint(s) you intend to use. Same PAT you use for the SQL warehouse connection works.
- The **serving endpoint name** (not the model name) — this is the string under the **Serving** tab → **Endpoints** column. For Foundation Models the endpoint names are pre-provisioned and start with `databricks-…`.

## Step-by-step

1. **Open the LLM wizard.**
    ```text
    amx
    /llm /add-llm-profile
    ```
    AMX walks you through provider → model → connection details.

2. **Pick `databricks_serving` as the provider.**
    ```text
    Select AI provider [openai/openrouter/anthropic/gemini/deepseek/local/kimi/ollama/databricks_serving]:
    > databricks_serving
    ```

3. **Enter the serving endpoint name** (not the underlying model name).
    ```text
    Databricks Serving model = the SERVING ENDPOINT NAME from your
      workspace's 'Serving' tab (Foundation Models or your custom endpoint).
      Examples: databricks-meta-llama-3-1-70b-instruct,
                databricks-dbrx-instruct, my-custom-mistral-endpoint
    Serving endpoint name [databricks-meta-llama-3-1-70b-instruct]:
    > databricks-meta-llama-3-1-70b-instruct
    ```
    The default suggestion is the Llama 3.1 70B Foundation Model — a solid baseline.
    Press Enter to accept, or type your own endpoint name.

4. **Enter the workspace host.** AMX appends `/serving-endpoints` automatically — just
   the bare hostname.
    ```text
    Databricks workspace host (e.g. adb-xxxxxxxxxxxxxxxx.0.azuredatabricks.net):
    > adb-1234567890123456.7.azuredatabricks.net
    ```
    !!! tip
        Same hostname your SQL warehouse profile uses. AMX strips `https://` /
        trailing slashes if you paste a full URL.

5. **Paste the workspace PAT.** Hidden as you type.
    ```text
    Databricks personal access token (PAT):
    > ********************************
    ```

6. **Generation defaults — Enter to accept.**
    ```text
    Alternatives (1-5)        [3]:
    Column batch size         [10]:
    Temperature (0.0-2.0)     [0.2]:
    High threshold            [0.85]:
    Medium threshold          [0.50]:
    ```
    See [generation defaults](index.md#generation-defaults-that-apply-across-all-providers)
    for what each one does.

## Sample config

After the wizard, your `~/.amx/config.yml` gets a block like this:

```yaml
llm_profiles:
  databricks-llama:
    provider: databricks_serving
    model: databricks-meta-llama-3-1-70b-instruct
    api_base: https://adb-1234567890123456.7.azuredatabricks.net/serving-endpoints
    api_key: dapi_••••••••••••••••••••••••••••••
    temperature: 0.2
    n_alternatives: 3
    column_batch_size: 10
    logprob_high: 0.85
    logprob_medium: 0.50
active_llm_profile: databricks-llama
```

## Verify

1. **Probe connectivity.**
    ```text
    amx
    /doctor
    ```
    The `[LLM]` stage should report the endpoint, model id, and a short response from a
    smoke prompt. A `403` or `endpoint not found` here is almost always a permissions
    issue on the PAT, not an AMX bug.

2. **Try a single-column draft.**
    ```text
    /run --tables myschema.orders --column-limit 1
    ```
    Watch the LLM line for `tokens in / tokens out` — confirms the endpoint is actually
    answering, not just accepting the request.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `401 Unauthorized` on first `/run` | PAT missing **Can Query** on the endpoint | In the Databricks UI: Serving → endpoint → Permissions → grant the PAT's user **Can Query** |
| `404 endpoint not found` | Wrong endpoint name (often confused with the model name) | Open the **Serving** tab in the workspace and copy the *Endpoint* column value, not the *Model* one |
| Token-throughput tier exceeded | Foundation Model endpoints have per-workspace QPS limits | Drop `column_batch_size` to 5–8, or move to a Provisioned Throughput endpoint for predictable cost |
| `logprob_high`/`medium` warnings on draft results | Some Databricks-hosted endpoints don't return logprobs | Lower thresholds or rely on the heuristic-confidence fallback; see [logprob thresholds](index.md#generation-defaults-that-apply-across-all-providers) |
| Auto-detected `api_base` is wrong | You typed a full URL with extra path components into the host prompt | Re-run `/edit-llm-profile <name>` and enter just the bare hostname (no scheme, no path) |
