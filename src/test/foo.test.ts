import { Call, Multicall } from "../multicall"
import * as dotenv from "dotenv"
import { ethers } from "ethers"

dotenv.config()

const RPC_URL = process.env.MAINNET_RPC_URL || ""

describe("Test Multicall", () => {
  it("Test", async () => {
    const calls: Call[] = [
      {
        target: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        methodName: "balanceOf",
        params: [
          {
            type: "address",
            value: "0x0000000000000000000000000000000000000000",
          },
        ],
        returnTypes: [
          {
            type: "uint256",
            name: "balance",
          },
        ],
      },
    ]

    const multicall = new Multicall({
      provider: new ethers.providers.JsonRpcProvider(RPC_URL),
      chainId: 1,
    })

    const data = await multicall.getData(calls)

    console.log(data)
  })
})
