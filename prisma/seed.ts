import { PrismaClient } from '@prisma/client';
import { users, customers, invoices, revenue } from '../app/lib/placeholder-data';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  try {
    // Clean existing data
    await prisma.$transaction([
      prisma.invoice.deleteMany(),
      prisma.customer.deleteMany(),
      prisma.revenue.deleteMany(),
      prisma.user.deleteMany(),
    ]);

    // Seed all data in a transaction
    await prisma.$transaction(async (tx: PrismaClient) => {
      // Seed users
      const hashedPassword = await bcrypt.hash('123456', 10);
      await Promise.all(
        users.map((user) =>
          tx.user.create({
            data: {
              id: user.id,
              name: user.name,
              email: user.email,
              password: hashedPassword,
            },
          })
        )
      );

      // Seed customers
      await Promise.all(
        customers.map((customer) =>
          tx.customer.create({
            data: {
              id: customer.id,
              name: customer.name,
              email: customer.email,
              imageUrl: customer.image_url,
            },
          })
        )
      );

      // Seed invoices
      await Promise.all(
        invoices.map((invoice) =>
          tx.invoice.create({
            data: {
              customerId: invoice.customer_id,
              amount: invoice.amount,
              status: invoice.status,
              date: new Date(invoice.date),
            },
          })
        )
      );

      // Seed revenue
      await Promise.all(
        revenue.map((rev) =>
          tx.revenue.create({
            data: {
              month: rev.month,
              revenue: rev.revenue,
            },
          })
        )
      );
    });

    console.log('Database seeded successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((err) => {
    console.error('Error seeding database:', err);
    process.exit(1);
  });
