import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cdoxkdzajtdsehrhjfjp.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkb3hrZHphanRkc2VocmhqZmpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2ODk0NzUsImV4cCI6MjA5NDI2NTQ3NX0.IVb5OTiGOPjoAcP7EHtv9YwxzOgr-DUfPvjBKRJ0b_M'

export const supabase = createClient(supabaseUrl, supabaseKey)