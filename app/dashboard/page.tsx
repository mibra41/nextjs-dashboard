"use client";

import { auth } from "@/auth";
import { useState, useEffect } from "react";
import { User } from "@/app/lib/definitions";
import {
  createLinkToken,
  handleLinkSuccess,
  checkUserAccessToken,
} from "@/app/lib/actions";
import { Button } from "@/app/ui/button";
import { usePlaidLink } from "react-plaid-link";
import { Suspense } from "react";
import { ArrowPathIcon, BanknotesIcon } from "@heroicons/react/24/outline";

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-4">
      <ArrowPathIcon className="w-6 h-6 animate-spin text-gray-500" />
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

  useEffect(() => {
    async function fetchUser() {
      try {
        const session = await auth();
        if (session?.user) {
          if (session.user.id) {
            const { access_token } = await checkUserAccessToken(
              session.user.id
            );
            const user = session.user as User;
            user.access_token = access_token;
            setUser(user);
            if (!access_token) {
              const { linkToken } = await createLinkToken(session.user.id);
              setLinkToken(linkToken);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchUser();
  }, []);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Please Sign In
          </h1>
          <p className="text-gray-600">
            You need to be signed in to view this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            Welcome, {user.name}
          </h1>
          <p className="text-gray-600 mt-1">
            {user.access_token
              ? "Your bank account is connected. View your accounts below."
              : "Connect your bank account to get started."}
          </p>
        </div>

        <Suspense fallback={<LoadingSpinner />}>
          {user.access_token ? (
            <div className="space-y-4">
              {/* Add your accounts list component here */}
              <p className="text-gray-700">Your accounts will appear here</p>
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
              <LinkAccountButton linkToken={linkToken} userId={user.id} />
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
