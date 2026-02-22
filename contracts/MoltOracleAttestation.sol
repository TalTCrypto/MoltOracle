// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MoltOracleAttestation
 * @notice On-chain attestation layer for verified crypto data.
 *         Each data point is cross-verified from multiple sources,
 *         hashed, and attested on-chain for independent verification.
 * @author taltclaw (MoltOracle)
 */
contract MoltOracleAttestation {
    
    struct Attestation {
        bytes32 dataHash;       // keccak256(asset, price, sources, timestamp)
        uint256 timestamp;      // block.timestamp when attested
        uint8 sourceCount;      // number of sources that agreed
        uint8 confidence;       // 0-100 confidence score
        string asset;           // e.g. "BTC", "ETH"
        uint256 price;          // price in USD with 8 decimals (e.g. 6738900000000 = $67,389.00)
        int16 maxDivergenceBps; // max divergence between sources in basis points
    }

    // Oracle operator
    address public oracle;
    
    // All attestations by sequential ID
    mapping(uint256 => Attestation) public attestations;
    uint256 public attestationCount;
    
    // Latest attestation per asset
    mapping(string => uint256) public latestAttestation;
    
    // Events
    event DataAttested(
        uint256 indexed id,
        string asset,
        uint256 price,
        uint8 confidence,
        bytes32 dataHash,
        uint256 timestamp
    );
    
    event OracleTransferred(address indexed oldOracle, address indexed newOracle);

    modifier onlyOracle() {
        require(msg.sender == oracle, "MoltOracle: not oracle");
        _;
    }

    constructor() {
        oracle = msg.sender;
    }

    /**
     * @notice Attest a verified data point on-chain
     * @param asset The asset ticker (e.g. "BTC")
     * @param price Price in USD with 8 decimals
     * @param sourceCount Number of sources that were cross-checked
     * @param confidence Confidence score 0-100
     * @param maxDivergenceBps Maximum divergence between sources in bps
     * @param dataHash Pre-computed hash of the full data payload
     */
    function attest(
        string calldata asset,
        uint256 price,
        uint8 sourceCount,
        uint8 confidence,
        int16 maxDivergenceBps,
        bytes32 dataHash
    ) external onlyOracle returns (uint256 id) {
        id = attestationCount++;
        
        attestations[id] = Attestation({
            dataHash: dataHash,
            timestamp: block.timestamp,
            sourceCount: sourceCount,
            confidence: confidence,
            asset: asset,
            price: price,
            maxDivergenceBps: maxDivergenceBps
        });
        
        latestAttestation[asset] = id;
        
        emit DataAttested(id, asset, price, confidence, dataHash, block.timestamp);
    }

    /**
     * @notice Batch attest multiple assets at once (gas efficient)
     */
    function attestBatch(
        string[] calldata assets,
        uint256[] calldata prices,
        uint8[] calldata sourceCounts,
        uint8[] calldata confidences,
        int16[] calldata maxDivergenceBps,
        bytes32[] calldata dataHashes
    ) external onlyOracle {
        require(assets.length == prices.length, "MoltOracle: length mismatch");
        require(assets.length == sourceCounts.length, "MoltOracle: length mismatch");
        require(assets.length == confidences.length, "MoltOracle: length mismatch");
        require(assets.length == maxDivergenceBps.length, "MoltOracle: length mismatch");
        require(assets.length == dataHashes.length, "MoltOracle: length mismatch");
        
        for (uint256 i = 0; i < assets.length; i++) {
            uint256 id = attestationCount++;
            
            attestations[id] = Attestation({
                dataHash: dataHashes[i],
                timestamp: block.timestamp,
                sourceCount: sourceCounts[i],
                confidence: confidences[i],
                asset: assets[i],
                price: prices[i],
                maxDivergenceBps: maxDivergenceBps[i]
            });
            
            latestAttestation[assets[i]] = id;
            
            emit DataAttested(id, assets[i], prices[i], confidences[i], dataHashes[i], block.timestamp);
        }
    }

    /**
     * @notice Verify a data point against its on-chain attestation
     * @param id Attestation ID
     * @param expectedHash The hash the client computed independently
     * @return valid Whether the hash matches
     */
    function verify(uint256 id, bytes32 expectedHash) external view returns (bool valid) {
        return attestations[id].dataHash == expectedHash;
    }

    /**
     * @notice Get the latest attested price for an asset
     */
    function getLatestPrice(string calldata asset) external view returns (
        uint256 price,
        uint8 confidence,
        uint256 timestamp,
        bytes32 dataHash
    ) {
        uint256 id = latestAttestation[asset];
        Attestation storage a = attestations[id];
        return (a.price, a.confidence, a.timestamp, a.dataHash);
    }

    /**
     * @notice Transfer oracle role
     */
    function transferOracle(address newOracle) external onlyOracle {
        require(newOracle != address(0), "MoltOracle: zero address");
        emit OracleTransferred(oracle, newOracle);
        oracle = newOracle;
    }
}
