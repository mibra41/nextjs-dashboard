import { Suspense } from 'react';
import { auth } from '@/auth';
import { createLinkToken } from '@/app/lib/actions';
import { fetchUserAccounts } from '@/app/lib/data/accounts';
import { PlaidLink } from 'react-plaid-link';
import { Button } from '@/app/ui/button';
import { redirect } from "next/navigation";

function LinkAccountButton({ linkToken }: { linkToken: string }) {
  return (
    <PlaidLink
      token={linkToken}
      onSuccess={(public_token, metadata) => {
        // Submit form with public token and metadata
        const form = document.createElement('form');
        form.method = 'POST';
        
        const tokenInput = document.createElement('input');
        tokenInput.type = 'hidden';
        tokenInput.name = 'public_token';
        tokenInput.value = public_token;
        
        const metadataInput = document.createElement('input');
        metadataInput.type = 'hidden';
        metadataInput.name = 'metadata';
        metadataInput.value = JSON.stringify(metadata);
        
        form.appendChild(tokenInput);
        form.appendChild(metadataInput);
        document.body.appendChild(form);
        form.submit();
      }}
    >
      <Button>Link a New Account</Button>
    </PlaidLink>
  );
}

function AccountList({ accounts }: { accounts: Awaited<ReturnType<typeof fetchUserAccounts>> }) {
  if (accounts.length === 0) {
    return (
      <div className="rounded-lg bg-gray-50 p-6 text-center">
        <h3 className="text-sm font-medium">No accounts linked yet</h3>
        <p className="mt-1 text-sm text-gray-500">Get started by linking your first account.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 flow-root">
      <div className="inline-block min-w-full align-middle">
        <div className="rounded-lg bg-gray-50 p-2 md:pt-0">
          <div className="md:hidden">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="mb-2 w-full rounded-md bg-white p-4"
              >
                <div className="flex items-center justify-between border-b pb-4">
                  <div>
                    <div className="mb-2 flex items-center">
                      <p className="font-semibold">{account.institution_name}</p>
                    </div>
                    <p className="text-sm text-gray-500">{account.name}</p>
                  </div>
                </div>
                <div className="flex w-full items-center justify-between pt-4">
                  <div>
                    <p className="text-xl font-medium">
                      ${account.balance_current.toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-500">Current Balance</p>
                  </div>
                  {account.balance_available !== null && (
                    <div className="text-right">
                      <p className="text-xl font-medium">
                        ${account.balance_available.toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-500">Available Balance</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <table className="hidden min-w-full text-gray-900 md:table">
            <thead className="rounded-lg text-left text-sm font-normal">
              <tr>
                <th scope="col" className="px-4 py-5 font-medium">
                  Institution
                </th>
                <th scope="col" className="px-4 py-5 font-medium">
                  Account
                </th>
                <th scope="col" className="px-4 py-5 font-medium">
                  Type
                </th>
                <th scope="col" className="px-4 py-5 font-medium text-right">
                  Current Balance
                </th>
                <th scope="col" className="px-4 py-5 font-medium text-right">
                  Available Balance
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {accounts.map((account) => (
                <tr
                  key={account.id}
                  className="w-full border-b py-3 text-sm last-of-type:border-none"
                >
                  <td className="whitespace-nowrap px-4 py-3">
                    {account.institution_name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {account.name} {account.mask ? `(${account.mask})` : ''}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 capitalize">
                    {account.type} {account.subtype ? `- ${account.subtype}` : ''}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    ${account.balance_current.toFixed(2)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {account.balance_available !== null
                      ? `$${account.balance_available.toFixed(2)}`
                      : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [accounts, { linkToken }] = await Promise.all([
    fetchUserAccounts(session.user.id),
    createLinkToken(session.user.id),
  ]);

  return (
    <main className="w-full">
      <div className="flex w-full items-center justify-between">
        <h1 className="text-2xl">Linked Accounts</h1>
        {linkToken && <LinkAccountButton linkToken={linkToken} />}
      </div>
      <Suspense fallback={<div>Loading accounts...</div>}>
        <AccountList accounts={accounts} />
      </Suspense>
    </main>
  );
}
