import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types
export interface LandRecord {
  id: string
  land_id: string
  owner_name: string
  location: string
  area: number
  property_type: string
  registration_date: string
  status: 'pending' | 'approved' | 'rejected'
  blockchain_hash?: string
  ipfs_hash?: string
  created_at: string
  updated_at: string
}

export interface Query {
  id: string
  user_id: string
  subject: string
  message: string
  status: 'open' | 'in_progress' | 'resolved'
  category: 'general' | 'document_issue' | 'ownership_dispute' | 'technical_support'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  admin_response?: string
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string
  role: 'user' | 'admin'
  admin_department?: string
  admin_id?: string
  created_at: string
  updated_at: string
}

export interface Approval {
  id: string
  record_id: string
  admin_id: string
  admin_name: string
  admin_department: string
  approval_status: 'pending' | 'approved' | 'rejected'
  comments?: string
  approved_at?: string
  created_at: string
}

export interface BlockchainTransaction {
  id: string
  record_id: string
  transaction_hash: string
  block_number?: number
  gas_used?: number
  status: 'pending' | 'confirmed' | 'failed'
  created_at: string
}

export interface IPFSDocument {
  id: string
  record_id: string
  file_name: string
  file_type: string
  ipfs_hash: string
  file_size: number
  uploaded_by: string
  created_at: string
}