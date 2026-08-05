// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PumpRobinToken
 * @notice ERC-20 with optional Bankr-style anti-snipe fee decay on buys from the pool.
 * @dev When anti-snipe is enabled, buys (transfers out of the Uniswap pool) start at
 *      80% fee and linearly decay to 0% over 10 seconds. Swaps still succeed so
 *      Uniswap / GMGN / aggregators can route; sniping is just expensive.
 *      Fee is armed only after liquidity is seeded (creator first-buy is exempt).
 */
contract PumpRobinToken is ERC20, Ownable {
    uint16 public constant ANTI_SNIPE_START_BPS = 8_000; // 80%
    uint16 public constant ANTI_SNIPE_END_BPS = 0;
    uint32 public constant ANTI_SNIPE_DURATION = 10; // seconds

    address public immutable factory;
    address public immutable creator;
    address public immutable antiSnipeFeeRecipient;

    string public imageUri;
    string public description;

    bool public immutable antiSnipeEnabled;
    address public launcher;
    address public uniswapPool;
    uint256 public tradingOpenedAt;

    mapping(address => bool) public isExcludedFromAntiSnipe;

    event LauncherSet(address indexed launcher);
    event TradingArmed(address indexed pool, uint256 openedAt);
    event AntiSnipeFee(
        address indexed buyer,
        uint256 amount,
        uint256 fee,
        uint256 feeBps
    );

    constructor(
        string memory name_,
        string memory symbol_,
        string memory imageUri_,
        string memory description_,
        address creator_,
        bool antiSnipeEnabled_,
        address antiSnipeFeeRecipient_
    ) ERC20(name_, symbol_) Ownable(creator_) {
        require(creator_ != address(0), "Bad creator");
        if (antiSnipeEnabled_) {
            require(antiSnipeFeeRecipient_ != address(0), "Fee recipient required");
        }

        factory = msg.sender;
        creator = creator_;
        imageUri = imageUri_;
        description = description_;
        antiSnipeEnabled = antiSnipeEnabled_;
        antiSnipeFeeRecipient = antiSnipeFeeRecipient_;

        isExcludedFromAntiSnipe[msg.sender] = true;
        isExcludedFromAntiSnipe[creator_] = true;
        isExcludedFromAntiSnipe[address(this)] = true;
        if (antiSnipeFeeRecipient_ != address(0)) {
            isExcludedFromAntiSnipe[antiSnipeFeeRecipient_] = true;
        }

        _mint(msg.sender, 1_000_000_000 * 10 ** decimals());
        // Match Bags-style audit: no privileged owner after launch
        renounceOwnership();
    }

    /// @notice Factory wires the bonding-curve launcher (once) so it can arm trading
    function setLauncher(address launcher_) external {
        require(msg.sender == factory, "Only factory");
        require(launcher == address(0), "Launcher set");
        require(launcher_ != address(0), "Bad launcher");
        launcher = launcher_;
        isExcludedFromAntiSnipe[launcher_] = true;
        emit LauncherSet(launcher_);
    }

    /**
     * @notice Start the anti-snipe clock after the Uniswap pool is live.
     * @dev Called by the launcher after LP seed + creator buy so the first buy is free of decay fee.
     */
    function armTrading(address pool) external {
        require(antiSnipeEnabled, "Anti-snipe off");
        require(msg.sender == launcher || msg.sender == factory, "Not launcher");
        require(tradingOpenedAt == 0, "Already armed");
        require(pool != address(0), "Bad pool");
        uniswapPool = pool;
        tradingOpenedAt = block.timestamp;
        emit TradingArmed(pool, tradingOpenedAt);
    }

    /// @notice Current buy fee in bps (0 if disabled / not armed / after decay)
    function currentAntiSnipeBps() public view returns (uint256) {
        if (!antiSnipeEnabled || tradingOpenedAt == 0) return 0;
        uint256 elapsed = block.timestamp - tradingOpenedAt;
        if (elapsed >= ANTI_SNIPE_DURATION) return ANTI_SNIPE_END_BPS;
        uint256 start = ANTI_SNIPE_START_BPS;
        uint256 end = ANTI_SNIPE_END_BPS;
        return start - ((start - end) * elapsed) / ANTI_SNIPE_DURATION;
    }

    function _update(address from, address to, uint256 amount) internal override {
        if (
            antiSnipeEnabled &&
            tradingOpenedAt != 0 &&
            from != address(0) &&
            to != address(0) &&
            from == uniswapPool &&
            !isExcludedFromAntiSnipe[to] &&
            amount > 0
        ) {
            uint256 feeBps = currentAntiSnipeBps();
            if (feeBps > 0) {
                uint256 fee = (amount * feeBps) / 10_000;
                uint256 send = amount - fee;
                if (fee > 0) {
                    super._update(from, antiSnipeFeeRecipient, fee);
                    emit AntiSnipeFee(to, amount, fee, feeBps);
                }
                if (send > 0) {
                    super._update(from, to, send);
                }
                return;
            }
        }
        super._update(from, to, amount);
    }
}
