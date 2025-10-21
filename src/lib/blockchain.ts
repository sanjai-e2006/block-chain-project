import crypto from 'crypto'

// Block structure for our blockchain
export interface Block {
  index: number
  timestamp: string
  data: any
  previousHash: string
  hash: string
  adminSignatures: AdminSignature[]
  nonce: number
}

export interface AdminSignature {
  adminId: string
  adminName: string
  signature: string
  timestamp: string
  action: 'create' | 'update' | 'approve' | 'reject'
}

export interface LandRecordTransaction {
  recordId: string
  action: 'create' | 'update' | 'approve' | 'reject'
  previousData?: any
  newData: any
  adminId: string
  adminName: string
  timestamp: string
}

export class LandRecordsBlockchain {
  private chain: Block[]
  private difficulty: number = 2

  constructor() {
    this.chain = [this.createGenesisBlock()]
  }

  private createGenesisBlock(): Block {
    const fixedTimestamp = "2025-01-01T00:00:00.000Z"
    const genesisData = {
      message: "Land Records Blockchain Genesis Block",
      system: "Land Management System v1.0",
      timestamp: fixedTimestamp
    }
    
    const genesisBlock: Block = {
      index: 0,
      timestamp: fixedTimestamp,
      data: genesisData,
      previousHash: "0",
      hash: "",
      adminSignatures: [],
      nonce: 0
    }
    
    // Mine the genesis block to ensure it starts with "00"
    genesisBlock.hash = this.calculateHash(
      genesisBlock.index,
      genesisBlock.timestamp,
      genesisBlock.data,
      genesisBlock.previousHash,
      genesisBlock.nonce
    )
    
    // Mine the genesis block with proper difficulty
    return this.mineBlock(genesisBlock)
  }

  private calculateHash(index: number, timestamp: string, data: any, previousHash: string, nonce: number): string {
    const blockString = index + timestamp + JSON.stringify(data) + previousHash + nonce
    return crypto.createHash('sha256').update(blockString).digest('hex')
  }

  // Test function to demonstrate identical data creates different hashes
  testIdenticalDataHashes(): void {
    console.log('🧪 Testing identical data with different hashes...\n')
    
    // Same land record data
    const identicalData = {
      land_id: 'LR-SAME001',
      owner_name: 'John Doe',
      location: 'Same Location',
      area: 100,
      property_type: 'residential'
    }
    
    // Create two blocks with identical data but different timestamps
    const time1 = new Date().toISOString()
    
    // Wait a tiny bit for different timestamp
    setTimeout(() => {
      const time2 = new Date().toISOString()
      
      // Block 1 with identical data
      const hash1 = this.calculateHash(
        1,                    // index
        time1,               // timestamp 1
        identicalData,       // SAME DATA
        "00abc123def456",    // previous hash
        0                    // nonce
      )
      
      // Block 2 with identical data but different timestamp
      const hash2 = this.calculateHash(
        1,                    // SAME index
        time2,               // timestamp 2 (different!)
        identicalData,       // SAME DATA
        "00abc123def456",    // SAME previous hash
        0                    // SAME nonce
      )
      
      console.log('Identical Data Test Results:')
      console.log(`Data: ${JSON.stringify(identicalData)}`)
      console.log(`Timestamp 1: ${time1}`)
      console.log(`Timestamp 2: ${time2}`)
      console.log(`Hash 1: ${hash1}`)
      console.log(`Hash 2: ${hash2}`)
      console.log(`Hashes are different: ${hash1 !== hash2}`)
      console.log(`Time difference: ${new Date(time2).getTime() - new Date(time1).getTime()}ms\n`)
    }, 1)
  }

  // Check for hash collisions (should never happen!)
  checkForHashCollisions(): { hasCollisions: boolean, collisions: any[] } {
    const hashMap = new Map<string, number>()
    const collisions: any[] = []
    
    this.chain.forEach((block, index) => {
      if (hashMap.has(block.hash)) {
        collisions.push({
          hash: block.hash,
          firstBlock: hashMap.get(block.hash),
          secondBlock: index,
          blockData: {
            first: this.chain[hashMap.get(block.hash)!],
            second: block
          }
        })
      } else {
        hashMap.set(block.hash, index)
      }
    })
    
    if (collisions.length > 0) {
      console.log('🚨 CRITICAL: Hash collisions detected!')
      collisions.forEach(collision => {
        console.log(`   Blocks ${collision.firstBlock} and ${collision.secondBlock} have same hash: ${collision.hash}`)
      })
    } else {
      console.log('✅ No hash collisions detected - blockchain secure!')
    }
    
    return { hasCollisions: collisions.length > 0, collisions }
  }

  getLatestBlock(): Block {
    const latest = this.chain[this.chain.length - 1]
    console.log(`🔍 Getting latest block - Index: ${latest.index}, Hash: ${latest.hash}`)
    return latest
  }

  private mineBlock(block: Block): Block {
    const target = "0".repeat(this.difficulty)
    console.log(`⛏️ Mining block ${block.index} with difficulty ${this.difficulty} (target: ${target})`)
    
    const startTime = Date.now()
    
    while (block.hash.substring(0, this.difficulty) !== target) {
      block.nonce++
      block.hash = this.calculateHash(
        block.index,
        block.timestamp,
        block.data,
        block.previousHash,
        block.nonce
      )
      
      // Log progress every 100 attempts
      if (block.nonce % 100 === 0) {
        console.log(`   Nonce: ${block.nonce}, Hash: ${block.hash.substring(0, 20)}...`)
      }
    }
    
    const endTime = Date.now()
    const miningTime = endTime - startTime
    
    console.log(`✅ Block ${block.index} mined successfully!`)
    console.log(`   Final nonce: ${block.nonce}`)
    console.log(`   Final hash: ${block.hash}`)
    console.log(`   Mining time: ${miningTime}ms`)
    console.log(`   Hash starts with: ${block.hash.substring(0, this.difficulty)}`)
    
    return block
  }

  createAdminSignature(adminId: string, adminName: string, action: 'create' | 'update' | 'approve' | 'reject', blockData: any): AdminSignature {
    const signatureData = {
      adminId,
      adminName,
      action,
      blockData: JSON.stringify(blockData)
    }
    
    const signature = crypto
      .createHash('sha256')
      .update(JSON.stringify(signatureData))
      .digest('hex')

    return {
      adminId,
      adminName,
      signature,
      timestamp: new Date().toISOString(),
      action
    }
  }

  addLandRecordTransaction(transaction: LandRecordTransaction): Block {
    const latestBlock = this.getLatestBlock()
    
    console.log('🔍 BLOCKCHAIN DEBUG - Adding new transaction:')
    console.log(`   Chain length: ${this.chain.length}`)
    console.log(`   Latest block index: ${latestBlock.index}`)
    console.log(`   Latest block hash: ${latestBlock.hash}`)
    console.log(`   New block will have previousHash: ${latestBlock.hash}`)
    
    const adminSignature = this.createAdminSignature(
      transaction.adminId,
      transaction.adminName,
      transaction.action,
      transaction
    )

    const newBlock: Block = {
      index: latestBlock.index + 1,
      timestamp: new Date().toISOString(),
      data: transaction,
      previousHash: latestBlock.hash,
      hash: "",
      adminSignatures: [adminSignature],
      nonce: 0
    }

    console.log(`   New block created:`)
    console.log(`     Index: ${newBlock.index}`)
    console.log(`     Previous hash: ${newBlock.previousHash}`)
    console.log(`     Expected previous hash: ${latestBlock.hash}`)
    console.log(`     Match: ${newBlock.previousHash === latestBlock.hash}`)

    newBlock.hash = this.calculateHash(
      newBlock.index,
      newBlock.timestamp,
      newBlock.data,
      newBlock.previousHash,
      newBlock.nonce
    )

    const minedBlock = this.mineBlock(newBlock)
    
    console.log(`   Block after mining:`)
    console.log(`     Final hash: ${minedBlock.hash}`)
    console.log(`     Final previous hash: ${minedBlock.previousHash}`)
    console.log(`     Previous hash still matches: ${minedBlock.previousHash === latestBlock.hash}`)
    
    this.chain.push(minedBlock)
    
    // Verify chain integrity after adding
    const chainValid = this.isChainValid()
    console.log(`   Chain valid after adding: ${chainValid}`)
    
    return minedBlock
  }

  addAdminApproval(blockHash: string, adminId: string, adminName: string, action: 'approve' | 'reject'): boolean {
    const block = this.chain.find(b => b.hash === blockHash)
    
    if (!block) {
      throw new Error("Block not found")
    }

    const existingSignature = block.adminSignatures.find(sig => sig.adminId === adminId)
    if (existingSignature) {
      throw new Error("Admin has already signed this block")
    }

    const adminSignature = this.createAdminSignature(adminId, adminName, action, block.data)
    block.adminSignatures.push(adminSignature)

    return true
  }

  isChainValid(): boolean {
    console.log(`🔍 Validating blockchain with ${this.chain.length} blocks...`)
    
    // First check for hash collisions
    const collisionCheck = this.checkForHashCollisions()
    if (collisionCheck.hasCollisions) {
      console.log('❌ Blockchain invalid due to hash collisions!')
      return false
    }
    
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i]
      const previousBlock = this.chain[i - 1]

      console.log(`   Checking block ${i}:`)
      console.log(`     Current hash: ${currentBlock.hash}`)
      console.log(`     Previous hash: ${currentBlock.previousHash}`)
      console.log(`     Expected previous: ${previousBlock.hash}`)

      const recalculatedHash = this.calculateHash(
        currentBlock.index,
        currentBlock.timestamp,
        currentBlock.data,
        currentBlock.previousHash,
        currentBlock.nonce
      )

      if (currentBlock.hash !== recalculatedHash) {
        console.log(`❌ Invalid hash at block ${i}`)
        console.log(`     Expected: ${recalculatedHash}`)
        console.log(`     Actual: ${currentBlock.hash}`)
        return false
      }

      if (currentBlock.previousHash !== previousBlock.hash) {
        console.log(`❌ Invalid previous hash at block ${i}`)
        console.log(`     Expected: ${previousBlock.hash}`)
        console.log(`     Actual: ${currentBlock.previousHash}`)
        return false
      }

      const target = "0".repeat(this.difficulty)
      if (currentBlock.hash.substring(0, this.difficulty) !== target) {
        console.log(`❌ Block not properly mined at ${i}`)
        console.log(`     Hash: ${currentBlock.hash}`)
        console.log(`     Required: starts with ${target}`)
        return false
      }
      
      console.log(`   ✅ Block ${i} is valid`)
    }

    // Also check genesis block
    const genesisBlock = this.chain[0]
    const genesisTarget = "0".repeat(this.difficulty)
    if (genesisBlock.hash.substring(0, this.difficulty) !== genesisTarget) {
      console.log(`❌ Genesis block not properly mined`)
      console.log(`     Hash: ${genesisBlock.hash}`)
      console.log(`     Required: starts with ${genesisTarget}`)
      return false
    }
    
    console.log(`✅ Blockchain is valid! All ${this.chain.length} blocks properly mined with difficulty ${this.difficulty}`)
    return true
  }

  getChain(): Block[] {
    return this.chain
  }

  getRecordHistory(recordId: string): Block[] {
    return this.chain.filter(block => {
      return block.data && block.data.recordId === recordId
    })
  }

  getBlocksByAdmin(adminId: string): Block[] {
    return this.chain.filter(block => {
      return block.adminSignatures.some(sig => sig.adminId === adminId)
    })
  }

  hasRequiredApprovals(blockHash: string, requiredApprovals: number = 2): boolean {
    const block = this.chain.find(b => b.hash === blockHash)
    if (!block) return false

    const approvals = block.adminSignatures.filter(sig => sig.action === 'approve')
    return approvals.length >= requiredApprovals
  }

  resetBlockchain(): void {
    console.log('🔄 Resetting blockchain...')
    this.chain = [this.createGenesisBlock()]
    console.log('✅ Blockchain reset with new properly mined genesis block')
  }

  rebuildChainFromTransactions(transactions: any[]): void {
    console.log('🔄 Rebuilding blockchain from transactions...')
    
    // Reset to genesis block
    this.chain = [this.createGenesisBlock()]
    
    // Sort transactions by timestamp to maintain order
    const sortedTransactions = transactions.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
    
    // Rebuild each block with proper hash chain
    for (const txData of sortedTransactions) {
      const latestBlock = this.getLatestBlock()
      
      const newBlock: Block = {
        index: latestBlock.index + 1,
        timestamp: txData.timestamp,
        data: txData.transaction_data,
        previousHash: latestBlock.hash, // This ensures proper chain linking
        hash: "",
        adminSignatures: [],
        nonce: 0
      }

      // Calculate and mine the block
      newBlock.hash = this.calculateHash(
        newBlock.index,
        newBlock.timestamp,
        newBlock.data,
        newBlock.previousHash,
        newBlock.nonce
      )

      const minedBlock = this.mineBlock(newBlock)
      this.chain.push(minedBlock)
      
      console.log(`✅ Rebuilt block ${minedBlock.index} with hash: ${minedBlock.hash}`)
      console.log(`   Previous hash: ${minedBlock.previousHash}`)
    }
    
    console.log('✅ Blockchain rebuild complete with proper hash chain')
  }

  getBlockchainStats() {
    return {
      totalBlocks: this.chain.length,
      difficulty: this.difficulty,
      totalNonces: this.chain.reduce((sum, block) => sum + block.nonce, 0),
      averageNonce: this.chain.length > 0 ? this.chain.reduce((sum, block) => sum + block.nonce, 0) / this.chain.length : 0,
      allBlocksValid: this.isChainValid(),
      genesisBlockHash: this.chain[0]?.hash,
      latestBlockHash: this.getLatestBlock()?.hash,
      allHashesStartWithTarget: this.chain.every(block => 
        block.hash.substring(0, this.difficulty) === "0".repeat(this.difficulty)
      )
    }
  }

  exportChain(): string {
    return JSON.stringify(this.chain, null, 2)
  }

  importChain(chainData: string): boolean {
    try {
      const importedChain = JSON.parse(chainData)
      this.chain = importedChain
      return this.isChainValid()
    } catch (error) {
      console.error("Failed to import chain:", error)
      return false
    }
  }
}

export const landRecordsBlockchain = new LandRecordsBlockchain()

export const BlockchainUtils = {
  createLandRecordTransaction: (recordData: any, adminId: string, adminName: string): LandRecordTransaction => {
    return {
      recordId: recordData.id || recordData.land_id,
      action: 'create',
      newData: recordData,
      adminId,
      adminName,
      timestamp: new Date().toISOString()
    }
  },

  updateLandRecordTransaction: (recordId: string, previousData: any, newData: any, adminId: string, adminName: string): LandRecordTransaction => {
    return {
      recordId,
      action: 'update',
      previousData,
      newData,
      adminId,
      adminName,
      timestamp: new Date().toISOString()
    }
  },

  verifyHash: (hash: string): boolean => {
    return /^[a-f0-9]{64}$/i.test(hash)
  },

  generateAdminSignature: (adminId: string, data: any): string => {
    const signatureData = adminId + JSON.stringify(data)
    return crypto.createHash('sha256').update(signatureData).digest('hex')
  },

  rebuildChain: async () => {
    console.log('🔄 Rebuilding blockchain with reset method...')
    landRecordsBlockchain.resetBlockchain()
    console.log('✅ Blockchain rebuilt with fixed genesis block')
    return landRecordsBlockchain
  },

  rebuildFromDatabaseTransactions: async (transactions: any[]) => {
    console.log('🔄 Rebuilding blockchain from database transactions...')
    landRecordsBlockchain.rebuildChainFromTransactions(transactions)
    console.log('✅ Blockchain rebuilt from database with proper hash chain')
    return landRecordsBlockchain
  }
}