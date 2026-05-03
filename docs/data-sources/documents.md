# Documents

The RAG Agent reads your documentation — PDFs, Word docs, Markdown handbooks, Excel data
dictionaries — and surfaces relevant passages per column. This is where institutional
knowledge that lives in writing gets pulled into AMX's inference.

## Adding a document profile

```text
/docs
/add-doc-profile sap_handbook
```

The wizard asks for:

- **Name** — used to switch with `/use-doc <name>`.
- **Paths** — one or more locations. Mix local directories, GitHub URLs, S3 buckets,
  Google Drive links, and SharePoint links freely.

When you add paths, AMX checks **reachability only** (e.g. `git ls-remote` for GitHub,
bucket/prefix checks for S3, lightweight HTTP checks for Drive/SharePoint). Full file
discovery happens on `/scan` and `/ingest`.

## Supported sources

| Source | Path format | Auth |
|---|---|---|
| Local files / directories | `/path/to/docs` | filesystem |
| GitHub | `https://github.com/user/repo` or `git@github.com:user/repo.git` | repo must be public, or a deploy key / SSH config in place |
| AWS S3 | `s3://bucket/prefix` | standard AWS credential chain (env vars, profile, IAM role) |
| Google Drive | `https://drive.google.com/...` | Public links zero-config; private files via service account or OAuth |
| SharePoint / OneDrive | `https://...sharepoint.com/...` or `https://onedrive.live.com/...` | Public sharing links zero-config; private via Azure AD app |

## Supported file types

`pdf`, `docx`, `doc`, `txt`, `md`, `csv`, `xlsx`, `xls`, `html`, `htm`, `pptx`, `json`,
`yaml`, `yml`, `rst`, `rtf`.

## Cloud document access

AMX always **tries the public/anonymous download first** — no credentials needed if the
file is shared as "Anyone with the link". Credentials are only required for private files
or folder listings.

### Google Drive

- **Public files** ("Anyone with the link can view"): just paste the link.
- **Google Docs / Sheets / Slides**: public export to PDF / CSV works automatically.
- **Private files or entire folders**: set one of:
    - `AMX_GOOGLE_SERVICE_ACCOUNT_JSON` — path to a service account JSON. Share the
      file/folder with that service account email.
    - `AMX_GOOGLE_OAUTH_TOKEN_JSON` — path to a user OAuth token JSON from a prior
      consent flow.

### SharePoint / OneDrive

- **Public sharing links** ("Anyone with the link"): just paste the link.
- **Private / org-restricted files**: set:
    - `AMX_AZURE_TENANT_ID`
    - `AMX_AZURE_CLIENT_ID`
    - `AMX_AZURE_CLIENT_SECRET`

  Use an Azure AD app registration with Microsoft Graph permissions **Files.Read.All** and
  **Sites.Read.All**.

### S3

S3 scans and ingests preserve object key prefixes in the temporary download tree, so files
with the same basename under different prefixes remain distinct. Use the standard AWS
credential chain — env vars (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`), the AWS
config file (`~/.aws/credentials`), or instance role credentials.

## Scanning and ingesting

```text
/scan                          # preview what AMX would ingest from the active profile
/scan some/specific/path       # ad-hoc preview
/ingest                        # ingest into the RAG vector store
/ingest --refresh              # remove existing chunks for these files first, then re-upsert
/search-docs primary key for company code   # similarity search (no LLM)
```

`/ingest --refresh` is what to use after files have moved or shrunk — it removes existing
chunks whose stored resolved file path or original profile source path matches the files
being ingested, then re-upserts. Without `--refresh`, stale chunks linger and can return
in retrieval.

## Standalone RAG Agent

```text
/doc-analyze sap_s6p.t001
```

Runs the RAG Agent in isolation — useful for testing prompts or producing document-only
descriptions without paying for the full multi-agent pipeline.

## Embeddings

Document embeddings use the same provider as the search catalog:

```text
/embeddings              # show current
/embeddings MiniLM       # default, offline
/embeddings OpenAI-compatible openai/text-embedding-3-small
/embeddings Local         # local sentence-transformers
```

Run `/search rebuild` after switching to re-embed both catalog and document chunks.

## Where ingested chunks live

Chunks are stored in a Chroma collection inside `~/.amx/chroma/` (separate from the
`amx_code` and `amx_search` collections). Each chunk carries:

- `source_path` (resolved local path)
- `original_source` (the path you typed when adding the profile — useful for remote files
  cleared after ingest)
- `doc_profile`
- `mime_type`

## Limits

- Chroma is single-node. For very large documentation sets (> 1M chunks), embedding time
  dominates; use the `local-embeddings` extra with sentence-transformers and run
  `/ingest` overnight.
- `pdf` extraction quality depends on the source. Scanned PDFs without OCR yield empty
  chunks — install OCR separately and convert before ingesting.
- Remote-fetched files (GitHub, S3, Drive, SharePoint) are downloaded to temporary
  directories only for the active scan/ingest operation, then removed.
