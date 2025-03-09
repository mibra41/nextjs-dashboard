'use server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  try {
    // Clean existing data
    await prisma.$transaction([
      prisma.plaidAccount.deleteMany(),
      prisma.accountBalance.deleteMany(),
      prisma.session.deleteMany(),
      prisma.account.deleteMany(),
      prisma.verificationToken.deleteMany(),
      prisma.user.deleteMany(),
    ]);

    // Seed all data in a transaction
    await prisma.$transaction(async (tx) => {
      // Seed users
      const hashedPassword = await bcrypt.hash('123456', 10);
      const user = await tx.user.create({
        data: {
          name: 'Demo User',
          email: 'demo@example.com',
          password: hashedPassword,
          emailVerified: new Date(),
        },
      });

      // Create a demo plaid account
      const plaidAccount = await tx.plaidAccount.create({
        data: {
          userId: user.id,
          plaidId: 'demo_account_id',
          name: 'Demo Checking Account',
          mask: '1234',
          type: 'depository',
          subtype: 'checking',
          currentBalance: 1000.00,
          availableBalance: 950.00,
        },
      });

      // Create some historical balance records
      const now = new Date();
      const balanceHistory = Array.from({length: 30}, (_, i) => ({
        accountId: plaidAccount.id,
        balance: 1000 + (Math.random() * 200 - 100),
        available: 950 + (Math.random() * 200 - 100),
        timestamp: new Date(now.getTime() - (i * 24 * 60 * 60 * 1000))
      }));

      await Promise.all(
        balanceHistory.map(balance =>
          tx.accountBalance.create({
            data: balance
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
