"use client";

import { auth, signOut } from "@/auth";
import { useState, useEffect } from "react";
import { User } from "@/app/lib/definitions";
import {
  createLinkToken,
  handleLinkSuccess,
  checkUserAccessToken,
  getUserAccounts,
} from "@/app/lib/actions";
import { Button } from "@/app/ui/button";
import { usePlaidLink } from "react-plaid-link";
import { Suspense } from "react";
import { formatCurrency } from "@/app/lib/utils";
import {
  BanknotesIcon,
  ArrowPathIcon,
  CreditCardIcon,
  HomeIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";
import { redirect } from "next/navigation";

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-4">
      <ArrowPathIcon className="w-6 h-6 animate-spin text-gray-500" />
    </div>
  );
}

const getAccountIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case "depository":
      return BanknotesIcon;
    case "credit":
      return CreditCardIcon;
    case "loan":
      return HomeIcon;
    case "investment":
      return ArrowTrendingUpIcon;
    default:
      return BanknotesIcon;
  }
};

function AccountCard({ account }: { account: any }) {
  const Icon = getAccountIcon(account.type);

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Icon className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              {account.name}
            </h3>
            <p className="text-sm text-gray-500">
              {account.type} {account.mask ? `****${account.mask}` : ""}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-gray-900">
            {JSON.parse(account.currentBalance)}
          </p>
          {account.availableBalance !== null && (
            <p className="text-sm text-gray-500">
              {JSON.parse(account.availableBalance)} available
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 text-sm text-gray-500">
        Last updated: {new Date(account.lastUpdated).toLocaleDateString()}
      </div>
    </div>
  );
}

function AccountsList({ accounts }: { accounts: any[] }) {
  // Group accounts by type
  const groupedAccounts = accounts.reduce((acc, account) => {
    const type = account.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(account);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-6">
      {Object.entries(groupedAccounts).map(([type, accounts]) => (
        <div key={type}>
          <h2 className="text-lg font-semibold text-gray-900 mb-3 capitalize">
            {type} Accounts
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {accounts.map((account: any) => (
              <AccountCard key={account.id} account={account} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LinkAccountButton({
  linkToken,
  userId,
}: {
  linkToken: string;
  userId: string;
}) {
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (public_token, metadata) => {
      handleLinkSuccess(userId, public_token);
      console.log("Success:", public_token, metadata);
    },
    onExit: (err, metadata) => {
      if (err) console.log("Error:", err, metadata);
    },
  });

  return (
    <Button
      onClick={() => open()}
      disabled={!ready}
      className="inline-flex items-center gap-2"
    >
      <BanknotesIcon className="w-5 h-5" />
      Connect Your Bank Account
    </Button>
  );
}

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[] | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const session = await auth();
        if (session?.user?.id) {
          const user = session.user as User;
          const { access_token } = await checkUserAccessToken(user.id);
          user.access_token = access_token;
          setUser(user);
          if (access_token) {
            const { accounts, error } = await getUserAccounts(user.id);
            if (error) {
              console.error("Error fetching accounts:", error);
              throw new Error(error);
            }
            if (accounts) setAccounts(accounts);
          } else {
            const { linkToken } = await createLinkToken(user.id);
            setLinkToken(linkToken);
          }
        } else {
          console.log("No user found");
          signOut();
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            Welcome, {user?.name}
          </h1>
          <p className="text-gray-600 mt-1">
            {user?.access_token
              ? "Here's an overview of your connected accounts"
              : "Connect your bank account to get started."}
          </p>
        </div>

        <Suspense fallback={<LoadingSpinner />}>
          {user?.access_token ? (
            <div>
              {accounts ? (
                <>
                  <AccountsList accounts={accounts} />
                  <div className="mt-6 flex justify-center">
                    {linkToken ? (
                      <LinkAccountButton
                        linkToken={linkToken}
                        userId={user.id}
                      />
                    ) : (
                      <Button
                        onClick={async () => {
                          const { linkToken } = await createLinkToken(user.id);
                          setLinkToken(linkToken);
                        }}
                        className="inline-flex items-center gap-2"
                      >
                        <BanknotesIcon className="w-5 h-5" />
                        Connect Another Account
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <LoadingSpinner />
              )}
            </div>
          ) : linkToken ? (
            <div className="flex flex-col items-center py-8">
              <div className="text-center mb-4">
                <BanknotesIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h2 className="mt-2 text-lg font-medium text-gray-900">
                  No accounts connected
                </h2>
                <p className="mt-1 text-gray-500">
                  Get started by connecting your bank account
                </p>
              </div>
              <LinkAccountButton linkToken={linkToken} userId={user!.id} />
            </div>
          ) : (
            <div className="text-center text-gray-600">
              Loading connection details...
            </div>
          )}
        </Suspense>
      </div>
    </div>
  );
}
