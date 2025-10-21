import { supabase, type Approval, type LandRecord } from './supabase'

export interface ApprovalWorkflow {
  recordId: string
  requiredApprovals: number
  currentApprovals: number
  pendingAdmins: string[]
  approvedAdmins: string[]
  rejectedAdmins: string[]
  status: 'pending' | 'approved' | 'rejected'
}

export class ApprovalService {
  // Get approval workflow status for a record
  async getApprovalWorkflow(recordId: string): Promise<ApprovalWorkflow | null> {
    try {
      const { data: approvals, error } = await supabase
        .from('approvals')
        .select('*')
        .eq('record_id', recordId)

      if (error) throw error

      if (!approvals || approvals.length === 0) {
        return null
      }

      const approvedAdmins = approvals
        .filter(a => a.approval_status === 'approved')
        .map(a => a.admin_id)

      const rejectedAdmins = approvals
        .filter(a => a.approval_status === 'rejected')
        .map(a => a.admin_id)

      const pendingAdmins = approvals
        .filter(a => a.approval_status === 'pending')
        .map(a => a.admin_id)

      // For this system, we require 2 approvals minimum
      const requiredApprovals = 2
      const currentApprovals = approvedAdmins.length

      let status: 'pending' | 'approved' | 'rejected' = 'pending'
      if (rejectedAdmins.length > 0) {
        status = 'rejected'
      } else if (currentApprovals >= requiredApprovals) {
        status = 'approved'
      }

      return {
        recordId,
        requiredApprovals,
        currentApprovals,
        pendingAdmins,
        approvedAdmins,
        rejectedAdmins,
        status
      }
    } catch (error) {
      console.error('❌ Failed to get approval workflow:', error)
      return null
    }
  }

  // Submit record for approval (creates approval entries for all admins)
  async submitForApproval(recordId: string): Promise<boolean> {
    try {
      // Get all admins except the one who created the record
      const { data: admins, error: adminError } = await supabase
        .from('profiles')
        .select('id, full_name, admin_department')
        .eq('role', 'admin')

      if (adminError) throw adminError

      if (!admins || admins.length < 2) {
        throw new Error('At least 2 admins required for approval workflow')
      }

      // Create approval entries for all admins
      const approvalEntries = admins.map(admin => ({
        record_id: recordId,
        admin_id: admin.id,
        admin_name: admin.full_name,
        admin_department: admin.admin_department || 'Unknown Department',
        approval_status: 'pending' as const
      }))

      const { error: insertError } = await supabase
        .from('approvals')
        .insert(approvalEntries)

      if (insertError) throw insertError

      console.log('✅ Record submitted for approval:', recordId)
      return true
    } catch (error) {
      console.error('❌ Failed to submit for approval:', error)
      return false
    }
  }

  // Process admin approval/rejection
  async processApproval(
    recordId: string,
    adminId: string,
    decision: 'approved' | 'rejected',
    comments?: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('approvals')
        .update({
          approval_status: decision,
          comments,
          approved_at: new Date().toISOString()
        })
        .eq('record_id', recordId)
        .eq('admin_id', adminId)

      if (error) throw error

      // Check if record should be marked as approved/rejected
      const workflow = await this.getApprovalWorkflow(recordId)
      if (workflow) {
        let newStatus: 'pending' | 'approved' | 'rejected' = 'pending'
        
        if (workflow.status === 'approved') {
          newStatus = 'approved'
        } else if (workflow.status === 'rejected') {
          newStatus = 'rejected'
        }

        // Update the land record status if final decision is reached
        if (newStatus !== 'pending') {
          await supabase
            .from('land_records')
            .update({ status: newStatus })
            .eq('id', recordId)
        }
      }

      console.log(`✅ Approval processed: ${decision} for record ${recordId}`)
      return true
    } catch (error) {
      console.error('❌ Failed to process approval:', error)
      return false
    }
  }

  // Get pending approvals for an admin
  async getPendingApprovals(adminId: string): Promise<(Approval & { record: LandRecord })[]> {
    try {
      const { data, error } = await supabase
        .from('approvals')
        .select(`
          *,
          record:land_records(*)
        `)
        .eq('admin_id', adminId)
        .eq('approval_status', 'pending')

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('❌ Failed to get pending approvals:', error)
      return []
    }
  }

  // Get approval history for a record
  async getApprovalHistory(recordId: string): Promise<Approval[]> {
    try {
      const { data, error } = await supabase
        .from('approvals')
        .select('*')
        .eq('record_id', recordId)
        .order('created_at', { ascending: true })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('❌ Failed to get approval history:', error)
      return []
    }
  }

  // Check if admin can approve a specific record
  async canAdminApprove(recordId: string, adminId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('approvals')
        .select('approval_status')
        .eq('record_id', recordId)
        .eq('admin_id', adminId)
        .single()

      if (error) return false

      return data?.approval_status === 'pending'
    } catch (error) {
      console.error('❌ Failed to check admin approval permission:', error)
      return false
    }
  }

  // Get approval statistics
  async getApprovalStats(adminId?: string): Promise<{
    totalPending: number
    totalApproved: number
    totalRejected: number
    recentActivity: Approval[]
  }> {
    try {
      let query = supabase.from('approvals').select('*')
      
      if (adminId) {
        query = query.eq('admin_id', adminId)
      }

      const { data, error } = await query

      if (error) throw error

      const approvals = data || []
      
      return {
        totalPending: approvals.filter(a => a.approval_status === 'pending').length,
        totalApproved: approvals.filter(a => a.approval_status === 'approved').length,
        totalRejected: approvals.filter(a => a.approval_status === 'rejected').length,
        recentActivity: approvals
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 10)
      }
    } catch (error) {
      console.error('❌ Failed to get approval stats:', error)
      return {
        totalPending: 0,
        totalApproved: 0,
        totalRejected: 0,
        recentActivity: []
      }
    }
  }
}

export const approvalService = new ApprovalService()