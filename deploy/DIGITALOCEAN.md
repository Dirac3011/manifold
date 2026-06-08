# Deploy Manifold on DigitalOcean

This guide runs the **full** platform: auth, projects, LaTeX compile, PDF preview, live collaboration, chat, and invites.

**Recommended droplet:** Ubuntu 24.04, **4 GB RAM / 80 GB disk** (~$24/mo — covered by GitHub Student Pack credits for many months).

---

## What you need before starting

| Item | Why |
|------|-----|
| [GitHub Student Pack](https://education.github.com/pack) → DigitalOcean $200 credit | Pays for the droplet |
| A domain (optional at first) | HTTPS + OAuth; you can start with the droplet IP |
| OAuth app credentials (optional) | Google/GitHub sign-in |
| SMTP (optional) | Email collaborator invites |

---

## 1. Create the droplet

1. [DigitalOcean](https://cloud.digitalocean.com) → **Create** → **Droplets**
2. **Image:** Ubuntu 24.04 LTS
3. **Size:** Basic → **4 GB RAM** (2 GB works but LaTeX image build may fail)
4. **Authentication:** SSH key (recommended)
5. **Hostname:** `manifold`
6. Create droplet and note the **public IP**

### Install Docker on the droplet

SSH in:

```bash
ssh root@YOUR_DROPLET_IP
```

```bash
apt-get update && apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sh
```

Verify:

```bash
docker --version
docker compose version
```

---

## 2. Clone and configure

```bash
cd /opt
git clone https://github.com/Dirac3011/manifold.git
cd manifold
cp .env.production.example .env
nano .env   # or vim
```

### Required `.env` values

```bash
# Generate a secret (run on the droplet):
openssl rand -base64 32

NEXTAUTH_URL="http://YOUR_DROPLET_IP"    # switch to https://your-domain.com later
NEXTAUTH_SECRET="paste-secret-here"
POSTGRES_PASSWORD="strong-db-password"
```

Save the file.

---

## 3. Build the LaTeX compiler image

First build downloads TeX Live (~4 GB). Takes **30–60 minutes**.

```bash
cd /opt/manifold
docker build -t manifold-latex ./docker/latex
```

Verify:

```bash
docker images | grep manifold-latex
```

---

## 4. Start the platform

```bash
cd /opt/manifold
docker compose -f docker-compose.prod.yml up -d --build
```

Watch logs:

```bash
docker compose -f docker-compose.prod.yml logs -f app
```

Wait until you see `Manifold ready on ...`.

### Seed demo data (first time only)

This **deletes all existing projects** and creates one fresh sample project.

```bash
docker compose -f docker-compose.prod.yml exec app npm run db:seed
```

Demo login:

| Email | Password |
|-------|----------|
| `euler@example.com` | `euler` |
| `bob@example.com` | `password123` |

### Open the app

Visit **http://YOUR_DROPLET_IP** in a browser.

---

## 5. Add HTTPS with your domain (recommended)

1. Point DNS **A record** → droplet IP (e.g. `manifold.yourdomain.com`)
2. Edit `deploy/Caddyfile.domain` — replace `your-domain.example.com` with your domain
3. Copy it over and restart Caddy:

```bash
cp deploy/Caddyfile.domain deploy/Caddyfile
# edit deploy/Caddyfile if you haven't already
nano deploy/Caddyfile
```

4. Update `.env`:

```bash
NEXTAUTH_URL="https://manifold.yourdomain.com"
```

5. Restart:

```bash
docker compose -f docker-compose.prod.yml up -d --build app
docker compose -f docker-compose.prod.yml restart caddy
```

Caddy will obtain a Let's Encrypt certificate automatically.

---

## 6. OAuth callbacks (optional)

Update redirect URLs in Google/GitHub consoles:

| Provider | Callback URL |
|----------|----------------|
| Google | `https://your-domain.com/api/auth/callback/google` |
| GitHub | `https://your-domain.com/api/auth/callback/github` |

Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_ID`, `GITHUB_SECRET` to `.env`, then:

```bash
docker compose -f docker-compose.prod.yml up -d --build app
```

---

## 7. Email invites (optional)

Use [Resend](https://resend.com) SMTP or any provider:

```bash
SMTP_HOST="smtp.resend.com"
SMTP_PORT="587"
SMTP_USER="resend"
SMTP_PASS="re_xxxx"
SMTP_FROM="Manifold <onboarding@resend.dev>"
```

Restart the app after changing `.env`.

---

## 8. Firewall (recommended)

```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

---

## Operations cheat sheet

| Task | Command |
|------|---------|
| View logs | `docker compose -f docker-compose.prod.yml logs -f app` |
| Restart app | `docker compose -f docker-compose.prod.yml restart app` |
| Pull updates | `git pull && docker compose -f docker-compose.prod.yml up -d --build` |
| DB shell | `docker compose -f docker-compose.prod.yml exec postgres psql -U manifold manifold` |
| Backup DB | `docker compose -f docker-compose.prod.yml exec postgres pg_dump -U manifold manifold > backup.sql` |

---

## Troubleshooting

### Compile fails with "Cannot connect to Docker daemon"

The app container needs the host Docker socket. Confirm `docker-compose.prod.yml` mounts `/var/run/docker.sock` and that `manifold-latex` image exists.

### Collaboration shows "Offline"

Set `NEXTAUTH_URL` to the exact URL users visit (including `https://`). Socket.IO CORS uses this value in production.

### Out of memory during LaTeX image build

Resize droplet to 4 GB+, or build the image locally and `docker save` / `docker load` on the server.

### "Invalid callback URL" on login

`NEXTAUTH_URL` must match the browser URL exactly (scheme + host, no trailing slash).

---

## Using DigitalOcean Managed Database (optional)

Instead of the `postgres` service in Compose:

1. Create a **Managed PostgreSQL** cluster in DO
2. Set `DATABASE_URL` in `.env` to the connection string
3. Remove or disable the `postgres` service in `docker-compose.prod.yml`
4. Update `app` `depends_on` accordingly

---

## Cost estimate (with Student Pack)

| Resource | ~Monthly |
|----------|----------|
| 4 GB Droplet | $24 |
| Managed DB (optional) | $15+ |
| **Student credit** | **$200 / 12 mo** |

A single 4 GB droplet with containerized Postgres fits comfortably within student credits for most of the year.
