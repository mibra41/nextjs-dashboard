"use server";

import { z } from "zod";
import bcrypt from "bcrypt";
import { sql } from "@vercel/postgres";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { PrismaClient } from "@prisma/client";
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  CountryCode,
  Products,
} from "plaid";

const prisma = new PrismaClient();
const config = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

const plaid = new PlaidApi(config);

async function getAccountBalances(accessToken: string) {
  try {
    const response = await plaid.accountsBalanceGet({
      access_token: accessToken,
    });
    return response.data.accounts;
  } catch (error: any) {
    if (error.response?.data?.error_code === 'ITEM_LOGIN_REQUIRED') {
      throw new Error('Bank connection needs to be re-authenticated');
    }
    console.error("Error fetching account balances:", error);
    throw error;
  }
}

interface AccessTokenResult {
  access_token: string | null;
  errors?: any[];
  message?: string;
}

export async function checkUserAccessToken(userId: string): Promise<AccessTokenResult> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { access_token: true }
    });

    if (!user?.access_token) {
      return { access_token: null, errors: [], message: "No access token found" };
    }
    return { access_token: user.access_token, errors: [], message: "Access token found" };
  } catch (error) {
    console.error('Error checking access token:', error);
    return {
      access_token: null,
      errors: [error],
      message: "Database Error: Failed to Fetch Access Token.",
    };
  }
}

export async function handleLinkSuccess(userId: string, publicToken: string) {
  try {
    const exchangeResponse = await plaid.itemPublicTokenExchange({
      public_token: publicToken,
    });
    const accessToken = exchangeResponse.data.access_token;

    // Store accessToken in your database
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { access_token: accessToken }
      });
    } catch (error) {
      return { errors: {}, message: "Database Error: Failed to Update User." };
    }

    try {
      const accountsWithBalances = await getAccountBalances(accessToken);
      return accountsWithBalances;
    } catch (error: any) {
      if (error.response?.data?.error_code === 'ITEM_LOGIN_REQUIRED') {
        await prisma.user.update({
          where: { id: userId },
          data: { access_token: null }
        });
        throw new Error('Bank connection needs to be re-authenticated');
      }
      throw error;
    }
  } catch (error) {
    console.error("Plaid API error:", error);
    throw error;
  }
}

export async function createLinkToken(userId: string) {
  const request = {
    user: { client_user_id: userId },
    client_name: "Finale",
    products: ["auth", "transactions"] as Products[],
    country_codes: [CountryCode.Us],
    language: "en",
  };

  try {
    const response = await plaid.linkTokenCreate(request);
    return { linkToken: response.data.link_token };
  } catch (error) {
    console.error("Error creating link token:", error);
    throw error;
  }
}

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
    name?: string[];
    email?: string[];
    password?: string[];
  };
  message?: string | null;
};

export async function authenticate(
  prevState: State | undefined,
  formData: FormData
) {
  try {
    await signIn("credentials", formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { message: "Invalid credentials." };
        default:
          return { message: "Something went wrong." };
      }
    }
    throw error;
  }
  return { ...prevState };
}

const SignupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function createUser(
  prevState: State | undefined,
  formData: FormData
) {
  const validatedFields = SignupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Missing Fields. Failed to Create User.",
    };
  }

  const { name, email, password } = validatedFields.data;

  try {
    if (email) {
      const existingUser = await prisma.user.findUnique({
        where: {
          email: email,
        },
      });

      if (existingUser) {
        return { message: "User with this email already exists" };
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name: name,
        email: email,
        password: hashedPassword,
      },
    });
  } catch (error) {
    return {
      message: "Database Error: Failed to Create User.",
    };
  } finally {
    await prisma.$disconnect();
  }
  redirect("/login");
  return { ...prevState };
}
