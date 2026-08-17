// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    BalanceDelta,
    BalanceDeltaLibrary,
    Currency,
    IPoolManager,
    IUnlockCallback,
    PoolKey,
    SwapParams,
    TickMath
} from "../v4/V4Types.sol";

/// @notice Minimal CREATE2 factory used to mine the hook's flag-encoded address.
contract Create2Factory {
    event Deployed(address addr);

    function deploy(bytes32 salt, bytes memory initCode) external returns (address addr) {
        assembly {
            addr := create2(0, add(initCode, 0x20), mload(initCode), salt)
        }
        require(addr != address(0), "CREATE2 failed");
        emit Deployed(addr);
    }

    function addressOf(bytes32 salt, bytes32 initCodeHash) external view returns (address) {
        return address(
            uint160(
                uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, initCodeHash)))
            )
        );
    }
}

/**
 * @notice Bare-bones v4 swap router. Stands in for UniversalRouter so the test
 *         proves the hook charges an arbitrary external router, not just our UI.
 */
contract TestSwapRouter is IUnlockCallback {
    IPoolManager public immutable poolManager;

    struct CallbackData {
        address sender;
        PoolKey key;
        SwapParams params;
    }

    constructor(IPoolManager poolManager_) {
        poolManager = poolManager_;
    }

    /// @param amountIn exact input; zeroForOne picks the direction.
    function swap(PoolKey calldata key, bool zeroForOne, uint256 amountIn)
        external
        returns (BalanceDelta delta)
    {
        bytes memory result = poolManager.unlock(
            abi.encode(
                CallbackData({
                    sender: msg.sender,
                    key: key,
                    params: SwapParams({
                        zeroForOne: zeroForOne,
                        amountSpecified: -int256(amountIn),
                        sqrtPriceLimitX96: zeroForOne
                            ? TickMath.MIN_SQRT_RATIO + 1
                            : TickMath.MAX_SQRT_RATIO - 1
                    })
                })
            )
        );
        delta = abi.decode(result, (BalanceDelta));
    }

    function unlockCallback(bytes calldata data) external override returns (bytes memory) {
        require(msg.sender == address(poolManager), "Only PoolManager");
        CallbackData memory d = abi.decode(data, (CallbackData));

        BalanceDelta delta = poolManager.swap(d.key, d.params, "");

        _resolve(d.key.currency0, BalanceDeltaLibrary.amount0(delta), d.sender);
        _resolve(d.key.currency1, BalanceDeltaLibrary.amount1(delta), d.sender);
        return abi.encode(delta);
    }

    function _resolve(Currency currency, int128 amount, address user) internal {
        if (amount == 0) return;
        address asset = Currency.unwrap(currency);
        if (amount < 0) {
            uint256 owed = uint256(uint128(-amount));
            poolManager.sync(currency);
            IERC20(asset).transferFrom(user, address(poolManager), owed);
            poolManager.settle();
        } else {
            poolManager.take(currency, user, uint256(uint128(amount)));
        }
    }
}

/// @notice Canonical WETH9, redeployed locally so the sim needs no archive node.
contract WETH9 {
    string public name = "Wrapped Ether";
    string public symbol = "WETH";
    uint8 public decimals = 18;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Approval(address indexed src, address indexed guy, uint256 wad);
    event Transfer(address indexed src, address indexed dst, uint256 wad);
    event Deposit(address indexed dst, uint256 wad);
    event Withdrawal(address indexed src, uint256 wad);

    receive() external payable {
        deposit();
    }

    function deposit() public payable {
        balanceOf[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 wad) public {
        require(balanceOf[msg.sender] >= wad, "WETH: insufficient");
        balanceOf[msg.sender] -= wad;
        (bool ok, ) = msg.sender.call{value: wad}("");
        require(ok, "WETH: send failed");
        emit Withdrawal(msg.sender, wad);
    }

    function totalSupply() public view returns (uint256) {
        return address(this).balance;
    }

    function approve(address guy, uint256 wad) public returns (bool) {
        allowance[msg.sender][guy] = wad;
        emit Approval(msg.sender, guy, wad);
        return true;
    }

    function transfer(address dst, uint256 wad) public returns (bool) {
        return transferFrom(msg.sender, dst, wad);
    }

    function transferFrom(address src, address dst, uint256 wad) public returns (bool) {
        require(balanceOf[src] >= wad, "WETH: insufficient");
        if (src != msg.sender && allowance[src][msg.sender] != type(uint256).max) {
            require(allowance[src][msg.sender] >= wad, "WETH: allowance");
            allowance[src][msg.sender] -= wad;
        }
        balanceOf[src] -= wad;
        balanceOf[dst] += wad;
        emit Transfer(src, dst, wad);
        return true;
    }
}
