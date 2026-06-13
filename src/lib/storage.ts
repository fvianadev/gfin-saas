/**
 * Extrai o caminho do arquivo (path) de uma URL pública do Supabase Storage.
 * Exemplo: de "https://xxx.supabase.co/storage/v1/object/public/servicos/id/foto.jpg"
 * retorna "id/foto.jpg" para o bucket "servicos".
 */
export function extractPathFromSupabaseUrl(url: string, bucketName: string): string | null {
  if (!url || !url.startsWith('http')) return null;
  const searchStr = `/storage/v1/object/public/${bucketName}/`;
  const index = url.indexOf(searchStr);
  if (index === -1) return null;
  return url.substring(index + searchStr.length);
}
