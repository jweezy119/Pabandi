import { IPaymentConnector, PaymentRailId } from './types';
import { SolanaConnector } from './solana.connector';
import { RaastConnector } from './raast.connector';
import { StripeConnector } from './stripe.connector';
import { JazzCashConnector } from './jazzcash.connector';

export * from './types';
export * from './solana.connector';
export * from './raast.connector';
export * from './stripe.connector';
export * from './jazzcash.connector';

export class ConnectorRegistry {
  private static instance: ConnectorRegistry;
  private connectors: Map<PaymentRailId, IPaymentConnector> = new Map();

  private constructor() {
    this.register(new SolanaConnector());
    this.register(new RaastConnector());
    this.register(new StripeConnector());
    this.register(new JazzCashConnector());
  }

  static getInstance(): ConnectorRegistry {
    if (!ConnectorRegistry.instance) {
      ConnectorRegistry.instance = new ConnectorRegistry();
    }
    return ConnectorRegistry.instance;
  }

  register(connector: IPaymentConnector): void {
    this.connectors.set(connector.railId, connector);
  }

  get(railId: PaymentRailId): IPaymentConnector | undefined {
    return this.connectors.get(railId);
  }

  getAll(): IPaymentConnector[] {
    return Array.from(this.connectors.values());
  }

  findCompatibleConnectors(currency: string, requireSharia?: boolean): IPaymentConnector[] {
    const normCurrency = currency.toUpperCase();
    return this.getAll().filter((c) => {
      const currencyMatch = c.supportedCurrencies.includes(normCurrency) || normCurrency === 'USD' || normCurrency === 'PKR';
      if (requireSharia && !c.isShariaCompliant) return false;
      return currencyMatch;
    });
  }
}

export const connectorRegistry = ConnectorRegistry.getInstance();

