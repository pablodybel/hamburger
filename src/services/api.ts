import { supabase } from '@/lib/supabase'
import { createSupabaseApi } from './supabaseApi'
import { createDemoApi } from './demoApi'

export const api = supabase ? createSupabaseApi(supabase) : createDemoApi()
