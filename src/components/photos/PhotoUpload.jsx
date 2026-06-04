import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Trash2, Upload } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export default function PhotoUpload({ stepId, agentId, photos = [], onAdd, onRemove, onPhotoClick }) {
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')

  const uploadFile = async (file) => {
    const ext  = file.name.split('.').pop()
    const path = `${agentId || 'agent'}/${stepId || 'temp'}/${uuidv4()}.${ext}`
    const { error } = await supabase.storage.from('photos').upload(path, file, { upsert: false })
    if (error) throw error
    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path)
    return urlData.publicUrl
  }

  const onDrop = useCallback(async (acceptedFiles) => {
    if (!stepId) { setErr("Enregistrez d'abord l'étape pour ajouter des photos"); return }
    setErr('')
    setUploading(true)
    try {
      for (const file of acceptedFiles) {
        if (file.size > 10 * 1024 * 1024) { setErr(`${file.name} dépasse 10 Mo`); continue }
        const url = await uploadFile(file)
        const ordre = photos.length
        const { data, error: dbErr } = await supabase
          .from('photos')
          .insert({ etape_id: stepId, url, ordre })
          .select()
          .single()
        if (dbErr) throw dbErr
        onAdd?.(stepId, data)
      }
    } catch (e) {
      setErr(e.message)
    } finally {
      setUploading(false)
    }
  }, [stepId, photos, onAdd, agentId])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [] },
    multiple: true,
  })

  const handleRemove = async (photo) => {
    await supabase.from('photos').delete().eq('id', photo.id)
    onRemove?.(stepId, photo.id)
  }

  return (
    <div className="space-y-2">
      {/* Thumbnails */}
      {photos.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {photos.map((p, i) => (
            <div key={p.id} className="relative group">
              <img
                src={p.url}
                alt=""
                onClick={() => onPhotoClick?.(i)}
                className="h-16 w-16 object-cover rounded-lg cursor-pointer hover:opacity-90 transition"
              />
              <button
                type="button"
                onClick={() => handleRemove(p)}
                className="absolute -top-1.5 -right-1.5 bg-white border border-gray-200 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition shadow-sm"
              >
                <Trash2 size={10} className="text-red-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl px-4 py-3 flex items-center gap-2 cursor-pointer transition text-sm ${
          isDragActive
            ? 'border-navy bg-navy/5 text-navy'
            : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500'
        }`}
      >
        <input {...getInputProps()} />
        <Upload size={14} />
        {uploading
          ? 'Envoi en cours…'
          : isDragActive
            ? 'Déposez ici'
            : 'Ajouter des photos'}
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  )
}
