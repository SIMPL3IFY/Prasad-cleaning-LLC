import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// SCRUM-204: Limits match the service-images bucket settings
const BUCKET = 'service-images'
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024
const ADMIN_ERROR = 'Please make sure you are signed in as an admin.'

const getImageUrl = (path) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

// SCRUM-204: Unique file names so browsers and the CDN never show a cached old photo
const buildImagePath = (serviceName, file) => {
    const slug = serviceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const extension = file.name.split('.').pop().toLowerCase()
    return `${slug}-${Date.now()}.${extension}`
}

// SCRUM-204: Returns an error message, or '' when the file can be uploaded
const validateImage = (file) => {
    if (!ALLOWED_TYPES.includes(file.type)) return 'Please choose a JPG, PNG, or WebP image.'
    if (file.size > MAX_FILE_SIZE) return 'Please choose an image smaller than 5 MB.'
    return ''
}

export default function ServicePhotosManager({ onClose }) {
    const [services, setServices] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedFiles, setSelectedFiles] = useState({}) // service id -> { file, previewUrl }
    const [busy, setBusy] = useState(null) // { id, action } while a save is running
    const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)
    const [newServiceName, setNewServiceName] = useState('')
    const [newServiceFile, setNewServiceFile] = useState(null) // { file, previewUrl }
    const [newServiceInputKey, setNewServiceInputKey] = useState(0) // bumped to clear the file input
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

    const startAction = (id, action) => {
        setBusy({ id, action })
        setMessage('')
        setError('')
    }

    const failAction = (errorMessage) => {
        setError(errorMessage)
        setBusy(null)
    }

    const isBusy = (id, action) => busy?.id === id && busy?.action === action

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

        const fileError = validateImage(file)
        if (fileError) {
            setError(fileError)
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

        startAction(service.id, 'replace')

        const newPath = buildImagePath(service.name, selected.file)

        const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(newPath, selected.file, { contentType: selected.file.type })

        if (uploadError) {
            console.error('Error uploading service photo:', uploadError.message)
            failAction(`Could not upload the photo: ${uploadError.message}`)
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
            failAction(`Could not save the new photo. ${ADMIN_ERROR}`)
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
        setBusy(null)
    }

    // SCRUM-204: Hidden services stay in the table but disappear from the public pages
    const toggleActive = async (service) => {
        startAction(service.id, 'toggle')

        const { data: updatedRows, error: updateError } = await supabase
            .from('services')
            .update({ is_active: !service.is_active })
            .eq('id', service.id)
            .select('id')

        if (updateError || !updatedRows?.length) {
            console.error('Error updating service visibility:', updateError?.message)
            failAction(`Could not update ${service.name}. ${ADMIN_ERROR}`)
            return
        }

        setServices((prev) => prev.map((s) => (s.id === service.id ? { ...s, is_active: !s.is_active } : s)))
        setMessage(service.is_active ? `${service.name} is now hidden from the site.` : `${service.name} is now shown on the site.`)
        setBusy(null)
    }

    // SCRUM-204: Delete the row first so the site never points at a missing photo
    const deleteService = async (service) => {
        startAction(service.id, 'delete')
        setConfirmingDeleteId(null)

        const { data: deletedRows, error: deleteError } = await supabase
            .from('services')
            .delete()
            .eq('id', service.id)
            .select('id')

        if (deleteError || !deletedRows?.length) {
            console.error('Error deleting service:', deleteError?.message)
            failAction(`Could not delete ${service.name}. ${ADMIN_ERROR}`)
            return
        }

        const { error: removeError } = await supabase.storage.from(BUCKET).remove([service.image_path])
        if (removeError) {
            console.error('Error removing deleted service photo:', removeError.message)
        }

        clearSelectedFile(service.id)
        setServices((prev) => prev.filter((s) => s.id !== service.id))
        setMessage(`${service.name} was deleted.`)
        setBusy(null)
    }

    const clearNewServiceFile = () => {
        if (newServiceFile) URL.revokeObjectURL(newServiceFile.previewUrl)
        setNewServiceFile(null)
    }

    const handleNewServiceFileChange = (file) => {
        setMessage('')
        setError('')
        clearNewServiceFile()

        if (!file) return

        const fileError = validateImage(file)
        if (fileError) {
            setError(fileError)
            setNewServiceInputKey((key) => key + 1)
            return
        }

        setNewServiceFile({ file, previewUrl: URL.createObjectURL(file) })
    }

    // SCRUM-204: Upload the photo, then add the service at the end of the list
    const addService = async (event) => {
        event.preventDefault()

        const name = newServiceName.trim()

        if (!name) {
            setError('Please enter a service name.')
            return
        }

        if (services.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
            setError(`A service named "${name}" already exists.`)
            return
        }

        if (!newServiceFile) {
            setError('Please choose a photo for the new service.')
            return
        }

        startAction('new', 'add')

        const newPath = buildImagePath(name, newServiceFile.file)

        const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(newPath, newServiceFile.file, { contentType: newServiceFile.file.type })

        if (uploadError) {
            console.error('Error uploading new service photo:', uploadError.message)
            failAction(`Could not upload the photo: ${uploadError.message}`)
            return
        }

        const nextSortOrder = services.reduce((max, s) => Math.max(max, s.sort_order), 0) + 1

        const { data: insertedRows, error: insertError } = await supabase
            .from('services')
            .insert({ name, image_path: newPath, sort_order: nextSortOrder })
            .select('id, name, image_path, sort_order, is_active')

        if (insertError || !insertedRows?.length) {
            console.error('Error adding service:', insertError?.message)
            await supabase.storage.from(BUCKET).remove([newPath])
            // 23505 = unique violation, e.g. another admin just added the same name
            failAction(insertError?.code === '23505'
                ? `A service named "${name}" already exists.`
                : `Could not add the service. ${ADMIN_ERROR}`)
            return
        }

        setServices((prev) => [...prev, insertedRows[0]])
        setNewServiceName('')
        clearNewServiceFile()
        setNewServiceInputKey((key) => key + 1)
        setMessage(`${name} was added.`)
        setBusy(null)
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
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '1rem',
                                        flexWrap: 'wrap',
                                        opacity: service.is_active ? 1 : 0.6,
                                    }}
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
                                            disabled={busy !== null}
                                            aria-label={`New photo for ${service.name}`}
                                            style={{ display: 'block', marginTop: '0.5rem' }}
                                        />
                                    </div>

                                    {confirmingDeleteId === service.id ? (
                                        <div className="admin-btn-row">
                                            <span>Delete {service.name}?</span>
                                            <button
                                                type="button"
                                                onClick={() => deleteService(service)}
                                                className="admin-btn admin-btn--danger"
                                            >
                                                Yes, delete
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setConfirmingDeleteId(null)}
                                                className="admin-btn admin-btn--ghost"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="admin-btn-row">
                                            <button
                                                type="button"
                                                onClick={() => replacePhoto(service)}
                                                disabled={!selected || busy !== null}
                                                className="admin-btn admin-btn--primary"
                                            >
                                                {isBusy(service.id, 'replace') ? 'Saving...' : 'Save photo'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => toggleActive(service)}
                                                disabled={busy !== null}
                                                className="admin-btn admin-btn--ghost"
                                            >
                                                {isBusy(service.id, 'toggle') ? 'Saving...' : service.is_active ? 'Hide' : 'Show'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setConfirmingDeleteId(service.id)}
                                                disabled={busy !== null}
                                                className="admin-btn admin-btn--danger"
                                            >
                                                {isBusy(service.id, 'delete') ? 'Deleting...' : 'Delete'}
                                            </button>
                                        </div>
                                    )}
                                </li>
                            )
                        })}
                    </ul>
                )}

                {/* SCRUM-204: Add a new service card with its photo */}
                <form onSubmit={addService} style={{ marginTop: '2rem' }}>
                    <h4 className="admin-modal-title">Add a Service</h4>

                    <div className="admin-field">
                        <label htmlFor="new-service-name" className="admin-label">Service name</label>
                        <input
                            id="new-service-name"
                            value={newServiceName}
                            onChange={(e) => setNewServiceName(e.target.value)}
                            disabled={busy !== null}
                            className="admin-input"
                            placeholder="e.g. Window Cleaning"
                        />
                    </div>

                    <div className="admin-field">
                        <label htmlFor="new-service-photo" className="admin-label">Photo</label>
                        <input
                            id="new-service-photo"
                            key={newServiceInputKey}
                            type="file"
                            accept={ALLOWED_TYPES.join(',')}
                            onChange={(e) => handleNewServiceFileChange(e.target.files[0])}
                            disabled={busy !== null}
                            style={{ display: 'block' }}
                        />
                        {newServiceFile && (
                            <img
                                src={newServiceFile.previewUrl}
                                alt="New service preview"
                                style={{ width: '120px', height: '80px', objectFit: 'cover', borderRadius: '8px', marginTop: '0.5rem' }}
                            />
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={busy !== null}
                        className="admin-btn admin-btn--success"
                    >
                        {isBusy('new', 'add') ? 'Adding...' : 'Add service'}
                    </button>
                </form>
            </div>
        </div>
    )
}
