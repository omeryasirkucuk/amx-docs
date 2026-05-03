# TLS and proxies

Most AMX users hit AMX from a workstation that has direct internet access and trusts a
public CA chain. Corporate networks add complications. This page covers the recovery
paths.

## HTTP / HTTPS proxies

AMX honours the standard env vars for outbound traffic — both for LLM API calls and for
backend drivers that go over HTTP / HTTPS.

```bash
export HTTPS_PROXY=http://proxy.example.com:8080
export HTTP_PROXY=http://proxy.example.com:8080
export NO_PROXY=localhost,127.0.0.1,internal.example.com
```

`NO_PROXY` is important — internal databases on the same network as the proxy itself
should bypass the proxy.

Set these in your shell `rc`, in a project `.env`, or as systemd unit env vars depending
on your deployment.

## TLS certificate verification

Most providers and databases AMX talks to are reachable via the public CA chain. When they
aren't (corporate Postgres behind a private CA, Databricks workspace behind a corporate
proxy, internal Snowflake account on a private link), you have three options:

1. **Trust the corporate CA at the OS level** — install the CA bundle into your
   system trust store. Best long-term solution.
2. **Point AMX at a CA bundle file.** Per-backend or via env vars.
3. **Disable TLS verification.** Last resort, insecure.

### Per-backend CA bundle

Each backend exposes its own field for the trusted CA bundle:

| Backend | Field |
|---|---|
| Databricks | `tls_trusted_ca_file` (or `AMX_DATABRICKS_TRUSTED_CA_FILE`) |
| Postgres | `sslrootcert` in the profile or `PGSSLROOTCERT` env var |
| Snowflake | Snowflake driver uses the system trust store; install the corp CA there |
| BigQuery | The Google client uses the system trust store; install the corp CA there |

For everything else, AMX honours `REQUESTS_CA_BUNDLE` and `SSL_CERT_FILE` as fallbacks.

### Databricks-specific

Databricks workspaces reached through a company proxy or private CA can fail with
`CERTIFICATE_VERIFY_FAILED`. AMX has a multi-stage recovery path:

1. **Saved profile.** Use `tls_trusted_ca_file` on the Databricks DB profile. The path
   may use `~` or env vars (`$HOME/certs/company-ca.pem`); AMX expands before opening
   the connection.
2. **Env-var bundle.** If the profile field is empty, AMX checks
   `AMX_DATABRICKS_TRUSTED_CA_FILE`, `DATABRICKS_TRUSTED_CA_FILE`,
   `REQUESTS_CA_BUNDLE`, then `SSL_CERT_FILE` and passes the first configured bundle
   to the Databricks connector.
3. **`tls_no_verify`.** Last resort. Insecure — should only be used for internal
   troubleshooting. The first successful recovery path is saved back into the active
   DB profile and printed in the terminal.

The `/db tls` command is a quick way to view or set these fields without re-running the
wizard:

```text
/db tls                              # show current
/db tls on /etc/ssl/certs/corp.pem   # set CA bundle
/db tls clear                        # clear bundle
/db tls off                          # disable verification (insecure)
```

### LLM provider TLS

LLM providers terminate TLS on their public CDN. The corporate CA usually doesn't matter
unless your egress proxy does TLS interception (man-in-the-middle). When it does, point
the OpenAI / Anthropic / Gemini SDKs at the corporate CA via `REQUESTS_CA_BUNDLE` and
`SSL_CERT_FILE`.

## Local self-signed endpoints

Self-signed TLS on a local LLM server (vLLM / LM Studio / a fine-tuned model behind your
own ingress):

```bash
export REQUESTS_CA_BUNDLE=/path/to/your-ca.pem
amx
```

For development only, set `REQUESTS_CA_BUNDLE=""` and `SSL_CERT_FILE=""` to skip
verification. Don't ship that to production.

## Verifying the connection

```bash
amx doctor                       # full check including TLS
amx doctor --skip-network        # offline check (skip everything network)
```

For a one-off connection test against the active DB profile:

```text
amx
/db connect
```

Reports the path that succeeded (saved profile / env-var bundle / `tls_no_verify`) so you
can confirm the recovery worked.

## Common error messages

| Error | Likely cause | Fix |
|---|---|---|
| `SSL: CERTIFICATE_VERIFY_FAILED` | Corporate CA not trusted | Install the CA at the OS level, or point AMX at the CA bundle file |
| `SSL: WRONG_VERSION_NUMBER` | TLS being attempted against a non-TLS port | Wrong port — check the backend's TLS endpoint |
| `Tunnel connection failed: 407 Proxy Authentication Required` | Proxy needs auth | Embed credentials in `HTTPS_PROXY` URL: `http://user:pass@proxy:8080` |
| `Could not connect to internal.example.com` from inside the proxy | Internal address being routed through the proxy | Add to `NO_PROXY` |
| `databricks-sql-connector` `CERTIFICATE_VERIFY_FAILED` after profile fix | Cached connection in the same session | Restart `amx` to pick up the profile change |
