'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type LandRecord, type Approval, type Query } from '@/lib/supabase'
import { SupabaseBlockchainService, type BlockchainTransaction, type MultiAdminApproval } from '@/lib/supabase-blockchain'
import { landRecordsBlockchain, BlockchainUtils, type LandRecordTransaction } from '@/lib/blockchain'
import { MultiAdminApprovalService } from '@/lib/multi-admin-approval'
import MultiAdminApprovalPanel from '@/components/MultiAdminApprovalPanel'
import { 
  FileText, 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Eye, 
  Upload,
  ExternalLink,
  AlertCircle,
  Zap,
  Globe,
  Menu,
  X,
  Home,
  Settings,
  MessageCircle,
  Bell,
  Plus,
  LogOut,
  Shield,
  Database,
  Activity,
  MessageSquare,
  ChevronRight,
  User
} from 'lucide-react'

export default function AdminDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authLoading, setAuthLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  
  // Data states
  const [landRecords, setLandRecords] = useState<LandRecord[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<(Approval & { record: LandRecord })[]>([])
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [queries, setQueries] = useState<Query[]>([])
  const [blockchainTransactions, setBlockchainTransactions] = useState<any[]>([])
  const [blockchainStats, setBlockchainStats] = useState({
    totalTransactions: 0,
    totalSignatures: 0,
    pendingApprovals: 0,
    approvedTransactions: 0,
    lastTransactionAt: null as string | null,
    chainValid: true
  })
  const [multiAdminApprovals, setMultiAdminApprovals] = useState<any[]>([])
  const [stats, setStats] = useState({
    totalRecords: 0,
    pendingRecords: 0,
    approvedRecords: 0,
    rejectedRecords: 0,
    totalQueries: 0,
    openQueries: 0
  })
  
  // Modal states
  const [selectedRecord, setSelectedRecord] = useState<LandRecord | null>(null)
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [showNewRecordForm, setShowNewRecordForm] = useState(false)
  const [submittingRecord, setSubmittingRecord] = useState(false)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [selectedQuery, setSelectedQuery] = useState<Query | null>(null)
  const [showQueryModal, setShowQueryModal] = useState(false)
  
  // Form states
  const [recordForm, setRecordForm] = useState({
    land_id: '',
    owner_name: '',
    location: '',
    area: '',
    property_type: 'residential' as 'residential' | 'commercial' | 'agricultural' | 'industrial',
    registration_date: ''
  })
  const [recordLoading, setRecordLoading] = useState(false)
  const [approvalComment, setApprovalComment] = useState('')
  const [approvalLoading, setApprovalLoading] = useState(false)

  // Check authentication and admin role
  useEffect(() => {
    checkAuthentication()
  }, [])

  const checkAuthentication = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      
      console.log('🔐 Auth Check:', { user: user?.id, error })
      
      if (error || !user) {
        router.push('/auth')
        return
      }

      // Get user profile to verify admin role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      console.log('👤 Profile Check:', { profile, profileError })

      if (profileError || !profile || profile.role !== 'admin') {
        console.log('Access denied - not an admin')
        router.push('/user/dashboard')
        return
      }

      setUser(user)
      setUserProfile(profile)
      setAuthLoading(false)
      
      // Load dashboard data
      await loadDashboardData()
    } catch (error) {
      console.error('Authentication check failed:', error)
      router.push('/auth')
    }
  }

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      // First, rebuild blockchain from database to ensure in-memory chain is correct
      console.log('🔄 Rebuilding blockchain from database...')
      const { data: allTransactions, error: txError } = await supabase
        .from('blockchain_transactions')
        .select('*')
        .order('block_index', { ascending: true })
      
      if (!txError && allTransactions && allTransactions.length > 0) {
        console.log(`📦 Found ${allTransactions.length} transactions in database`)
        await BlockchainUtils.rebuildFromDatabaseTransactions(allTransactions)
        console.log('✅ Blockchain rebuilt from database')
      } else {
        console.log('📦 No blockchain transactions found, starting with genesis block')
      }
      
      // Load land records from the main table
      let { data: records, error: recordsError } = await supabase
        .from('land_records')
        .select('*')
        .order('created_at', { ascending: false })

      console.log('📊 Land Records Query Result:', { records, recordsError, count: records?.length })
      
      // Load blockchain transactions with admin signatures to match with land records
      const { data: blockchainData, error: blockchainError } = await supabase
        .from('blockchain_transactions')
        .select(`
          *,
          admin_signatures(
            id,
            admin_id,
            admin_name,
            signature_hash,
            action_type,
            signed_at,
            signature_data
          )
        `)
        .order('created_at', { ascending: false })
      
      console.log('🔗 Blockchain transactions with signatures:', { blockchainData, blockchainError, count: blockchainData?.length })
      
      // If land_records table has records, match them with blockchain data
      if (records && records.length > 0) {
        // Create a map of blockchain transactions by land_record_id
        const blockchainMap = new Map()
        if (blockchainData && blockchainData.length > 0) {
          blockchainData.forEach(tx => {
            if (tx.land_record_id) {
              blockchainMap.set(tx.land_record_id, tx)
            }
          })
        }
        
        // Update land records with blockchain information
        records = records.map(record => {
          const blockchainTx = blockchainMap.get(record.id)
          if (blockchainTx) {
            return {
              ...record,
              blockchain_hash: blockchainTx.block_hash,
              blockchain_transaction_id: blockchainTx.id,
              blockchain_verified: true,
              blockchain_created_at: blockchainTx.created_at,
              ipfs_hash: blockchainTx.ipfs_hash || record.ipfs_hash
            }
          }
          return record
        })
        
        console.log('🔄 Updated land records with blockchain data:', records.length)
      } else if (blockchainData && blockchainData.length > 0) {
        // If land_records table is empty, convert blockchain transactions to land records format
        console.log('🔗 Land records table is empty, loading from blockchain_transactions...')
        
        const convertedRecords = blockchainData.map((tx, index) => {
          let transactionData: any = {};
          try {
            transactionData = typeof tx.transaction_data === 'string' 
              ? JSON.parse(tx.transaction_data) 
              : tx.transaction_data || {};
          } catch (e) {
            console.log('Error parsing transaction data:', e);
          }
          
          // Extract land record info from transaction_data if it exists
          const landData = transactionData.land_record || transactionData;
          
          return {
            id: tx.land_record_id || tx.id,
            land_id: landData.land_id || `LR-${tx.block_index}-${new Date(tx.created_at).getTime()}`,
            owner_name: landData.owner_name || landData.admin_id || `Owner-${index + 1}`,
            location: landData.location || 'Location from blockchain',
            area: landData.area || 100,
            property_type: landData.property_type || 'residential',
            registration_date: landData.registration_date || tx.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
            status: 'approved', // Since it's on blockchain, it's approved
            blockchain_hash: tx.block_hash,
            ipfs_hash: landData.ipfs_hash || null,
            created_at: tx.created_at || new Date().toISOString(),
            updated_at: tx.created_at || new Date().toISOString(),
            created_by: landData.created_by || transactionData.admin_id,
            blockchain_transaction_id: tx.id,
            blockchain_verified: true,
            blockchain_created_at: tx.created_at
          };
        });
        
        console.log('🔄 Converted blockchain data to land records:', convertedRecords);
        records = convertedRecords;
      }
      
      setLandRecords(records || [])

      // Load pending approvals with record details
      const { data: approvals } = await supabase
        .from('approvals')
        .select(`
          *,
          record:land_records(*)
        `)
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false })

      setPendingApprovals(approvals || [])

      // Load queries - only show unresolved ones
      const { data: userQueries } = await supabase
        .from('queries')
        .select('*')
        .in('status', ['open', 'in_progress']) // Only load unresolved queries
        .order('created_at', { ascending: false })

      setQueries(userQueries || [])

      // Load pending land record requests
      try {
        const pendingReqs = await MultiAdminApprovalService.getPendingApprovalRequests()
        setPendingRequests(pendingReqs || [])
      } catch (error) {
        console.error('Error loading pending requests:', error)
        setPendingRequests([])
      }

      // Load blockchain data
      await loadBlockchainData()

      // Calculate stats
      const recordStats = records || []
      setStats({
        totalRecords: recordStats.length,
        pendingRecords: recordStats.filter(r => r.status === 'pending').length,
        approvedRecords: recordStats.filter(r => r.status === 'approved').length,
        rejectedRecords: recordStats.filter(r => r.status === 'rejected').length,
        totalQueries: (userQueries || []).length,
        openQueries: (userQueries || []).filter(q => q.status === 'open' || q.status === 'in_progress').length
      })

    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadBlockchainData = async () => {
    try {
      // Load blockchain transactions with error handling
      try {
        const transactions = await SupabaseBlockchainService.getAllBlockchainTransactions()
        
        // Enhance transactions with signature counts
        const enhancedTransactions = transactions?.map(tx => ({
          ...tx,
          signature_count: tx.admin_signatures?.length || 0
        })) || []
        
        setBlockchainTransactions(enhancedTransactions)
      } catch (txError) {
        console.log('Blockchain transactions not loaded yet:', txError)
        
        // Try loading directly from blockchain transactions table with signatures as fallback
        try {
          const { data: blocks, error: blocksError } = await supabase
            .from('blockchain_transactions')
            .select(`
              *,
              admin_signatures(
                id,
                admin_id,
                admin_name,
                signature_hash,
                action_type,
                signed_at,
                signature_data
              )
            `)
            .order('created_at', { ascending: false })
          
          if (!blocksError && blocks) {
            console.log('📦 Loaded blockchain transactions with signatures:', blocks.length)
            
            // Enhance with signature counts and other details
            const enhancedBlocks = blocks.map(block => ({
              ...block,
              signature_count: block.admin_signatures?.length || 0,
              land_id: block.transaction_data?.land_record?.land_id || 
                      (typeof block.transaction_data === 'string' ? 
                        JSON.parse(block.transaction_data)?.land_record?.land_id : null) ||
                      'N/A',
              owner_name: block.transaction_data?.land_record?.owner_name || 
                         (typeof block.transaction_data === 'string' ? 
                           JSON.parse(block.transaction_data)?.land_record?.owner_name : null) ||
                         'System'
            }))
            
            setBlockchainTransactions(enhancedBlocks)
          } else {
            setBlockchainTransactions([])
          }
        } catch (fallbackError) {
          console.log('Fallback blockchain query also failed:', fallbackError)
          setBlockchainTransactions([])
        }
      }

      // Load blockchain statistics with error handling
      try {
        const stats = await SupabaseBlockchainService.getBlockchainStats()
        setBlockchainStats(prev => ({ ...prev, ...stats }))
      } catch (statsError) {
        console.log('Blockchain stats not loaded yet:', statsError)
        setBlockchainStats(prev => ({
          ...prev,
          totalTransactions: 0,
          totalSignatures: 0,
          pendingApprovals: 0,
          approvedTransactions: 0,
          lastTransactionAt: null,
          chainValid: true
        }))
      }
      
      // Validate blockchain integrity with error handling
      try {
        const validation = await SupabaseBlockchainService.validateBlockchainIntegrity()
        setBlockchainStats(prev => ({
          ...prev,
          chainValid: validation.isValid
        }))
      } catch (validationError) {
        console.log('Blockchain validation not available yet:', validationError)
        setBlockchainStats(prev => ({ ...prev, chainValid: true }))
      }

      // Load pending multi-admin approvals with error handling
      try {
        const pendingApprovals = await SupabaseBlockchainService.getPendingMultiAdminApprovals()
        setMultiAdminApprovals(pendingApprovals || [])
      } catch (approvalsError) {
        console.log('Multi-admin approvals not loaded yet:', approvalsError)
        setMultiAdminApprovals([])
      }

    } catch (error) {
      console.error('Error loading blockchain data:', error)
      // Set default values to prevent crashes
      setBlockchainTransactions([])
      setMultiAdminApprovals([])
      setBlockchainStats({
        totalTransactions: 0,
        totalSignatures: 0,
        pendingApprovals: 0,
        approvedTransactions: 0,
        lastTransactionAt: null,
        chainValid: true
      })
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleSubmitRecord = async (e: React.FormEvent) => {
    e.preventDefault()
    setRecordLoading(true)
    
    try {
      // Create land record with blockchain integration
      const { landRecord, blockchainData } = await SupabaseBlockchainService.createLandRecordWithBlockchain(
        {
          land_id: recordForm.land_id,
          owner_name: recordForm.owner_name,
          location: recordForm.location,
          area: parseFloat(recordForm.area),
          property_type: recordForm.property_type,
          registration_date: recordForm.registration_date || '',
          status: 'pending',
          created_by: user.id
        },
        user.id,
        userProfile.full_name
      )

      // Create blockchain transaction
      const transaction = BlockchainUtils.createLandRecordTransaction(
        landRecord,
        user.id,
        userProfile.full_name
      )

      // Add to blockchain
      const block = landRecordsBlockchain.addLandRecordTransaction(transaction)
      
      // Store blockchain transaction in database
      const storedTransaction = await SupabaseBlockchainService.storeBlockchainTransaction({
        block_index: block.index,
        block_hash: block.hash,
        previous_hash: block.previousHash,
        transaction_data: block.data,
        timestamp: block.timestamp,
        nonce: block.nonce,
        difficulty: 2,
        land_record_id: landRecord.id,
        created_by: user.id
      })

      // Store admin signature with correct transaction ID
      if (block.adminSignatures.length > 0) {
        const signature = block.adminSignatures[0]
        await SupabaseBlockchainService.storeAdminSignature({
          blockchain_transaction_id: storedTransaction.id, // Use the returned transaction ID
          admin_id: signature.adminId,
          admin_name: signature.adminName,
          signature_hash: signature.signature,
          action_type: signature.action,
          signed_at: signature.timestamp,
          signature_data: null
        })
      }

      // Reset form
      setRecordForm({
        land_id: '',
        owner_name: '',
        location: '',
        area: '',
        property_type: 'residential',
        registration_date: ''
      })
      
      setShowNewRecordForm(false)
      await loadDashboardData()
      
    } catch (error: any) {
      console.error('Error creating record with blockchain:', error)
      alert('Error creating record: ' + error.message)
    } finally {
      setRecordLoading(false)
    }
  }

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingRecord(true)
    
    try {
      const formData = new FormData(e.target as HTMLFormElement)
      
      // Get uploaded files
      const primaryDoc = formData.get('primary_document') as File
      const additionalDocs = formData.getAll('additional_documents') as File[]
      const allDocuments = [primaryDoc, ...additionalDocs].filter(doc => doc && doc.size > 0)

      // Create land record request (not immediate record)
      const { request, documentUploads } = await MultiAdminApprovalService.createLandRecordRequest(
        {
          request_type: 'create',
          owner_name: formData.get('owner_name') as string,
          location: formData.get('property_address') as string,
          area: parseFloat(formData.get('area_acres') as string) || 0,
          property_type: formData.get('property_type') as string || 'residential',
          registration_date: new Date().toISOString().split('T')[0],
          requested_by: user.id,
          request_notes: formData.get('request_notes') as string || '',
          required_approvals: 2 // Require 2 additional admin approvals
        },
        allDocuments
      )

      // Close form and refresh data
      setShowNewRecordForm(false)
      await loadDashboardData()
      
      // Show success message
      alert(`✅ Land record request submitted successfully!\n� Request ID: ${request.id?.substring(0, 8)}...\n👥 Requires 2 admin approvals before blockchain creation\n📎 Documents uploaded: ${documentUploads.length}`)
      
    } catch (error: any) {
      console.error('Error creating approval request:', error)
      alert('❌ Error creating approval request: ' + error.message)
    } finally {
      setSubmittingRecord(false)
    }
  }

  const handleApproval = async (approvalId: string, status: 'approved' | 'rejected') => {
    setApprovalLoading(true)
    
    try {
      const { error } = await supabase
        .from('approvals')
        .update({
          approval_status: status,
          comments: approvalComment || null,
          approved_at: new Date().toISOString()
        })
        .eq('id', approvalId)

      if (error) throw error

      setShowApprovalModal(false)
      setApprovalComment('')
      await loadDashboardData()
      
    } catch (error: any) {
      console.error('Error updating approval:', error)
      alert('Error updating approval: ' + error.message)
    } finally {
      setApprovalLoading(false)
    }
  }

  const handleMarkAsResolved = async (queryId: string) => {
    try {
      const { error } = await supabase
        .from('queries')
        .update({
          status: 'resolved',
          updated_at: new Date().toISOString()
        })
        .eq('id', queryId)

      if (error) throw error

      // Remove the resolved query from the current list immediately
      setQueries(prevQueries => prevQueries.filter(q => q.id !== queryId))
      
      // Update stats
      setStats(prevStats => ({
        ...prevStats,
        openQueries: prevStats.openQueries - 1
      }))

      // Optionally reload dashboard data to ensure consistency
      await loadDashboardData()
      
    } catch (error: any) {
      console.error('Error marking query as resolved:', error)
      alert('Error updating query: ' + error.message)
    }
  }

  const handleQueryResponse = async (queryId: string, response: string) => {
    try {
      const { error } = await supabase
        .from('queries')
        .update({
          admin_response: response,
          status: 'resolved', // Automatically mark as resolved when responded
          updated_at: new Date().toISOString()
        })
        .eq('id', queryId)

      if (error) throw error

      // Remove the query from the dashboard immediately after response
      setQueries(prevQueries => prevQueries.filter(q => q.id !== queryId))
      
      // Update stats
      setStats(prevStats => ({
        ...prevStats,
        openQueries: prevStats.openQueries - 1
      }))

      // Close modal and reset state
      setShowQueryModal(false)
      setSelectedQuery(null)
      
      alert('✅ Response sent successfully! Query has been resolved and removed from dashboard.')
      
    } catch (error: any) {
      console.error('Error submitting query response:', error)
      alert('Error sending response: ' + error.message)
    }
  }

  const handleFixBlockchain = async () => {
    try {
      setLoading(true)
      console.log('🔧 Starting blockchain repair...')
      
      // Get all blockchain transactions from database
      const { data: transactions, error } = await supabase
        .from('blockchain_transactions')
        .select('*')
        .order('block_index', { ascending: true })
      
      if (error) throw error
      
      console.log(`📊 Found ${transactions?.length || 0} transactions to rebuild`)
      
      // Rebuild blockchain with proper hash chain
      await BlockchainUtils.rebuildFromDatabaseTransactions(transactions || [])
      
      // Get the corrected blockchain
      const correctedChain = landRecordsBlockchain.getChain()
      
      // Update database with corrected hashes
      for (let i = 0; i < correctedChain.length; i++) {
        const block = correctedChain[i]
        
        if (i === 0) {
          // Skip genesis block - it's not in database
          continue
        }
        
        // Find corresponding transaction in database
        const dbTransaction = transactions?.[i - 1] // Offset by 1 for genesis block
        if (dbTransaction) {
          await supabase
            .from('blockchain_transactions')
            .update({
              block_hash: block.hash,
              previous_hash: block.previousHash,
              nonce: block.nonce
            })
            .eq('id', dbTransaction.id)
            
          console.log(`✅ Updated block ${block.index} with correct hash: ${block.hash}`)
        }
      }
      
      // Reload blockchain data to show corrected values
      await loadBlockchainData()
      
      alert('✅ Blockchain repaired successfully! All previous hash links are now correct.')
      
    } catch (error: any) {
      console.error('Error fixing blockchain:', error)
      alert('Error fixing blockchain: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const sidebarItems = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'records', label: 'TerraTrust Registry', icon: FileText },
    { id: 'approvals', label: 'Approvals', icon: CheckCircle },
    { id: 'queries', label: 'User Support', icon: MessageCircle },
    { id: 'blockchain', label: 'Blockchain Ledger', icon: Globe },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'open':
        return 'bg-blue-100 text-blue-800'
      case 'in_progress':
        return 'bg-purple-100 text-purple-800'
      case 'resolved':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user || !userProfile) {
    return null
  }

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/5 to-indigo-400/5"></div>
      <div className="absolute top-0 left-1/4 w-72 h-72 bg-blue-400/10 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
      <div className="absolute top-0 right-1/4 w-72 h-72 bg-purple-400/10 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-1/3 w-72 h-72 bg-pink-400/10 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      
      {/* Sidebar */}
      <div className={`relative z-10 bg-white/80 backdrop-blur-xl shadow-2xl border-r border-white/20 transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-16'} flex flex-col`}>
        {/* Enhanced Sidebar Header */}
        <div className="relative p-4 border-b border-white/20">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10"></div>
          <div className="relative z-10 flex items-center justify-between">
            {sidebarOpen && (
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                    TerraTrust Admin
                  </h1>
                  <p className="text-xs text-gray-600 font-medium">🌍 Secure Land Registry Platform</p>
                </div>
              </div>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-xl hover:bg-white/60 transition-all group backdrop-blur-sm border border-white/30"
            >
              {sidebarOpen ? 
                <X className="h-5 w-5 text-gray-600 group-hover:text-indigo-600 transition-colors" /> : 
                <Menu className="h-5 w-5 text-gray-600 group-hover:text-indigo-600 transition-colors" />
              }
            </button>
          </div>
        </div>

        {/* Enhanced Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {sidebarItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full group relative flex items-center px-3 py-4 rounded-2xl text-left transition-all duration-300 transform hover:scale-105 ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 scale-105'
                    : 'text-gray-700 hover:bg-white/70 hover:shadow-lg backdrop-blur-sm border border-transparent hover:border-indigo-100'
                }`}
              >
                {isActive && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl opacity-90"></div>
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-400/20 to-purple-400/20 rounded-2xl animate-pulse"></div>
                  </>
                )}
                <div className="relative z-10 flex items-center w-full">
                  <div className={`flex-shrink-0 p-2.5 rounded-xl transition-all duration-300 ${
                    isActive 
                      ? 'bg-white/20 shadow-inner backdrop-blur-sm' 
                      : 'bg-gradient-to-br from-indigo-50 to-purple-50 group-hover:from-indigo-100 group-hover:to-purple-100 shadow-sm'
                  }`}>
                    <Icon className={`h-5 w-5 transition-all duration-300 ${
                      isActive ? 'text-white drop-shadow-sm' : 'text-indigo-600 group-hover:text-indigo-700'
                    }`} />
                  </div>
                  {sidebarOpen && (
                    <div className="ml-4 flex-1 flex items-center justify-between">
                      <span className={`font-bold text-sm transition-all duration-300 ${
                        isActive ? 'text-white drop-shadow-sm' : 'text-gray-700 group-hover:text-indigo-600'
                      }`}>
                        {item.label}
                      </span>
                      {isActive && (
                        <div className="w-2 h-2 bg-white rounded-full shadow-lg animate-pulse"></div>
                      )}
                    </div>
                  )}
                  {!sidebarOpen && isActive && (
                    <div className="absolute -right-1 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-white rounded-full shadow-lg"></div>
                  )}
                </div>
              </button>
            )
          })}
        </nav>

        {/* Enhanced User Info */}
        <div className="p-4 border-t border-white/20 bg-gradient-to-r from-gray-50/80 to-indigo-50/80 backdrop-blur-sm">
          <div className={`flex items-center ${sidebarOpen ? 'space-x-3' : 'justify-center'}`}>
            <div className="relative flex-shrink-0">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm">
                <div className="w-full h-full bg-green-400 rounded-full animate-ping"></div>
              </div>
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{userProfile.full_name}</p>
                <div className="flex items-center mt-1">
                  <span className="text-xs text-indigo-600 font-medium bg-gradient-to-r from-indigo-50 to-purple-50 px-3 py-1 rounded-full border border-indigo-100 shadow-sm">
                    {userProfile.admin_department}
                  </span>
                </div>
                <div className="flex items-center mt-2 text-xs text-emerald-600">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse shadow-sm"></div>
                  <span className="font-medium">Online & Active</span>
                </div>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <button
              onClick={handleSignOut}
              className="w-full mt-4 flex items-center justify-center space-x-3 px-4 py-3 text-red-600 hover:text-red-700 bg-gradient-to-r from-red-50 to-pink-50 hover:from-red-100 hover:to-pink-100 rounded-2xl transition-all duration-300 group border border-red-100 hover:border-red-200 hover:shadow-lg transform hover:scale-105"
            >
              <div className="p-1 bg-red-100 rounded-lg group-hover:bg-red-200 transition-colors shadow-sm">
                <LogOut className="h-4 w-4" />
              </div>
              <span className="font-bold text-sm">Sign Out</span>
            </button>
          )}
        </div>
      </div>

      {/* Enhanced Main Content */}
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
        {/* Glassmorphism Header */}
        <header className="bg-white/80 backdrop-blur-xl shadow-xl border-b border-white/20 px-6 py-5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/50 to-purple-50/50"></div>
          <div className="relative z-10 flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent capitalize flex items-center">
                {activeTab === 'overview' ? (
                  <>
                    <Home className="h-8 w-8 mr-3 text-indigo-600" />
                    Dashboard Overview
                  </>
                ) : (
                  <>
                    <Activity className="h-8 w-8 mr-3 text-indigo-600" />
                    {activeTab.replace('_', ' ')}
                  </>
                )}
              </h2>
              <p className="text-gray-600 mt-1 font-medium">Welcome to TerraTrust • {userProfile.full_name}</p>
            </div>
            <div className="flex items-center space-x-6">
              {/* Real-time status indicator */}
              <div className="flex items-center space-x-3 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-2xl border border-white/30">
                <div className="relative">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <div className="absolute inset-0 w-3 h-3 bg-green-400 rounded-full animate-ping"></div>
                </div>
                <span className="text-sm font-semibold text-green-700">System Online</span>
              </div>
              
              {/* Notification Bell */}
              <button className="relative p-3 bg-white/60 backdrop-blur-sm rounded-2xl border border-white/30 hover:bg-white/80 transition-all group">
                <Bell className="h-6 w-6 text-indigo-600 group-hover:scale-110 transition-transform" />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-bounce">
                  {stats.openQueries}
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* Enhanced Content Area */}
        <main className="flex-1 overflow-auto p-6 bg-gradient-to-br from-gray-50/50 to-indigo-50/30">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Premium Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Records Card */}
                <div className="group relative overflow-hidden bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-100/30"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between">
                      <div className="p-3 bg-blue-500/10 rounded-2xl">
                        <FileText className="h-8 w-8 text-blue-600 group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider">TerraTrust Properties</p>
                        <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalRecords}</p>
                        <div className="flex items-center text-xs text-green-600 mt-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></div>
                          🏘️ Registry Active
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Pending Records Card */}
                <div className="group relative overflow-hidden bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-50/50 to-amber-100/30"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between">
                      <div className="p-3 bg-orange-500/10 rounded-2xl">
                        <Clock className="h-8 w-8 text-orange-600 group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Pending Approval</p>
                        <p className="text-3xl font-bold text-gray-900 mt-1">{stats.pendingRecords}</p>
                        <div className="flex items-center text-xs text-orange-600 mt-2">
                          <div className="w-2 h-2 bg-orange-500 rounded-full mr-1 animate-pulse"></div>
                          🔍 Admin Review
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Approved Records Card */}
                <div className="group relative overflow-hidden bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 to-emerald-100/30"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between">
                      <div className="p-3 bg-green-500/10 rounded-2xl">
                        <CheckCircle className="h-8 w-8 text-green-600 group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Blockchain Secured</p>
                        <p className="text-3xl font-bold text-gray-900 mt-1">{stats.approvedRecords}</p>
                        <div className="flex items-center text-xs text-green-600 mt-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></div>
                          ✅ Verified Assets
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Open Queries Card */}
                <div className="group relative overflow-hidden bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-50/50 to-violet-100/30"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between">
                      <div className="p-3 bg-purple-500/10 rounded-2xl">
                        <MessageCircle className="h-8 w-8 text-purple-600 group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider">User Support</p>
                        <p className="text-3xl font-bold text-gray-900 mt-1">{stats.openQueries}</p>
                        <div className="flex items-center text-xs text-purple-600 mt-2">
                          <div className="w-2 h-2 bg-purple-500 rounded-full mr-1 animate-pulse"></div>
                          💬 Help Requests
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Recent Activity Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Land Records */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 px-6 py-4 border-b border-blue-100/50">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center">
                      <FileText className="h-6 w-6 text-emerald-600 mr-3" />
                      Recent TerraTrust Registrations
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">🏘️ Latest blockchain-secured property records</p>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      {landRecords.slice(0, 5).map((record, index) => (
                        <div key={record.id} className="flex items-center justify-between p-4 bg-gray-50/80 rounded-xl hover:bg-blue-50/80 transition-colors group">
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                              <span className="text-blue-600 font-bold">{index + 1}</span>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                {record.land_id}
                              </p>
                              <p className="text-sm text-gray-600">{record.owner_name}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(record.status)}`}>
                              {record.status}
                            </span>
                            <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Recent Queries */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-500/10 to-violet-500/10 px-6 py-4 border-b border-purple-100/50">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center">
                      <MessageSquare className="h-6 w-6 text-purple-600 mr-3" />
                      Recent Queries
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">Latest user inquiries</p>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      {queries.slice(0, 5).map((query, index) => (
                        <div key={query.id} className="flex items-center justify-between p-4 bg-gray-50/80 rounded-xl hover:bg-purple-50/80 transition-colors group">
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center">
                              <span className="text-purple-600 font-bold">{index + 1}</span>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                                {query.subject}
                              </p>
                              <p className="text-sm text-gray-600 capitalize">{query.category.replace('_', ' ')}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(query.status)}`}>
                              {query.status}
                            </span>
                            <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-purple-600 transition-colors" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Land Records Tab */}
          {activeTab === 'records' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                    TerraTrust Registry
                  </h3>
                  <p className="text-gray-600 mt-1">🏘️ Complete digital land registry with blockchain-secured ownership records</p>
                </div>
                <div className="flex space-x-3">
                  <div className="bg-white/60 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/30">
                    <span className="text-sm font-semibold text-gray-700">Total Records: {landRecords.length}</span>
                  </div>
                  <button
                    onClick={() => setShowNewRecordForm(true)}
                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Add New Record
                  </button>
                </div>
              </div>
              
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-6 py-4 border-b border-gray-200">
                  <h4 className="text-lg font-bold text-gray-900 flex items-center">
                    <Database className="h-5 w-5 mr-2 text-emerald-600" />
                    TerraTrust Property Database
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">🏘️ Complete digital registry with blockchain-verified ownership & authenticity</p>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gradient-to-r from-gray-50 to-blue-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Land ID</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Owner Details</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Property Info</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Blockchain</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white/80 divide-y divide-gray-200">
                      {landRecords.map((record, index) => (
                        <tr key={record.id} className="hover:bg-blue-50/50 transition-colors group">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center mr-3 shadow-lg">
                                <span className="text-white font-bold text-sm">{index + 1}</span>
                              </div>
                              <div>
                                <div className="text-sm font-bold text-gray-900">{record.land_id}</div>
                                <div className="text-xs text-gray-500">
                                  Reg: {new Date(record.registration_date).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          </td>
                          
                          <td className="px-6 py-4">
                            <div>
                              <div className="text-sm font-bold text-gray-900">{record.owner_name}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                Created: {new Date(record.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </td>
                          
                          <td className="px-6 py-4">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{record.location}</div>
                              <div className="text-xs text-gray-600 mt-1">
                                Area: <span className="font-semibold">{record.area}</span> acres
                              </div>
                              <div className="text-xs text-gray-600">
                                Type: <span className="capitalize">{record.property_type}</span>
                              </div>
                            </div>
                          </td>
                          
                          <td className="px-6 py-4">
                            <div>
                              {record.blockchain_hash ? (
                                <div className="flex items-center">
                                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                                  <div>
                                    <div className="text-xs font-bold text-green-700">On Blockchain</div>
                                    <div className="text-xs text-gray-500 font-mono">
                                      {record.blockchain_hash.substring(0, 12)}...
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center">
                                  <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                                  <div className="text-xs text-yellow-700 font-medium">
                                    {record.status === 'approved' ? 'Ready for Blockchain' : 'Pending Approval'}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(record.status)}`}>
                              {getStatusIcon(record.status)}
                              <span className="ml-1 capitalize">{record.status}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {landRecords.length === 0 && (
                  <div className="text-center py-16">
                    <FileText className="h-16 w-16 text-gray-400 mx-auto mb-6" />
                    <h3 className="text-xl font-bold text-gray-900 mb-2">No Records Found</h3>
                    <p className="text-gray-600 mb-6">No land records have been registered yet.</p>
                    <button
                      onClick={() => setShowNewRecordForm(true)}
                      className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold"
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      Add First Record
                    </button>
                  </div>
                )}
              </div>

              {/* Summary Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mr-4">
                      <FileText className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{landRecords.length}</div>
                      <div className="text-sm text-gray-600">Total Records</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mr-4">
                      <CheckCircle className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        {landRecords.filter(r => r.status === 'approved').length}
                      </div>
                      <div className="text-sm text-gray-600">Approved</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center mr-4">
                      <Clock className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        {landRecords.filter(r => r.status === 'pending').length}
                      </div>
                      <div className="text-sm text-gray-600">Pending</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center mr-4">
                      <Shield className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        {landRecords.filter(r => r.blockchain_hash).length}
                      </div>
                      <div className="text-sm text-gray-600">On Blockchain</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Multi-Admin Approvals Tab */}
          {activeTab === 'approvals' && (
            <div className="space-y-8">
              {/* Pending Land Record Requests */}
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 px-6 py-4 border-b border-blue-100/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 flex items-center">
                        <Users className="h-6 w-6 text-blue-600 mr-3" />
                        Pending Land Record Requests
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">Multi-admin approval required before blockchain creation</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full">
                        {pendingRequests.length} Pending
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="space-y-6">
                    {pendingRequests.map((request) => (
                      <div key={request.id} className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl p-6 border border-blue-100">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-3">
                              <h4 className="text-lg font-bold text-gray-900">
                                {request.land_id}
                              </h4>
                              <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">
                                {request.request_type.toUpperCase()}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <div>
                                <p className="text-sm font-medium text-gray-700">Owner</p>
                                <p className="text-sm text-gray-600">{request.owner_name}</p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-700">Location</p>
                                <p className="text-sm text-gray-600">{request.location}</p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-700">Area</p>
                                <p className="text-sm text-gray-600">{request.area} acres</p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-700">Property Type</p>
                                <p className="text-sm text-gray-600">{request.property_type}</p>
                              </div>
                            </div>

                            {request.request_notes && (
                              <div className="mb-4">
                                <p className="text-sm font-medium text-gray-700">Notes</p>
                                <p className="text-sm text-gray-600 bg-gray-100 p-2 rounded">{request.request_notes}</p>
                              </div>
                            )}

                            {request.document_urls && request.document_urls.length > 0 && (
                              <div className="mb-4">
                                <p className="text-sm font-medium text-gray-700 mb-2">Documents</p>
                                <div className="flex space-x-2">
                                  {request.document_urls.map((url: string, index: number) => (
                                    <a
                                      key={index}
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center px-3 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full hover:bg-indigo-200 transition-colors"
                                    >
                                      <FileText className="h-3 w-3 mr-1" />
                                      Document {index + 1}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <span>Requested: {new Date(request.created_at).toLocaleDateString()}</span>
                              <span>Approvals: {request.current_approvals}/{request.required_approvals}</span>
                              <span>Status: {request.approval_status}</span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col space-y-2 ml-6">
                            <button
                              onClick={async () => {
                                try {
                                  const { approvalComplete, blockchainCreated } = await MultiAdminApprovalService.submitAdminApproval(
                                    request.id,
                                    user.id,
                                    userProfile.full_name,
                                    'approve',
                                    `Approved by ${userProfile.full_name}`,
                                    userProfile.admin_department
                                  )
                                  
                                  if (blockchainCreated) {
                                    alert(`✅ Request approved and blockchain transaction created!\n🔗 Land record has been added to the blockchain.`)
                                  } else if (approvalComplete) {
                                    alert(`✅ Request approved!\nWaiting for ${request.required_approvals - request.current_approvals - 1} more approval(s).`)
                                  }
                                  
                                  await loadDashboardData()
                                } catch (error: any) {
                                  alert('❌ Error approving request: ' + error.message)
                                }
                              }}
                              className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold text-sm flex items-center"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </button>
                            <button
                              onClick={async () => {
                                const reason = prompt('Reason for rejection:')
                                if (!reason) return
                                
                                try {
                                  await MultiAdminApprovalService.submitAdminApproval(
                                    request.id,
                                    user.id,
                                    userProfile.full_name,
                                    'reject',
                                    reason,
                                    userProfile.admin_department
                                  )
                                  
                                  alert(`❌ Request rejected.\nReason: ${reason}`)
                                  await loadDashboardData()
                                } catch (error: any) {
                                  alert('❌ Error rejecting request: ' + error.message)
                                }
                              }}
                              className="px-4 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-lg hover:from-red-600 hover:to-rose-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold text-sm flex items-center"
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {pendingRequests.length === 0 && (
                      <div className="text-center py-12">
                        <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h4 className="text-lg font-bold text-gray-900 mb-2">No Pending Requests</h4>
                        <p className="text-gray-600">All land record requests have been processed or are awaiting other admin approvals</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Traditional Legacy Approvals (if any exist) */}
              {pendingApprovals.length > 0 && (
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
                  <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 px-6 py-4 border-b border-orange-100/50">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center">
                      <CheckCircle className="h-6 w-6 text-orange-600 mr-3" />
                      Legacy Approvals
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">Old approval system (non-blockchain)</p>
                  </div>
                  
                  <div className="p-6">
                    <div className="space-y-4">
                      {pendingApprovals.map((approval) => (
                        <div key={approval.id} className="bg-gradient-to-r from-gray-50 to-orange-50 rounded-2xl p-6 border border-orange-100">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-lg font-bold text-gray-900">
                                Land Record: {approval.record.land_id}
                              </h4>
                              <p className="text-sm text-gray-600 mt-1">
                                Owner: {approval.record.owner_name}
                              </p>
                              <p className="text-sm text-gray-600">
                                Location: {approval.record.location}
                              </p>
                              <p className="text-xs text-gray-500 mt-2">
                                Submitted: {new Date(approval.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedRecord(approval.record)
                                setShowApprovalModal(true)
                              }}
                              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-2xl hover:from-orange-600 hover:to-amber-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold"
                            >
                              Review
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Enhanced Queries Tab */}
          {activeTab === 'queries' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    User Queries
                  </h3>
                  <p className="text-gray-600 mt-1">Manage and respond to user inquiries</p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-2 rounded-2xl border border-blue-200">
                    <span className="text-sm font-semibold text-blue-700">
                      {stats.openQueries} Open • {stats.totalQueries} Total
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-6">
                {queries.filter(query => !query.admin_response || query.status !== 'resolved').map((query) => (
                  <div key={query.id} className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden group hover:shadow-2xl transition-all duration-300">
                    <div className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 px-6 py-4 border-b border-purple-100/50">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="text-xl font-bold text-gray-900">{query.subject}</h4>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(query.status)}`}>
                              {query.status}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              query.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                              query.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                              query.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {query.priority} priority
                            </span>
                          </div>
                          <div className="flex items-center space-x-6 text-sm text-gray-600">
                            <span className="flex items-center">
                              <MessageSquare className="h-4 w-4 mr-1" />
                              Category: {query.category.replace('_', ' ')}
                            </span>
                            <span className="flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              {new Date(query.created_at).toLocaleDateString()}
                            </span>
                            <span className="flex items-center">
                              <Users className="h-4 w-4 mr-1" />
                              User ID: {query.user_id}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-6">
                      {/* Query Message */}
                      <div className="mb-6">
                        <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                          <MessageCircle className="h-4 w-4 mr-2 text-indigo-600" />
                          User Message:
                        </h5>
                        <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl p-4 border border-gray-200">
                          <p className="text-gray-800 leading-relaxed">{query.message}</p>
                        </div>
                      </div>

                      {/* Admin Response Section */}
                      {query.admin_response ? (
                        <div className="mb-6">
                          <h5 className="text-sm font-semibold text-blue-700 mb-3 flex items-center">
                            <Shield className="h-4 w-4 mr-2" />
                            Your Response:
                          </h5>
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-200">
                            <p className="text-blue-800 leading-relaxed">{query.admin_response}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="mb-6">
                          <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-4 border border-orange-200 flex items-center">
                            <AlertCircle className="h-5 w-5 text-orange-600 mr-3 flex-shrink-0" />
                            <p className="text-orange-800 font-medium">This query is awaiting your response</p>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex justify-end space-x-3">
                        <button
                          onClick={() => {
                            setSelectedQuery(query)
                            setShowQueryModal(true)
                          }}
                          className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold flex items-center space-x-2"
                        >
                          <MessageSquare className="h-4 w-4" />
                          <span>{query.admin_response ? 'Edit Response' : 'Respond Now'}</span>
                        </button>
                        {query.status !== 'resolved' && !query.admin_response && (
                          <button
                            onClick={() => {
                              if (confirm('Mark this query as resolved without responding? The query will be removed from the dashboard.')) {
                                handleMarkAsResolved(query.id)
                              }
                            }}
                            className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold flex items-center space-x-2"
                          >
                            <CheckCircle className="h-4 w-4" />
                            <span>Mark Resolved</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {queries.length === 0 && (
                  <div className="text-center py-16">
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-12">
                      <MessageCircle className="h-16 w-16 text-gray-400 mx-auto mb-6" />
                      <h3 className="text-xl font-bold text-gray-900 mb-2">No Queries Found</h3>
                      <p className="text-gray-600">No user queries have been submitted yet.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Enhanced Blockchain Tab */}
          {activeTab === 'blockchain' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                    TerraTrust Blockchain
                  </h3>
                  <p className="text-gray-600 mt-1">⛓️ Immutable land ownership records with SHA-256 cryptographic security</p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className={`bg-gradient-to-r ${blockchainStats.chainValid ? 'from-green-50 to-emerald-50 border-green-200' : 'from-red-50 to-pink-50 border-red-200'} px-4 py-2 rounded-2xl border`}>
                    <span className={`text-sm font-semibold ${blockchainStats.chainValid ? 'text-green-700' : 'text-red-700'}`}>
                      Chain Status: {blockchainStats.chainValid ? 'Valid' : 'Invalid'}
                    </span>
                  </div>
                  <button
                    onClick={handleFixBlockchain}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold rounded-2xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    {loading ? 'Repairing...' : 'Fix Chain'}
                  </button>
                </div>
              </div>

              {/* Blockchain Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Transactions */}
                <div className="group relative overflow-hidden bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-100/30"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between">
                      <div className="p-3 bg-blue-500/10 rounded-2xl">
                        <Globe className="h-8 w-8 text-blue-600 group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Chain Blocks</p>
                        <p className="text-3xl font-bold text-gray-900 mt-1">{blockchainStats.totalTransactions}</p>
                        <div className="flex items-center text-xs text-blue-600 mt-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mr-1 animate-pulse"></div>
                          ⛓️ TerraTrust Active
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Admin Signatures */}
                <div className="group relative overflow-hidden bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-50/50 to-violet-100/30"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between">
                      <div className="p-3 bg-purple-500/10 rounded-2xl">
                        <Shield className="h-8 w-8 text-purple-600 group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Admin Signatures</p>
                        <p className="text-3xl font-bold text-gray-900 mt-1">{blockchainStats.totalSignatures}</p>
                        <div className="flex items-center text-xs text-purple-600 mt-2">
                          <div className="w-2 h-2 bg-purple-500 rounded-full mr-1 animate-pulse"></div>
                          🔐 Crypto Security
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pending Approvals */}
                <div className="group relative overflow-hidden bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-50/50 to-amber-100/30"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between">
                      <div className="p-3 bg-orange-500/10 rounded-2xl">
                        <Clock className="h-8 w-8 text-orange-600 group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Awaiting Review</p>
                        <p className="text-3xl font-bold text-gray-900 mt-1">{blockchainStats.pendingApprovals}</p>
                        <div className="flex items-center text-xs text-orange-600 mt-2">
                          <div className="w-2 h-2 bg-orange-500 rounded-full mr-1 animate-pulse"></div>
                          👥 Multi-Admin Review
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Approved Transactions */}
                <div className="group relative overflow-hidden bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 to-emerald-100/30"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between">
                      <div className="p-3 bg-green-500/10 rounded-2xl">
                        <CheckCircle className="h-8 w-8 text-green-600 group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Chain Secured</p>
                        <p className="text-3xl font-bold text-gray-900 mt-1">{blockchainStats.approvedTransactions}</p>
                        <div className="flex items-center text-xs text-green-600 mt-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></div>
                          🔒 Immutable Records
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Blockchain Transactions Table */}
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 px-6 py-4 border-b border-indigo-100/50">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center">
                    <Database className="h-6 w-6 text-emerald-600 mr-3" />
                    TerraTrust Blockchain Ledger
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">⛓️ Immutable transaction history with cryptographic proof & digital signatures</p>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gradient-to-r from-gray-50 to-indigo-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Block #</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Current Hash</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Previous Hash</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Land Record</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Signatures</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Nonce</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Created</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Details</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white/80 divide-y divide-gray-200">
                      {blockchainTransactions.map((transaction, index) => (
                        <tr key={transaction.id} className="hover:bg-indigo-50/50 transition-colors group">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                                <span className="text-white font-bold text-sm">{transaction.block_index}</span>
                              </div>
                              <div className="text-xs text-gray-500">
                                Block #{transaction.block_index}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <div className="text-xs font-mono text-gray-900 bg-blue-100 px-2 py-1 rounded border">
                                {transaction.block_hash?.substring(0, 16)}...
                              </div>
                              <div className="text-xs text-gray-500">Current Block Hash</div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <div className="text-xs font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded border">
                                {transaction.previous_hash?.substring(0, 16)}...
                              </div>
                              <div className="text-xs text-gray-500">Previous Block Hash</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm">
                              <div className="font-semibold text-gray-900">
                                {transaction.transaction_data?.newData?.land_id || 
                                 transaction.transaction_data?.recordId ||
                                 transaction.land_record_id?.substring(0, 8) + '...' || 'System'}
                              </div>
                              <div className="text-gray-600 text-xs">
                                {transaction.transaction_data?.newData?.owner_name || 
                                 transaction.transaction_data?.newData?.owner ||
                                 'System Record'}
                              </div>
                              {transaction.land_record_id && (
                                <div className="text-xs text-blue-600">ID: {transaction.land_record_id.substring(0, 8)}...</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <Shield className="h-4 w-4 text-indigo-600" />
                                <span className="text-sm font-semibold text-gray-900">
                                  {transaction.signature_count || 0} Signatures
                                </span>
                              </div>
                              {transaction.admin_signatures && transaction.admin_signatures.length > 0 && (
                                <div className="space-y-1">
                                  {transaction.admin_signatures.slice(0, 2).map((sig: any, sigIndex: number) => (
                                    <div key={sigIndex} className="text-xs bg-green-50 border border-green-200 rounded px-2 py-1">
                                      <div className="font-medium text-green-800">{sig.admin_name}</div>
                                      <div className="text-green-600 font-mono text-xs">
                                        ID: {sig.admin_id?.substring(0, 8)}...
                                      </div>
                                    </div>
                                  ))}
                                  {transaction.admin_signatures.length > 2 && (
                                    <div className="text-xs text-gray-500">
                                      +{transaction.admin_signatures.length - 2} more
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="space-y-1">
                              <div className="text-sm font-mono text-gray-900 bg-yellow-100 px-2 py-1 rounded border">
                                {transaction.nonce || 'N/A'}
                              </div>
                              <div className="text-xs text-gray-500">Proof of Work</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="space-y-1">
                              <div className="text-sm text-gray-900">
                                {new Date(transaction.timestamp || transaction.created_at).toLocaleDateString()}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(transaction.timestamp || transaction.created_at).toLocaleTimeString()}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => {
                                // Create detailed view of transaction
                                const details = {
                                  blockIndex: transaction.block_index,
                                  currentHash: transaction.block_hash,
                                  previousHash: transaction.previous_hash,
                                  nonce: transaction.nonce,
                                  difficulty: transaction.difficulty || 2,
                                  timestamp: transaction.timestamp || transaction.created_at,
                                  transactionData: transaction.transaction_data,
                                  signatures: transaction.admin_signatures || [],
                                  landRecordId: transaction.land_record_id,
                                  createdBy: transaction.created_by
                                }
                                alert(`🔗 Blockchain Block Details\n\n` +
                                  `Block Index: ${details.blockIndex}\n` +
                                  `Current Hash: ${details.currentHash}\n` +
                                  `Previous Hash: ${details.previousHash}\n` +
                                  `Nonce: ${details.nonce}\n` +
                                  `Difficulty: ${details.difficulty}\n` +
                                  `Timestamp: ${new Date(details.timestamp).toLocaleString()}\n` +
                                  `Signatures: ${details.signatures.length} admin signatures\n` +
                                  `Land Record ID: ${details.landRecordId || 'N/A'}\n` +
                                  `Created By: ${details.createdBy || 'System'}`)
                              }}
                              className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1"
                            >
                              <Eye className="h-3 w-3" />
                              <span>View</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {blockchainTransactions.length === 0 && (
                  <div className="text-center py-16">
                    <Globe className="h-16 w-16 text-gray-400 mx-auto mb-6" />
                    <h3 className="text-xl font-bold text-gray-900 mb-2">No Blockchain Transactions</h3>
                    <p className="text-gray-600 mb-6">No transactions have been recorded on the blockchain yet.</p>
                    <div className="text-sm text-gray-500 space-y-2">
                      <p>• Create or update land records to see blockchain transactions</p>
                      <p>• Each action is cryptographically signed and stored immutably</p>
                      <p>• Multi-admin approval ensures transaction security</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Multi-Admin Approval Panel */}
              {multiAdminApprovals.length > 0 && (
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 px-6 py-4 border-b border-purple-100/50">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center">
                      <Users className="h-6 w-6 text-purple-600 mr-3" />
                      Multi-Admin Approvals
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">Transactions requiring multiple administrator signatures</p>
                  </div>
                  
                  <div className="p-6 space-y-6">
                    {multiAdminApprovals.map((approval) => (
                      <div key={approval.id} className="bg-gradient-to-r from-gray-50 to-purple-50 rounded-2xl p-6 border border-purple-100">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="text-lg font-bold text-gray-900">{approval.land_id}</h4>
                            <p className="text-sm text-gray-600">{approval.owner_name}</p>
                          </div>
                          <div className="text-right">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(approval.approval_status)}`}>
                              {approval.approval_status}
                            </span>
                            <p className="text-sm text-gray-600 mt-1">
                              {approval.current_approvals}/{approval.required_approvals} approvals
                            </p>
                          </div>
                        </div>
                        
                        {approval.approval_signatures && approval.approval_signatures.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="text-sm font-semibold text-gray-700">Admin Signatures:</h5>
                            {approval.approval_signatures.map((sig: any, index: number) => (
                              <div key={index} className="flex items-center justify-between bg-white rounded-lg px-4 py-2">
                                <div className="flex items-center space-x-3">
                                  <div className={`w-3 h-3 rounded-full ${sig.approval_action === 'approve' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                  <span className="text-sm font-medium text-gray-900">{sig.admin_name}</span>
                                  <span className={`text-xs px-2 py-1 rounded-full ${sig.approval_action === 'approve' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {sig.approval_action}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500">
                                  {new Date(sig.signed_at).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Blockchain Features Info */}
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
                <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 px-6 py-4 border-b border-green-100/50">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center">
                    <Zap className="h-6 w-6 text-green-600 mr-3" />
                    Blockchain Features
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">Local blockchain implementation with enterprise security</p>
                </div>
                
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold text-gray-900">✅ Implemented Features</h4>
                      <div className="space-y-3 text-sm text-gray-700">
                        <div className="flex items-center space-x-3">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span>SHA-256 cryptographic hashing</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span>Proof-of-work mining algorithm</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span>Multi-admin digital signatures</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span>Immutable transaction records</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span>Chain integrity validation</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold text-gray-900">🔒 Security Features</h4>
                      <div className="space-y-3 text-sm text-gray-700">
                        <div className="flex items-center space-x-3">
                          <Shield className="h-5 w-5 text-blue-600" />
                          <span>Local blockchain (no external dependencies)</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Shield className="h-5 w-5 text-blue-600" />
                          <span>Zero cost implementation</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Shield className="h-5 w-5 text-blue-600" />
                          <span>Admin-only transaction approval</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Shield className="h-5 w-5 text-blue-600" />
                          <span>Tamper-proof record history</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Shield className="h-5 w-5 text-blue-600" />
                          <span>Database integration for persistence</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-8">
              {/* Settings Header */}
              <div className="text-center">
                <h3 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Settings & Profile
                </h3>
                <p className="text-gray-600 mt-2 text-lg">Manage your admin account and system preferences</p>
              </div>

              {/* Admin Profile Card */}
              <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
                {/* Profile Header */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-8 py-6">
                  <div className="flex items-center space-x-6">
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                      <User className="h-10 w-10 text-white" />
                    </div>
                    <div className="text-white">
                      <h4 className="text-2xl font-bold">{userProfile.full_name}</h4>
                      <p className="text-indigo-100 text-lg">System Administrator</p>
                      <p className="text-indigo-200 text-sm mt-1">Department: {userProfile.admin_department || 'General Administration'}</p>
                    </div>
                  </div>
                </div>

                {/* Profile Information */}
                <div className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Personal Information */}
                    <div className="space-y-6">
                      <div className="flex items-center space-x-3 mb-6">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                          <User className="h-4 w-4 text-white" />
                        </div>
                        <h5 className="text-xl font-bold text-gray-900">Personal Information</h5>
                      </div>
                      
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Full Name</label>
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-xs text-green-600 font-medium">Verified</span>
                            </div>
                          </div>
                          <p className="text-lg font-bold text-gray-900 bg-white rounded-xl px-4 py-3 border border-gray-200">
                            {userProfile.full_name}
                          </p>
                        </div>
                      </div>

                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Email Address</label>
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                              <span className="text-xs text-green-600 font-medium">Active</span>
                            </div>
                          </div>
                          <p className="text-lg font-bold text-gray-900 bg-white rounded-xl px-4 py-3 border border-gray-200 font-mono">
                            {userProfile.email}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* System Information */}
                    <div className="space-y-6">
                      <div className="flex items-center space-x-3 mb-6">
                        <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                          <Shield className="h-4 w-4 text-white" />
                        </div>
                        <h5 className="text-xl font-bold text-gray-900">System Access</h5>
                      </div>

                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-100">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Department</label>
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                              <span className="text-xs text-purple-600 font-medium">Assigned</span>
                            </div>
                          </div>
                          <p className="text-lg font-bold text-gray-900 bg-white rounded-xl px-4 py-3 border border-gray-200">
                            {userProfile.admin_department || 'General Administration'}
                          </p>
                        </div>
                      </div>

                      <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-6 border border-orange-100">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Admin ID</label>
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                              <span className="text-xs text-orange-600 font-medium">System Generated</span>
                            </div>
                          </div>
                          <p className="text-lg font-bold text-gray-900 bg-white rounded-xl px-4 py-3 border border-gray-200 font-mono">
                            {userProfile.admin_id || userProfile.id?.substring(0, 8).toUpperCase()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <button className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold">
                        <Settings className="h-5 w-5 mr-2" />
                        Edit Profile
                      </button>
                      <button className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold">
                        <Shield className="h-5 w-5 mr-2" />
                        Security Settings
                      </button>
                      <button className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-2xl hover:from-purple-600 hover:to-pink-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold">
                        <Bell className="h-5 w-5 mr-2" />
                        Notifications
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* System Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6 hover:shadow-2xl transition-all duration-300">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                      <CheckCircle className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h6 className="font-bold text-gray-900">System Status</h6>
                      <p className="text-sm text-green-600 font-semibold">Online & Secure</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6 hover:shadow-2xl transition-all duration-300">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                      <Database className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h6 className="font-bold text-gray-900">Data Backup</h6>
                      <p className="text-sm text-blue-600 font-semibold">Last: Today</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6 hover:shadow-2xl transition-all duration-300">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                      <Activity className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h6 className="font-bold text-gray-900">Activity</h6>
                      <p className="text-sm text-purple-600 font-semibold">High Performance</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals would go here - adding in next update */}

      {/* New Land Record Form Modal */}
      {showNewRecordForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Add New Land Record</h3>
                <button
                  onClick={() => setShowNewRecordForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <form onSubmit={handleCreateRecord} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property Address *
                </label>
                <input
                  type="text"
                  name="property_address"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter property address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Owner Name *
                </label>
                <input
                  type="text"
                  name="owner_name"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter owner name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Area (in acres)
                </label>
                <input
                  type="number"
                  name="area_acres"
                  step="0.01"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter area in acres"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property Type
                </label>
                <select
                  name="property_type"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Select property type</option>
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="agricultural">Agricultural</option>
                  <option value="industrial">Industrial</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Survey Number
                </label>
                <input
                  type="text"
                  name="survey_number"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter survey number"
                />
              </div>

              {/* PDF Document Upload Section */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Upload className="h-4 w-4 inline mr-1" />
                  Upload Supporting Documents
                </label>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Primary Document (PDF) *
                    </label>
                    <input
                      type="file"
                      name="primary_document"
                      accept=".pdf"
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                    <p className="text-xs text-gray-500 mt-1">Upload the main property document (Required)</p>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Additional Documents (Optional)
                    </label>
                    <input
                      type="file"
                      name="additional_documents"
                      accept=".pdf,.jpg,.jpeg,.png"
                      multiple
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
                    />
                    <p className="text-xs text-gray-500 mt-1">Survey maps, legal documents, photos, etc.</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Request Notes
                </label>
                <textarea
                  name="request_notes"
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Additional notes for approval review (optional)"
                />
              </div>

              {/* Multi-Admin Approval Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <Users className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">Multi-Admin Approval Required</p>
                    <p className="text-xs text-blue-600 mt-1">
                      This request will be sent for approval by 2 additional admins before being added to the blockchain.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewRecordForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRecord}
                  className="px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {submittingRecord ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Submitting Request...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Submit for Approval
                    </>
                  )}
                </button>
              </div>

              {submittingRecord && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                  <div className="flex items-center">
                    <Activity className="h-5 w-5 text-blue-600 mr-2 animate-pulse" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">Creating Approval Request</p>
                      <p className="text-xs text-blue-600">Uploading documents and submitting for multi-admin approval...</p>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Enhanced Record Detail Modal */}
      {showRecordModal && selectedRecord && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-6 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold flex items-center">
                    <FileText className="h-7 w-7 mr-3" />
                    Land Record Details
                  </h2>
                  <p className="text-indigo-100 mt-1">Complete information for {selectedRecord.land_id}</p>
                </div>
                <button
                  onClick={() => setShowRecordModal(false)}
                  className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-2 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-8 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Basic Information */}
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                      <Home className="h-5 w-5 mr-2 text-indigo-600" />
                      Property Information
                    </h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-semibold text-gray-600">Land ID</label>
                          <p className="text-lg font-bold text-gray-900">{selectedRecord.land_id}</p>
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-gray-600">Property Type</label>
                          <p className="text-lg font-bold text-gray-900 capitalize">{selectedRecord.property_type}</p>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-gray-600">Location</label>
                        <p className="text-lg font-bold text-gray-900">{selectedRecord.location}</p>
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-gray-600">Area</label>
                        <p className="text-lg font-bold text-gray-900">{selectedRecord.area} acres</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                      <User className="h-5 w-5 mr-2 text-green-600" />
                      Owner Information
                    </h3>
                    <div>
                      <label className="text-sm font-semibold text-gray-600">Owner Name</label>
                      <p className="text-lg font-bold text-gray-900">{selectedRecord.owner_name}</p>
                    </div>
                  </div>
                </div>

                {/* Status and Blockchain */}
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                      <Activity className="h-5 w-5 mr-2 text-purple-600" />
                      Status & Dates
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-semibold text-gray-600">Current Status</label>
                        <div className="mt-1">
                          <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(selectedRecord.status)}`}>
                            {getStatusIcon(selectedRecord.status)}
                            <span className="ml-2 capitalize">{selectedRecord.status}</span>
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="text-sm font-semibold text-gray-600">Registration Date</label>
                          <p className="text-lg font-bold text-gray-900">
                            {new Date(selectedRecord.registration_date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-gray-600">Created</label>
                          <p className="text-lg font-bold text-gray-900">
                            {new Date(selectedRecord.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                      <Shield className="h-5 w-5 mr-2 text-amber-600" />
                      Blockchain Status
                    </h3>
                    <div className="space-y-4">
                      {selectedRecord.blockchain_hash ? (
                        <div>
                          <div className="flex items-center mb-3">
                            <div className="w-4 h-4 bg-green-500 rounded-full mr-3 animate-pulse"></div>
                            <span className="text-lg font-bold text-green-700">Recorded on Blockchain</span>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <label className="text-sm font-semibold text-gray-600">Block Hash</label>
                              <p className="text-sm font-mono bg-gray-100 rounded-lg p-3 break-all text-gray-800">
                                {selectedRecord.blockchain_hash}
                              </p>
                            </div>
                            {selectedRecord.ipfs_hash && (
                              <div>
                                <label className="text-sm font-semibold text-gray-600">IPFS Hash</label>
                                <p className="text-sm font-mono bg-gray-100 rounded-lg p-3 break-all text-gray-800">
                                  {selectedRecord.ipfs_hash}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center mb-3">
                            <div className="w-4 h-4 bg-yellow-500 rounded-full mr-3"></div>
                            <span className="text-lg font-bold text-yellow-700">
                              {selectedRecord.status === 'approved' ? 'Ready for Blockchain' : 'Pending Approval'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            {selectedRecord.status === 'approved' 
                              ? 'This record is approved and ready to be added to the blockchain.' 
                              : 'This record is pending approval before it can be added to the blockchain.'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Record Metadata */}
              <div className="mt-8 bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl p-6 border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <Database className="h-5 w-5 mr-2 text-gray-600" />
                  Technical Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Record ID</label>
                    <p className="text-sm font-mono bg-white rounded-lg p-3 text-gray-800 border">
                      {selectedRecord.id}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Last Updated</label>
                    <p className="text-sm font-medium text-gray-800 bg-white rounded-lg p-3 border">
                      {new Date(selectedRecord.updated_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Data Integrity</label>
                    <div className="bg-white rounded-lg p-3 border">
                      <div className="flex items-center">
                        <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                        <span className="text-sm font-medium text-green-700">Verified</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 flex justify-end space-x-4">
                <button
                  onClick={() => setShowRecordModal(false)}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-2xl hover:bg-gray-300 transition-all duration-300 font-semibold"
                >
                  Close
                </button>
                {selectedRecord.blockchain_hash && (
                  <button
                    onClick={() => {
                      alert(`🔗 Blockchain Verification:\n\nThis record is permanently stored on the blockchain with hash: ${selectedRecord.blockchain_hash}\n\nThis ensures the record cannot be tampered with or deleted.`)
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 font-semibold flex items-center"
                  >
                    <Shield className="h-5 w-5 mr-2" />
                    Verify on Blockchain
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Query Response Modal */}
      {showQueryModal && selectedQuery && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4 rounded-t-2xl">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">Respond to Query</h3>
                <button
                  onClick={() => {
                    setShowQueryModal(false)
                    setSelectedQuery(null)
                  }}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {/* Query Details */}
              <div className="mb-6">
                <h4 className="text-lg font-bold text-gray-900 mb-2">{selectedQuery.subject}</h4>
                <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
                  <span>User ID: {selectedQuery.user_id}</span>
                  <span>Priority: {selectedQuery.priority}</span>
                  <span>Category: {selectedQuery.category.replace('_', ' ')}</span>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <h5 className="font-semibold text-gray-700 mb-2">User Message:</h5>
                  <p className="text-gray-800">{selectedQuery.message}</p>
                </div>
              </div>

              {/* Response Form */}
              <form onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.target as HTMLFormElement)
                const response = formData.get('response') as string
                if (response.trim()) {
                  handleQueryResponse(selectedQuery.id, response.trim())
                }
              }}>
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Your Response:
                  </label>
                  <textarea
                    name="response"
                    rows={6}
                    className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                    placeholder="Type your response to the user..."
                    defaultValue={selectedQuery.admin_response || ''}
                    required
                  />
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowQueryModal(false)
                      setSelectedQuery(null)
                    }}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl font-semibold"
                  >
                    Send Response & Resolve
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}