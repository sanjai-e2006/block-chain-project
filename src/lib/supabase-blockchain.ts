import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Enhanced Types with Blockchain Integration
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
  blockchain_transaction_id?: string
  blockchain_verified?: boolean
  blockchain_created_at?: string
  ipfs_hash?: string
  created_at: string
  updated_at: string
  created_by?: string
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

// Blockchain-specific Types
export interface BlockchainTransaction {
  id: string
  block_index: number
  block_hash: string
  previous_hash: string
  transaction_data: any
  timestamp: string
  nonce: number
  difficulty: number
  land_record_id?: string
  created_by?: string
  created_at: string
}

export interface AdminSignature {
  id: string
  blockchain_transaction_id: string
  admin_id: string
  admin_name: string
  signature_hash: string
  action_type: 'create' | 'update' | 'approve' | 'reject'
  signed_at: string
  signature_data?: any
  created_at: string
}

export interface BlockchainValidation {
  id: string
  blockchain_transaction_id: string
  is_valid: boolean
  validation_errors?: any
  validated_at: string
  validated_by?: string
}

export interface MultiAdminApproval {
  id: string
  blockchain_transaction_id?: string
  land_record_id?: string
  required_approvals: number
  current_approvals: number
  approval_status: 'pending' | 'approved' | 'rejected'
  initiated_by?: string
  completed_at?: string
  created_at: string
}

export interface AdminApprovalSignature {
  id: string
  multi_admin_approval_id: string
  admin_id: string
  admin_name: string
  approval_action: 'approve' | 'reject'
  signature_hash: string
  comments?: string
  signed_at: string
  created_at: string
}

export interface BlockchainConfig {
  id: string
  config_key: string
  config_value: any
  description?: string
  updated_by?: string
  updated_at: string
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

// Blockchain Integration Functions
export class SupabaseBlockchainService {
  
  // Store blockchain transaction in database
  static async storeBlockchainTransaction(transaction: Omit<BlockchainTransaction, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('blockchain_transactions')
      .insert([transaction])
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // Store admin signature
  static async storeAdminSignature(signature: Omit<AdminSignature, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('admin_signatures')
      .insert([signature])
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // Create multi-admin approval workflow
  static async createMultiAdminApproval(approval: Omit<MultiAdminApproval, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('multi_admin_approvals')
      .insert([approval])
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // Add admin approval signature
  static async addAdminApprovalSignature(signature: Omit<AdminApprovalSignature, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('admin_approval_signatures')
      .insert([signature])
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // Get blockchain transaction by hash
  static async getBlockchainTransactionByHash(blockHash: string) {
    const { data, error } = await supabase
      .from('blockchain_transactions')
      .select('*')
      .eq('block_hash', blockHash)
      .single()
    
    if (error) throw error
    return data
  }

  // Get blockchain transactions for a land record
  static async getBlockchainTransactionsForRecord(landRecordId: string) {
    const { data, error } = await supabase
      .from('blockchain_transactions')
      .select(`
        *,
        admin_signatures (*)
      `)
      .eq('land_record_id', landRecordId)
      .order('block_index', { ascending: true })
    
    if (error) throw error
    return data
  }

  // Get all blockchain transactions with details
  static async getAllBlockchainTransactions() {
    const { data, error } = await supabase
      .from('blockchain_transaction_details')
      .select('*')
      .order('block_index', { ascending: false })
    
    if (error) throw error
    return data
  }

  // Get multi-admin approval status
  static async getMultiAdminApprovalStatus(approvalId?: string, landRecordId?: string) {
    let query = supabase
      .from('multi_admin_approval_status')
      .select('*')
    
    if (approvalId) {
      query = query.eq('id', approvalId)
    } else if (landRecordId) {
      query = query.eq('land_record_id', landRecordId)
    }
    
    const { data, error } = await query.order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  }

  // Get pending multi-admin approvals
  static async getPendingMultiAdminApprovals() {
    const { data, error } = await supabase
      .from('multi_admin_approval_status')
      .select('*')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  }

  // Validate blockchain chain integrity
  static async validateBlockchainIntegrity() {
    const { data: transactions, error } = await supabase
      .from('blockchain_transactions')
      .select('*')
      .order('block_index', { ascending: true })
    
    if (error) throw error
    
    // Simple validation - check if each block's previous_hash matches the previous block's hash
    for (let i = 1; i < transactions.length; i++) {
      const currentBlock = transactions[i]
      const previousBlock = transactions[i - 1]
      
      if (currentBlock.previous_hash !== previousBlock.block_hash) {
        return {
          isValid: false,
          error: `Block ${currentBlock.block_index} has invalid previous_hash`,
          invalidBlock: currentBlock
        }
      }
    }
    
    return { isValid: true, totalBlocks: transactions.length }
  }

  // Get blockchain configuration
  static async getBlockchainConfig() {
    const { data, error } = await supabase
      .from('blockchain_config')
      .select('*')
    
    if (error) throw error
    
    // Convert to key-value object
    const config: Record<string, any> = {}
    data.forEach(item => {
      config[item.config_key] = item.config_value
    })
    
    return config
  }

  // Update blockchain configuration
  static async updateBlockchainConfig(configKey: string, configValue: any, updatedBy: string) {
    const { data, error } = await supabase
      .from('blockchain_config')
      .upsert([{
        config_key: configKey,
        config_value: configValue,
        updated_by: updatedBy,
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // Get blockchain statistics
  static async getBlockchainStats() {
    const { data: transactions } = await supabase
      .from('blockchain_transactions')
      .select('id')
    
    const { data: signatures } = await supabase
      .from('admin_signatures')
      .select('id')
    
    const { data: approvals } = await supabase
      .from('multi_admin_approvals')
      .select('approval_status')
    
    const { data: recentTransactions } = await supabase
      .from('blockchain_transactions')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
    
    return {
      totalTransactions: transactions?.length || 0,
      totalSignatures: signatures?.length || 0,
      pendingApprovals: approvals?.filter(a => a.approval_status === 'pending').length || 0,
      approvedTransactions: approvals?.filter(a => a.approval_status === 'approved').length || 0,
      lastTransactionAt: recentTransactions?.[0]?.created_at || null
    }
  }

  // Create land record with blockchain integration
  static async createLandRecordWithBlockchain(
    recordData: Omit<LandRecord, 'id' | 'created_at' | 'updated_at'>,
    adminId: string,
    adminName: string
  ) {
    // Start a transaction-like operation
    try {
      // First create the land record
      const { data: landRecord, error: recordError } = await supabase
        .from('land_records')
        .insert([recordData])
        .select()
        .single()
      
      if (recordError) throw recordError

      // Create blockchain transaction
      const blockchainData = {
        recordId: landRecord.id,
        action: 'create' as const,
        newData: landRecord,
        adminId,
        adminName,
        timestamp: new Date().toISOString()
      }

      // This will be handled by the blockchain service
      return { landRecord, blockchainData }
      
    } catch (error) {
      console.error('Error creating land record with blockchain:', error)
      throw error
    }
  }

  // Update land record with blockchain integration
  static async updateLandRecordWithBlockchain(
    recordId: string,
    updates: Partial<LandRecord>,
    adminId: string,
    adminName: string
  ) {
    try {
      // Get current record
      const { data: currentRecord, error: fetchError } = await supabase
        .from('land_records')
        .select('*')
        .eq('id', recordId)
        .single()
      
      if (fetchError) throw fetchError

      // Update the record
      const { data: updatedRecord, error: updateError } = await supabase
        .from('land_records')
        .update(updates)
        .eq('id', recordId)
        .select()
        .single()
      
      if (updateError) throw updateError

      // Create blockchain transaction for the update
      const blockchainData = {
        recordId,
        action: 'update' as const,
        previousData: currentRecord,
        newData: updatedRecord,
        adminId,
        adminName,
        timestamp: new Date().toISOString()
      }

      return { updatedRecord, blockchainData }
      
    } catch (error) {
      console.error('Error updating land record with blockchain:', error)
      throw error
    }
  }
}