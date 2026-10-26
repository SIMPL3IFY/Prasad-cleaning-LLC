export async function deleteCurrentAccount(supabase) {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session?.access_token) {
        throw new Error('Your session has expired. Sign in again before deleting your account.')
    }

    const { error: deleteError } = await supabase.functions.invoke('delete-account')

    if (deleteError) {
        throw new Error('Unable to delete your account. The deletion was not completed. Please try again later.')
    }

    await supabase.auth.signOut({ scope: 'local' })
}