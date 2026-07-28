#!/bin/bash
# Script khởi động CRM App
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Khởi động CRM App..."

# Kill process cũ nếu có
lsof -ti :3001 | xargs kill -9 2>/dev/null
lsof -ti :3000 | xargs kill -9 2>/dev/null
sleep 1

# Chạy backend
cd "$DIR/backend"
node index.js &
BACKEND_PID=$!
echo "✅ Backend chạy (PID $BACKEND_PID) → http://localhost:3001"

# Chạy frontend
cd "$DIR/frontend"
npx vite preview --port 3000 &
FRONTEND_PID=$!
echo "✅ Frontend chạy (PID $FRONTEND_PID) → http://localhost:3000"

echo ""
echo "📌 Đăng nhập: admin / Admin@123"
echo "📌 Nhấn Ctrl+C để dừng"

# Mở browser
sleep 2
open http://localhost:3000 2>/dev/null || xdg-open http://localhost:3000 2>/dev/null

# Chờ Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Đã dừng.'" INT
wait
