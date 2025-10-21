'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function SupabaseTest() {
  const [testResults, setTestResults] = useState<any>({})
  
  useEffect(() => {
    testSupabaseConnection()
  }, [])
  
  const testSupabaseConnection = async () => {
    const results: any = {}
    
    try {
      // Test 1: Check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      results.auth = { user: user?.id, error: authError?.message }
      
      // Test 2: Check profile
      if (user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        results.profile = { profile, error: profileError?.message }
      }
      
      // Test 3: Raw count query
      const { count, error: countError } = await supabase
        .from('land_records')
        .select('*', { count: 'exact', head: true })
      results.count = { count, error: countError?.message }
      
      // Test 4: Raw select query
      const { data: records, error: recordsError } = await supabase
        .from('land_records')
        .select('*')
        .limit(5)
      results.records = { 
        count: records?.length || 0, 
        records: records?.slice(0, 2), 
        error: recordsError?.message 
      }
      
      // Test 5: Query with different filters
      const { data: approvedRecords, error: approvedError } = await supabase
        .from('land_records')
        .select('*')
        .eq('status', 'approved')
        .limit(5)
      results.approved = { 
        count: approvedRecords?.length || 0, 
        error: approvedError?.message 
      }
      
    } catch (error: any) {
      results.globalError = error.message
    }
    
    setTestResults(results)
  }
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Supabase Connection Test</h1>
      
      <div className="space-y-4">
        {Object.entries(testResults).map(([key, value]: [string, any]) => (
          <div key={key} className="bg-gray-100 rounded-lg p-4">
            <h3 className="font-semibold text-lg mb-2 capitalize">{key}</h3>
            <pre className="text-sm bg-white p-3 rounded border overflow-auto">
              {JSON.stringify(value, null, 2)}
            </pre>
          </div>
        ))}
      </div>
      
      <button 
        onClick={testSupabaseConnection}
        className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Retest Connection
      </button>
    </div>
  )
}