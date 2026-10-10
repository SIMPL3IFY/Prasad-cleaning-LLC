import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// SCRUM-204: Limits match the service-images bucket settings
const BUCKET = 'service-images'
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024

const getImageUrl = (path) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

// SCRUM-204: Unique file names so browsers and the CDN never show a cached old photo
const buildImagePath = (serviceName, file) => {
    const slug = serviceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const extension = file.name.split('.').pop().toLowerCase()
    return `${slug}-${Date.now()}.${extension}`
}

export default function ServicePhotosManager({ onClose }) {
    const [services, setServices] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedFiles, setSelectedFiles] = useState({}) // service id -> { file, previewUrl }
    const [savingId, setSavingId] = useState(null)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    // SCRUM-204: Admins see every service, including hidden ones
    const fetchServices = async () => {
        setLoading(true)
        const { data, error: fetchError } = await supabase
            .from('services')
            .select('id, name, image_path, sort_order, is_active')
            .order('sort_order', { ascending: true })

        if (fetchError) {
            console.error('Error fetching services:', fetchError.message)
            setError('Unable to load services.')
        } else {
            setServices(data || [])
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchServices()
    }, [])

    const clearSelectedFile = (serviceId) => {
        setSelectedFiles((prev) => {
            if (prev[serviceId]) URL.revokeObjectURL(prev[serviceId].previewUrl)
            const next = { ...prev }
            delete next[serviceId]
            return next
        })
    }

    const handleFileChange = (serviceId, file) => {
        setMessage('')
        setError('')
        clearSelectedFile(serviceId)

        if (!file) return

        if (!ALLOWED_TYPES.includes(file.type)) {
            setError('Please choose a JPG, PNG, or WebP image.')
            return
        }

        if (file.size > MAX_FILE_SIZE) {
            setError('Please choose an image smaller than 5 MB.')
            return
        }

        setSelectedFiles((prev) => ({
            ...prev,
            [serviceId]: { file, previewUrl: URL.createObjectURL(file) },
        }))
    }

    // SCRUM-204: Upload new photo -> point the service at it -> remove the old photo
    const replacePhoto = async (service) => {
        const selected = selectedFiles[service.id]
        if (!selected) return

        setSavingId(service.id)
        setMessage('')
        setError('')

        const newPath = buildImagePath(service.name, selected.file)

        const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(newPath, selected.file, { contentType: selected.file.type })

        if (uploadError) {
            console.error('Error uploading service photo:', uploadError.message)
            setError(`Could not upload the photo: ${uploadError.message}`)
            setSavingId(null)
            return
        }

        // RLS blocks silently (0 rows, no error), so ask for the updated row back
        const { data: updatedRows, error: updateError } = await supabase
            .from('services')
            .update({ image_path: newPath })
            .eq('id', service.id)
            .select('id')

        if (updateError || !updatedRows?.length) {
            console.error('Error updating service photo:', updateError?.message)
            await supabase.storage.from(BUCKET).remove([newPath])
            setError('Could not save the new photo. Please make sure you are signed in as an admin.')
            setSavingId(null)
            return
        }

        // A leftover old file doesn't break anything, so only log this failure
        const { error: removeError } = await supabase.storage.from(BUCKET).remove([service.image_path])
        if (removeError) {
            console.error('Error removing old service photo:', removeError.message)
        }

        setServices((prev) => prev.map((s) => (s.id === service.id ? { ...s, image_path: newPath } : s)))
        clearSelectedFile(service.id)
        setMessage(`${service.name} photo updated.`)
        setSavingId(null)
    }

    return (
        <div className="admin-modal">
            <div className="admin-modal-box admin-modal-box--wide admin-modal-box--scroll">
                <div className="admin-row">
                    <h3 className="admin-modal-title">Service Photos</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="admin-btn admin-btn--close"
                        aria-label="Close service photos"
                    >
                        ×
                    </button>
                </div>

                {message && <p className="admin-note admin-note--success">{message}</p>}
                {error && <p role="alert" className="admin-note admin-note--danger">{error}</p>}

                {loading ? (
                    <p className="admin-empty">Loading services...</p>
                ) : services.length === 0 ? (
                    <p className="admin-empty">No services found.</p>
                ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '1rem' }}>
                        {services.map((service) => {
                            const selected = selectedFiles[service.id]

                            return (
                                <li
                                    key={service.id}
                                    style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}
                                >
                                    <img
                                        src={selected?.previewUrl || getImageUrl(service.image_path)}
                                        alt={service.name}
                                        style={{ width: '120px', height: '80px', objectFit: 'cover', borderRadius: '8px' }}
                                    />
                                    <div style={{ flex: '1 1 200px' }}>
                                        <strong>{service.name}</strong>
                                        {!service.is_active && <span> (hidden)</span>}
                                        <input
                                            key={service.image_path}
                                            type="file"
                                            accept={ALLOWED_TYPES.join(',')}
                                            onChange={(e) => handleFileChange(service.id, e.target.files[0])}
                                            disabled={savingId !== null}
                                            aria-label={`New photo for ${service.name}`}
                                            style={{ display: 'block', marginTop: '0.5rem' }}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => replacePhoto(service)}
                                        disabled={!selected || savingId !== null}
                                        className="admin-btn admin-btn--primary"
                                    >
                                        {savingId === service.id ? 'Saving...' : 'Save photo'}
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </div>
        </div>
    )
}
