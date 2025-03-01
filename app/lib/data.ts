import { sql } from "@vercel/postgres";
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  Revenue,
} from "./definitions";
import { formatCurrency } from "./utils";

export async function fetchRevenue() {
  try {
    const data = await sql<Revenue>`SELECT * FROM revenue`;
    return data.rows;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch revenue data.");
  }
}

export async function fetchLatestInvoices() {
  try {
    const data = await sql<LatestInvoiceRaw>`
      SELECT invoice.amount, customer.name, customer.image_url, customer.email, invoice.id
      FROM invoice
      JOIN customer ON invoice.customer_id = customer.id
      ORDER BY invoice.date DESC
      LIMIT 5`;

    const latestInvoices = data.rows.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    return latestInvoices;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch the latest invoices.");
  }
}

export async function fetchCardData() {
  try {
    // You can probably combine these into a single SQL query
    // However, we are intentionally splitting them to demonstrate
    // how to initialize multiple queries in parallel with JS.
    const invoiceCountPromise = sql`SELECT COUNT(*) FROM invoice`;
    const customerCountPromise = sql`SELECT COUNT(*) FROM customer`;
    const invoiceStatusPromise = sql`SELECT
         SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
         SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
         FROM invoice`;

    const data = await Promise.all([
      invoiceCountPromise,
      customerCountPromise,
      invoiceStatusPromise,
    ]);

    const numberOfInvoices = Number(data[0].rows[0].count ?? "0");
    const numberOfCustomers = Number(data[1].rows[0].count ?? "0");
    const totalPaidInvoices = formatCurrency(data[2].rows[0].paid ?? "0");
    const totalPendingInvoices = formatCurrency(data[2].rows[0].pending ?? "0");

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch card data.");
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const invoices = await sql<InvoicesTable>`
      SELECT
        invoice.id,
        invoice.amount,
        invoice.date,
        invoice.status,
        customer.name,
        customer.email,
        customer.image_url
      FROM invoice
      JOIN customer ON invoice.customer_id = customer.id
      WHERE
        customer.name ILIKE ${`%${query}%`} OR
        customer.email ILIKE ${`%${query}%`} OR
        invoice.amount::text ILIKE ${`%${query}%`} OR
        invoice.date::text ILIKE ${`%${query}%`} OR
        invoice.status ILIKE ${`%${query}%`}
      ORDER BY invoice.date DESC
      LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
    `;

    return invoices.rows;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoices.");
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    const count = await sql`SELECT COUNT(*)
    FROM invoice
    JOIN customer ON invoice.customer_id = customer.id
    WHERE
      customer.name ILIKE ${`%${query}%`} OR
      customer.email ILIKE ${`%${query}%`} OR
      invoice.amount::text ILIKE ${`%${query}%`} OR
      invoice.date::text ILIKE ${`%${query}%`} OR
      invoice.status ILIKE ${`%${query}%`}
  `;

    const totalPages = Math.ceil(Number(count.rows[0].count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch total number of invoices.");
  }
}

export async function fetchInvoiceById(id: string) {
  try {
    const data = await sql<InvoiceForm>`
      SELECT
        invoice.id,
        invoice.customer_id,
        invoice.amount,
        invoice.status
      FROM invoice
      WHERE invoice.id = ${id};
    `;

    const invoice = data.rows.map((invoice) => ({
      ...invoice,
      // Convert amount from cents to dollars
      amount: invoice.amount / 100,
    }));

    return invoice[0];
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoice.");
  }
}

export async function fetchCustomers() {
  try {
    const data = await sql<CustomerField>`
      SELECT
        id,
        name
      FROM customer
      ORDER BY name ASC
    `;

    const customers = data.rows;
    return customers;
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch all customers.");
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const data = await sql<CustomersTableType>`
		SELECT
		  customer.id,
		  customer.name,
		  customer.email,
		  customer.image_url,
		  COUNT(invoice.id) AS total_invoice,
		  SUM(CASE WHEN invoice.status = 'pending' THEN invoice.amount ELSE 0 END) AS total_pending,
		  SUM(CASE WHEN invoice.status = 'paid' THEN invoice.amount ELSE 0 END) AS total_paid
		FROM customer
		LEFT JOIN invoice ON customer.id = invoice.customer_id
		WHERE
		  customer.name ILIKE ${`%${query}%`} OR
        customer.email ILIKE ${`%${query}%`}
		GROUP BY customer.id, customer.name, customer.email, customer.image_url
		ORDER BY customer.name ASC
	  `;

    const customers = data.rows.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch customer table.");
  }
}
