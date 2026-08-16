// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PumpRobinHook} from "../contracts/PumpRobinHook.sol";
import {PumpRobinFactory} from "../contracts/PumpRobinFactory.sol";
import {IPoolManager} from "../contracts/v4/V4Types.sol";

/// @notice Mines a CREATE2 salt so the hook address encodes permission flags 0x2ECC, then deploys factory.
contract DeployPumpRobin is Script {
    uint160 internal constant FLAGS = 0x2ECC;
    uint160 internal constant FLAG_MASK = 0x3FFF;
    address internal constant POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;
    address internal constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address internal constant FEE_COLLECTOR = 0x61F928CBbc9b65C404C3DB42BDe403D78954aDD9;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        bytes memory ctorArgs = abi.encode(
            IPoolManager(POOL_MANAGER),
            WETH,
            FEE_COLLECTOR,
            deployer
        );
        bytes memory initCode = abi.encodePacked(type(PumpRobinHook).creationCode, ctorArgs);
        bytes32 initCodeHash = keccak256(initCode);

        (bytes32 salt, address hookAddr) = mine(deployer, initCodeHash);
        require(hookAddr != address(0), "Could not mine hook salt");
        console.log("Hook salt:");
        console.logBytes32(salt);
        console.log("Hook address:", hookAddr);

        vm.startBroadcast(pk);
        PumpRobinHook hook = new PumpRobinHook{salt: salt}(
            IPoolManager(POOL_MANAGER),
            WETH,
            FEE_COLLECTOR,
            deployer
        );
        require(address(hook) == hookAddr, "CREATE2 mismatch");

        PumpRobinFactory factory = new PumpRobinFactory(FEE_COLLECTOR, address(hook));
        hook.setFactory(address(factory));
        vm.stopBroadcast();

        console.log("Factory:", address(factory));
        console.log("Set NEXT_PUBLIC_FACTORY_ADDRESS and NEXT_PUBLIC_HOOK_ADDRESS");
    }

    function mine(address deployer, bytes32 initCodeHash) internal pure returns (bytes32 salt, address predicted) {
        for (uint256 i = 0; i < 800_000; i++) {
            bytes32 s = bytes32(i);
            address addr = address(
                uint160(
                    uint256(
                        keccak256(abi.encodePacked(bytes1(0xff), deployer, s, initCodeHash))
                    )
                )
            );
            if (uint160(addr) & FLAG_MASK == FLAGS) {
                return (s, addr);
            }
        }
    }
}
