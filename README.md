# EIA MCP server

Wraps EIA API v2, with native data routes and metadata discovery. Set `EIA_API_KEY` in Worker secrets or local `.dev.vars`. Keys stay in the Worker; echoed credential fields and secret strings are removed before data reaches Code Mode or staging.

Use `eia_search` / `mcp_eia_search` to find endpoints and recipes, then `eia_execute` / `mcp_eia_execute` to run them. Query/schema tools also have both aliases.

## Discover before querying

The local helpers below make requests to the fixed `https://api.eia.gov` host:

- `GET /discovery/metadata`: `route` defaults to `/v2`. Follow native child route IDs until reaching a dataset. Retains frequencies, columns, units, facets and period bounds.
- `GET /discovery/facet`: requires `route` and the exact `facet` identifier from metadata. Calls `{route}/facet/{facet}`. Preserves native values, labels and `totalFacets`; no undocumented facet pagination is assumed.
- `GET /discovery/data`: requires a discovered `route` and `data[]` columns; forwards native bracket parameters to `{route}/data`. Defaults to 100 rows, permits 1–5000, and supports an explicit nonnegative integer offset. Arrays become repeated query parameters.

Helpers return `{data: <redacted provider envelope>, provenance, _mcp, note}`. Existing native routes retain their original envelope shape, with credentials removed and local provenance/coverage added in `_mcp`. Any colliding native `_mcp` field remains in the retained source JSON. Values stay as provider strings; units, nulls, warnings, totals and unknown fields are retained. A returned page is not proof of complete history or a consistent snapshot. Select columns and frequencies from current metadata rather than assuming every dataset supports `value` or `annual`.

The electricity recipe checks metadata plus state/sector membership before requesting monthly Colorado residential prices using `data[]=price`. It reads staged metadata in 4,000-character SQL slices (131,072-character total bound) and checks staged facet IDs while retaining all source handles. Failed reads or absent required IDs stop the observation query. A separate AEO recipe returns edition/child-route metadata; it does not guess current editions or claim that the parent is a data endpoint.

Transport reads make one fixed-host request, bounded at 4 MiB and 50 seconds across headers and the complete body. Redirects, byte fragments, invalid UTF-8/JSON and native error envelopes fail explicitly. Native error text/status and Retry-After survive within the same bound, with credential echoes redacted, including Unicode-escaped JSON strings. Cancellation cannot keep an expired call waiting.

Provenance includes retrieval time, credential-free source URL, API version, original-byte SHA-256/count and source JSON preserving BOM, whitespace and numeric tokens except for credential redaction. `redacted` identifies transformed source text; its hash still describes the original bytes. `redacted_json_sha256` separately retains the earlier parsed/redacted serialization hash. Parsed unknown numeric fields remain subject to JavaScript precision limits.

All eight aliases cite successes and errors. Complete envelopes, composed results and large SQL outputs stage above 30 KiB with transport headroom. `payloads` retains the full staged source/envelope. Ordered `mcp_source_index` and `mcp_native_json` columns preserve native record occurrences; scalar string projections retain precision and leading zeroes. Use `eia_metadata`, `eia_facets`, `eia_routes` or the observation table (`electricity_data`, `natural_gas_data`, `petroleum_data`, otherwise `eia_data`). `eia_response` retains envelope context and controls. SQL results that stage use `query_rows(row_index, native_json)`; results above the shared 98,304-byte query ceiling fail without partial rows, so select fewer columns or explicit smaller pages.

## Evidence and pending acceptance

Rechecked [EIA technical documentation](https://www.eia.gov/opendata/documentation.php) on 2026-10-06. Its latest listed patch is March 2026 v2.1.12; this is an extension of the existing v2 integration, not a version migration.

Synthetic contract fixtures cover metadata/facet routing, repeated bracket parameters, exact strings/units, credential isolation/redaction, complete deadlines, workflow stops and full-envelope staging. Actual MCP HTTP handlers with Node SQLite recover staged metadata, all facet/observation rows, child routes and full source hashes through both aliases. Local JavaScript substitutes for isolate execution. See the [October 6 review](../../../docs/audits/2026-10-06-eia-response-review.md) for counts and retained evidence.

Authenticated provider validation remains pending; no credential was acquired. A fresh anonymous request fails DNS and the live MCP CLI cannot establish a local session. Native data and edited Workerd acceptance remain unqualified. No deployment was performed.

<!-- license-and-data-terms:start -->
## License and data terms

The code in this repository is licensed under the Apache License 2.0 (see `LICENSE`).
If you use it in your work, please cite it (see `CITATION.cff`). Citation is requested, not required.

The license covers the code only. Data that this server returns comes from EIA API v2 and stays under the terms of that source: US public domain.
You are responsible for your use of the data under those terms.
<!-- license-and-data-terms:end -->
