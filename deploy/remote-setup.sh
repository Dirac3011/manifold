#!/bin/bash
# Full Manifold deploy on Ubuntu droplet. Usage:
#   bash remote-setup.sh YOUR_PUBLIC_IPV4 [postgres_password]
set -euo pipefail

IP="${1:?Usage: remote-setup.sh PUBLIC_IPV4 [POSTGRES_PASSWORD]}"
DB_PASS="${2:-$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)}"
REPO_DIR="/opt/manifold"

echo "==> Installing Docker (if needed)..."
if ! command -v docker >/dev/null 2>&1; then
  apt-get update
  apt-get install -y ca-certificates curl git
  curl -fsSL https://get.docker.com | sh
fi
docker --version
docker compose version

echo "==> Cloning/updating Manifold..."
mkdir -p /opt
if [ -d "$REPO_DIR/.git" ]; then
  cd "$REPO_DIR"
  git pull
else
  git clone https://github.com/Dirac3011/manifold.git "$REPO_DIR"
  cd "$REPO_DIR"
fi

echo "==> Writing .env..."
if [ ! -f .env ]; then
  cp .env.production.example .env
fi
SECRET="$(openssl rand -base64 32)"
sed -i "s|NEXTAUTH_URL=.*|NEXTAUTH_URL=\"http://${IP}\"|" .env
sed -i "s|NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=\"${SECRET}\"|" .env
sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=\"${DB_PASS}\"|" .env
rm -f .env~

mkdir -p "$REPO_DIR/compile-workspace"
if grep -q '^COMPILE_WORKSPACE_HOST=' .env 2>/dev/null; then
  sed -i "s|COMPILE_WORKSPACE_HOST=.*|COMPILE_WORKSPACE_HOST=\"$REPO_DIR/compile-workspace\"|" .env
else
  echo "COMPILE_WORKSPACE_HOST=\"$REPO_DIR/compile-workspace\"" >> .env
fi

echo "==> Building LaTeX compiler image (30-60 min if first time)..."
if ! docker image inspect manifold-latex >/dev/null 2>&1; then
  docker build -t manifold-latex ./docker/latex
else
  echo "manifold-latex image already exists, skipping build."
fi

echo "==> Starting services..."
docker compose -f docker-compose.prod.yml up -d --build

echo "==> Waiting for app..."
for i in $(seq 1 60); do
  if docker compose -f docker-compose.prod.yml exec -T app node -e "process.exit(0)" 2>/dev/null; then
    break
  fi
  sleep 5
done

echo "==> Seeding database..."
docker compose -f docker-compose.prod.yml exec -T app npm run db:seed

echo "==> Firewall (optional)..."
if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH || true
  ufw allow 80 || true
  ufw allow 443 || true
  ufw --force enable || true
fi

echo ""
echo "============================================"
echo " Manifold is live: http://${IP}"
echo " Login: euler@example.com / euler"
echo "============================================"
