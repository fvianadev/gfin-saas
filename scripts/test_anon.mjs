async function testFetch() {
  const url = 'https://eozvjjtqoicyqooiuvqi.supabase.co/rest/v1/servicos_produtos?estabelecimento_id=eq.28197b7a-5e9a-4ed0-87c6-7870bf88a951&tipo=eq.receita';
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvenZqanRxb2ljeXFvb2l1dnFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjMxMTcsImV4cCI6MjA5MzYzOTExN30.LSBVxyztekk993z01ohWDnmR6oT1GMt8KVmeFkeuz60';
  
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    });
    const data = await res.json();
    console.log('--- TEST ANON FETCH ---');
    console.log('Status:', res.status);
    console.log('Count:', Array.isArray(data) ? data.length : 'Error: ' + JSON.stringify(data));
  } catch (err) {
    console.error('Fetch Error:', err.message);
  }
}

testFetch();
