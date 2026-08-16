// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title PumpRobinToken
 * @notice ERC-20 (1B supply). Buys from the Uniswap V3 pair take 2% (99% during
 *         optional anti-snipe). Sells into the pair are untaxed so V3 swaps work.
 *         No owner / pause / blacklist / proxy.
 */
contract PumpRobinToken is ERC20 {
    address public immutable factory;
    address public immutable creator;
    address public immutable platformFeeRecipient;
    uint256 public immutable launchedAt;
    uint256 public immutable antiSnipeEndsAt;
    uint256 public immutable maxWalletAmount;

    address public bondingCurve;
    address public uniswapPair;

    string public imageUri;
    string public description;
    string public metadataURI;

    uint256 public pendingCreatorTokens;
    uint256 public pendingPlatformTokens;
    uint256 public accCreatorTokens;

    address[] public creatorFeeRecipients;
    mapping(address => uint16) public creatorFeeShareBps;
    mapping(address => uint256) public claimedCreatorTokens;

    uint256 public constant FEE_BPS = 200;
    uint256 public constant CREATOR_FEE_BPS = 100;
    uint256 public constant ANTI_SNIPE_BPS = 9_900;
    uint256 public constant ANTI_SNIPE_DURATION = 15 minutes;

    address public constant POSITION_MANAGER =
        0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3;
    address public constant SWAP_ROUTER =
        0xCaf681a66D020601342297493863E78C959E5cb2;
    address public constant UNIVERSAL_ROUTER =
        0x8876789976dEcBfCbBbe364623C63652db8C0904;
    address public constant DEAD =
        0x000000000000000000000000000000000000dEaD;

    event CreatorFeesClaimed(address indexed creator, uint256 amount);
    event PlatformFeesFlushed(address indexed platform, uint256 amount);

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
        maxWalletAmount = maxWallet_ ? (1_000_000_000 * 10 ** decimals() * 2) / 100 : 0;
        _mint(msg.sender, 1_000_000_000 * 10 ** decimals());
    }

    function owner() external pure returns (address) {
        return address(0);
    }

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

    function buyTax() external view returns (uint256) {
        return isAntiSnipeActive() ? ANTI_SNIPE_BPS : FEE_BPS;
    }

    function sellTax() external pure returns (uint256) {
        return FEE_BPS;
    }

    function buyFee() external view returns (uint256) {
        return isAntiSnipeActive() ? ANTI_SNIPE_BPS : FEE_BPS;
    }

    function sellFee() external pure returns (uint256) {
        return FEE_BPS;
    }

    function hasTransferTax() external pure returns (bool) {
        return false;
    }

    function isAntiSnipeActive() public view returns (bool) {
        return antiSnipeEndsAt != 0 && block.timestamp < antiSnipeEndsAt;
    }

    function setBondingCurve(address curve_) external {
        require(msg.sender == factory, "Only factory");
        require(bondingCurve == address(0) && curve_ != address(0), "Curve set");
        bondingCurve = curve_;
    }

    function setUniswapPair(address pair_) external {
        require(msg.sender == bondingCurve, "Only curve");
        require(uniswapPair == address(0) && pair_ != address(0), "Pair set");
        uniswapPair = pair_;
    }

    function setFeeShares(address[] calldata recipients, uint16[] calldata bps)
        external
    {
        require(msg.sender == factory, "Only factory");
        require(creatorFeeRecipients.length == 0, "Shares set");
        require(recipients.length > 0 && recipients.length == bps.length, "Bad shares");
        require(recipients.length <= 100, "Too many recipients");
        uint256 sum;
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Bad recipient");
            require(bps[i] > 0, "Bad bps");
            require(creatorFeeShareBps[recipients[i]] == 0, "Duplicate");
            creatorFeeShareBps[recipients[i]] = bps[i];
            creatorFeeRecipients.push(recipients[i]);
            sum += bps[i];
        }
        require(sum == 10_000, "Shares must total 100%");
    }

    function pendingCreatorFeesOf(address account) public view returns (uint256) {
        if (creatorFeeRecipients.length == 0) {
            return account == creator ? pendingCreatorTokens : 0;
        }
        uint16 bps = creatorFeeShareBps[account];
        if (bps == 0) return 0;
        uint256 entitled = (accCreatorTokens * bps) / 10_000;
        uint256 claimed = claimedCreatorTokens[account];
        return entitled > claimed ? entitled - claimed : 0;
    }

    function claimCreatorFees() external {
        uint256 amt = pendingCreatorFeesOf(msg.sender);
        require(amt > 0, "Nothing to claim");
        if (creatorFeeRecipients.length == 0) {
            pendingCreatorTokens = 0;
        } else {
            claimedCreatorTokens[msg.sender] += amt;
        }
        super._update(address(this), msg.sender, amt);
        emit CreatorFeesClaimed(msg.sender, amt);
    }

    function flushPlatformFees() external {
        uint256 amt = pendingPlatformTokens;
        require(amt > 0, "Nothing to flush");
        pendingPlatformTokens = 0;
        super._update(address(this), platformFeeRecipient, amt);
        emit PlatformFeesFlushed(platformFeeRecipient, amt);
    }

    function _isExempt(address account) private view returns (bool) {
        return
            account == address(0) ||
            account == address(this) ||
            account == factory ||
            account == bondingCurve ||
            account == POSITION_MANAGER ||
            account == DEAD;
    }

    function _isAggregator(address account) private pure returns (bool) {
        return account == SWAP_ROUTER || account == UNIVERSAL_ROUTER;
    }

    function _update(address from, address to, uint256 amount) internal override {
        // Tax only buys (pool → trader). Sells to the V3 pool must be untaxed or swaps revert.
        // Aggregator recipients are untaxed after anti-snipe so Universal Router swaps settle.
        bool buy = uniswapPair != address(0) && from == uniswapPair && !_isExempt(to);
        bool skipAggregator = _isAggregator(to) && !isAntiSnipeActive();
        if (!buy || skipAggregator || amount == 0 || from == address(0) || to == address(0)) {
            super._update(from, to, amount);
            _enforceMaxWallet(to);
            return;
        }

        uint256 taxBps = isAntiSnipeActive() ? ANTI_SNIPE_BPS : FEE_BPS;
        uint256 fee = (amount * taxBps) / 10_000;
        if (fee == 0) {
            super._update(from, to, amount);
            _enforceMaxWallet(to);
            return;
        }

        if (isAntiSnipeActive()) {
            pendingPlatformTokens += fee;
            super._update(from, address(this), fee);
        } else {
            uint256 creatorFee = (fee * CREATOR_FEE_BPS) / FEE_BPS;
            uint256 platformFee = fee - creatorFee;
            pendingCreatorTokens += creatorFee;
            accCreatorTokens += creatorFee;
            super._update(from, address(this), creatorFee);
            super._update(from, platformFeeRecipient, platformFee);
        }
        super._update(from, to, amount - fee);
        _enforceMaxWallet(to);
    }

    function _enforceMaxWallet(address to) private view {
        if (
            maxWalletAmount == 0 ||
            to == uniswapPair ||
            _isExempt(to) ||
            _isAggregator(to)
        ) return;
        require(balanceOf(to) <= maxWalletAmount, "Max wallet 2%");
    }
}
