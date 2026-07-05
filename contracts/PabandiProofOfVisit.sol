// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title PabandiProofOfVisit
 * @notice Soulbound (non-transferable) NFT representing a verified visit/check-in to a business.
 *         Mints an on-chain SVG badge. Used to gate access to the review system.
 */
contract PabandiProofOfVisit is ERC721, ERC721URIStorage, AccessControl {
    using Counters for Counters.Counter;
    using Strings for uint256;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    Counters.Counter private _tokenIds;

    struct VisitData {
        string businessId;
        string businessName;
        uint64 timestamp;
    }

    mapping(uint256 => VisitData) public visitData;
    
    // Mapping to check if user has a token for a specific business
    // wallet => businessId => hasToken
    mapping(address => mapping(string => bool)) private _hasVisited;

    event VisitMinted(address indexed to, uint256 indexed tokenId, string businessId);

    constructor(address minter) ERC721("Pabandi Proof of Visit", "POV") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, minter);
    }

    /**
     * @notice Mint a POV token to a customer's wallet.
     */
    function mintProofOfVisit(
        address to,
        string calldata businessId,
        string calldata businessName
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();

        _safeMint(to, newItemId);
        
        visitData[newItemId] = VisitData({
            businessId: businessId,
            businessName: businessName,
            timestamp: uint64(block.timestamp)
        });

        _hasVisited[to][businessId] = true;

        _setTokenURI(newItemId, _buildTokenURI(newItemId));

        emit VisitMinted(to, newItemId, businessId);

        return newItemId;
    }

    /**
     * @notice Verify if a user holds a Proof of Visit token for a specific business.
     */
    function hasVisited(address user, string calldata businessId) external view returns (bool) {
        return _hasVisited[user][businessId];
    }

    /**
     * @dev Block all transfers except minting
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override {
        require(from == address(0), "POV: non-transferable Soulbound Token");
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function _buildTokenURI(uint256 tokenId) internal view returns (string memory) {
        VisitData memory data = visitData[tokenId];

        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">',
            '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">',
            '<stop offset="0%" stop-color="#16a34a"/><stop offset="100%" stop-color="#15803d"/></linearGradient></defs>',
            '<rect width="300" height="300" rx="16" fill="url(#bg)"/>',
            '<text x="150" y="80" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="24" font-weight="bold">Verified Visit</text>',
            '<text x="150" y="140" text-anchor="middle" fill="#dcfce7" font-family="Arial,sans-serif" font-size="16">Pabandi Reservation</text>',
            '<text x="150" y="190" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="20" font-weight="bold">', data.businessName, '</text>',
            '<text x="150" y="240" text-anchor="middle" fill="#dcfce7" font-family="Arial,sans-serif" font-size="12">Timestamp: ', uint256(data.timestamp).toString(), '</text>',
            '</svg>'
        ));

        string memory json = string(abi.encodePacked(
            '{"name":"Proof of Visit: ', data.businessName, '",',
            '"description":"A cryptographically verified proof that the holder checked into this business via Pabandi.",',
            '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '",',
            '"attributes":[',
            '{"trait_type":"Business ID","value":"', data.businessId, '"},',
            '{"trait_type":"Timestamp","value":', uint256(data.timestamp).toString(), '}',
            ']}'
        ));

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }

    // Required overrides
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
