/** Pinata IPFS helpers (server-only). */

const PINATA_PIN_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";

export function pinataGatewayUrl(cid: string): string {
  const base =
    process.env.NEXT_PUBLIC_PINATA_GATEWAY?.replace(/\/$/, "") ||
    "https://gateway.pinata.cloud/ipfs";
  return `${base}/${cid}`;
}

export async function pinFileToIpfs(
  file: Blob,
  filename: string
): Promise<{ cid: string; url: string }> {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    throw new Error("PINATA_JWT is not configured");
  }

  const form = new FormData();
  form.append("file", file, filename);
  form.append(
    "pinataMetadata",
    JSON.stringify({ name: filename.slice(0, 120) })
  );
  form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  const res = await fetch(PINATA_PIN_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pinata upload failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as { IpfsHash: string };
  if (!json.IpfsHash) {
    throw new Error("Pinata response missing IpfsHash");
  }

  return { cid: json.IpfsHash, url: pinataGatewayUrl(json.IpfsHash) };
}
