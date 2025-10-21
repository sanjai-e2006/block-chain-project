import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
           🏠 Land Records System
          </h1>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
            Secure, transparent, and blockchain-powered land record management system
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth"
              className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
            >
              Get Started
            </Link>
            <Link
              href="/learn-more"
              className="inline-flex items-center px-8 py-4 border-2 border-gray-300 text-lg font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-lg hover:shadow-xl transition-all duration-200"
            >
              Learn More
            </Link>
          </div>
        </div>
        
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="bg-blue-100 rounded-xl p-4 w-16 h-16 mb-6">
              <div className="text-2xl">🔒</div>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Secure & Transparent</h3>
            <p className="text-gray-600">
              Blockchain technology ensures immutable and transparent record keeping
            </p>
          </div>
          
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="bg-green-100 rounded-xl p-4 w-16 h-16 mb-6">
              <div className="text-2xl">👥</div>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Role-Based Access</h3>
            <p className="text-gray-600">
              Different access levels for citizens, officials, and administrators
            </p>
          </div>
          
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="bg-purple-100 rounded-xl p-4 w-16 h-16 mb-6">
              <div className="text-2xl">📁</div>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">IPFS Storage</h3>
            <p className="text-gray-600">
              Distributed document storage with cryptographic verification
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}