// src/PabandiClient.ts
import axios from "axios";

// src/resources/Business.ts
var BusinessResource = class {
  constructor(client) {
    this.client = client;
  }
  client;
  async list(params) {
    const response = await this.client.get("/businesses", { params });
    return response.data;
  }
  async getById(id) {
    const response = await this.client.get(`/businesses/${id}`);
    return response.data;
  }
  async getMyBusiness() {
    const response = await this.client.get("/businesses/me");
    return response.data;
  }
  async register(data) {
    const response = await this.client.post("/businesses/register", data);
    return response.data;
  }
  async getCustomers() {
    const response = await this.client.get("/businesses/me/customers");
    return response.data;
  }
};

// src/resources/Auth.ts
var AuthResource = class {
  constructor(client) {
    this.client = client;
  }
  client;
  async register(data) {
    const response = await this.client.post("/auth/register", data);
    return response.data;
  }
  async login(data) {
    const response = await this.client.post("/auth/login", data);
    return response.data;
  }
  async getMe() {
    const response = await this.client.get("/auth/me");
    return response.data;
  }
};

// src/resources/Reliability.ts
var ReliabilityResource = class {
  constructor(client) {
    this.client = client;
  }
  client;
  async getMatrix(userId) {
    const response = await this.client.get(`/reliability/matrix/${userId}`);
    return response.data;
  }
  async verifyIdentity(data) {
    const response = await this.client.post("/reliability/verify", data);
    return response.data;
  }
};

// src/resources/Trust.ts
var TrustResource = class {
  constructor(client) {
    this.client = client;
  }
  client;
  async verify(walletAddress, requiredTier) {
    const body = { wallet_address: walletAddress };
    if (requiredTier) body.required_tier = requiredTier;
    const response = await this.client.post("/passport/verify", body);
    return response.data;
  }
  async eligibility(walletAddress, requiredTier) {
    const response = await this.client.post("/passport/eligibility", {
      wallet_address: walletAddress,
      required_tier: requiredTier
    });
    return response.data;
  }
  async recordIncident(walletAddress, type, description) {
    const response = await this.client.post("/passport/incidents", {
      wallet_address: walletAddress,
      type,
      description
    });
    return response.data;
  }
  async publicProfile(sellerId) {
    const response = await this.client.get(`/passport/public/${encodeURIComponent(sellerId)}`);
    return response.data;
  }
  async publicReviews(sellerId) {
    const response = await this.client.get(`/passport/public/${encodeURIComponent(sellerId)}/reviews`);
    return response.data;
  }
};

// src/resources/Escrow.ts
var EscrowResource = class {
  constructor(client) {
    this.client = client;
  }
  client;
  async createCheckout(input) {
    const payload = {
      businessId: input.sellerId,
      amount: input.amount,
      successUrl: input.metadata?.successUrl || "",
      cancelUrl: input.metadata?.cancelUrl || "",
      source: input.channel || "UNIVERSAL"
    };
    if (input.currency) payload.currency = input.currency;
    if (input.reference) payload.reference = input.reference;
    const response = await this.client.post("/checkout/embed-checkout", payload);
    return response.data;
  }
  async verifyBeforeCheckout(buyerWallet, requiredTier = "Gold") {
    const response = await this.client.post("/passport/eligibility", {
      wallet_address: buyerWallet,
      required_tier: requiredTier
    });
    return response.data;
  }
};

// src/PabandiClient.ts
var PabandiClient = class {
  client;
  business;
  auth;
  reliability;
  trust;
  escrow;
  constructor(options) {
    let baseURL = "https://pabandi-backend-97129395003.asia-south1.run.app/api/v1";
    if (options.environment === "development") {
      baseURL = "https://dev.api.pabandi.com/api/v1";
    } else if (options.environment === "local") {
      baseURL = "http://localhost:5000/api/v1";
    }
    const headers = {
      "Content-Type": "application/json"
    };
    if (options.apiKey) {
      headers["x-api-key"] = options.apiKey;
    }
    if (options.bearerToken) {
      headers["Authorization"] = `Bearer ${options.bearerToken}`;
    }
    this.client = axios.create({
      baseURL,
      headers
    });
    this.business = new BusinessResource(this.client);
    this.auth = new AuthResource(this.client);
    this.reliability = new ReliabilityResource(this.client);
    this.trust = new TrustResource(this.client);
    this.escrow = new EscrowResource(this.client);
  }
};
export {
  AuthResource,
  BusinessResource,
  EscrowResource,
  PabandiClient,
  ReliabilityResource,
  TrustResource
};
