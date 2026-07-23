// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract PumpRobinToken is ERC20 {
    address public immutable factory;
    address public immutable creator;
    string public imageUri;
    string public description;

    constructor(
        string memory name_,
        string memory symbol_,
        string memory imageUri_,
        string memory description_,
        address creator_
    ) ERC20(name_, symbol_) {
        factory = msg.sender;
        creator = creator_;
        imageUri = imageUri_;
        description = description_;
        _mint(msg.sender, 1_000_000_000 * 10 ** decimals());
    }
}
