import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { SERVICES_LIST } from '../data/ServicesData'

// SCRUM-204: Bundled images shown if Supabase can't be reached
const FALLBACK_FEATURED = ['Residential Cleaning', 'Commercial Cleaning', 'Special Offers']
const FALLBACK_SERVICES = SERVICES_LIST.map((service) => ({
    id: service.name,
    name: service.name,
    img: service.img,
    isFeatured: FALLBACK_FEATURED.includes(service.name),
}))

// SCRUM-204: Loads the active service cards and their photo URLs from Supabase
export function useServices() {
    const [services, setServices] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        let isMounted = true

        const fetchServices = async () => {
            const { data, error: fetchError } = await supabase
                .from('services')
                .select('id, name, image_path, is_featured')
                .eq('is_active', true)
                .order('sort_order', { ascending: true })

            if (!isMounted) return

            if (fetchError) {
                console.error('Error fetching services:', fetchError.message)
                setError(fetchError)
                setServices(FALLBACK_SERVICES)
            } else {
                setServices(data.map((service) => ({
                    id: service.id,
                    name: service.name,
                    img: supabase.storage.from('service-images').getPublicUrl(service.image_path).data.publicUrl,
                    isFeatured: service.is_featured,
                })))
            }

            setLoading(false)
        }

        fetchServices()

        return () => {
            isMounted = false
        }
    }, [])

    return { services, loading, error }
}
