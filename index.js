const { exec, spawn } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Add a sleep function to wait between runs
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to check for and commit changes
const commitAndPushChanges = async (runCount) => {
  try {
    console.log('Checking for changes to commit...');
    
    // Check if there are any changes
    const { stdout: statusOutput } = await execPromise('git status --porcelain')
    
    if (!statusOutput.trim()) {
      console.log('No changes detected, skipping commit');
      return false;
    }
    
    // Count the number of changed files
    const changedFiles = statusOutput.trim().split('\n');
    const fileCount = changedFiles.length;
    
    console.log(`Detected ${fileCount} changed files`);
    
    // Only commit if more than one file has changed
    if (fileCount <= 2) {
      console.log('Less file changed, skipping commit');
      return false;
    }
    
    console.log('Multiple files changed, committing and pushing...');
    
    // Configure git
    await execPromise('git config --local user.email "bot@pooltogether.com"');
    await execPromise('git config --local user.name "PT Winners Bot"');
    
    // Add all changes
    await execPromise('git add .');
    
    // Commit with timestamp
    const timestamp = new Date().toISOString();
    await execPromise(`git commit -m "Update winners data - Run #${runCount} at ${timestamp}"`);
    
    // Push changes
    await execPromise('git push');
    
    console.log(`Successfully committed and pushed ${fileCount} changed files`);
    return true;
  } catch (error) {
    console.error('Error committing changes:', error.message);
    return false;
  }
};

const processAllChains = async (runCount) => {
  const chains = [
    // Arbitrum Mainnet
    {
      CHAIN_ID: 42161,
      PRIZE_POOL_ADDRESS: "0x52e7910c4c287848c8828e8b17b8371f4ebc5d42",
      JSON_RPC_URL: "https://arbitrum.llamarpc.com",
      CONTRACT_JSON_URL: "https://raw.githubusercontent.com/GenerationSoftware/pt-v5-mainnet/bc9e4b4c25a033ec3c1c2b89b62422399b7db2f6/deployments/arbitrum/contracts.json",
      SUBGRAPH_URL: 'https://api.studio.thegraph.com/query/63100/pt-v5-arbitrum/version/latest',
      REMOTE_STATUS_URL: 'https://raw.githubusercontent.com/GenerationSoftware/pt-v5-winners/refs/heads/main/winners/vaultAccounts'
    },
    // Optimism Mainnet
    {
      CHAIN_ID: 10,
      PRIZE_POOL_ADDRESS: "0xf35fe10ffd0a9672d0095c435fd8767a7fe29b55",
      JSON_RPC_URL: "https://optimism.llamarpc.com",
      CONTRACT_JSON_URL: "https://raw.githubusercontent.com/GenerationSoftware/pt-v5-mainnet/bc9e4b4c25a033ec3c1c2b89b62422399b7db2f6/deployments/optimism/contracts.json",
      SUBGRAPH_URL: 'https://api.studio.thegraph.com/query/63100/pt-v5-optimism/version/latest?source=pooltogether',
      REMOTE_STATUS_URL: 'https://raw.githubusercontent.com/GenerationSoftware/pt-v5-winners/refs/heads/main/winners/vaultAccounts'
    },
    // Base Mainnet
    {
      CHAIN_ID: 8453,
      PRIZE_POOL_ADDRESS: "0x45b2010d8A4f08b53c9fa7544C51dFd9733732cb",
      JSON_RPC_URL: "https://base.llamarpc.com",
      CONTRACT_JSON_URL: "https://raw.githubusercontent.com/GenerationSoftware/pt-v5-mainnet/bc9e4b4c25a033ec3c1c2b89b62422399b7db2f6/deployments/base/contracts.json",
      SUBGRAPH_URL: 'https://subgraph.satsuma-prod.com/17063947abe2/g9-software-inc--666267/pt-v5-base/version/v0.0.1/api',
      REMOTE_STATUS_URL: 'https://raw.githubusercontent.com/GenerationSoftware/pt-v5-winners/refs/heads/main/winners/vaultAccounts'
    },
    // Gnosis Mainnet
    {
      CHAIN_ID: 100,
      PRIZE_POOL_ADDRESS: "0x0c08c2999e1a14569554eddbcda9da5e1918120f",
      MULTICALL_ADDRESS: "0xcA11bde05977b3631167028862bE2a173976CA11",
      JSON_RPC_URL: "https://rpc.gnosischain.com",
      CONTRACT_JSON_URL: "https://raw.githubusercontent.com/GenerationSoftware/pt-v5-mainnet/196aa20f4a0b3e651d0504ffeb0e1b9a08c7ccb6/deployments/gnosis/contracts.json",
      SUBGRAPH_URL: 'https://api.studio.thegraph.com/query/63100/pt-v5-gnosis/version/latest',
      REMOTE_STATUS_URL: 'https://raw.githubusercontent.com/GenerationSoftware/pt-v5-winners/refs/heads/main/winners/vaultAccounts'
    },
    // Scroll Mainnet
    {
      CHAIN_ID: 534352,
      PRIZE_POOL_ADDRESS: "0xa6ecd65c3eecdb59c2f74956ddf251ab5d899845",
      MULTICALL_ADDRESS: "0xcA11bde05977b3631167028862bE2a173976CA11",
      JSON_RPC_URL: "https://1rpc.io/scroll",
      CONTRACT_JSON_URL: "https://raw.githubusercontent.com/GenerationSoftware/pt-v5-mainnet/196aa20f4a0b3e651d0504ffeb0e1b9a08c7ccb6/deployments/scroll/contracts.json",
      SUBGRAPH_URL: 'https://api.studio.thegraph.com/query/63100/pt-v5-scroll/version/latest',
      REMOTE_STATUS_URL: 'https://raw.githubusercontent.com/GenerationSoftware/pt-v5-winners/refs/heads/main/winners/vaultAccounts'
    },
  ];

  const OUTPUT_DIRECTORY_NAME = "winners/vaultAccounts";

  // Process all chains in parallel
  console.log(`Starting to process ${chains.length} chains in parallel...`);
  
  const processChain = async (chain, runCount) => {
    try {
      console.log(`Processing chain ${chain.CHAIN_ID}...`);
      
      // Prepare command and arguments for spawn
      const env = { ...process.env, JSON_RPC_URL: chain.JSON_RPC_URL };
      const args = [
        'utils', 'compileWinners',
        '-o', `./${OUTPUT_DIRECTORY_NAME}`,
        '-p', chain.PRIZE_POOL_ADDRESS,
        '-c', chain.CHAIN_ID.toString(),
        '-j', chain.CONTRACT_JSON_URL,
        '-s', chain.SUBGRAPH_URL,
        '-r', chain.REMOTE_STATUS_URL
      ];
      
      // Only add multicall address if it exists
      if (chain.MULTICALL_ADDRESS) {
        args.push('-m', chain.MULTICALL_ADDRESS);
      }
      
      console.log(`Executing command for chain ${chain.CHAIN_ID}:`);
      console.log(`JSON_RPC_URL=${chain.JSON_RPC_URL} ptv5 ${args.join(' ')}`);
      
      // Use spawn to get real-time output
      return new Promise((resolve, reject) => {
        const childProcess = spawn('ptv5', args, { env });
        let stdoutData = '';
        let stderrData = '';
        
        // Stream stdout in real-time
        childProcess.stdout.on('data', (data) => {
          const output = data.toString();
          stdoutData += output;
          console.log(`[Chain ${chain.CHAIN_ID} - STDOUT]: ${output.trim()}`);
        });
        
        // Stream stderr in real-time
        childProcess.stderr.on('data', (data) => {
          const output = data.toString();
          stderrData += output;
          console.error(`[Chain ${chain.CHAIN_ID} - STDERR]: ${output.trim()}`);
        });
        
        // Handle process completion
        childProcess.on('close', async (code) => {
          console.log(`\nProcess for chain ${chain.CHAIN_ID} exited with code ${code}`);
          
          if (code === 0) {
            console.log(`Completed processing chain ${chain.CHAIN_ID}`);
            
            // Commit and push any changes
            const committed = await commitAndPushChanges(runCount);
            if (committed) {
              console.log(`Changes from run #${runCount} have been committed and pushed`);
            }
            
            resolve({ chainId: chain.CHAIN_ID, success: true });
          } else {
            console.error(`Failed to process chain ${chain.CHAIN_ID} with exit code ${code}`);
            resolve({ chainId: chain.CHAIN_ID, success: false, error: `Process exited with code ${code}` });
          }
        });
        
        // Handle process errors
        childProcess.on('error', (error) => {
          console.error(`Error executing process for chain ${chain.CHAIN_ID}:`, error.message);
          reject({ chainId: chain.CHAIN_ID, success: false, error: error.message });
        });
      });
    } catch (error) {
      console.error(`Failed to process chain ${chain.CHAIN_ID}:`, error.message);
      return { chainId: chain.CHAIN_ID, success: false, error: error.message };
    }
  };

  // Run all chains in parallel and wait for all to complete
  const results = await Promise.all(chains.map(chain => processChain(chain,runCount)));
  
  // Summarize results
  console.log('\n--- Processing Summary ---');
  const successful = results.filter(r => r.success).length;
  console.log(`Successfully processed ${successful} out of ${chains.length} chains`);
  
  if (successful < chains.length) {
    console.log('\nFailed chains:');
    results.filter(r => !r.success).forEach(result => {
      console.log(`- Chain ${result.chainId}: ${result.error}`);
    });
  }

  console.log('\nAll chains processing completed');
  return successful;
};

// Main function that runs continuously
const main = async () => {
  console.log('Starting continuous winner compilation process...');
  console.log('Press Ctrl+C to stop the process');
  
  let runCount = 0;
  
  // Run continuously with a 10-second delay between runs
  while (true) {
    runCount++;
    const currentTime = new Date().toISOString();
    console.log(`\n=== Run #${runCount} at ${currentTime} ===`);
    
    try {
      const successCount = await processAllChains(runCount);
      console.log(`Run #${runCount} completed with ${successCount} successful chains`);
      
      // Commit and push any changes
      const committed = await commitAndPushChanges(runCount);
      if (committed) {
        console.log(`Changes from run #${runCount} have been committed and pushed`);
      }
    } catch (error) {
      console.error(`Error in run #${runCount}:`, error.message);
    }
    
    console.log(`Waiting 30 seconds before next run...`);
    await sleep(10000); // Wait 30 seconds
  }
};

// Execute the main function
main().catch(error => {
  console.error('Error in main execution:', error);
  process.exit(1);
});