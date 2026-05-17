async function testEstab() {
  const slug = 'barbearia-viana';
  const url = `https://eozvjjtqoicyqooiuvqi.supabase.co/rest/v1/estabelecimentos?slug=eq.${slug}&select=*`;
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvenZqanRxb2ljeXFvb2l1dnFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjMxMTcsImV4cCI6MjA5MzYzOTExN30.LSBVxyztekk993z01ohWDnmR6oT1GMt8KVmeFkeuz60';
  
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Accept': 'application/vnd.pgrst.object+json' // Force single object
      }
    });
    const data = await res.json();
    console.log('--- TEST ESTAB ANON FETCH ---');
    console.log('Status:', res.status);
    console.log('Data:', data.id ? data.nome : 'Error: ' + JSON.stringify(data));
  } catch (err) {
    console.error('Fetch Error:', err.message);
  }
}

testEstab();
