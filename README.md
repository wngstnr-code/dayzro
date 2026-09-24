# Dayzro

**Get paid on day zero.** Buyer-accepted invoices as transferable onchain receivables on [Arc](https://arc.io).

A supplier issues an invoice, the buyer accepts it onchain, and the invoice becomes an ERC-721 receivable. The supplier can sell it to a financier facility and receive USDC in the same transaction at a price computed onchain. At maturity the buyer pays the contract and the funds flow to whoever holds the receivable. Every payment builds the buyer's onchain credit record.

No backend: contracts plus a static frontend reading Arc directly.

## Repository

| Path | Contents |
|---|---|
| `contracts/` | Foundry project (Arc Foundry): `DayzroRegistry`, `DayzroFacility`, `DayzroRenderer`, tests, deploy script |
| `docs/` | Hackathon notes, idea validation, contract design |
| `.env.example` | Single env file shared by contracts and frontend |

## Contracts

- **DayzroRegistry**: invoice lifecycle (Pending, Accepted, Paid, Cancelled, Defaulted), EIP-712 / ERC-1271 acceptance, payments routed to the current holder, buyer guarantees, onchain buyer stats, per-holder exposure.
- **DayzroFacility**: financier liquidity with discount APR, max tenor and per-buyer caps; instant sale with protocol fee (capped at 1%).
- **DayzroRenderer**: fully onchain SVG tokenURI.

Arc-native integrations: USDC and EURC, the Memo contract for invoice references, Multicall3From for approve and pay in one transaction, EIP-2612 permit.

## Development

Requires [Arc Foundry](https://github.com/circlefin/arc-foundry) (`arc-forge`).

```bash
git clone --recurse-submodules https://github.com/wngstnr-code/dayzro
cp .env.example .env
cd contracts
arc-forge test --no-match-path 'test/fork/*'
arc-forge test --match-path 'test/fork/*' --fork-url https://rpc.mainnet.arc.io --network arc
```

Deploy (simulate first, then add `--broadcast`):

```bash
arc-forge script script/Deploy.s.sol --rpc-url https://rpc.mainnet.arc.io --network arc
```

## License

MIT
