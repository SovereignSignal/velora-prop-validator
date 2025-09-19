# Velora Prop Validator

A community Vibe Coded tool for validating Velora DAO proposals. Protect treasury funds by ensuring merkle roots match distribution data.

## Overview

DAOs distribute millions of dollars in tokens through Snapshot proposals every month. These distributions rely on merkle trees - cryptographic proofs that ensure each recipient gets exactly what they're owed. The Velora Verification System makes it simple for anyone to verify these distributions are correct before voting.

## Features

- **Instant Verification**: Verify distributions in seconds, not minutes
- **Multiple Formats**: Supports OpenZeppelin, Uniswap, and custom merkle tree formats
- **IPFS Integration**: Automatic fallback across multiple IPFS gateways
- **Comprehensive Validation**: Address validation, duplicate detection, anomaly detection
- **Statistical Analysis**: Distribution metrics, concentration analysis, outlier detection
- **User-Friendly**: No technical knowledge required - just paste a Snapshot URL

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm or yarn package manager

### Installation

1. Clone or download the repository:
```bash
git clone <your-repository-url>
cd velora-prop-validator
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Run the development server:
```bash
npm run dev  # Uses Next.js with Turbopack
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Available Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production with Turbopack  
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Usage

### Basic Verification

1. Navigate to the main page
2. Paste a Snapshot proposal URL (e.g., `https://snapshot.org/#/space.eth/proposal/0x...`)
3. Click "Verify Distribution"
4. Review the results showing whether the merkle root matches

### Advanced Options

Click "Show Advanced Options" to access:
- Manual IPFS verification with custom CID
- Local JSON file verification
- Custom merkle tree format selection

### Understanding Results

- **Green Checkmark**: Merkle root matches - distribution is correct
- **Red X**: Merkle root mismatch - distribution has errors
- **Validation Checks**: Additional checks for duplicates, invalid addresses, outliers
- **Statistics**: Distribution metrics including total amount, recipient count, concentration risk

## Technical Architecture

### Core Components

- **Merkle Engine**: Supports multiple encoding formats (OpenZeppelin, Uniswap, custom)
- **IPFS Gateway Manager**: Automatic fallback across 7 public gateways
- **Snapshot Integration**: GraphQL API integration for proposal data
- **Validators**: Comprehensive validation for addresses, amounts, and distributions

### Supported Merkle Formats

1. **OpenZeppelin**: Double-hashed encoding `keccak256(keccak256(abi.encode(address, amount)))`
2. **Uniswap**: Indexed encoding `keccak256(abi.encode(index, address, amount))`
3. **Custom**: Simple packed encoding `keccak256(abi.encodePacked(address, amount))`

### API Endpoints

- `POST /api/verify`: Main verification endpoint
  - Body: `{ url: string, format?: string }`
  - Returns: Complete verification result with merkle comparison and statistics

## Project Structure

```
velora-prop-validator/
├── app/                      # Next.js app directory
│   ├── api/                  # API routes
│   └── page.tsx             # Main UI
├── components/              # React components
├── lib/                     # Core logic
│   ├── merkle/             # Merkle tree implementation
│   ├── validators/         # Data validators
│   └── integrations/       # External integrations
└── types/                   # TypeScript types
```

## Configuration

### Environment Variables

Create a `.env.local` file:

```bash
# Optional: Custom RPC endpoint for contract detection
NEXT_PUBLIC_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

# Optional: Custom Snapshot GraphQL endpoint
NEXT_PUBLIC_SNAPSHOT_API=https://hub.snapshot.org/graphql
```


## Deployment

### Vercel (Recommended)

1. Push to your repository
2. Import to Vercel
3. Deploy with default Next.js settings

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to your fork
5. Open a pull request

## Security

- All verification happens client-side - no sensitive data is stored
- IPFS data is fetched over HTTPS
- Address validation includes checksum verification
- No wallet connection required

## License

MIT License - see LICENSE file for details

## Acknowledgments

- A community Vibe Coded tool for the Velora DAO ecosystem
- Built with Next.js 15.5.3, TypeScript, and Tailwind CSS v4
- Uses Turbopack for fast builds and hot module replacement
- Merkle tree implementation using merkletreejs
- IPFS integration with multi-gateway fallback
- Snapshot GraphQL API for proposal data

## Support

For issues, questions, or suggestions:
- Open an issue on GitHub

---

A community Vibe Coded tool for validating Velora DAO proposals.
