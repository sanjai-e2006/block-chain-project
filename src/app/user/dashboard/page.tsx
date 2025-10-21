'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type LandRecord, type Query } from '@/lib/supabase'
import { 
  FileText, 
  Plus, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Eye, 
  MessageCircle,
  AlertCircle,
  Home,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  Star,
  TrendingUp,
  Activity,
  Award,
  Target,
  User,
  HelpCircle,
  Shield,
  Zap,
  Filter,
  Download,
  FileIcon,
  MapPin,
  Users,
  FolderOpen
} from 'lucide-react'

export default function UserDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authLoading, setAuthLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  
  // Enhanced UI states
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  
  // Notification states
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [toastMessage, setToastMessage] = useState<string>('')
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info')
  
  // Core data states (preserved)
  const [landRecords, setLandRecords] = useState<LandRecord[]>([])
  const [queries, setQueries] = useState<Query[]>([])
  
  // Modal states (preserved)
  const [selectedRecord, setSelectedRecord] = useState<LandRecord | null>(null)
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [showNewQueryForm, setShowNewQueryForm] = useState(false)
  
  // Query form states (preserved)
  const [queryForm, setQueryForm] = useState({
    subject: '',
    message: '',
    category: 'general' as 'general' | 'document_issue' | 'ownership_dispute' | 'technical_support',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent'
  })
  const [queryLoading, setQueryLoading] = useState(false)

  // Search and filter states for enhanced Land Records
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [allLandRecords, setAllLandRecords] = useState<LandRecord[]>([])
  const [filteredRecords, setFilteredRecords] = useState<LandRecord[]>([])
  const [searchBy, setSearchBy] = useState<'survey' | 'location' | 'owner'>('survey')
  const [showDocuments, setShowDocuments] = useState(false)
  const [selectedRecordDocuments, setSelectedRecordDocuments] = useState<any[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(false)

  // Enhanced notification functions
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message)
    setToastType(type)
    setTimeout(() => setToastMessage(''), 4000)
  }

  const generateNotifications = () => {
    const sampleNotifications = [
      {
        id: 1,
        title: 'Query Response Received',
        message: 'Your land record query has been responded to by admin',
        type: 'success',
        time: '2 hours ago',
        read: false
      },
      {
        id: 2,
        title: 'Record Verification Update',
        message: 'Your land record is under blockchain verification',
        type: 'info',
        time: '1 day ago',
        read: false
      }
    ]
    setNotifications(sampleNotifications)
  }

  // Enhanced sidebar items
  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { id: 'records', label: 'My Properties', icon: FileText, color: 'text-green-600', bgColor: 'bg-green-50' },
    { id: 'queries', label: 'Support Tickets', icon: MessageCircle, color: 'text-purple-600', bgColor: 'bg-purple-50' },
    { id: 'help', label: 'TerraTrust Help', icon: HelpCircle, color: 'text-pink-600', bgColor: 'bg-pink-50' }
  ]

  // Core authentication check (preserved)
  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          router.push('/auth')
          return
        }

        setUser(session.user)

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (!profile) {
          router.push('/auth')
          return
        }

        if (profile.role === 'admin') {
          router.push('/admin/dashboard')
          return
        }

        setUserProfile(profile)
        setAuthLoading(false)
        
      } catch (error) {
        console.error('Auth error:', error)
        router.push('/auth')
      }
    }

    checkAuth()
  }, [router])

  // Core data loading (preserved)
  useEffect(() => {
    async function loadDashboardData() {
      if (!user) return

      try {
        setLoading(true)

        const [recordsResponse, queriesResponse, allRecordsResponse] = await Promise.all([
          // User's own records
          supabase
            .from('land_records')
            .select('*')
            .eq('created_by', user.id)
            .order('created_at', { ascending: false }),
          // User's queries
          supabase
            .from('queries')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
          // All approved public records for search functionality
          supabase
            .from('land_records')
            .select('*')
            .eq('status', 'approved')
            .order('created_at', { ascending: false })
        ])

        if (recordsResponse.data) setLandRecords(recordsResponse.data)
        if (queriesResponse.data) setQueries(queriesResponse.data)
        if (allRecordsResponse.data) {
          setAllLandRecords(allRecordsResponse.data)
          setFilteredRecords(allRecordsResponse.data)
        }

      } catch (error) {
        console.error('Error loading dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [user])

  // Enhanced search and filter functionality
  const handleSearch = (term: string) => {
    setSearchTerm(term)
    filterRecords(term, filterType, searchBy)
  }

  const filterRecords = (searchTerm: string, filterType: string, searchBy: string) => {
    let filtered = allLandRecords

    // Apply text search
    if (searchTerm) {
      filtered = filtered.filter(record => {
        switch (searchBy) {
          case 'survey':
            return record.land_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                   record.id?.toLowerCase().includes(searchTerm.toLowerCase())
          case 'location':
            return record.location?.toLowerCase().includes(searchTerm.toLowerCase())
          case 'owner':
            return record.owner_name?.toLowerCase().includes(searchTerm.toLowerCase())
          default:
            return record.land_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                   record.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                   record.owner_name?.toLowerCase().includes(searchTerm.toLowerCase())
        }
      })
    }

    // Apply property type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(record => record.property_type === filterType)
    }

    setFilteredRecords(filtered)
  }

  // Function to load documents for a specific record
  const loadRecordDocuments = async (recordId: string) => {
    setDocumentsLoading(true)
    try {
      // First try to load documents using land_record_id
      let { data: documents, error } = await supabase
        .from('document_uploads')
        .select('*')
        .eq('land_record_id', recordId)
        .eq('upload_status', 'completed')
        .order('created_at', { ascending: false })

      if (error) throw error

      // If no documents found by land_record_id, try to find by survey number/land_id
      if (!documents || documents.length === 0) {
        // Get the land record to find its land_id (survey number)
        const { data: landRecord } = await supabase
          .from('land_records')
          .select('land_id')
          .eq('id', recordId)
          .single()

        if (landRecord?.land_id) {
          // Search for documents by matching land_id patterns
          const { data: allDocs, error: allDocsError } = await supabase
            .from('document_uploads')
            .select(`
              *,
              land_record:land_records(land_id),
              request:land_record_requests(land_id)
            `)
            .eq('upload_status', 'completed')
            .order('created_at', { ascending: false })

          if (!allDocsError && allDocs) {
            // Filter documents that match the survey number
            documents = allDocs.filter(doc => {
              const landRec = doc.land_record
              const req = doc.request
              return landRec?.land_id?.includes(landRecord.land_id) || 
                     req?.land_id?.includes(landRecord.land_id)
            })
          }
        }
      }

      setSelectedRecordDocuments(documents || [])
    } catch (error) {
      console.error('Error loading documents:', error)
      showToast('Error loading documents', 'error')
      setSelectedRecordDocuments([])
    } finally {
      setDocumentsLoading(false)
    }
  }

  // Function to search documents by survey number directly
  const searchDocumentsBySurveyNumber = async (surveyNumber: string) => {
    setDocumentsLoading(true)
    try {
      console.log('Searching for documents with survey number:', surveyNumber)
      
      // First, try to get all documents to see what's available
      const { data: allDocuments, error: allDocsError } = await supabase
        .from('document_uploads')
        .select('*')
        .eq('upload_status', 'completed')

      console.log('All available documents:', allDocuments)

      if (allDocsError) {
        console.error('Error fetching all documents:', allDocsError)
        throw allDocsError
      }

      // Now try the specific query with joins
      const { data: documents, error } = await supabase
        .from('document_uploads')
        .select(`
          *,
          land_record:land_records(land_id, owner_name, created_by),
          request:land_record_requests(land_id, owner_name, requested_by)
        `)
        .eq('upload_status', 'completed')
        .order('created_at', { ascending: false })

      console.log('Documents with joins:', documents)

      if (error) {
        console.error('Error with join query:', error)
        // Use simple approach - just show all completed documents for now
        setSelectedRecordDocuments(allDocuments || [])
      } else {
        // Filter documents that match the survey number
        const filteredDocs = documents?.filter(doc => {
          const landRecord = doc.land_record
          const request = doc.request
          
          // Check if survey number matches in land_record or request
          const matchesLandRecord = landRecord?.land_id?.toLowerCase().includes(surveyNumber.toLowerCase())
          const matchesRequest = request?.land_id?.toLowerCase().includes(surveyNumber.toLowerCase())
          
          console.log('Checking document:', {
            docId: doc.id,
            landRecordId: landRecord?.land_id,
            requestId: request?.land_id,
            searchTerm: surveyNumber,
            matchesLandRecord,
            matchesRequest
          })
          
          return matchesLandRecord || matchesRequest
        }) || []

        console.log('Filtered documents:', filteredDocs)
        setSelectedRecordDocuments(filteredDocs)
      }

      // Show the documents modal
      setShowDocuments(true)
      
      const resultCount = selectedRecordDocuments.length
      if (resultCount === 0) {
        showToast(`No documents found for survey number "${surveyNumber}". Found ${allDocuments?.length || 0} total documents in system.`, 'info')
      } else {
        showToast(`Found ${resultCount} document(s) for survey ${surveyNumber}`, 'success')
      }

    } catch (error) {
      console.error('Error searching documents by survey number:', error)
      showToast('Error searching documents. Check console for details.', 'error')
      setSelectedRecordDocuments([])
    } finally {
      setDocumentsLoading(false)
    }
  }

  // Core sign out function (preserved)
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  // Core query submission function (preserved)
  const handleSubmitQuery = async (e: React.FormEvent) => {
    e.preventDefault()
    setQueryLoading(true)
    
    try {
      const { error } = await supabase
        .from('queries')
        .insert([
          {
            user_id: user.id,
            subject: queryForm.subject,
            message: queryForm.message,
            category: queryForm.category,
            priority: queryForm.priority,
            status: 'open'
          }
        ])

      if (error) throw error

      // Reset form
      setQueryForm({
        subject: '',
        message: '',
        category: 'general',
        priority: 'medium'
      })
      
      setShowNewQueryForm(false)
      showToast('Query submitted successfully!', 'success')
      
      // Reload queries
      const { data: queriesData } = await supabase
        .from('queries')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      
      if (queriesData) setQueries(queriesData)
      
    } catch (error: any) {
      console.error('Error submitting query:', error)
      showToast('Error submitting query: ' + error.message, 'error')
    } finally {
      setQueryLoading(false)
    }
  }

  // Core status functions (preserved)
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
      case 'open':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'approved':
      case 'resolved':
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
      case 'open':
        return 'bg-yellow-100 text-yellow-800'
      case 'approved':
      case 'resolved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600"></div>
      </div>
    )
  }

  if (!user || !userProfile) {
    return null
  }

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 to-green-50 flex relative">
      {/* Enhanced Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all transform ${
          toastType === 'success' ? 'bg-green-500 text-white' :
          toastType === 'error' ? 'bg-red-500 text-white' :
          'bg-blue-500 text-white'
        } animate-bounce`}>
          <div className="flex items-center space-x-2">
            {toastType === 'success' && <CheckCircle className="h-5 w-5" />}
            {toastType === 'error' && <XCircle className="h-5 w-5" />}
            {toastType === 'info' && <Bell className="h-5 w-5" />}
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Enhanced Sidebar */}
      <div className={`bg-white shadow-2xl transition-all duration-500 ease-in-out ${
        sidebarOpen ? 'w-72' : 'w-20'
      } flex flex-col relative border-r border-gray-100`}>
        
        {/* Gradient Header */}
        <div className="p-6 bg-gradient-to-r from-green-600 to-teal-700 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              {sidebarOpen && (
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-200 to-blue-200 bg-clip-text text-transparent">TerraTrust Portal</h1>
                  <p className="text-green-100 text-sm">🌍 Secure Property Registry</p>
                </div>
              )}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
          {/* Decorative Elements */}
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full"></div>
          <div className="absolute -bottom-2 -left-2 w-16 h-16 bg-white/5 rounded-full"></div>
        </div>

        {/* Enhanced Navigation */}
        <nav className="flex-1 p-6 space-y-2">
          {sidebarItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`group w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all duration-200 hover:shadow-md ${
                  activeTab === item.id
                    ? `${item.bgColor} ${item.color} shadow-lg transform scale-105`
                    : 'text-gray-700 hover:bg-gray-50 hover:shadow-sm'
                }`}
              >
                <div className={`p-2 rounded-lg ${activeTab === item.id ? 'bg-white/80' : 'bg-gray-100 group-hover:bg-gray-200'} transition-colors`}>
                  <Icon className="h-5 w-5" />
                </div>
                {sidebarOpen && (
                  <div className="flex-1">
                    <span className="font-medium">{item.label}</span>
                  </div>
                )}
                {activeTab === item.id && sidebarOpen && (
                  <div className="w-2 h-2 rounded-full bg-current opacity-60"></div>
                )}
              </button>
            )
          })}
        </nav>

        {/* Enhanced User Info Section */}
        <div className="p-6 border-t border-gray-100 bg-gradient-to-r from-gray-50 to-green-50">
          {/* Notifications */}
          {sidebarOpen && (
            <div className="mb-4 p-3 bg-white rounded-lg shadow-sm border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Notifications</span>
                <button 
                  onClick={() => {
                    generateNotifications()
                    setShowNotifications(!showNotifications)
                  }}
                  className="relative p-1 text-gray-500 hover:text-green-600 transition-colors"
                >
                  <Bell className="h-4 w-4" />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {notifications.filter(n => !n.read).length}
                    </span>
                  )}
                </button>
              </div>
              {showNotifications && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {notifications.slice(0, 3).map(notification => (
                    <div key={notification.id} className={`p-2 rounded text-xs ${
                      !notification.read ? 'bg-green-50 border-l-2 border-green-500' : 'bg-gray-50'
                    }`}>
                      <p className="font-medium text-gray-800">{notification.title}</p>
                      <p className="text-gray-600 text-xs mt-1">{notification.time}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* User Profile */}
          <div className="flex items-center space-x-3 p-3 bg-white rounded-lg shadow-sm border">
            <div className="bg-gradient-to-r from-green-500 to-teal-600 p-2 rounded-full">
              <User className="h-5 w-5 text-white" />
            </div>
            {sidebarOpen && (
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">{userProfile.full_name}</p>
                <p className="text-xs text-gray-500 flex items-center">
                  <Award className="h-3 w-3 mr-1" />
                  Citizen User
                </p>
              </div>
            )}
          </div>

          {sidebarOpen && (
            <button
              onClick={handleSignOut}
              className="w-full mt-4 flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 rounded-lg transition-all font-medium shadow-sm"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>

      {/* Enhanced Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Enhanced Header */}
        <header className="bg-white shadow-lg border-b border-gray-100 px-6 py-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-green-50 to-teal-50 opacity-50"></div>
          <div className="relative z-10 flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent capitalize flex items-center">
                {activeTab === 'dashboard' ? (
                  <>
                    <Home className="h-8 w-8 mr-3 text-green-600" />
                    Dashboard Overview
                  </>
                ) : (
                  <>
                    {sidebarItems.find(item => item.id === activeTab) && (
                      <>
                        {React.createElement(sidebarItems.find(item => item.id === activeTab)!.icon, {
                          className: `h-8 w-8 mr-3 ${sidebarItems.find(item => item.id === activeTab)!.color}`
                        })}
                        {sidebarItems.find(item => item.id === activeTab)!.label}
                      </>
                    )}
                  </>
                )}
              </h2>
              <p className="text-gray-600 mt-1">Welcome back, {userProfile.full_name}</p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search records..."
                  className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              {/* Notification Bell */}
              <button 
                onClick={() => {
                  generateNotifications()
                  showToast('Welcome to your enhanced dashboard!', 'success')
                }}
                className="relative p-2 text-gray-400 hover:text-green-600 transition-colors bg-gray-50 rounded-lg hover:bg-green-50"
              >
                <Bell className="h-6 w-6" />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {queries.filter(q => q.status === 'open').length}
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* Enhanced Content Area */}
        <main className="flex-1 overflow-auto p-6 bg-gradient-to-br from-gray-50 to-green-50">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Welcome Banner */}
              <div className="bg-gradient-to-r from-green-600 via-teal-600 to-blue-600 rounded-2xl p-8 text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-black/10"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold mb-2">Welcome to TerraTrust, {userProfile.full_name}!</h3>
                      <p className="text-green-100 mb-4">🏘️ Manage your blockchain-secured property portfolio with confidence</p>
                      <div className="flex items-center space-x-4 text-sm">
                        <div className="flex items-center">
                          <Activity className="h-4 w-4 mr-1" />
                          <span>System Status: Active</span>
                        </div>
                        <div className="flex items-center">
                          <Shield className="h-4 w-4 mr-1" />
                          <span>Records: Secure</span>
                        </div>
                      </div>
                    </div>
                    <div className="hidden md:block">
                      <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center">
                        <User className="h-16 w-16 text-white/80" />
                      </div>
                    </div>
                  </div>
                </div>
                {/* Decorative elements */}
                <div className="absolute -top-4 -right-4 w-32 h-32 bg-white/5 rounded-full"></div>
                <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white/5 rounded-full"></div>
              </div>

              {/* Enhanced Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="group bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 hover:border-green-200 transform hover:-translate-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="p-3 bg-green-100 rounded-xl group-hover:bg-green-200 transition-colors">
                        <FileText className="h-8 w-8 text-green-600" />
                      </div>
                      <p className="text-sm font-medium text-gray-600 mt-4">My Records</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">{landRecords.length}</p>
                      <div className="flex items-center mt-2 text-sm text-green-600">
                        <TrendingUp className="h-4 w-4 mr-1" />
                        <span>All secure</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="group bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 hover:border-blue-200 transform hover:-translate-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="p-3 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition-colors">
                        <MessageCircle className="h-8 w-8 text-blue-600" />
                      </div>
                      <p className="text-sm font-medium text-gray-600 mt-4">Active Queries</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">{queries.filter(q => q.status === 'open').length}</p>
                      <div className="flex items-center mt-2 text-sm text-blue-600">
                        <Target className="h-4 w-4 mr-1" />
                        <span>Pending response</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="group bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 hover:border-purple-200 transform hover:-translate-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="p-3 bg-purple-100 rounded-xl group-hover:bg-purple-200 transition-colors">
                        <CheckCircle className="h-8 w-8 text-purple-600" />
                      </div>
                      <p className="text-sm font-medium text-gray-600 mt-4">Resolved</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">{queries.filter(q => q.status === 'resolved').length}</p>
                      <div className="flex items-center mt-2 text-sm text-purple-600">
                        <Award className="h-4 w-4 mr-1" />
                        <span>Successfully completed</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="group bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 hover:border-orange-200 transform hover:-translate-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="p-3 bg-orange-100 rounded-xl group-hover:bg-orange-200 transition-colors">
                        <Star className="h-8 w-8 text-orange-600" />
                      </div>
                      <p className="text-sm font-medium text-gray-600 mt-4">Satisfaction</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">98%</p>
                      <div className="flex items-center mt-2 text-sm text-orange-600">
                        <Star className="h-4 w-4 mr-1" />
                        <span>Service rating</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                  <Zap className="h-5 w-5 mr-2 text-yellow-600" />
                  Quick Actions
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <button 
                    onClick={() => setActiveTab('records')}
                    className="p-4 bg-gradient-to-r from-green-50 to-teal-50 rounded-xl border border-green-200 hover:from-green-100 hover:to-teal-100 transition-all transform hover:scale-105"
                  >
                    <FileText className="h-6 w-6 text-green-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-green-800">View Records</p>
                  </button>
                  <button 
                    onClick={() => setActiveTab('queries')}
                    className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200 hover:from-purple-100 hover:to-pink-100 transition-all transform hover:scale-105"
                  >
                    <Plus className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-purple-800">New Query</p>
                  </button>
                  <button 
                    onClick={() => setActiveTab('help')}
                    className="p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl border border-orange-200 hover:from-orange-100 hover:to-red-100 transition-all transform hover:scale-105"
                  >
                    <HelpCircle className="h-6 w-6 text-orange-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-orange-800">Get Help</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Land Records Tab */}
          {activeTab === 'records' && (
            <div className="space-y-6">
              {/* Search and Filter Section */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                      TerraTrust Property Search
                    </h2>
                    <p className="text-gray-600 mt-1">🔍 Search blockchain-verified properties by survey number, location, or owner</p>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <FileText className="h-4 w-4" />
                    <span>{filteredRecords.length} records found</span>
                  </div>
                </div>

                {/* Search Controls */}
                <div className="grid md:grid-cols-4 gap-4">
                  {/* Search Input */}
                  <div className="md:col-span-2 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Enter survey number, location, or owner name..."
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>

                  {/* Search Type Selector */}
                  <div>
                    <select
                      value={searchBy}
                      onChange={(e) => {
                        setSearchBy(e.target.value as 'survey' | 'location' | 'owner')
                        filterRecords(searchTerm, filterType, e.target.value)
                      }}
                      className="w-full py-3 px-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="survey">Survey Number</option>
                      <option value="location">Location</option>
                      <option value="owner">Owner Name</option>
                    </select>
                  </div>

                  {/* Property Type Filter */}
                  <div>
                    <select
                      value={filterType}
                      onChange={(e) => {
                        setFilterType(e.target.value)
                        filterRecords(searchTerm, e.target.value, searchBy)
                      }}
                      className="w-full py-3 px-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="all">All Types</option>
                      <option value="residential">Residential</option>
                      <option value="commercial">Commercial</option>
                      <option value="agricultural">Agricultural</option>
                      <option value="industrial">Industrial</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Results Section */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
                <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-green-50 to-blue-50">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center">
                      <FileText className="h-5 w-5 mr-2 text-green-600" />
                      Search Results
                    </h3>
                    <div className="flex items-center space-x-3">
                      <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full">
                        {filteredRecords.length} Found
                      </span>
                      {/* Search Documents Button */}
                      {searchBy === 'survey' && searchTerm.trim() && (
                        <button
                          onClick={() => searchDocumentsBySurveyNumber(searchTerm.trim())}
                          disabled={documentsLoading}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center disabled:opacity-50"
                        >
                          <FolderOpen className="h-4 w-4 mr-1" />
                          {documentsLoading ? 'Searching...' : 'View Documents'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                    </div>
                  ) : filteredRecords.length === 0 ? (
                    <div className="text-center py-8">
                      <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No records found</h3>
                      <p className="text-gray-600">Try adjusting your search criteria or filters.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {filteredRecords.map((record) => (
                        <div key={record.id} className="bg-gradient-to-r from-white to-blue-50 border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-300 hover:border-blue-300">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center mb-2">
                                <h3 className="text-lg font-bold text-gray-900 mr-3">{record.land_id}</h3>
                                {record.blockchain_hash && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    <Shield className="h-3 w-3 mr-1" />
                                    Blockchain Secured
                                  </span>
                                )}
                              </div>
                              <div className="grid md:grid-cols-3 gap-2 text-sm text-gray-600 mb-3">
                                <p className="flex items-center">
                                  <MapPin className="h-4 w-4 mr-1 text-blue-600" />
                                  <span className="font-medium">Location:</span>&nbsp;{record.location}
                                </p>
                                <p className="flex items-center">
                                  <Users className="h-4 w-4 mr-1 text-green-600" />
                                  <span className="font-medium">Owner:</span>&nbsp;{record.owner_name}
                                </p>
                                <p className="flex items-center">
                                  <FileText className="h-4 w-4 mr-1 text-purple-600" />
                                  <span className="font-medium">Type:</span>&nbsp;{record.property_type}
                                </p>
                              </div>
                              <p className="text-xs text-gray-500">
                                Area: {record.area} sq ft • Registered: {new Date(record.registration_date).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex flex-col items-end space-y-2">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(record.status)}`}>
                                {getStatusIcon(record.status)}
                                <span className="ml-1">{record.status}</span>
                              </span>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => {
                                    setSelectedRecord(record)
                                    setShowRecordModal(true)
                                  }}
                                  className="inline-flex items-center px-3 py-1.5 border border-blue-300 shadow-sm text-xs font-medium rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  Details
                                </button>
                                <button
                                  onClick={() => {
                                    loadRecordDocuments(record.id)
                                    setSelectedRecord(record)
                                    setShowDocuments(true)
                                  }}
                                  className="inline-flex items-center px-3 py-1.5 border border-green-300 shadow-sm text-xs font-medium rounded-lg text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
                                >
                                  <FileIcon className="h-3 w-3 mr-1" />
                                  Documents
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* User's Own Records Section */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
                <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-pink-50">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center">
                      <User className="h-5 w-5 mr-2 text-purple-600" />
                      My Personal Records
                    </h3>
                    <span className="bg-purple-100 text-purple-800 text-xs font-bold px-3 py-1 rounded-full">
                      {landRecords.length} Records
                    </span>
                  </div>
                </div>
                
                <div className="p-6">
                  {landRecords.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No personal records</h3>
                      <p className="text-gray-600">You don't have any land records registered under your account yet.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {landRecords.map((record) => (
                        <div key={record.id} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow bg-gradient-to-r from-gray-50 to-purple-50">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h3 className="text-lg font-bold text-gray-900">{record.land_id}</h3>
                              <p className="text-sm text-gray-600 mt-1">{record.location}</p>
                              <p className="text-sm text-gray-600">{record.owner_name}</p>
                              <p className="text-xs text-gray-500 mt-2">
                                Area: {record.area} sq ft • Type: {record.property_type}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(record.status)}`}>
                                {getStatusIcon(record.status)}
                                <span className="ml-1">{record.status}</span>
                              </span>
                              <button
                                onClick={() => {
                                  setSelectedRecord(record)
                                  setShowRecordModal(true)
                                }}
                                className="inline-flex items-center px-3 py-1.5 border border-green-300 shadow-sm text-xs font-medium rounded-lg text-green-700 bg-green-50 hover:bg-green-100"
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                View
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Queries Tab */}
          {activeTab === 'queries' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
                <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-pink-50">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center">
                      <MessageCircle className="h-5 w-5 mr-2 text-purple-600" />
                      My Queries
                    </h2>
                    <button
                      onClick={() => setShowNewQueryForm(true)}
                      className="flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      New Query
                    </button>
                  </div>
                </div>
                
                <div className="p-6">
                  {queries.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No queries yet</h3>
                      <p className="text-gray-600 mb-4">Submit your first query to get help with land records.</p>
                      <button
                        onClick={() => setShowNewQueryForm(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700"
                      >
                        Submit Query
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {queries.map((query) => (
                        <div key={query.id} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow bg-gradient-to-r from-gray-50 to-purple-50">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h3 className="text-lg font-bold text-gray-900">{query.subject}</h3>
                              <p className="text-sm text-gray-600 mt-1">{query.message}</p>
                              <p className="text-xs text-gray-500 mt-2">
                                Category: {query.category.replace('_', ' ')} • Priority: {query.priority}
                              </p>
                              <p className="text-xs text-gray-500">
                                Submitted on {new Date(query.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(query.status)}`}>
                                {getStatusIcon(query.status)}
                                <span className="ml-1">{query.status}</span>
                              </span>
                            </div>
                          </div>
                          {query.admin_response && (
                            <div className="mt-4 p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
                              <h4 className="text-sm font-bold text-green-800 mb-2">Admin Response:</h4>
                              <p className="text-sm text-green-700">{query.admin_response}</p>
                              <p className="text-xs text-green-600 mt-2">
                                Last updated: {new Date(query.updated_at).toLocaleDateString()}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Help & Support Tab */}
          {activeTab === 'help' && (
            <div className="space-y-8">
              {/* Header Section */}
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-pink-500 to-purple-600 rounded-2xl mb-4">
                  <HelpCircle className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                  TerraTrust Support Center
                </h2>
                <p className="text-gray-600 text-lg max-w-2xl mx-auto">
                  🌍 We're here to help you navigate TerraTrust's blockchain property registry. Find answers or contact our expert support team.
                </p>
              </div>

              {/* Contact Information Cards */}
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                {/* Email Card */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6 hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                      <MessageCircle className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-bold text-gray-900">Email Support</h3>
                      <p className="text-sm text-gray-600">Send us your queries</p>
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                    <p className="text-blue-800 font-semibold break-all">sanjai020206@gmail.com</p>
                  </div>
                </div>

                {/* Phone Card */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6 hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                      <MessageCircle className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-bold text-gray-900">Phone Support</h3>
                      <p className="text-sm text-gray-600">Call us directly</p>
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                    <p className="text-green-800 font-semibold">+91 6380773890</p>
                  </div>
                </div>

                {/* Hours Card */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6 hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                      <Clock className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-bold text-gray-900">Support Hours</h3>
                      <p className="text-sm text-gray-600">We're available</p>
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                    <p className="text-purple-800 font-semibold">Mon-Fri 9AM-5PM</p>
                  </div>
                </div>
              </div>

              {/* FAQ and Quick Help Section */}
              <div className="grid lg:grid-cols-2 gap-8">
                {/* FAQ Section */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4">
                    <h3 className="text-xl font-bold text-white flex items-center">
                      <HelpCircle className="h-5 w-5 mr-2" />
                      Frequently Asked Questions
                    </h3>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100 hover:shadow-md transition-shadow">
                      <h4 className="font-bold text-gray-900 mb-2 flex items-center">
                        <FileText className="h-4 w-4 mr-2 text-blue-600" />
                        How do I view my TerraTrust properties?
                      </h4>
                      <p className="text-gray-700 text-sm leading-relaxed">
                        Navigate to the "My Properties" tab to view all your blockchain-verified assets. You can see ownership details, area, location, and cryptographic verification status.
                      </p>
                    </div>
                    
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100 hover:shadow-md transition-shadow">
                      <h4 className="font-bold text-gray-900 mb-2 flex items-center">
                        <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
                        How do I submit a query?
                      </h4>
                      <p className="text-gray-700 text-sm leading-relaxed">
                        Go to "My Queries" tab and click "New Query" to submit any questions, concerns, or requests. You can track the status and receive responses from our admin team.
                      </p>
                    </div>
                    
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100 hover:shadow-md transition-shadow">
                      <h4 className="font-bold text-gray-900 mb-2 flex items-center">
                        <Shield className="h-4 w-4 mr-2 text-purple-600" />
                        Is my TerraTrust data secure?
                      </h4>
                      <p className="text-gray-700 text-sm leading-relaxed">
                        Absolutely! TerraTrust uses advanced blockchain technology with SHA-256 cryptographic security, ensuring immutable property records that cannot be tampered with.
                      </p>
                    </div>
                    
                    <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-100 hover:shadow-md transition-shadow">
                      <h4 className="font-bold text-gray-900 mb-2 flex items-center">
                        <Bell className="h-4 w-4 mr-2 text-orange-600" />
                        How do I get notifications?
                      </h4>
                      <p className="text-gray-700 text-sm leading-relaxed">
                        You'll receive notifications for query responses, record updates, and important system announcements. Check the bell icon in the top bar.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick Actions & Resources */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
                  <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-4">
                    <h3 className="text-xl font-bold text-white flex items-center">
                      <Zap className="h-5 w-5 mr-2" />
                      Quick Actions & Resources
                    </h3>
                  </div>
                  <div className="p-6 space-y-4">
                    <button 
                      onClick={() => setActiveTab('queries')}
                      className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl p-4 hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-between group"
                    >
                      <div className="flex items-center">
                        <Plus className="h-5 w-5 mr-3" />
                        <span className="font-semibold">Submit New Query</span>
                      </div>
                      <span className="text-blue-200 group-hover:text-white transition-colors">→</span>
                    </button>
                    
                    <button 
                      onClick={() => setActiveTab('records')}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl p-4 hover:from-green-600 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-between group"
                    >
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 mr-3" />
                        <span className="font-semibold">View My Records</span>
                      </div>
                      <span className="text-green-200 group-hover:text-white transition-colors">→</span>
                    </button>
                    
                    <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-4 border border-gray-200">
                      <h4 className="font-bold text-gray-900 mb-2 flex items-center">
                        <Award className="h-4 w-4 mr-2 text-yellow-600" />
                        System Features
                      </h4>
                      <ul className="text-sm text-gray-700 space-y-1">
                        <li className="flex items-center">
                          <CheckCircle className="h-3 w-3 mr-2 text-green-600" />
                          Blockchain-secured records
                        </li>
                        <li className="flex items-center">
                          <CheckCircle className="h-3 w-3 mr-2 text-green-600" />
                          Real-time query tracking
                        </li>
                        <li className="flex items-center">
                          <CheckCircle className="h-3 w-3 mr-2 text-green-600" />
                          Multi-admin verification
                        </li>
                        <li className="flex items-center">
                          <CheckCircle className="h-3 w-3 mr-2 text-green-600" />
                          Secure document storage
                        </li>
                      </ul>
                    </div>

                    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-4 border border-yellow-200">
                      <h4 className="font-bold text-gray-900 mb-2 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-2 text-yellow-600" />
                        Need Immediate Help?
                      </h4>
                      <p className="text-sm text-gray-700 mb-3">
                        For urgent matters, please call us directly or send an email with "URGENT" in the subject line.
                      </p>
                      <div className="flex space-x-2">
                        <a 
                          href="tel:+916380773890"
                          className="flex-1 bg-green-600 text-white text-center py-2 px-3 rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold"
                        >
                          Call Now
                        </a>
                        <a 
                          href="mailto:sanjai020206@gmail.com"
                          className="flex-1 bg-blue-600 text-white text-center py-2 px-3 rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
                        >
                          Email Us
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* System Status */}
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <Activity className="h-5 w-5 mr-2 text-green-600" />
                  System Status
                </h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-100">
                    <span className="text-sm font-medium text-gray-700">Blockchain Network</span>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                      <span className="text-xs font-semibold text-green-700">Online</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <span className="text-sm font-medium text-gray-700">Database</span>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></div>
                      <span className="text-xs font-semibold text-blue-700">Operational</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-xl border border-purple-100">
                    <span className="text-sm font-medium text-gray-700">Support Team</span>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-purple-500 rounded-full mr-2 animate-pulse"></div>
                      <span className="text-xs font-semibold text-purple-700">Available</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Core Record Modal (preserved functionality) */}
      {showRecordModal && selectedRecord && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-2xl bg-white">
            <div className="mt-3">
              <div className="flex items-center mb-4">
                <FileText className="h-6 w-6 text-green-600 mr-2" />
                <h3 className="text-lg font-bold text-gray-900">Land Record Details</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Land ID</label>
                  <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-2 rounded">{selectedRecord.land_id}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedRecord.status)}`}>
                    {getStatusIcon(selectedRecord.status)}
                    <span className="ml-1">{selectedRecord.status}</span>
                  </span>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Owner</label>
                  <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-2 rounded">{selectedRecord.owner_name}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Location</label>
                  <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-2 rounded">{selectedRecord.location}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Area</label>
                    <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-2 rounded">{selectedRecord.area} sq ft</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Type</label>
                    <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-2 rounded capitalize">{selectedRecord.property_type}</p>
                  </div>
                </div>
                
                {selectedRecord.registration_date && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Registration Date</label>
                    <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-2 rounded">
                      {new Date(selectedRecord.registration_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
                
                {selectedRecord.blockchain_hash && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Blockchain Hash</label>
                    <p className="mt-1 text-sm text-gray-900 font-mono text-xs break-all bg-gray-50 p-2 rounded">
                      {selectedRecord.blockchain_hash}
                    </p>
                  </div>
                )}
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    setShowRecordModal(false)
                    setSelectedRecord(null)
                  }}
                  className="px-6 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg hover:from-gray-600 hover:to-gray-700 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Core Query Submission Modal (preserved functionality) */}
      {showNewQueryForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-2xl bg-white">
            <div className="mt-3">
              <div className="flex items-center mb-4">
                <MessageCircle className="h-6 w-6 text-purple-600 mr-2" />
                <h3 className="text-lg font-bold text-gray-900">Submit New Query</h3>
              </div>
              
              <form onSubmit={handleSubmitQuery} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Subject</label>
                  <input
                    type="text"
                    value={queryForm.subject}
                    onChange={(e) => setQueryForm({...queryForm, subject: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Category</label>
                  <select
                    value={queryForm.category}
                    onChange={(e) => setQueryForm({...queryForm, category: e.target.value as any})}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="general">General</option>
                    <option value="document_issue">Document Issue</option>
                    <option value="ownership_dispute">Ownership Dispute</option>
                    <option value="technical_support">Technical Support</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Priority</label>
                  <select
                    value={queryForm.priority}
                    onChange={(e) => setQueryForm({...queryForm, priority: e.target.value as any})}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Message</label>
                  <textarea
                    value={queryForm.message}
                    onChange={(e) => setQueryForm({...queryForm, message: e.target.value})}
                    rows={4}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowNewQueryForm(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={queryLoading}
                    className="px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 disabled:opacity-50"
                  >
                    {queryLoading ? 'Submitting...' : 'Submit Query'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Documents Modal */}
      {showDocuments && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border max-w-4xl shadow-2xl rounded-2xl bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <FileIcon className="h-6 w-6 text-green-600 mr-2" />
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Documents for {selectedRecord.land_id}</h3>
                    <p className="text-sm text-gray-600">{selectedRecord.location} • {selectedRecord.owner_name}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowDocuments(false)
                    setSelectedRecord(null)
                    setSelectedRecordDocuments([])
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              {documentsLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                </div>
              ) : selectedRecordDocuments.length === 0 ? (
                <div className="text-center py-12">
                  <FileIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Documents Found</h3>
                  <p className="text-gray-600">No documents have been uploaded for this land record yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-4 border border-green-200">
                    <h4 className="font-semibold text-gray-900 mb-2">Available Documents ({selectedRecordDocuments.length})</h4>
                    <p className="text-sm text-gray-600">Click on any document to download or view</p>
                  </div>
                  
                  <div className="grid gap-4">
                    {selectedRecordDocuments.map((doc, index) => (
                      <div key={doc.id || index} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center flex-1">
                            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center mr-4">
                              <FileIcon className="h-6 w-6 text-white" />
                            </div>
                            <div className="flex-1">
                              <h5 className="font-semibold text-gray-900">{doc.file_name}</h5>
                              <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                                <span className="capitalize">{doc.document_type || 'Document'}</span>
                                {doc.file_size && (
                                  <span>{(doc.file_size / 1024 / 1024).toFixed(2)} MB</span>
                                )}
                                <span>{new Date(doc.created_at || doc.uploaded_at).toLocaleDateString()}</span>
                              </div>
                              {doc.document_description && (
                                <p className="text-sm text-gray-600 mt-1">{doc.document_description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            {doc.public_url && (
                              <a
                                href={doc.public_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-3 py-2 border border-blue-300 shadow-sm text-sm font-medium rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </a>
                            )}
                            {doc.public_url && (
                              <a
                                href={doc.public_url}
                                download={doc.file_name}
                                className="inline-flex items-center px-3 py-2 border border-green-300 shadow-sm text-sm font-medium rounded-lg text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => {
                    setShowDocuments(false)
                    setSelectedRecord(null)
                    setSelectedRecordDocuments([])
                  }}
                  className="px-6 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg hover:from-gray-600 hover:to-gray-700 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}