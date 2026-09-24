// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IDayzroRegistry} from "./interfaces/IDayzroRegistry.sol";

/// @notice Fully onchain tokenURI (JSON + SVG) for Dayzro receivables.
library DayzroRenderer {
    using Strings for uint256;
    using Strings for address;

    function render(uint256 id, IDayzroRegistry.Receivable memory r, bool overdue, uint128 remaining)
        external
        view
        returns (string memory)
    {
        string memory symbol = _symbol(r.token);
        string memory status = _status(r.status, overdue);
        string memory face = string.concat(_amount(r.faceAmount), " ", symbol);
        string memory left = string.concat(_amount(remaining), " ", symbol);
        bool guaranteed = r.flags & 1 != 0;

        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 250" font-family="monospace">',
            '<rect width="400" height="250" rx="16" fill="#0B0F14"/>',
            '<text x="24" y="40" fill="#F5F5F0" font-size="20" font-weight="bold">DAYZRO #',
            id.toString(),
            "</text>",
            '<text x="24" y="92" fill="#F5F5F0" font-size="26">',
            face,
            "</text>",
            '<text x="24" y="124" fill="#9AA4B2" font-size="13">remaining ',
            left,
            "</text>",
            '<text x="24" y="150" fill="#9AA4B2" font-size="13">due ',
            uint256(r.dueDate).toString(),
            guaranteed ? " | guaranteed" : "",
            "</text>",
            '<text x="24" y="220" fill="',
            _statusColor(r.status, overdue),
            '" font-size="16">',
            status,
            "</text></svg>"
        );

        string memory json = string.concat(
            '{"name":"Dayzro Receivable #',
            id.toString(),
            '","description":"Buyer-accepted invoice on Arc. Payments flow to the current holder.",',
            '"attributes":[{"trait_type":"Status","value":"',
            status,
            '"},{"trait_type":"Token","value":"',
            symbol,
            '"},{"trait_type":"Face","value":"',
            _amount(r.faceAmount),
            '"},{"trait_type":"Remaining","value":"',
            _amount(remaining),
            '"},{"trait_type":"Guaranteed","value":"',
            guaranteed ? "yes" : "no",
            '"},{"display_type":"date","trait_type":"Due","value":',
            uint256(r.dueDate).toString(),
            '},{"trait_type":"Buyer","value":"',
            r.buyer.toHexString(),
            '"}],"image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '"}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function _symbol(address token) private view returns (string memory) {
        try IERC20Metadata(token).symbol() returns (string memory s) {
            return s;
        } catch {
            return "TOKEN";
        }
    }

    /// @dev Formats a 6-decimal amount as "1234.56".
    function _amount(uint256 v) private pure returns (string memory) {
        uint256 cents = (v % 1e6) / 1e4;
        return string.concat((v / 1e6).toString(), ".", cents < 10 ? "0" : "", cents.toString());
    }

    function _status(IDayzroRegistry.Status s, bool overdue) private pure returns (string memory) {
        if (s == IDayzroRegistry.Status.Pending) return "PENDING";
        if (s == IDayzroRegistry.Status.Accepted) return overdue ? "OVERDUE" : "ACCEPTED";
        if (s == IDayzroRegistry.Status.Paid) return "PAID";
        if (s == IDayzroRegistry.Status.Cancelled) return "CANCELLED";
        if (s == IDayzroRegistry.Status.Defaulted) return "DEFAULTED";
        return "NONE";
    }

    function _statusColor(IDayzroRegistry.Status s, bool overdue) private pure returns (string memory) {
        if (s == IDayzroRegistry.Status.Paid) return "#4ADE80";
        if (s == IDayzroRegistry.Status.Defaulted || overdue) return "#F87171";
        if (s == IDayzroRegistry.Status.Accepted) return "#60A5FA";
        return "#9AA4B2";
    }
}
