"use client";

import { auth } from "@/auth";
import { useState, useEffect } from "react";
import { User } from "@/app/lib/definitions";
import {
  createLinkToken,
  handleLinkSuccess,
  checkUserAccessToken,
} from "@/app/lib/actions";
// import { fetchUserAccounts } from '@/app/lib/data';
import { Button } from "@/app/ui/button";
import { redirect } from "next/navigation";
import { PlaidLink, usePlaidLink } from "react-plaid-link";

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
      // Handle successful link
      handleLinkSuccess(userId, public_token);
      console.log("Success:", public_token, metadata);
    },
    onExit: (err, metadata) => {
      // Handle exit
      if (err) console.log("Error:", err, metadata);
    },
  });

  return (
    <Button onClick={() => open()} disabled={!ready}>
      Link Bank Account
    </Button>
  );
}

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUser() {
      const session = await auth();
      if (session?.user) {
        // Get link token when user is available
        if (session.user.id) {
          const {access_token} = await checkUserAccessToken(
            session.user.id
          )
          session.user.access_token = access_token;
          setUser(session?.user as User | null);
          if (!user?.access_token) {
            const { linkToken } = await createLinkToken(session.user.id);
            setLinkToken(linkToken);
          }
        }
      }
    }
    fetchUser();
  }, []);

  return (
    <div>
      <p>hello {user?.name}</p>
      {user && user.access_token && <div>Here are your accounts</div>}
      {user && !user.access_token && linkToken && (
        <LinkAccountButton linkToken={linkToken} userId={user.id} />
      )}
    </div>
  );
}
