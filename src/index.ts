import type { ExternalProvider } from '@ethersproject/providers'
import type { Actions, ProviderRpcError } from '@web3-react/types'
import { Connector } from '@web3-react/types'

// export interface MagicConnectorArguments extends MagicSDKAdditionalConfiguration {
//   apiKey: string
// }
interface TorusConnectorArguments {
  initOptions?: any
  constructorOptions?: any
  loginOptions?: any
  chainId: number,
  connectEagerly?: boolean
}
export class Torus extends Connector {
  public provider: any
  private readonly initOptions: any
  private readonly constructorOptions: any
  private readonly loginOptions: any
  private readonly chainId: number
  private eagerConnection?: Promise<void>

  public torus?: any

  constructor(actions: Actions,connectEagerly = false, {chainId, initOptions = {}, constructorOptions = {}, loginOptions = {}}:TorusConnectorArguments) {
    super(actions)
    this.chainId = chainId
    this.initOptions = initOptions
    this.constructorOptions = constructorOptions
    this.loginOptions = loginOptions    

    if (connectEagerly && this.serverSide) {
      throw new Error('connectEagerly = true is invalid for SSR, instead use the connectEagerly method in a useEffect')
    }

    if (connectEagerly) void this.connectEagerly()

  }

  private async startListening(configuration: any): Promise<void> {
     
    if(!this.torus){
      return import('@toruslabs/torus-embed').then(async (m) => {
        this.torus = new m.default(this.constructorOptions)
        
        await this.torus.init(this.initOptions)

        const [Web3Provider, Eip1193Bridge] = await Promise.all([
          import('@ethersproject/providers').then(({ Web3Provider }) => Web3Provider),
          import('@ethersproject/experimental').then(({ Eip1193Bridge }) => Eip1193Bridge),
        ])
  
        await this.torus.login(this.loginOptions)
        const provider = new Web3Provider(this.torus.provider as unknown as ExternalProvider)
  
        this.provider = new Eip1193Bridge(provider.getSigner(), provider)
      })
    }
  }

  public async activate(configuration: any): Promise<void> {
    this.actions.startActivation()

    await this.startListening(configuration).catch((error: Error) => {
      this.actions.reportError(error)
    })

    if (this.provider) {
      await Promise.all([
        this.provider.request({ method: 'eth_chainId' }) as Promise<string>,
        this.provider.request({ method: 'eth_accounts' }) as Promise<string[]>,
      ])
        .then(([chainId, accounts]) => {
          this.actions.update({ chainId: Number.parseInt(chainId, 16), accounts })
        })
        .catch((error: Error) => {
          this.actions.reportError(error)
        })
    }
  }


  private async isomorphicInitialize(): Promise<void> {
    if (this.eagerConnection) return this.eagerConnection

    await (this.eagerConnection = import('@toruslabs/torus-embed').then(async (m) => {
      this.torus = new m.default(this.constructorOptions)
      
      await this.torus.init(this.initOptions)

      const [Web3Provider, Eip1193Bridge] = await Promise.all([
        import('@ethersproject/providers').then(({ Web3Provider }) => Web3Provider),
        import('@ethersproject/experimental').then(({ Eip1193Bridge }) => Eip1193Bridge),
      ])

      await this.torus.login(this.loginOptions)
      const provider = new Web3Provider(this.torus.provider as unknown as ExternalProvider)

      this.provider = new Eip1193Bridge(provider.getSigner(), provider)


    if (this.provider) {
      await Promise.all([
        this.provider.request({ method: 'eth_chainId' }) as Promise<string>,
        this.provider.request({ method: 'eth_accounts' }) as Promise<string[]>,
      ])
        .then(([chainId, accounts]) => {
          this.actions.update({ chainId: Number.parseInt(chainId, 16), accounts })
        })
        .catch((error: Error) => {
          this.actions.reportError(error)
        })
    }
    })
    )
  }

   /** {@inheritdoc Connector.connectEagerly} */
   public async connectEagerly(): Promise<void> {
    await this.isomorphicInitialize()
   }

  public async deactivate(error?:Error): Promise<void> {
    console.log('before disconnect')
    await this.torus?.logout();
    await this.torus?.cleanUp();
    console.log('after disconnect')
    this.torus = undefined;
    this.eagerConnection = undefined;
    this.actions.reportError(error);
  }

}