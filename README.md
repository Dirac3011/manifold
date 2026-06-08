# Manifold

**Manifold** is a standalone collaborative research platform for mathematical writing. It combines a LaTeX editor/compiler, theorem-object-based discussion threads, project chat with native math rendering, citation management, and cross-reference dependency graphs.

This is **not** an Overleaf extension — it is an independent web application.

## Features (MVP)

- **User accounts & projects** — email/password auth, Google & GitHub OAuth, project roles (owner/editor/viewer), collaborator invites
- **LaTeX editor** — Monaco editor with file tree, multi-file-ready data model (`main.tex` + `references.bib`)
- **PDF compilation** — Docker-sandboxed `latexmk` with resource limits, no network, compiler logs
- **Math object parsing** — detects theorem, lemma, definition, conjecture, etc. with labels, proofs, citations, refs
- **Object dashboard** — filter by type, status, unresolved comments, missing labels
- **Object threads** — persistent per-theorem discussions with KaTeX math (`$$...$$` inline, `[...]` display)
- **Project chat** — realtime via Socket.IO, `@label` mentions with autocomplete
- **Citations** — BibTeX parsing, used/unused/missing key detection, **DOI lookup** (CrossRef → BibTeX)
- **GitHub integration** — link a project to a repo, pull/push LaTeX files from the **Git** sidebar tab
- **Cross-references** — missing refs, unused labels, dependency graph view
- **Save history** — snapshots on save and compile

## Architecture

```
src/
├── app/                    # Next.js App Router (pages + API routes)
├── components/             # React UI (editor, sidebar, threads, chat)
├── lib/
│   ├── latex/
│   │   ├── parser.ts       # Theorem-environment parser
│   │   ├── citations.ts    # BibTeX parser
│   │   ├── compile.ts      # Docker LaTeX sandbox
│   │   ├── render.ts       # KaTeX message rendering
│   │   └── sync-objects.ts # DB sync preserving threads
│   ├── auth.ts             # NextAuth (credentials + Google/GitHub OAuth)
│   ├── citations/doi.ts    # CrossRef DOI → BibTeX
│   ├── github/             # GitHub API client + pull/push sync
│   └── permissions.ts      # Role-based access
server.ts                   # Custom server (Next.js + Socket.IO)
prisma/schema.prisma        # PostgreSQL schema
docker/latex/               # LaTeX compiler image
```

### LaTeX compiler profiles

Manifold supports three compile modes (selectable in the editor toolbar):

| Profile | Engine | Speed | Best for |
|---------|--------|-------|----------|
| **Draft (fast)** *(default)* | Single `pdflatex` pass | Fastest (~3–10×) | Previewing layout and math while writing. Skips BibTeX; refs may show `??`. |
| **Standard** | `latexmk` + BibTeX | Moderate | Day-to-day work with resolved citations and cross-references. |
| **Final (full)** | `latexmk -gg` + BibTeX | Slowest | Submission-ready PDFs with all references fully settled. |

Future options (not yet implemented): **XeLaTeX** / **LuaLaTeX** for advanced fonts, **Tectonic** for cached fast rebuilds.

### Key design decisions

1. **Object identity** — LaTeX `\label{}` is the primary stable anchor. Without a label, a content hash (`file + type + body`) is used. Threads persist across edits; orphaned objects are marked `DEPRECATED` rather than deleted.

2. **Compilation sandbox** — Docker container with `--network=none`, memory/CPU limits, isolated workspace per compile. Shell escape disabled via standard TeX Live config.

3. **Future Lean support** — `MathObject` includes `leanStatus`, `leanDeclaration`, `leanFilePath`, `leanNotes` placeholder fields. No Lean UI in MVP.

4. **Multi-file ready** — `File.path` supports arbitrary paths; parser accepts `filePath` param; compile copies all project files into workspace.

## Prerequisites

- **Node.js** 20+
- **Docker** (for LaTeX compilation and optionally PostgreSQL)
- **PostgreSQL** 16 (or use Docker Compose)

## Quick start

### 1. Clone and install

```bash
npm install
cp .env.example .env
```

Edit `.env` — set `NEXTAUTH_SECRET` to a random string:

```bash
# Generate a secret (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

#### OAuth (optional but recommended)

**Google sign-in**

1. Create an OAuth client at [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (Web application).
2. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`.

**GitHub sign-in & Git integration**

1. Create an OAuth App at [GitHub Developer Settings](https://github.com/settings/developers).
2. Callback URL: `http://localhost:3000/api/auth/callback/github`
3. Set `GITHUB_ID` and `GITHUB_SECRET` in `.env`.
4. Sign in with GitHub (or connect on **Profile**) to grant `repo` scope for push/pull.

**DOI lookup** — set `CROSSREF_MAILTO` to your email (CrossRef polite pool).

**Collaborator invites** — configure `SMTP_*` in `.env` to send invitation emails. Without SMTP, invite links are printed to the server console during development.

### 2. Start PostgreSQL

```bash
docker compose up -d postgres
```

### 3. Initialize database

```bash
npm run db:push
npm run db:seed
```

### 4. Build LaTeX Docker image

```bash
docker build -t manifold-latex ./docker/latex
```

> First build downloads TeX Live (~4 GB). Subsequent compiles are fast.

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Seed accounts

| Email | Password | Role |
|-------|----------|------|
| euler@example.com | euler | Project owner |
| bob@example.com | password123 | Editor |

## Usage walkthrough

1. Sign in as **euler@example.com**
2. Open **Sample Analysis Paper** (or create a new project)
3. Edit `main.tex` in the center editor
4. Click **Compile** — PDF appears on the right (requires Docker image)
5. Open **Objects** tab — see parsed theorems, lemmas, definitions
6. Click **thm:main** — open its discussion thread in the right panel
7. Post a comment with math: `The bound $$\\|a\\|_2 \\le \\sqrt{n}$$ seems tight`
8. Switch to **Chat** tab — message with `@thm:main` mention
9. View **Citations** tab — paste a DOI and click **Lookup & add**
10. Open **Git** tab — connect GitHub, link a repo, **Pull** / **Push** project files
11. View **Graph** tab for cross-reference dependencies

## API overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Create account |
| `/api/projects` | GET/POST | List/create projects |
| `/api/projects/:id/files` | PUT | Save file content |
| `/api/projects/:id/compile` | POST | Compile LaTeX → PDF |
| `/api/projects/:id/objects` | GET | List math objects |
| `/api/projects/:id/objects/:oid` | GET/PATCH | Object detail / update status |
| `/api/projects/:id/objects/:oid/comments` | POST | Add thread comment |
| `/api/projects/:id/chat` | GET/POST | Project chat |
| `/api/projects/:id/citations` | GET/POST | Citation management |
| `/api/projects/:id/citations/lookup-doi` | POST | DOI lookup → add citation |
| `/api/projects/:id/git` | GET/POST/DELETE | Link/unlink GitHub repo |
| `/api/projects/:id/git/pull` | POST | Pull files from GitHub |
| `/api/projects/:id/git/push` | POST | Push changed files to GitHub |
| `/api/integrations/github` | GET | List user's GitHub repos |
| `/api/projects/:id/references` | GET | Cross-ref analysis + deps |
| `/api/projects/:id/snapshots` | GET | Save history |
| `/api/projects/:id/members` | POST | Email collaborator invite |
| `/api/invites/:token` | GET | Preview invitation |
| `/api/invites/:token/accept` | POST | Accept invitation |

## Security notes

- LaTeX runs in Docker with no network, 1 GB RAM, 1 CPU, 256 PID limit
- Compile timeout: 120s (configurable via `COMPILE_TIMEOUT_MS`)
- File paths validated against traversal
- Project access enforced on every API route
- Shell escape disabled in TeX Live container

## Development

```bash
npm run dev          # Start dev server (Next.js + Socket.IO)
npm run db:studio    # Prisma Studio GUI
npm run lint         # ESLint
```

## Production considerations

- Configure production OAuth redirect URLs for Google and GitHub
- Use S3-compatible storage instead of local `./storage`
- Add Redis adapter for Socket.IO horizontal scaling
- Run LaTeX compiles on a dedicated worker queue

## License

MIT
