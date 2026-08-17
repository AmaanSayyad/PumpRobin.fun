// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title PumpRobinToken
 * @notice Plain ERC-20 (1B supply, 18 decimals). No transfer tax, no owner, no
 *         pause, no blacklist, no proxy.
 * @dev Trading fees are charged on the ETH/WETH leg by the bonding curve
 *      (pre-graduation) and by PumpRobinHook on the Uniswap v4 pool
 *      (post-graduation), exactly like bags. Keeping the ERC-20 itself
 *      untaxed is what makes swaps settle on every router — SwapRouter02,
 *      UniversalRouter, MetaMask, gmgn, axiom — and keeps scanners from
 *      flagging the token as fee-on-transfer.
 */
contract PumpRobinToken is ERC20 {
    address public immutable factory;
    address public immutable creator;
    address public immutable platformFeeRecipient;
    uint256 public immutable launchedAt;
    uint256 public immutable antiSnipeEndsAt;
    uint256 public immutable maxWalletAmount;

    string public imageUri;
    string public description;
    string public metadataURI;

    /// @notice Fee charged on the ETH leg of every trade — enforced by the hook.
    uint256 public constant FEE_BPS = 200;
    uint256 public constant CREATOR_FEE_BPS = 100;
    uint256 public constant PLATFORM_FEE_BPS = 100;
    uint256 public constant ANTI_SNIPE_BPS = 9_900;
    uint256 public constant ANTI_SNIPE_DURATION = 15 minutes;

    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    constructor(
        string memory name_,
        string memory symbol_,
        string memory imageUri_,
        string memory description_,
        string memory metadataURI_,
        address creator_,
        address platformFeeRecipient_,
        bool antiSnipe_,
        bool maxWallet_
    ) ERC20(name_, symbol_) {
        require(creator_ != address(0), "Bad creator");
        require(platformFeeRecipient_ != address(0), "Bad platform");
        factory = msg.sender;
        creator = creator_;
        platformFeeRecipient = platformFeeRecipient_;
        imageUri = imageUri_;
        description = description_;
        metadataURI = bytes(metadataURI_).length > 0 ? metadataURI_ : imageUri_;
        launchedAt = block.timestamp;
        antiSnipeEndsAt = antiSnipe_ ? block.timestamp + ANTI_SNIPE_DURATION : 0;
        maxWalletAmount = maxWallet_
            ? (1_000_000_000 * 10 ** decimals() * 2) / 100
            : 0;
        _mint(msg.sender, 1_000_000_000 * 10 ** decimals());
    }

    /// @notice Always zero — the token has no admin.
    function owner() external pure returns (address) {
        return address(0);
    }

    // Metadata aliases consumed by wallets, scanners and indexers.
    function image() external view returns (string memory) {
        return imageUri;
    }

    function logoURI() external view returns (string memory) {
        return imageUri;
    }

    function getImage() external view returns (string memory) {
        return imageUri;
    }

    function tokenURI() external view returns (string memory) {
        return metadataURI;
    }

    function contractURI() external view returns (string memory) {
        return metadataURI;
    }

    function isAntiSnipeActive() public view returns (bool) {
        return antiSnipeEndsAt != 0 && block.timestamp < antiSnipeEndsAt;
    }

    /// @notice Honest fee disclosure — charged on the ETH leg, not on transfers.
    function buyTax() external view returns (uint256) {
        return isAntiSnipeActive() ? ANTI_SNIPE_BPS : FEE_BPS;
    }

    function sellTax() external pure returns (uint256) {
        return FEE_BPS;
    }

    /// @notice False — balances are never reduced by a transfer.
    function hasTransferTax() external pure returns (bool) {
        return false;
    }

    function _update(address from, address to, uint256 amount) internal override {
        super._update(from, to, amount);
        // ponytail: contracts (pool, routers, curve) are exempt — an EOA cap is
        // all "max wallet 2%" ever meant, and this needs no address registry.
        if (
            maxWalletAmount != 0 &&
            to != address(0) &&
            to != DEAD &&
            to.code.length == 0
        ) {
            require(balanceOf(to) <= maxWalletAmount, "Max wallet 2%");
        }
    }
}
