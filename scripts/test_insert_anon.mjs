async function testInsertAgend() {
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvenZqanRxb2ljeXFvb2l1dnFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjMxMTcsImV4cCI6MjA5MzYzOTExN30.LSBVxyztekk993z01ohWDnmR6oT1GMt8KVmeFkeuz60';
  const url = 'https://eozvjjtqoicyqooiuvqi.supabase.co/rest/v1/agendamentos';
  
  const payload = {
    estabelecimento_id: '28197b7a-5e9a-4ed0-87c6-7870bf88a951',
    membro_id: 'd9b73468-23f2-4933-911b-31428383e981', // First professional found in debug
    servico_id: '64792739-0205-4dac-8b12-97f726bd2a32', // First service found in debug
    cliente_nome: 'Teste Cliente',
    cliente_whatsapp: '99999999999',
    data_hora_inicio: new Date().toISOString(),
    data_hora_fim: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    status: 'pendente'
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(payload)
    });
    
    console.log('--- TEST INSERT AGEND ANON ---');
    console.log('Status:', res.status);
    if (res.status >= 400) {
      const err = await res.json();
      console.log('Error:', err);
    } else {
      console.log('Success!');
    }
  } catch (err) {
    console.error('Fetch Error:', err.message);
  }
}

testInsertAgend();
