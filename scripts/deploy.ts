import { ethers } from "hardhat";

const FEE_COLLECTOR =
  process.env.FEE_COLLECTOR || "0x61F928CBbc9b65C404C3DB42BDe403D78954aDD9";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Fee collector:", FEE_COLLECTOR);

  const Factory = await ethers.getContractFactory("PumpRobinFactory");
  const factory = await Factory.deploy(FEE_COLLECTOR);
  await factory.waitForDeployment();

  const address = await factory.getAddress();
  console.log("PumpRobinFactory deployed to:", address);
  console.log("\nSet in .env:");
  console.log(`NEXT_PUBLIC_FACTORY_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
