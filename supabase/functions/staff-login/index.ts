import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { slug, pin } = await req.json()

    // Inicializa o cliente com a Service Role para bypassar RLS e buscar o PIN
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Busca o estabelecimento pelo slug
    const { data: estab, error: estabError } = await supabaseAdmin
      .from('estabelecimentos')
      .select('id')
      .eq('slug', slug)
      .single()

    if (estabError || !estab) {
      return new Response(JSON.stringify({ error: 'Estabelecimento não encontrado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    // 2. Busca o membro pelo estabelecimento e PIN (No mundo real, usaríamos hash, aqui simplificado para o exemplo)
    const { data: membro, error: membroError } = await supabaseAdmin
      .from('membros_equipe')
      .select('id, nome, cargo')
      .eq('estabelecimento_id', estab.id)
      .eq('pin_hash', pin) // Em produção: bcrypt.compare(pin, pin_hash)
      .eq('ativo', true)
      .single()

    if (membroError || !membro) {
      return new Response(JSON.stringify({ error: 'PIN incorreto ou membro inativo' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // 3. Retorna os dados do membro e um "token" (Em produção, geraríamos um JWT customizado aqui)
    // Para simplificar o MVP, o frontend pode armazenar o membro_id e usá-lo nas chamadas 
    // ou a Edge Function pode retornar um JWT assinado com a secret do Supabase.

    return new Response(
      JSON.stringify({ 
        user: membro,
        estabelecimento_id: estab.id,
        message: 'Login realizado com sucesso' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
