import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Check if Supabase is configured
const isSupabaseConfigured = supabaseUrl && supabaseServiceKey && supabaseServiceKey !== 'YOUR_SERVICE_ROLE_KEY'

// Server-side client with service role key for storage operations
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null

// Upload file to Supabase Storage
export async function uploadToSupabaseStorage(
  file: File,
  bucket: string,
  path: string
): Promise<{ url: string; path: string }> {
  if (!supabase) {
    throw new Error('Supabase Storage is not configured. Please add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your environment variables.')
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false
    })

  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(path)

  return {
    url: urlData.publicUrl,
    path: data.path
  }
}

// Delete file from Supabase Storage
export async function deleteFromSupabaseStorage(
  bucket: string,
  path: string
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase Storage is not configured.')
  }

  const { error } = await supabase.storage
    .from(bucket)
    .remove([path])

  if (error) {
    throw new Error(`Delete failed: ${error.message}`)
  }
}
