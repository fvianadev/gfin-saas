import { execSync } from 'child_process';

const args = process.argv.slice(2).join(' ');

try {
  console.log(`Running: npx -y supabase@latest ${args}`);
  execSync(`npx -y supabase@latest ${args}`, { stdio: 'inherit' });
  console.log('--- DONE ---');
} catch (error) {
  console.error('--- ERROR ---');
  console.error(error);
  process.exit(1);
}
