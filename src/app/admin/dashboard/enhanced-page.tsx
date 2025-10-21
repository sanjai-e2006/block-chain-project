'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type LandRecord, type Approval, type Query } from '@/lib/supabase'
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
  Activity
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
  const [queries, setQueries] = useState<Query[]>([])
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
      // Load all land records
      const { data: records } = await supabase
        .from('land_records')
        .select('*')
        .order('created_at', { ascending: false })

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

      // Load queries
      const { data: userQueries } = await supabase
        .from('queries')
        .select('*')
        .order('created_at', { ascending: false })

      setQueries(userQueries || [])

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

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleSubmitRecord = async (e: React.FormEvent) => {
    e.preventDefault()
    setRecordLoading(true)
    
    try {
      const { error } = await supabase
        .from('land_records')
        .insert([
          {
            land_id: recordForm.land_id,
            owner_name: recordForm.owner_name,
            location: recordForm.location,
            area: parseFloat(recordForm.area),
            property_type: recordForm.property_type,
            registration_date: recordForm.registration_date || null,
            status: 'pending',
            created_by: user.id
          }
        ])

      if (error) throw error

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
      console.error('Error creating record:', error)
      alert('Error creating record: ' + error.message)
    } finally {
      setRecordLoading(false)
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

  const sidebarItems = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'records', label: 'Land Records', icon: FileText },
    { id: 'approvals', label: 'Approvals', icon: CheckCircle },
    { id: 'queries', label: 'Queries', icon: MessageCircle },
    { id: 'blockchain', label: 'Blockchain', icon: Globe },
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
    <div className="h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className={`bg-white shadow-lg transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-16'} flex flex-col`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-md hover:bg-gray-100"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {sidebarItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeTab === item.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-5 w-5" />
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            )
          })}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-full">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            {sidebarOpen && (
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{userProfile.full_name}</p>
                <p className="text-xs text-gray-500">{userProfile.admin_department}</p>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <button
              onClick={handleSignOut}
              className="w-full mt-3 flex items-center space-x-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b px-6 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900 capitalize">
              {activeTab === 'overview' ? 'Dashboard Overview' : activeTab}
            </h2>
            <div className="flex items-center space-x-4">
              <Bell className="h-6 w-6 text-gray-400" />
              <div className="text-sm text-gray-600">
                {stats.openQueries} open queries
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <FileText className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Records</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalRecords}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <Clock className="h-8 w-8 text-yellow-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Pending</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.pendingRecords}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Approved</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.approvedRecords}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <MessageCircle className="h-8 w-8 text-purple-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Open Queries</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.openQueries}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Records */}
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Recent Land Records</h3>
                  </div>
                  <div className="p-6">
                    {landRecords.slice(0, 5).map((record) => (
                      <div key={record.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                        <div>
                          <p className="font-medium text-gray-900">{record.land_id}</p>
                          <p className="text-sm text-gray-600">{record.owner_name}</p>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                          {record.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Queries */}
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Recent Queries</h3>
                  </div>
                  <div className="p-6">
                    {queries.slice(0, 5).map((query) => (
                      <div key={query.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                        <div>
                          <p className="font-medium text-gray-900">{query.subject}</p>
                          <p className="text-sm text-gray-600 capitalize">{query.category.replace('_', ' ')}</p>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(query.status)}`}>
                          {query.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Land Records Tab */}
          {activeTab === 'records' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">All Land Records</h3>
                <button
                  onClick={() => setShowNewRecordForm(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Record
                </button>
              </div>
              
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Land ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Area</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {landRecords.map((record) => (
                      <tr key={record.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{record.land_id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.owner_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.location}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.area} sq ft</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                            {getStatusIcon(record.status)}
                            <span className="ml-1">{record.status}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => {
                              setSelectedRecord(record)
                              setShowRecordModal(true)
                            }}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Approvals Tab */}
          {activeTab === 'approvals' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Pending Approvals</h3>
              
              <div className="space-y-4">
                {pendingApprovals.map((approval) => (
                  <div key={approval.id} className="bg-white rounded-lg shadow p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">
                          Land Record: {approval.record.land_id}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          Owner: {approval.record.owner_name}
                        </p>
                        <p className="text-sm text-gray-600">
                          Location: {approval.record.location}
                        </p>
                        <p className="text-sm text-gray-600">
                          Area: {approval.record.area} sq ft
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                          Submitted: {new Date(approval.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setSelectedRecord(approval.record)
                            setShowApprovalModal(true)
                          }}
                          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                        >
                          Review
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {pendingApprovals.length === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No pending approvals</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Queries Tab */}
          {activeTab === 'queries' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">User Queries</h3>
              
              <div className="space-y-4">
                {queries.map((query) => (
                  <div key={query.id} className="bg-white rounded-lg shadow p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="text-lg font-medium text-gray-900">{query.subject}</h4>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(query.status)}`}>
                            {query.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{query.message}</p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span className="capitalize">Category: {query.category.replace('_', ' ')}</span>
                          <span className="capitalize">Priority: {query.priority}</span>
                          <span>Created: {new Date(query.created_at).toLocaleDateString()}</span>
                        </div>
                        {query.admin_response && (
                          <div className="mt-3 p-3 bg-blue-50 rounded-md">
                            <p className="text-sm font-medium text-blue-900">Your Response:</p>
                            <p className="text-sm text-blue-800 mt-1">{query.admin_response}</p>
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <button
                          onClick={() => {
                            setSelectedQuery(query)
                            setShowQueryModal(true)
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                          {query.admin_response ? 'Edit Response' : 'Respond'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {queries.length === 0 && (
                  <div className="text-center py-8">
                    <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No queries submitted</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Blockchain Tab */}
          {activeTab === 'blockchain' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Blockchain Integration</h3>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-center">
                  <Globe className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    Blockchain Features Coming Soon
                  </h4>
                  <p className="text-gray-600 mb-4">
                    Real blockchain integration with Ethereum testnet, MetaMask signing, and transaction tracking.
                  </p>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>• Ethereum testnet integration</p>
                    <p>• MetaMask wallet connection</p>
                    <p>• Digital signatures for admin actions</p>
                    <p>• Immutable transaction records</p>
                    <p>• Transaction hash verification</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Settings</h3>
              
              <div className="bg-white rounded-lg shadow p-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Admin Profile</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Full Name</label>
                    <p className="mt-1 text-sm text-gray-900">{userProfile.full_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="mt-1 text-sm text-gray-900">{userProfile.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Department</label>
                    <p className="mt-1 text-sm text-gray-900">{userProfile.admin_department}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Admin ID</label>
                    <p className="mt-1 text-sm text-gray-900">{userProfile.admin_id}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals would go here - adding in next update */}
    </div>
  )
}