#!/usr/bin/env bash
# One-shot host bootstrap. Run as ec2-user / ubuntu on a fresh box.
# Works on Ubuntu 24.04 arm64 AND Amazon Linux 2023 arm64.
set -euo pipefail

UNAME=$(. /etc/os-release; echo "$ID")
echo "→ detected: $UNAME"

if [ "$UNAME" = "ubuntu" ]; then
  sudo apt-get update -y
  sudo apt-get upgrade -y
  sudo apt-get install -y ca-certificates curl git gnupg jq build-essential \
    apt-transport-https debian-keyring debian-archive-keyring

  # Docker
  if ! command -v docker >/dev/null; then
    curl -fsSL https://get.docker.com | sudo sh
  fi

  # Node 22
  if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" != "22" ]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi

  # Caddy
  if ! command -v caddy >/dev/null; then
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
      | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
      | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
    sudo apt-get update -y
    sudo apt-get install -y caddy
  fi

elif [ "$UNAME" = "amzn" ]; then
  sudo dnf update -y
  sudo dnf install -y git jq tar gzip
  sudo dnf install -y docker
  sudo systemctl enable --now docker

  if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" != "22" ]; then
    curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo -E bash -
    sudo dnf install -y nodejs
  fi

  if ! command -v caddy >/dev/null; then
    sudo dnf install -y 'dnf-command(copr)'
    sudo dnf copr enable -y @caddy/caddy
    sudo dnf install -y caddy
  fi
else
  echo "Unknown OS '$UNAME'. Install docker, node22, pnpm, caddy manually."
  exit 1
fi

# pnpm — version pinned to match the workspace
sudo npm install -g pnpm@10.33.2

# user-in-docker (no sudo needed for docker)
sudo usermod -aG docker "$(whoami)"

echo
echo "✔ Host ready."
echo "  Re-login (or 'newgrp docker') so docker group membership takes effect."
echo "  Next:  bash infra/start.sh"
