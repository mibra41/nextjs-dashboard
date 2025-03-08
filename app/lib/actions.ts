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
    console.log(response);
    return response.data.accounts; // Array of accounts with balances
  } catch (error) {
    console.error("Error fetching account balances:", error);
    throw error;
  }
}

interface AccessTokenResult {
  access_token: string | null;
  errors?: { [key: string]: string };
  message?: string;
}

export async function checkUserAccessToken(userId: string):  Promise<AccessTokenResult>{
  try {
    const result = await sql`
            SELECT access_token FROM "user" 
            WHERE id = ${userId}
          `;
    if (result.rows.length > 0) {
      return { access_token: result.rows[0].access_token };
    } else {
      return { access_token: null }; // User not found, or no access token.
    }
  } catch (error) {
    return {
      access_token: null,
      errors: {},
      message: "Database Error: Failed to Fetch Access Token.",
    };
  }
}

export async function handleLinkSuccess(userId: string, publicToken: string) {
  try {
    // Exchange public_token for access_token
    const exchangeResponse = await plaid.itemPublicTokenExchange({
      public_token: publicToken,
    });
    const accessToken = exchangeResponse.data.access_token;

    // Store accessToken in your database
    try {
      await sql`
            UPDATE "user"
            SET access_token = ${accessToken}
            WHERE id = ${userId}
          `;
    } catch (error) {
      return { errors: {}, message: "Database Error: Failed to Update User." };
    }

    // Get account balances
    const accountsWithBalances = await getAccountBalances(accessToken);

    // Send data back to client, or store in database

    console.log("accounts with balances:", accountsWithBalances);
    return accountsWithBalances;
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

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({ invalid_type_error: "Please select a customer." }),
  amount: z.coerce
    .number()
    .gt(0, { message: "Please enter an amount greater than $0." }),
  status: z.enum(["pending", "paid"], {
    invalid_type_error: "Please select an invoice status.",
  }),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });

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

export async function createInvoice(prevState: State, formData: FormData) {
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });

  // If form validation fails, return errors early. Otherwise, continue.
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Missing Fields. Failed to Create Invoice.",
    };
  }

  // Prepare data for insertion into the database
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split("T")[0];

  try {
    await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
      `;
  } catch (error) {
    return { errors: {}, message: "Database Error: Failed to Create Invoice." };
  }

  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
  return { ...prevState };
}

const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function updateInvoice(
  id: string,
  prevState: State,
  formData: FormData
) {
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Missing Fields. Failed to Update Invoice.",
    };
  }

  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;

  try {
    await sql`
          UPDATE invoices
          SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
          WHERE id = ${id}
        `;
  } catch (error) {
    return { errors: {}, message: "Database Error: Failed to Update Invoice." };
  }

  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
  return { ...prevState };
}

export async function deleteInvoice(id: string) {
  await sql`DELETE FROM invoices WHERE id = ${id}`;
  revalidatePath("/dashboard/invoices");
}

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
