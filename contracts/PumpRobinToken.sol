// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title PumpRobinToken
 * @notice ERC-20 with a hardcoded 2% transfer tax (1% creator + 1% platform).
 * @dev Scanner-friendly:
 *      - No owner / pause / blacklist / proxy / fee setters
 *      - Tax is a constant
 *      - No external calls in transfers (cannot honeypot via callback)
 *      - Uniswap router / NPM / burns are hardcoded-exempt
 */
contract PumpRobinToken is ERC20 {
    address public immutable factory;
    address public immutable creator;
    address public immutable platformFeeRecipient;

    string public imageUri;
    string public description;

    uint256 public constant FEE_BPS = 200;
    uint256 public constant CREATOR_FEE_BPS = 100;

    address public constant POSITION_MANAGER =
        0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3;
    address public constant SWAP_ROUTER =
        0xCaf681a66D020601342297493863E78C959E5cb2;
    address public constant DEAD =
        0x000000000000000000000000000000000000dEaD;

    constructor(
        string memory name_,
        string memory symbol_,
        string memory imageUri_,
        string memory description_,
        address creator_,
        address platformFeeRecipient_
    ) ERC20(name_, symbol_) {
        require(creator_ != address(0), "Bad creator");
        require(platformFeeRecipient_ != address(0), "Bad platform");
        factory = msg.sender;
        creator = creator_;
        platformFeeRecipient = platformFeeRecipient_;
        imageUri = imageUri_;
        description = description_;
        _mint(msg.sender, 1_000_000_000 * 10 ** decimals());
    }

    /// @notice Always zero — token has no admin.
    function owner() external pure returns (address) {
        return address(0);
    }

    function _isExempt(address account) private view returns (bool) {
        return
            account == address(0) ||
            account == factory ||
            account == POSITION_MANAGER ||
            account == SWAP_ROUTER ||
            account == DEAD;
    }

    function _update(address from, address to, uint256 amount) internal override {
        // Skip tax when depositing into any contract (pool / router / curve / seller).
        // Uniswap V3 pulls user→pool directly; taxing that hop reverts STF/IIA on sells.
        // Buys still tax: pool (contract) → user (EOA).
        if (
            amount == 0 ||
            _isExempt(from) ||
            _isExempt(to) ||
            to.code.length > 0
        ) {
            super._update(from, to, amount);
            return;
        }

        uint256 fee = (amount * FEE_BPS) / 10_000;
        if (fee == 0) {
            super._update(from, to, amount);
            return;
        }

        uint256 creatorFee = (fee * CREATOR_FEE_BPS) / FEE_BPS;
        uint256 platformFee = fee - creatorFee;
        super._update(from, creator, creatorFee);
        super._update(from, platformFeeRecipient, platformFee);
        super._update(from, to, amount - fee);
    }
}
