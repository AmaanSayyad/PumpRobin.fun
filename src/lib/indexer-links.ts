/** External indexer URLs for token metadata and charts */

const CHAIN_SLUG = "robinhood";

export function dexScreenerTokenUrl(tokenAddress: string): string {
  return `https://dexscreener.com/${CHAIN_SLUG}/${tokenAddress.toLowerCase()}`;
}

export function dexScreenerUpdateInfoUrl(tokenAddress: string): string {
  return `${dexScreenerTokenUrl(tokenAddress)}?info=update`;
}

export function gmgnTokenUrl(tokenAddress: string): string {
  return `https://gmgn.ai/${CHAIN_SLUG}/token/${tokenAddress.toLowerCase()}`;
}

export function blockscoutTokenUrl(tokenAddress: string): string {
  return `https://robinhoodchain.blockscout.com/token/${tokenAddress.toLowerCase()}`;
}

export function blockscoutVerifyUrl(contractAddress: string): string {
  return `https://robinhoodchain.blockscout.com/address/${contractAddress.toLowerCase()}?tab=contract_verification`;
}
