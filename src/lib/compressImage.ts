import { extractPathFromSupabaseUrl } from './storage'

export function compressImage(file: File, maxSize = 800, quality = 0.8): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round(height * maxSize / width)
          width = maxSize
        } else {
          width = Math.round(width * maxSize / height)
          height = maxSize
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error('Falha na compressão'))),
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => reject(new Error('Falha ao carregar imagem'))
    img.src = URL.createObjectURL(file)
  })
}

export async function uploadImage(
  supabase: any,
  file: File,
  bucket: string,
  fileName: string,
): Promise<string> {
  const compressedBlob = await compressImage(file)
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(fileName, compressedBlob, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: true,
    })
  if (uploadError) throw uploadError

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName)
  return publicUrl
}

export function deleteOldImage(supabase: any, bucket: string, url: string | null) {
  if (!url) return
  const path = extractPathFromSupabaseUrl(url, bucket)
  if (path) {
    supabase.storage.from(bucket).remove([path]).then(({ error }: any) => {
      if (error) console.error(`Erro ao remover imagem antiga de ${bucket}:`, error)
    })
  }
}
