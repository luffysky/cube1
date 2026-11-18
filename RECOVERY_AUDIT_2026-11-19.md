# cube1 recovery audit (2026-11-19)

## Ground truth (verified through GitHub API)
- Repository: `luffysky/cube1`, default branch `main`
- Only visible ref: `refs/heads/main` at commit `8186a3202f27de2dfd4ef33547bad2258ecb1098` (before this recovery branch was created).
- That is the repository's sole reachable commit, with no parents.
- Commit tree: `c6b10dadf81d64fc1af7f605609ae557cb9f6009`
- Reachable tree contains **only** `README.md` (6805 bytes), blob `af5f62231b066b197e3c6542d16ea4ec1ba27666`.
- PRs: 0. Releases: 0. GitHub Actions workflow runs: 0.
- Existing source code for 139 claimed files is **not committed** and cannot be verified from this repository.
- Chat screenshots show GitHub create-blob operations were attempted for WAV/audio; they do **not** include successful blob hashes. Unreachable blobs cannot be enumerated through the standard REST Git API.
- This report does not assert that unattached Git objects have been deleted or remain recoverable.

## DO NOT DO
- Do not replace `main` or claim the 139 files were recovered.
- Do not push placeholder code as if it were the original.
- Do not touch `cube2` (Claude's independent repository).
- Do not expose auth, Neon or payment secrets in repository, issues or logs.

## Target inventory inferred from committed README (NOT original file manifest)
- `dist/`: static web and PWA deliverable
- `dist/games/spinrealm/`: gameplay, UI, sounds, skins, auth/ranked client, five-language localization
- `dist/platform/catalog.mjs`: store/economy catalog
- `server/match-simulation.mjs`: deterministic server-authoritative simulation
- `server/api/`: Node 24, Neon Function API, JWT and PostgreSQL
- `server/migrations/`: database schema and RLS
- `desktop/`: Electron desktop app and SteamPipe guides
- `tests/`: gameplay and API test suite
- `docs/`: product, deployment, backend and Steam docs
- `.github/workflows/`: web deployment and desktop CI

## Recovery next steps
1. Obtain old conversation export; search tool outputs for SHA-1 values of `create_blob`, `create_tree`, or `create_commit`, along with matching original file paths.
2. For each real SHA, call GitHub `git/blobs/{sha}` and verify retrieved object length/content.
3. Match recovered SHA to original file path using old manifest or source records; avoid guessing paths.
4. Assemble a tree from verified blobs on a separate branch; run relevant tests before considering merge to `main`.
5. Recover missing files from any old generated ZIP, local copies or exported code; otherwise mark missing and rebuild separately.

## Note on recovered specifications
The committed README documents SPINREALM v0.4 functionality, but is not evidence the described features are deployed or that source files survive. It describes game logic (SRS, T-Spin, 7-bag), coin balances (250 welcome / 50 daily / 30-20-10 ranked rewards), catalog, friend and ranked flows, five languages, audio, Electron, and Steam deployment constraints. See existing README for the full project spec.
