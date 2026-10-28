import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { deleteCurrentAccount } from '../lib/deleteAccount'

export default function DeleteAccount({ onDeleted }) {
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [error, setError] = useState('')

    const handleDelete = async () => {
        setIsDeleting(true)
        setError('')
        try {
            await deleteCurrentAccount(supabase)
            setIsDialogOpen(false)
            onDeleted()
        } catch (deleteError) {
            setError(deleteError.message || 'Unable to confirm account deletion. Please sign in  again.')
            setIsDeleting(false)
        }
    }

    return (
        <section className="delete-account-section" aria-labelledby="delete-account-heading">
            <h3 id="delete-account-heading">Delete Account</h3>
            <p>Delete your account and associated profile information permanently.</p>
            <button
                type="button"
                className="delete-account-button"
                onClick={() => { setError(''); setIsDialogOpen(true) }}>Delete Account</button>
            {isDialogOpen && (
                <div className="admin-modal">
                    <div
                        className="admin-modal-box delete-account-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-account-dialog-title"
                        aria-describedby="delete-account-warning"
                    >
                        <h2 id="delete-account-dialog-title" className="admin-modal-title">Permanently delete your account?</h2>
                        <p id="delete-account-warning" className="admin-modal-text">This action cannot be undone. Your account and all associated data will be permanently deleted.</p>

                        {error && (
                            <p className="admin-note admin-note--danger" role="alert">{error}</p>
                        )}
                        <div className="delete-account-actions">
                            <button
                                type="button"
                                className="button button-alt"
                                onClick={() => setIsDialogOpen(false)}
                            >Cancel</button>

                            <button
                                type="button"
                                className="delete-account-button"
                                onClick={handleDelete}
                                disabled={isDeleting}
                            >{isDeleting ? 'Deleting...' : 'Yes, delete my account'}</button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    )
}