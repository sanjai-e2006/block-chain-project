import { supabase } from './supabase'
import { landRecordsBlockchain, BlockchainUtils } from './blockchain'

// Types for multi-admin approval workflow
export interface LandRecordRequest {
  id?: string
  request_type: 'create' | 'update' | 'transfer' | 'delete'
  land_id?: string
  owner_name: string
  location: string
  area?: number
  property_type?: string
  registration_date?: string
  document_urls?: string[]
  primary_document_url?: string
  requested_by: string
  requested_at?: string
  approval_status: 'pending' | 'approved' | 'rejected' | 'blockchain_created'
  required_approvals: number
  current_approvals: number
  existing_land_record_id?: string
  request_notes?: string
  rejection_reason?: string
  approved_at?: string
  rejected_at?: string
  blockchain_created_at?: string
  created_at?: string
  updated_at?: string
}

export interface RequestApproval {
  id?: string
  request_id: string
  admin_id: string
  admin_name: string
  admin_department?: string
  approval_action: 'approve' | 'reject'
  approval_comments?: string
  signature_hash: string
  signature_data?: any
  signed_at?: string
  created_at?: string
}

export interface DocumentUpload {
  id?: string
  request_id?: string
  land_record_id?: string
  file_name: string
  file_size?: number
  file_type?: string
  storage_path: string
  public_url?: string
  uploaded_by: string
  upload_status: 'pending' | 'completed' | 'failed'
  document_type: 'primary' | 'supporting' | 'legal' | 'survey' | 'other'
  document_description?: string
  created_at?: string
  updated_at?: string
}

export class MultiAdminApprovalService {
  
  // Create a new land record request (instead of immediate record)
  static async createLandRecordRequest(
    requestData: Omit<LandRecordRequest, 'id' | 'created_at' | 'updated_at' | 'approval_status' | 'current_approvals'>,
    documents: File[] = []
  ): Promise<{ request: LandRecordRequest; documentUploads: DocumentUpload[] }> {
    
    // Step 1: Create the request record
    const { data: request, error: requestError } = await supabase
      .from('land_record_requests')
      .insert([{
        ...requestData,
        approval_status: 'pending',
        current_approvals: 0,
        land_id: requestData.land_id || `LR-${Date.now()}`
      }])
      .select()
      .single()

    if (requestError) throw requestError

    // Step 2: Upload documents if provided
    const documentUploads: DocumentUpload[] = []
    
    if (documents.length > 0) {
      for (let i = 0; i < documents.length; i++) {
        const file = documents[i]
        const fileExt = file.name.split('.').pop()
        const fileName = `${request.id}/${Date.now()}_${i}.${fileExt}`
        
        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('land-documents')
          .upload(fileName, file)

        if (uploadError) {
          console.error('File upload error:', uploadError)
          continue
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('land-documents')
          .getPublicUrl(fileName)

        // Store document record
        const { data: docRecord, error: docError } = await supabase
          .from('document_uploads')
          .insert([{
            request_id: request.id,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            storage_path: fileName,
            public_url: urlData.publicUrl,
            uploaded_by: requestData.requested_by,
            upload_status: 'completed',
            document_type: i === 0 ? 'primary' : 'supporting',
            document_description: i === 0 ? 'Primary property document' : 'Supporting document'
          }])
          .select()
          .single()

        if (!docError && docRecord) {
          documentUploads.push(docRecord)
        }
      }

      // Update request with primary document URL
      if (documentUploads.length > 0) {
        await supabase
          .from('land_record_requests')
          .update({
            primary_document_url: documentUploads[0].public_url,
            document_urls: documentUploads.map(d => d.public_url)
          })
          .eq('id', request.id)
      }
    }

    // Step 3: Create notifications for other admins
    await this.createApprovalNotifications(request.id, requestData.requested_by)

    return { request, documentUploads }
  }

  // Get pending approval requests
  static async getPendingApprovalRequests(): Promise<LandRecordRequest[]> {
    const { data, error } = await supabase
      .from('land_record_requests')
      .select(`
        *,
        requester:profiles!land_record_requests_requested_by_fkey(full_name, email, admin_department),
        approvals:request_approvals(*)
      `)
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  // Submit admin approval/rejection
  static async submitAdminApproval(
    requestId: string,
    adminId: string,
    adminName: string,
    action: 'approve' | 'reject',
    comments?: string,
    adminDepartment?: string
  ): Promise<{ approvalComplete: boolean; blockchainCreated: boolean }> {
    
    // Generate digital signature
    const signatureData = {
      requestId,
      adminId,
      adminName,
      action,
      timestamp: new Date().toISOString(),
      comments: comments || ''
    }
    
    const signatureHash = BlockchainUtils.generateAdminSignature(adminId, signatureData)

    // Step 1: Store the approval
    const { data: approval, error: approvalError } = await supabase
      .from('request_approvals')
      .insert([{
        request_id: requestId,
        admin_id: adminId,
        admin_name: adminName,
        admin_department: adminDepartment,
        approval_action: action,
        approval_comments: comments,
        signature_hash: signatureHash,
        signature_data: signatureData
      }])
      .select()
      .single()

    if (approvalError) throw approvalError

    // Step 2: Update request approval count
    const { data: request, error: requestError } = await supabase
      .from('land_record_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (requestError) throw requestError

    if (action === 'reject') {
      // Reject the request
      await supabase
        .from('land_record_requests')
        .update({
          approval_status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejection_reason: comments || 'Rejected by admin approval'
        })
        .eq('id', requestId)

      return { approvalComplete: true, blockchainCreated: false }
    }

    // For approvals, check if we have enough
    const newApprovalCount = request.current_approvals + 1
    
    if (newApprovalCount >= request.required_approvals) {
      // Step 3: All approvals collected - create blockchain transaction
      await supabase
        .from('land_record_requests')
        .update({
          approval_status: 'approved',
          approved_at: new Date().toISOString(),
          current_approvals: newApprovalCount
        })
        .eq('id', requestId)

      // Step 4: Create the actual land record and blockchain transaction
      const blockchainCreated = await this.createBlockchainFromApprovedRequest(requestId)
      
      return { approvalComplete: true, blockchainCreated }
    } else {
      // Still need more approvals
      await supabase
        .from('land_record_requests')
        .update({
          current_approvals: newApprovalCount
        })
        .eq('id', requestId)

      return { approvalComplete: false, blockchainCreated: false }
    }
  }

  // Create blockchain transaction from approved request
  static async createBlockchainFromApprovedRequest(requestId: string): Promise<boolean> {
    try {
      const { data: request, error: requestError } = await supabase
        .from('land_record_requests')
        .select(`
          *,
          approvals:request_approvals(*)
        `)
        .eq('id', requestId)
        .single()

      if (requestError) throw requestError

      // Step 1: Create the actual land record
      const { data: landRecord, error: landRecordError } = await supabase
        .from('land_records')
        .insert([{
          land_id: request.land_id,
          owner_name: request.owner_name,
          location: request.location,
          area: request.area,
          property_type: request.property_type,
          registration_date: request.registration_date || new Date().toISOString().split('T')[0],
          status: 'approved',
          created_by: request.requested_by
        }])
        .select()
        .single()

      if (landRecordError) throw landRecordError

      // Step 2: Create blockchain transaction with all admin signatures
      const transaction = BlockchainUtils.createLandRecordTransaction(
        landRecord,
        request.requested_by,
        'Multi-Admin Approved'
      )

      // Step 3: Mine the block with multiple admin signatures
      const block = landRecordsBlockchain.addLandRecordTransaction(transaction)

      // Add all admin signatures to the block
      request.approvals.forEach((approval: any) => {
        block.adminSignatures.push({
          adminId: approval.admin_id,
          adminName: approval.admin_name,
          signature: approval.signature_hash,
          timestamp: approval.signed_at,
          action: approval.approval_action
        })
      })

      // Step 4: Store blockchain transaction
      const { data: storedTransaction } = await supabase
        .from('blockchain_transactions')
        .insert([{
          block_index: block.index,
          block_hash: block.hash,
          previous_hash: block.previousHash,
          transaction_data: block.data,
          timestamp: block.timestamp,
          nonce: block.nonce,
          difficulty: 2,
          land_record_id: landRecord.id,
          created_by: request.requested_by
        }])
        .select()
        .single()

      // Step 5: Store all admin signatures
      for (const approval of request.approvals) {
        await supabase
          .from('admin_signatures')
          .insert([{
            blockchain_transaction_id: storedTransaction.id,
            admin_id: approval.admin_id,
            admin_name: approval.admin_name,
            signature_hash: approval.signature_hash,
            action_type: approval.approval_action,
            signed_at: approval.signed_at,
            signature_data: approval.signature_data
          }])
      }

      // Step 6: Update request status
      await supabase
        .from('land_record_requests')
        .update({
          approval_status: 'blockchain_created',
          blockchain_created_at: new Date().toISOString(),
          existing_land_record_id: landRecord.id
        })
        .eq('id', requestId)

      // Step 7: Update document uploads to link to land record
      await supabase
        .from('document_uploads')
        .update({ land_record_id: landRecord.id })
        .eq('request_id', requestId)

      return true

    } catch (error) {
      console.error('Error creating blockchain from approved request:', error)
      return false
    }
  }

  // Create notifications for admins who need to approve
  static async createApprovalNotifications(requestId: string, requesterId: string) {
    // Get all other admins (exclude the requester)
    const { data: admins, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'admin')
      .neq('id', requesterId)

    if (error || !admins) return

    // Create notifications
    const notifications = admins.map(admin => ({
      request_id: requestId,
      admin_id: admin.id,
      notification_type: 'approval_required',
      title: 'New Land Record Approval Required',
      message: `A new land record request requires your approval before blockchain creation.`
    }))

    await supabase
      .from('approval_notifications')
      .insert(notifications)
  }

  // Get admin notifications
  static async getAdminNotifications(adminId: string) {
    const { data, error } = await supabase
      .from('approval_notifications')
      .select(`
        *,
        request:land_record_requests(*)
      `)
      .eq('admin_id', adminId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  // Mark notification as read
  static async markNotificationRead(notificationId: string) {
    await supabase
      .from('approval_notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', notificationId)
  }
}