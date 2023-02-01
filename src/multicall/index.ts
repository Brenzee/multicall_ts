import { ChainId, MULTICALL_CONTRACT_ADDRESSES } from "../constants"

import MulticallABI from "../ABI/multicall.abi.json"
import { ethers } from "ethers"

type Address = `0x${string}`

export interface Param {
  type: string
  value: string
}

export interface Call {
  target: Address
  methodName: string
  params: Param[]
  returnTypes: { type: string; name: string }[]
}

type ReturnNameType<C extends Call> = C["returnTypes"][number]["name"]
type ReturnObjectKey<C extends Call> = `${C["target"]}_${number}_${C["returnTypes"][number]["name"]}`
type ReturnValue = string | boolean

export class Multicall {
  private provider: ethers.providers.Provider
  private chainId: ChainId | number
  private multicallContract: ethers.Contract
  private blockNumber?: number

  constructor({
    provider,
    chainId,
    blockNumber,
    multicallContractAddress,
  }: {
    provider: ethers.providers.Provider
    chainId: ChainId
    blockNumber?: number
    multicallContractAddress?: string
  }) {
    this.provider = provider
    this.chainId = chainId
    this.blockNumber = blockNumber

    if (!multicallContractAddress) {
      multicallContractAddress = MULTICALL_CONTRACT_ADDRESSES[this.chainId as keyof typeof MULTICALL_CONTRACT_ADDRESSES]

      if (!multicallContractAddress) {
        throw new Error(
          `Multicall library does not support chainId ${chainId}. Please provide a multicallContractAddress.`
        )
      }
    }

    this.multicallContract = new ethers.Contract(multicallContractAddress, MulticallABI, this.provider)
  }

  public getData = async <C extends Call>(calls: C[]) => {
    const preparedCalls = calls.map((call) => {
      const { methodName, params, target } = call
      const abiInterface = new ethers.utils.Interface([`function ${methodName}(${params.map((param) => param.type)}) `])
      return {
        target,
        callData: abiInterface.encodeFunctionData(
          methodName,
          params.map((p) => p.value)
        ),
      }
    })

    const { returnData } = await this.multicallContract.callStatic.aggregate(preparedCalls)

    const decodedReturnData = calls.map((call, i) => {
      const { returnTypes } = call
      const iface = new ethers.utils.Interface([
        `function ${call.methodName}(${call.params.map((param) => param.type)}) returns (${returnTypes.map(
          (returnType) => returnType.type
        )})`,
      ])

      const decodedData = iface.decodeFunctionResult(call.methodName, returnData[i])
      return decodedData
    })

    const callReturnDataAsObject = decodedReturnData.map((data, i) => {
      const result = data.reduce((acc, value, index) => {
        const { name } = calls[i].returnTypes[index]

        if (ethers.BigNumber.isBigNumber(value)) {
          return { ...acc, [name]: value.toString() }
        }
        return { ...acc, [name]: value as ReturnValue }
      }, {}) as Record<ReturnNameType<C>, ReturnValue>
      return result
    })

    const decodedReturnDataAsArrays = decodedReturnData.map((data) => {
      return data.map((value) => {
        if (ethers.BigNumber.isBigNumber(value)) {
          return value.toString()
        }
        return value as ReturnValue
      })
    })

    const returnDataAsObject = decodedReturnData.reduce((acc, data, i) => {
      const reducedData = data.reduce((acc, value, index) => {
        const call = calls[i]
        const { name } = call.returnTypes[index]

        const key = `${call.target}_${i}_${name}`
        if (ethers.BigNumber.isBigNumber(value)) {
          return { ...acc, [key]: value.toString() }
        }
        return { ...acc, [key]: value }
      }, {} as Record<ReturnObjectKey<C>, ReturnValue>)
      return { ...acc, ...reducedData }
    }, {} as Record<ReturnObjectKey<C>, ReturnValue>)

    return {
      data: callReturnDataAsObject,
      dataArray: decodedReturnDataAsArrays,
      dataObject: returnDataAsObject,
    }
  }
}
