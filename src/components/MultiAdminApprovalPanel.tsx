import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { SupabaseBlockchainService } from '@/lib/supabase-blockchain'
import { landRecordsBlockchain, BlockchainUtils } from '@/lib/blockchain'
import { 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Shield, 
  AlertCircle,
  MessageSquare,
  FileText,
  Zap,
  Hash,
  Calendar,
  User
} from 'lucide-react'

interface MultiAdminApprovalPanelProps {
  userProfile: any
  onApprovalComplete?: () => void
}

export default function MultiAdminApprovalPanel({ userProfile, onApprovalComplete }: MultiAdminApprovalPanelProps) {
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processingApproval, setProcessingApproval] = useState<string | null>(null)
  const [selectedApproval, setSelectedApproval] = useState<any>(null)
  const [approvalComment, setApprovalComment] = useState('')
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve')

  useEffect(() => {
    loadPendingApprovals()
  }, [])

  const loadPendingApprovals = async () => {
    setLoading(true)
    try {
      const approvals = await SupabaseBlockchainService.getPendingMultiAdminApprovals()
      setPendingApprovals(approvals || [])
    } catch (error) {
      console.error('Error loading pending approvals:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprovalAction = async (approval: any, action: 'approve' | 'reject') => {
    setSelectedApproval(approval)
    setApprovalAction(action)
    setShowApprovalModal(true)
  }

  const submitApproval = async () => {
    if (!selectedApproval || !userProfile) return

    setProcessingApproval(selectedApproval.id)
    
    try {
      // Create admin signature
      const signatureData = {
        approvalId: selectedApproval.id,
        adminId: userProfile.id,
        adminName: userProfile.full_name,
        action: approvalAction,
        timestamp: new Date().toISOString(),
        comment: approvalComment
      }

      // Generate signature hash
      const signatureHash = BlockchainUtils.generateAdminSignature(userProfile.id, signatureData)

      // Store approval signature
      await SupabaseBlockchainService.addAdminApprovalSignature({
        multi_admin_approval_id: selectedApproval.id,
        admin_id: userProfile.id,
        admin_name: userProfile.full_name,
        approval_action: approvalAction,
        signature_hash: signatureHash,
        comments: approvalComment || undefined,
        signed_at: new Date().toISOString()
      })

      // If this was an approval and we now have enough approvals, finalize the blockchain transaction
      if (approvalAction === 'approve') {
        const updatedApproval = await SupabaseBlockchainService.getMultiAdminApprovalStatus(selectedApproval.id)
        
        if (updatedApproval && updatedApproval[0]?.approval_status === 'approved') {
          // Create final blockchain transaction
          if (selectedApproval.blockchain_transaction_id) {
            // Add final approval signature to blockchain
            const blockHash = selectedApproval.blockchain_hash
            if (blockHash) {
              landRecordsBlockchain.addAdminApproval(
                blockHash,
                userProfile.id,
                userProfile.full_name,
                'approve'
              )
            }
          }
        }
      }

      // Close modal and refresh
      setShowApprovalModal(false)
      setApprovalComment('')
      setSelectedApproval(null)
      await loadPendingApprovals()
      
      if (onApprovalComplete) {
        onApprovalComplete()
      }

    } catch (error: any) {
      console.error('Error processing approval:', error)
      alert('Error processing approval: ' + error.message)
    } finally {
      setProcessingApproval(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getProgressPercentage = (current: number, required: number) => {
    return Math.min((current / required) * 100, 100)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Multi-Admin Approval Center
          </h3>
          <p className="text-gray-600 mt-1">Review and approve blockchain transactions requiring consensus</p>
        </div>
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-2 rounded-2xl border border-indigo-200">
          <span className="text-sm font-semibold text-indigo-700">
            {pendingApprovals.length} Pending Approvals
          </span>
        </div>
      </div>

      {/* Pending Approvals List */}
      {pendingApprovals.length > 0 ? (
        <div className="space-y-6">
          {pendingApprovals.map((approval) => (
            <div key={approval.id} className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden group hover:shadow-2xl transition-all duration-300">
              {/* Header Section */}
              <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 px-6 py-4 border-b border-indigo-100/50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-xl font-bold text-gray-900">{approval.land_id}</h4>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(approval.approval_status)}`}>
                        {approval.approval_status}
                      </span>
                    </div>
                    <div className="flex items-center space-x-6 text-sm text-gray-600">
                      <span className="flex items-center">
                        <User className="h-4 w-4 mr-1" />
                        Owner: {approval.owner_name}
                      </span>
                      <span className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        {new Date(approval.created_at).toLocaleDateString()}
                      </span>
                      <span className="flex items-center">
                        <Hash className="h-4 w-4 mr-1" />
                        ID: {approval.id.substring(0, 8)}...
                      </span>
                    </div>
                  </div>
                  
                  {/* Approval Progress */}
                  <div className="text-right">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-2xl font-bold text-gray-900">
                        {approval.current_approvals}/{approval.required_approvals}
                      </span>
                      <Users className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div className="w-32 bg-gray-200 rounded-full h-2 mb-2">
                      <div 
                        className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${getProgressPercentage(approval.current_approvals, approval.required_approvals)}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-600">
                      {approval.required_approvals - approval.current_approvals} more needed
                    </p>
                  </div>
                </div>
              </div>

              {/* Content Section */}
              <div className="p-6">
                {/* Existing Signatures */}
                {approval.approval_signatures && approval.approval_signatures.length > 0 && (
                  <div className="mb-6">
                    <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                      <Shield className="h-4 w-4 mr-2 text-indigo-600" />
                      Admin Signatures ({approval.approval_signatures.length})
                    </h5>
                    <div className="space-y-2">
                      {approval.approval_signatures.map((sig: any, index: number) => (
                        <div key={index} className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-indigo-50 rounded-xl px-4 py-3 border border-indigo-100">
                          <div className="flex items-center space-x-4">
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                              sig.approval_action === 'approve' ? 'bg-green-500' : 'bg-red-500'
                            }`}>
                              {sig.approval_action === 'approve' ? 
                                <CheckCircle className="h-3 w-3 text-white" /> : 
                                <XCircle className="h-3 w-3 text-white" />
                              }
                            </div>
                            <div>
                              <span className="text-sm font-semibold text-gray-900">{sig.admin_name}</span>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                                  sig.approval_action === 'approve' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  {sig.approval_action}
                                </span>
                                {sig.comments && (
                                  <span className="text-xs text-gray-500 flex items-center">
                                    <MessageSquare className="h-3 w-3 mr-1" />
                                    Has comment
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">
                              {new Date(sig.signed_at).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-400 font-mono">
                              {sig.signature_hash.substring(0, 8)}...
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Check if current admin has already signed */}
                {(() => {
                  const hasAlreadySigned = approval.approval_signatures?.some((sig: any) => sig.admin_id === userProfile.id)
                  
                  if (hasAlreadySigned) {
                    return (
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-200">
                        <div className="flex items-center">
                          <CheckCircle className="h-5 w-5 text-blue-600 mr-3" />
                          <div>
                            <p className="text-blue-800 font-semibold">You have already signed this transaction</p>
                            <p className="text-blue-600 text-sm">Your approval has been recorded on the blockchain</p>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  if (approval.approval_status !== 'pending') {
                    return (
                      <div className={`rounded-2xl p-4 border ${
                        approval.approval_status === 'approved' ? 
                        'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' :
                        'bg-gradient-to-r from-red-50 to-pink-50 border-red-200'
                      }`}>
                        <div className="flex items-center">
                          {approval.approval_status === 'approved' ? 
                            <CheckCircle className="h-5 w-5 text-green-600 mr-3" /> :
                            <XCircle className="h-5 w-5 text-red-600 mr-3" />
                          }
                          <div>
                            <p className={`font-semibold ${
                              approval.approval_status === 'approved' ? 'text-green-800' : 'text-red-800'
                            }`}>
                              Transaction {approval.approval_status}
                            </p>
                            <p className={`text-sm ${
                              approval.approval_status === 'approved' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {approval.approval_status === 'approved' ? 
                                'All required approvals have been collected' :
                                'Transaction has been rejected by an administrator'
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  // Show action buttons for pending approvals
                  return (
                    <div className="space-y-4">
                      <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-2xl p-4 border border-yellow-200">
                        <div className="flex items-center">
                          <Clock className="h-5 w-5 text-yellow-600 mr-3" />
                          <div>
                            <p className="text-yellow-800 font-semibold">Your approval is required</p>
                            <p className="text-yellow-600 text-sm">Please review and approve or reject this transaction</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex space-x-4">
                        <button
                          onClick={() => handleApprovalAction(approval, 'approve')}
                          disabled={processingApproval === approval.id}
                          className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-4 rounded-2xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold flex items-center justify-center space-x-2"
                        >
                          <CheckCircle className="h-5 w-5" />
                          <span>Approve Transaction</span>
                        </button>
                        
                        <button
                          onClick={() => handleApprovalAction(approval, 'reject')}
                          disabled={processingApproval === approval.id}
                          className="flex-1 bg-gradient-to-r from-red-500 to-pink-600 text-white px-6 py-4 rounded-2xl hover:from-red-600 hover:to-pink-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold flex items-center justify-center space-x-2"
                        >
                          <XCircle className="h-5 w-5" />
                          <span>Reject Transaction</span>
                        </button>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-12">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-6" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Pending Approvals</h3>
            <p className="text-gray-600 mb-6">All transactions have been processed or no approvals are required.</p>
            <div className="text-sm text-gray-500 space-y-2">
              <p>• Multi-admin approvals ensure transaction security</p>
              <p>• Each admin provides a cryptographic signature</p>
              <p>• Consensus is required before blockchain finalization</p>
            </div>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedApproval && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className={`bg-gradient-to-r ${
              approvalAction === 'approve' ? 'from-green-500/10 to-emerald-500/10' : 'from-red-500/10 to-pink-500/10'
            } px-6 py-4 border-b`}>
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                {approvalAction === 'approve' ? 
                  <CheckCircle className="h-6 w-6 text-green-600 mr-3" /> :
                  <XCircle className="h-6 w-6 text-red-600 mr-3" />
                }
                {approvalAction === 'approve' ? 'Approve' : 'Reject'} Transaction
              </h3>
              <p className="text-gray-600 mt-1">Land Record: {selectedApproval.land_id}</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Comment (Optional)
                </label>
                <textarea
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  placeholder={`Reason for ${approvalAction}...`}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              <div className="bg-gradient-to-r from-gray-50 to-indigo-50 rounded-xl p-4 border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                  <Zap className="h-4 w-4 mr-2 text-indigo-600" />
                  Digital Signature Info
                </h4>
                <div className="space-y-1 text-xs text-gray-600">
                  <p>Admin: {userProfile.full_name}</p>
                  <p>Department: {userProfile.admin_department}</p>
                  <p>Action: {approvalAction}</p>
                  <p>Timestamp: {new Date().toLocaleString()}</p>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowApprovalModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={submitApproval}
                  disabled={processingApproval === selectedApproval.id}
                  className={`flex-1 px-4 py-3 text-white rounded-xl font-semibold transition-all duration-300 ${
                    approvalAction === 'approve' ?
                    'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700' :
                    'bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700'
                  }`}
                >
                  {processingApproval === selectedApproval.id ? 'Processing...' : `Confirm ${approvalAction}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}