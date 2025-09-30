import "dotenv/config";
import { Polar } from "@polar-sh/sdk";

export type PolarServer = "sandbox" | "production";

export function createPolar(options?: { accessToken?: string; server?: PolarServer }) {
  const accessToken = options?.accessToken ?? process.env.POLAR_ACCESS_TOKEN ?? "";
  const server = (options?.server ?? (process.env.POLAR_SERVER as PolarServer)) || "production";
  return new Polar({ accessToken: accessToken.trim(), server });
}

export async function listCustomers(params: {
  organizationId: string;
  limit?: number;
  page?: number;
  query?: string;
  sorting?: string;
  accessToken?: string;
  server?: PolarServer;
}) {
  const opts: { accessToken?: string; server?: PolarServer } = {};
  if (params.accessToken) opts.accessToken = params.accessToken;
  if (params.server) opts.server = params.server;
  const polar = createPolar(opts);

  return polar.customers.list({
    organizationId: params.organizationId,
    limit: params.limit,
    page: params.page,
    query: params.query,
    sorting: params.sorting as any,
  } as any);
}

export async function createCustomer(params: {
  externalId: string;
  email: string;
  name?: string;
  accessToken?: string;
  server?: PolarServer;
}) {
  const opts: { accessToken?: string; server?: PolarServer } = {};
  if (params.accessToken) opts.accessToken = params.accessToken;
  if (params.server) opts.server = params.server;
  const polar = createPolar(opts);

  return polar.customers.create({
    externalId: params.externalId,
    email: params.email,
    name: params.name || params.email,
  });
}

export type CreatePolarCustomerParams = {
  userId: string;
  email: string;
  name?: string;
};

export type PolarCustomerResult = {
  id: string;
  created: boolean;
};

/**
 * Creates a Polar customer for a user, handling the case where the customer already exists
 */
export async function createPolarCustomer({
  userId,
  email,
  name,
}: CreatePolarCustomerParams): Promise<PolarCustomerResult> {
  const organizationId = process.env["POLAR_ORG_ID"];
  if (!organizationId) {
    throw new Error("POLAR_ORG_ID not set in environment");
  }

  const polar = createPolar();

  try {
    // Try to create new customer
    const polarCustomer = await polar.customers.create({
      externalId: userId,
      email: email,
      name: name || email,
    });

    return {
      id: polarCustomer.id,
      created: true,
    };
  } catch (error: any) {
    // If customer already exists, try to find them by email
    if (error.detail?.[0]?.msg?.includes("already exists")) {
      console.log(`Customer with email ${email} already exists, looking up existing customer...`);

      const existingCustomers = (await polar.customers.list({
        organizationId: organizationId,
        query: email,
        limit: 1,
      })) as any;

      if (existingCustomers.result?.items && existingCustomers.result.items.length > 0) {
        const existingCustomer = existingCustomers.result.items[0];
        console.log(`Found existing customer: ${existingCustomer.id}`);

        return {
          id: existingCustomer.id,
          created: false,
        };
      } else {
        throw new Error(`Customer with email ${email} already exists but could not be found`);
      }
    } else {
      throw error;
    }
  }
}
