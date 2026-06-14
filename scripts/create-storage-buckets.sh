#!/usr/bin/env bash
set -e
# Ensure required Supabase storage buckets exist (idempotent)
create_bucket() {
  local name=$1
  if ! supabase storage bucket list | grep -q "^${name}$"; then
    supabase storage bucket create "${name}" --public
    echo "✅ Bucket '${name}' criado"
  else
    echo "✅ Bucket '${name}' já existe"
  fi
}

create_bucket "servicos"
create_bucket "logos"
create_bucket "avatars"
