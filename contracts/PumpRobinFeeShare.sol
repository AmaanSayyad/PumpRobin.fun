// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICreatorFeeSource {
    function claimCreatorFees() external;
}

interface IHookFeeSource {
    function claimCreatorFees(address token) external;
    function pendingCreatorFees(address token) external view returns (uint256);
}

/**
 * @title PumpRobinFeeShare
 * @notice Splits a token's 1% creator fee between one or more wallets.
 * @dev Stands in as the "creator" for both the bonding curve and the v4 hook, so
 *      a launch keeps a single payout address across both trading phases. Anyone
 *      can pull fees in; only a listed recipient can take their share out.
 */
contract PumpRobinFeeShare {
    uint256 private constant BPS = 10_000;

    address public immutable token;
    address public immutable curve;
    address public immutable hook;

    address[] public recipients;
    mapping(address => uint16) public shareBps;
    mapping(address => uint256) public claimed;

    /// @notice Lifetime ETH routed to this contract.
    uint256 public totalAccrued;

    event FeesReceived(uint256 amount, uint256 totalAccrued);
    event Claimed(address indexed recipient, uint256 amount);

    constructor(
        address token_,
        address curve_,
        address hook_,
        address[] memory recipients_,
        uint16[] memory bps_
    ) {
        require(token_ != address(0) && curve_ != address(0) && hook_ != address(0), "Bad wiring");
        require(recipients_.length > 0 && recipients_.length == bps_.length, "Bad shares");
        require(recipients_.length <= 100, "Too many recipients");
        token = token_;
        curve = curve_;
        hook = hook_;

        uint256 sum;
        for (uint256 i = 0; i < recipients_.length; i++) {
            require(recipients_[i] != address(0), "Bad recipient");
            require(bps_[i] > 0, "Bad bps");
            require(shareBps[recipients_[i]] == 0, "Duplicate recipient");
            shareBps[recipients_[i]] = bps_[i];
            recipients.push(recipients_[i]);
            sum += bps_[i];
        }
        require(sum == BPS, "Shares must total 100%");
    }

    receive() external payable {
        totalAccrued += msg.value;
        emit FeesReceived(msg.value, totalAccrued);
    }

    function recipientCount() external view returns (uint256) {
        return recipients.length;
    }

    function getRecipients() external view returns (address[] memory) {
        return recipients;
    }

    /// @notice Pulls whatever the curve and the hook are holding for this token.
    function sync() public {
        // Either source reverts when it has nothing owed, which is not an error
        // here — it just means that phase has no fees waiting.
        try ICreatorFeeSource(curve).claimCreatorFees() {} catch {}
        try IHookFeeSource(hook).claimCreatorFees(token) {} catch {}
    }

    function pendingOf(address account) public view returns (uint256) {
        uint16 bps = shareBps[account];
        if (bps == 0) return 0;
        uint256 entitled = (totalAccrued * bps) / BPS;
        uint256 taken = claimed[account];
        return entitled > taken ? entitled - taken : 0;
    }

    function claim() external {
        sync();
        uint256 amt = pendingOf(msg.sender);
        require(amt > 0, "Nothing to claim");
        claimed[msg.sender] += amt;
        (bool ok, ) = msg.sender.call{value: amt}("");
        require(ok, "Payout failed");
        emit Claimed(msg.sender, amt);
    }
}
