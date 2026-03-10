#!/usr/bin/env bash
# test-env-check.sh — Verify test infrastructure is running before tests.
# Usage: pnpm test:env:check
# Exit 0 = all services healthy. Exit 1 = something is down (with clear message).

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

POSTGRES_PORT="${TEST_POSTGRES_PORT:-5434}"
PGBOUNCER_PORT="${TEST_PGBOUNCER_PORT:-6433}"
REDIS_PORT="${TEST_REDIS_PORT:-6380}"

PASS=0
FAIL=0

check_service() {
  local name="$1"
  local port="$2"
  local check_cmd="$3"

  if eval "$check_cmd" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} ${name} (port ${port})"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} ${name} (port ${port}) — not responding"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "Checking test services..."
echo ""

# PostgreSQL — try pg_isready first, fall back to nc
if command -v pg_isready > /dev/null 2>&1; then
  check_service "PostgreSQL" "$POSTGRES_PORT" \
    "pg_isready -h localhost -p $POSTGRES_PORT -U everystack_test -q"
else
  check_service "PostgreSQL" "$POSTGRES_PORT" \
    "nc -z localhost $POSTGRES_PORT"
fi

# PgBouncer — just check the port is open
check_service "PgBouncer" "$PGBOUNCER_PORT" \
  "nc -z localhost $PGBOUNCER_PORT"

# Redis — try redis-cli first, fall back to nc
if command -v redis-cli > /dev/null 2>&1; then
  check_service "Redis" "$REDIS_PORT" \
    "redis-cli -p $REDIS_PORT ping"
else
  check_service "Redis" "$REDIS_PORT" \
    "nc -z localhost $REDIS_PORT"
fi

echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}${FAIL} service(s) not running.${NC}"
  echo ""
  echo "To start test services:"
  echo "  pnpm test:services:up"
  echo ""
  echo "To check Docker containers:"
  echo "  docker compose -f docker-compose.test.yml ps"
  echo ""
  exit 1
else
  echo -e "${GREEN}All ${PASS} services healthy.${NC}"
  echo ""
  exit 0
fi
