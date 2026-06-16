import 'dotenv/config'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

async function main() {
  // 1. List estabelecimentos
  const res1 = await fetch(`${supabaseUrl}/rest/v1/estabelecimentos?select=id,nome&limit=5`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  })
  const estabs = await res1.json()
  console.log('Estabelecimentos:', JSON.stringify(estabs, null, 2))

  if (!estabs?.length) { console.log('Nenhum estabelecimento encontrado'); return }

  // 2. Show existing destaques
  const res2 = await fetch(`${supabaseUrl}/rest/v1/marketplace_destaques?select=*`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  })
  const existing = await res2.json()
  console.log('Destaques existentes:', JSON.stringify(existing, null, 2))

  // 3. Upsert test record
  const testRecord = {
    estabelecimento_id: estabs[0].id,
    imagem_url: null,
    premium: true,
    ordem: 1,
    ativo: true,
    dados: {
      rating: 5,
      tags: ['Corte Masculino', 'Barba', 'Hidratação'],
      horario: 'Seg-Sáb 09:00-19:00',
    },
  }

  const res3 = await fetch(`${supabaseUrl}/rest/v1/marketplace_destaques`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(testRecord),
  })
  const inserted = await res3.json()
  console.log('Resposta insert:', JSON.stringify(inserted, null, 2))

  // 4. Verify
  const res4 = await fetch(`${supabaseUrl}/rest/v1/marketplace_destaques?select=*`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  })
  const verify = await res4.json()
  console.log('Verificação final:', JSON.stringify(verify, null, 2))
}

main().catch(console.error)
