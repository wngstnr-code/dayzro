// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {DayzroRegistry} from "../src/DayzroRegistry.sol";
import {DayzroFacility} from "../src/DayzroFacility.sol";
import {IDayzroRegistry} from "../src/interfaces/IDayzroRegistry.sol";

/// @notice Deploys DayzroRegistry (+ linked DayzroRenderer) and DayzroFacility to Arc.
/// Reads the repo-root .env (symlinked as contracts/.env):
///   DEPLOYER_PRIVATE_KEY, PROTOCOL_OWNER, PROTOCOL_TREASURY, PROTOCOL_FEE_BPS, USDC_ADDRESS, EURC_ADDRESS
///
/// Simulate: arc-forge script script/Deploy.s.sol --rpc-url $ARC_RPC_URL --network arc
/// Deploy:   add --broadcast --verify --verifier blockscout --verifier-url https://explorer.arc.io/api/
contract Deploy is Script {
    function run() external returns (DayzroRegistry registry, DayzroFacility facility) {
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(key);
        address owner = vm.envOr("PROTOCOL_OWNER", deployer);
        address treasury = vm.envOr("PROTOCOL_TREASURY", owner);
        uint16 feeBps = uint16(vm.envOr("PROTOCOL_FEE_BPS", uint256(25)));

        address[] memory tokens = new address[](2);
        tokens[0] = vm.envAddress("USDC_ADDRESS");
        tokens[1] = vm.envAddress("EURC_ADDRESS");

        vm.startBroadcast(key);
        registry = new DayzroRegistry(owner, tokens);
        facility = new DayzroFacility(IDayzroRegistry(address(registry)), owner, treasury, feeBps);
        vm.stopBroadcast();

        console2.log("DayzroRegistry:", address(registry));
        console2.log("DayzroFacility:", address(facility));
        console2.log("owner:", owner, "treasury:", treasury);
    }
}
