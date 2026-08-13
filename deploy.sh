#!/bin/bash
# deploy.sh — Chạy trên Ubuntu server
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "🚀 CRM App Deploy"
echo "=================="

# Kiểm tra file .env
if [ ! -f ".env" ]; then
  echo "⚠️  Chưa có file .env!"
  echo "   cp .env.example .env && nano .env"
  exit 1
fi

# Pull code mới nhất (nếu dùng git)
# git pull origin main

# Build & start
echo "🔨 Building images..."
docker compose build --no-cache

echo "▶️  Starting services..."
docker compose up -d

echo ""
echo "✅ CRM App đang chạy!"
echo "   🌐 http://$(hostname -I | awk '{print $1}'):8088"
echo "   📌 Login: admin / Admin@123"
echo ""
echo "📋 Quản lý:"
echo "   Logs:    docker compose logs -f"
echo "   Stop:    docker compose down"
echo "   Restart: docker compose restart"
echo "   Backup:  docker cp crm-backend:/data/crm.db ./backup-$(date +%Y%m%d).db"
