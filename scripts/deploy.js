const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying MoltOracleAttestation to Base Sepolia...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
  
  if (balance === 0n) {
    console.error("No testnet ETH! Get some from https://faucet.quicknode.com/base/sepolia");
    process.exit(1);
  }

  const Factory = await ethers.getContractFactory("MoltOracleAttestation");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();
  
  const address = await contract.getAddress();
  console.log("✅ MoltOracleAttestation deployed at:", address);
  console.log("   Explorer: https://sepolia.basescan.org/address/" + address);
  
  // Test attestation
  console.log("\nTesting attestation...");
  const tx = await contract.attest(
    "BTC",
    6743800000000n, // $67,438.00 with 8 decimals
    2, // 2 sources
    99, // 99% confidence
    1, // 1 bps divergence
    ethers.keccak256(ethers.toUtf8Bytes("test-attestation"))
  );
  await tx.wait();
  console.log("✅ Test attestation submitted, tx:", tx.hash);
  
  const latest = await contract.getLatestPrice("BTC");
  console.log("   Verified on-chain: BTC price =", (Number(latest[0]) / 1e8).toLocaleString(), "USD");
  console.log("   Confidence:", latest[1].toString() + "%");
}

main().catch(console.error);
